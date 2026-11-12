import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomBytes } from "crypto";
import { assertAdmin } from "./auth/assertAdmin";
import { ADMIN_ROLES, normalizeModules } from "./auth/adminModules";
import { sendInviteEmail } from "./email/sendInviteEmail";

const INVITE_DAYS = 7;

function adminAppUrl(): string {
  return (process.env.ADMIN_APP_URL || "http://localhost:5174").replace(/\/$/, "");
}

function roleLabel(role: string): string {
  return ADMIN_ROLES.find((r) => r.id === role)?.label || role;
}

function inviteLink(token: string): string {
  return `${adminAppUrl()}/invite/${token}`;
}

async function applyStaffClaims(
  uid: string,
  email: string,
  role: string,
  modules: string[]
) {
  const normalized = normalizeModules(modules, role);
  await admin.auth().setCustomUserClaims(uid, {
    admin: true,
    adminRole: role,
    adminModules: normalized
  });
  await admin.firestore().collection("admin").doc(uid).set({
    uid,
    email,
    role,
    modules: normalized,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

export const adminInviteStaff = onCall({ cors: true }, async (request) => {
  assertAdmin(request);
  const { email, role, modules, displayName } = request.data || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new HttpsError("invalid-argument", "Valid email is required.");
  }
  const staffRole = String(role || "custom");
  const staffModules = normalizeModules(modules, staffRole);

  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAt = now + INVITE_DAYS * 24 * 60 * 60 * 1000;

  const ref = admin.firestore().collection("staffInvite").doc();
  await ref.set({
    email: normalizedEmail,
    displayName: displayName?.trim() || "",
    role: staffRole,
    modules: staffModules,
    token,
    status: "pending",
    invitedBy: request.auth?.uid || null,
    createdAt: now,
    expiresAt
  });

  const link = inviteLink(token);
  const emailSent = await sendInviteEmail({
    to: normalizedEmail,
    inviteLink: link,
    roleLabel: roleLabel(staffRole)
  });

  return {
    success: true,
    inviteId: ref.id,
    inviteLink: link,
    emailSent,
    message: emailSent
      ? "Invitation email sent."
      : "Email could not be sent (check SMTP). Copy the invite link below."
  };
});

export const adminListStaffInvites = onCall({ cors: true }, async (request) => {
  assertAdmin(request);
  const snap = await admin.firestore().collection("staffInvite").orderBy("createdAt", "desc").limit(100).get();
  return {
    invites: snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  };
});

export const adminResendStaffInvite = onCall({ cors: true }, async (request) => {
  assertAdmin(request);
  const { inviteId } = request.data || {};
  if (!inviteId) throw new HttpsError("invalid-argument", "inviteId required");

  const ref = admin.firestore().collection("staffInvite").doc(inviteId);
  const doc = await ref.get();
  if (!doc.exists) throw new HttpsError("not-found", "Invite not found");
  const data = doc.data()!;
  if (data.status !== "pending") {
    throw new HttpsError("failed-precondition", "Only pending invites can be resent.");
  }

  const link = inviteLink(data.token);
  const emailSent = await sendInviteEmail({
    to: data.email,
    inviteLink: link,
    roleLabel: roleLabel(data.role)
  });

  return { success: true, inviteLink: link, emailSent };
});

export const adminRevokeStaffInvite = onCall({ cors: true }, async (request) => {
  assertAdmin(request);
  const { inviteId } = request.data || {};
  if (!inviteId) throw new HttpsError("invalid-argument", "inviteId required");
  await admin.firestore().collection("staffInvite").doc(inviteId).update({
    status: "revoked",
    revokedAt: Date.now()
  });
  return { success: true };
});

export const getStaffInviteByToken = onCall({ cors: true }, async (request) => {
  const token = String(request.data?.token || "").trim();
  if (!token) throw new HttpsError("invalid-argument", "token required");

  const snap = await admin
    .firestore()
    .collection("staffInvite")
    .where("token", "==", token)
    .limit(1)
    .get();

  if (snap.empty) throw new HttpsError("not-found", "Invitation not found.");
  const doc = snap.docs[0];
  const data = doc.data();

  if (data.status === "revoked") throw new HttpsError("failed-precondition", "This invitation was revoked.");
  if (data.status === "active") throw new HttpsError("failed-precondition", "This invitation was already used.");
  if (data.expiresAt < Date.now()) throw new HttpsError("failed-precondition", "This invitation has expired.");

  return {
    email: data.email,
    displayName: data.displayName || "",
    role: data.role,
    roleLabel: roleLabel(data.role),
    modules: data.modules || []
  };
});

export const acceptStaffInvite = onCall({ cors: true }, async (request) => {
  const { token, password, firstName, lastName } = request.data || {};
  const tokenStr = String(token || "").trim();
  const pwd = String(password || "");
  if (!tokenStr || pwd.length < 8) {
    throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
  }

  const snap = await admin
    .firestore()
    .collection("staffInvite")
    .where("token", "==", tokenStr)
    .limit(1)
    .get();

  if (snap.empty) throw new HttpsError("not-found", "Invitation not found.");
  const inviteRef = snap.docs[0].ref;
  const invite = snap.docs[0].data();

  if (invite.status !== "pending") {
    throw new HttpsError("failed-precondition", "Invitation is no longer valid.");
  }
  if (invite.expiresAt < Date.now()) {
    throw new HttpsError("failed-precondition", "Invitation has expired.");
  }

  const email = invite.email as string;
  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(userRecord.uid, { password: pwd });
  } catch (e: any) {
    if (e?.code === "auth/user-not-found") {
      userRecord = await admin.auth().createUser({
        email,
        password: pwd,
        emailVerified: true
      });
    } else {
      throw new HttpsError("internal", e?.message || "Could not create user.");
    }
  }

  const fn = String(firstName || invite.displayName || "Staff").trim();
  const ln = String(lastName || "").trim();

  await applyStaffClaims(userRecord.uid, email, invite.role, invite.modules || []);

  await admin.firestore().collection("user").doc(userRecord.uid).set(
    {
      firstName: fn,
      lastName: ln,
      email,
      imagePath: "",
      walletBalance: 0
    },
    { merge: true }
  );

  await inviteRef.update({
    status: "active",
    acceptedAt: Date.now(),
    uid: userRecord.uid
  });

  return { success: true, email };
});

export const adminUpdateStaffAccess = onCall({ cors: true }, async (request) => {
  assertAdmin(request);
  const { uid, role, modules } = request.data || {};
  if (!uid) throw new HttpsError("invalid-argument", "uid required");
  const staffRole = String(role || "custom");
  const staffModules = normalizeModules(modules, staffRole);
  const userRecord = await admin.auth().getUser(uid);
  await applyStaffClaims(userRecord.uid, userRecord.email || "", staffRole, staffModules);
  return { success: true, modules: staffModules };
});
