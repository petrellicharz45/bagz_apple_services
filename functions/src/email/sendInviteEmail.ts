export type InviteEmailPayload = {
  to: string;
  inviteLink: string;
  roleLabel: string;
};

/** Sends invite email when SMTP env vars are set; otherwise returns false. */
export async function sendInviteEmail(payload: InviteEmailPayload): Promise<boolean> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  const port = Number(process.env.SMTP_PORT || "587");

  if (!host || !user || !pass || !from) {
    return false;
  }

  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    await transport.sendMail({
      from,
      to: payload.to,
      subject: "You're invited to Fancy Deals Admin",
      text: `You have been invited as ${payload.roleLabel} on Fancy Deals Admin.\n\nOpen this link to set your password:\n${payload.inviteLink}\n\nThis link expires in 7 days.`,
      html: `<div style="font-family:Inter,sans-serif;max-width:520px">
<p>You have been invited as <strong>${payload.roleLabel}</strong> on <strong>Fancy Deals Admin</strong>.</p>
<p><a href="${payload.inviteLink}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Accept invitation &amp; set password</a></p>
<p style="color:#64748b;font-size:13px">Or copy this link:<br>${payload.inviteLink}</p>
<p style="color:#64748b;font-size:12px">This link expires in 7 days.</p>
</div>`
    });
    return true;
  } catch (e) {
    console.error("sendInviteEmail failed", e);
    return false;
  }
}
