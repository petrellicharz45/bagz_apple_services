<script lang="ts">
  import { to } from "$lib/paths";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
  import {
    EmailAuthProvider,
    reauthenticateWithCredential,
    updateEmail,
    updatePassword,
    updateProfile
  } from "firebase/auth";
  import { db, auth } from "$lib/firebase";
  import { userStore } from "$lib/stores/auth";
  import { uploadProductImage } from "$lib/images/cloudinaryUpload";
  import { fileToCardJpeg } from "$lib/images/productImage";
  import { showSuccessToast } from "$lib/stores/toast";

  type SettingsTab = "store" | "display" | "account" | "password";
  let tab: SettingsTab = "store";

  let whatsappNumber = "";
  let supportEmail = "";
  let callNumber = "";

  let activeProvider: "mtn" | "airtel" = "mtn";

  let mtnApiUser = "";
  let mtnApiKey = "";
  let mtnSubscriptionKey = "";
  let mtnEnvironment: "sandbox" | "production" = "sandbox";

  let airtelClientId = "";
  let airtelClientSecret = "";
  let airtelEnvironment: "sandbox" | "production" = "sandbox";

  let loading = true;
  let saving = false;
  let successMsg = "";
  let errorMsg = "";

  let currentPassword = "";
  let newPassword = "";
  let confirmPassword = "";
  let passwordSaving = false;
  let passwordSuccess = "";
  let passwordError = "";
  let showCurrent = false;
  let showNew = false;

  let profilePhotoURL = "";
  let photoUploading = false;
  let photoSuccess = "";
  let photoError = "";

  let loginEmail = "";
  let newEmail = "";
  let emailCurrentPassword = "";
  let emailSaving = false;
  let emailSuccess = "";
  let emailError = "";

  let shopLogoUrl = "";
  let shopFaviconUrl = "";
  let displayLoading = true;
  let logoUploading = false;
  let faviconUploading = false;
  let displaySaving = false;
  let displaySuccess = "";
  let displayError = "";

  function syncUserFromAuth() {
    const u = auth?.currentUser;
    if (!u) return;
    userStore.set({ uid: u.uid, email: u.email, photoURL: u.photoURL });
    loginEmail = u.email || "";
    profilePhotoURL = u.photoURL || "";
  }

  onMount(async () => {
    const t = $page.url.searchParams.get("tab");
    if (t === "account" || t === "password" || t === "store" || t === "display") tab = t;
    syncUserFromAuth();
    try {
      // 1. Fetch general config (WhatsApp number)
      const configDoc = await getDoc(doc(db, "settings", "config"));
      if (configDoc.exists()) {
        whatsappNumber = configDoc.data().whatsappNumber || "";
        supportEmail = configDoc.data().supportEmail || "";
        callNumber = configDoc.data().callNumber || "";
      }

      // 2. Fetch payment config
      const paymentDoc = await getDoc(doc(db, "settings", "payment_config"));
      if (paymentDoc.exists()) {
        const data = paymentDoc.data();
        activeProvider = data.activeProvider === "airtel" ? "airtel" : "mtn";
        if (data.mtn) {
          mtnApiUser = data.mtn.apiUser || "";
          mtnApiKey = data.mtn.apiKey || "";
          mtnSubscriptionKey = data.mtn.subscriptionKey || "";
          mtnEnvironment = data.mtn.environment === "production" ? "production" : "sandbox";
        }
        if (data.airtel) {
          airtelClientId = data.airtel.clientId || "";
          airtelClientSecret = data.airtel.clientSecret || "";
          airtelEnvironment = data.airtel.environment === "production" ? "production" : "sandbox";
        }
      }

      const displayDoc = await getDoc(doc(db, "settings", "display"));
      if (displayDoc.exists()) {
        const d = displayDoc.data();
        shopLogoUrl = d.shopLogoUrl || "";
        shopFaviconUrl = d.shopFaviconUrl || "";
      }
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      loading = false;
      displayLoading = false;
    }
  });

  async function persistDisplaySettings() {
    await setDoc(
      doc(db, "settings", "display"),
      {
        shopLogoUrl: shopLogoUrl.trim(),
        shopFaviconUrl: shopFaviconUrl.trim(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  async function onShopLogoSelected(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    logoUploading = true;
    displaySuccess = "";
    displayError = "";
    try {
      const blob = file.type === "image/png" ? file : await fileToCardJpeg(file);
      const ext = file.type === "image/png" ? "png" : "jpg";
      const id = `shop_logo_${Date.now()}`;
      shopLogoUrl = await uploadProductImage(blob, id, "shop/branding", `${id}.${ext}`);
      await persistDisplaySettings();
      showSuccessToast("Success — shop logo updated.");
    } catch (err: any) {
      displayError = err.message || "Failed to upload logo.";
    } finally {
      logoUploading = false;
      input.value = "";
    }
  }

  async function onShopFaviconSelected(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    faviconUploading = true;
    displaySuccess = "";
    displayError = "";
    try {
      const blob = file.type === "image/png" ? file : await fileToCardJpeg(file);
      const ext = file.type === "image/png" ? "png" : "jpg";
      const id = `shop_favicon_${Date.now()}`;
      shopFaviconUrl = await uploadProductImage(blob, id, "shop/branding", `${id}.${ext}`);
      await persistDisplaySettings();
      showSuccessToast("Success — favicon updated.");
    } catch (err: any) {
      displayError = err.message || "Failed to upload favicon.";
    } finally {
      faviconUploading = false;
      input.value = "";
    }
  }

  async function clearShopLogo() {
    displaySaving = true;
    displayError = "";
    try {
      shopLogoUrl = "";
      await persistDisplaySettings();
      displaySuccess = "Logo reset — shop uses the default Bagz logo.";
    } catch (err: any) {
      displayError = err.message || "Failed to reset logo.";
    } finally {
      displaySaving = false;
    }
  }

  async function clearShopFavicon() {
    displaySaving = true;
    displayError = "";
    try {
      shopFaviconUrl = "";
      await persistDisplaySettings();
      displaySuccess = "Favicon reset — shop uses the default icon.";
    } catch (err: any) {
      displayError = err.message || "Failed to reset favicon.";
    } finally {
      displaySaving = false;
    }
  }

  async function handleSave() {
    saving = true;
    successMsg = "";
    errorMsg = "";

    try {
      const cleanedPhone = whatsappNumber.replace(/[^0-9]/g, "");
      if (cleanedPhone && cleanedPhone.length < 9) {
        throw new Error("WhatsApp number must be at least 9 digits");
      }

      // 1. Save general config
      await setDoc(
        doc(db, "settings", "config"),
        {
          whatsappNumber: cleanedPhone,
          supportEmail: supportEmail.trim(),
          callNumber: callNumber.trim()
        },
        { merge: true }
      );
      whatsappNumber = cleanedPhone;

      // 2. Save secure payment credentials
      const paymentConfigData = {
        activeProvider,
        mtn: {
          apiUser: mtnApiUser.trim(),
          apiKey: mtnApiKey.trim(),
          subscriptionKey: mtnSubscriptionKey.trim(),
          environment: mtnEnvironment
        },
        airtel: {
          clientId: airtelClientId.trim(),
          clientSecret: airtelClientSecret.trim(),
          environment: airtelEnvironment
        },
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "settings", "payment_config"), paymentConfigData, { merge: true });

      // 3. Save public payment status indicator
      await setDoc(
        doc(db, "settings", "payment"),
        {
          activeProvider,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      successMsg = `Settings saved. Default network: ${
        activeProvider === "airtel" ? "Airtel Money" : "MTN Mobile Money"
      }. Customers still choose MTN or Airtel at checkout.`;
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      saving = false;
    }
  }

  async function handleChangePassword() {
    passwordSaving = true;
    passwordSuccess = "";
    passwordError = "";
    try {
      if (!auth?.currentUser?.email) {
        throw new Error("You must be signed in to change your password.");
      }
      if (newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("New password and confirmation do not match.");
      }
      if (currentPassword === newPassword) {
        throw new Error("New password must be different from the current password.");
      }

      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);

      currentPassword = "";
      newPassword = "";
      confirmPassword = "";
      passwordSuccess = "Password updated. Use the new password the next time you log in.";
    } catch (e: any) {
      const code = e?.code || "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
        passwordError = "Current password is incorrect.";
      } else if (code === "auth/weak-password") {
        passwordError = "New password is too weak. Use at least 6 characters.";
      } else if (code === "auth/requires-recent-login") {
        passwordError = "For security, please log out, log in again, then change your password.";
      } else {
        passwordError = e.message || "Failed to change password.";
      }
    } finally {
      passwordSaving = false;
    }
  }

  async function onProfilePhotoSelected(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !auth?.currentUser) return;
    photoUploading = true;
    photoSuccess = "";
    photoError = "";
    try {
      const jpeg = await fileToCardJpeg(file);
      const id = `admin_${auth.currentUser.uid}_${Date.now()}`;
      const url = await uploadProductImage(jpeg, id, "admin/avatars");
      await updateProfile(auth.currentUser, { photoURL: url });
      await setDoc(
        doc(db, "admin", auth.currentUser.uid),
        { photoURL: url, updatedAt: serverTimestamp() },
        { merge: true }
      );
      await auth.currentUser.reload();
      syncUserFromAuth();
      photoSuccess = "";
      showSuccessToast("Success — profile photo updated.");
    } catch (err: any) {
      photoError = err.message || "Failed to upload photo.";
    } finally {
      photoUploading = false;
      input.value = "";
    }
  }

  async function handleChangeEmail() {
    emailSaving = true;
    emailSuccess = "";
    emailError = "";
    try {
      const user = auth?.currentUser;
      if (!user?.email) throw new Error("You must be signed in.");
      const next = newEmail.trim().toLowerCase();
      if (!next || !next.includes("@")) throw new Error("Enter a valid email address.");
      if (next === user.email) throw new Error("That is already your login email.");
      if (!emailCurrentPassword) throw new Error("Enter your current password to confirm.");

      const credential = EmailAuthProvider.credential(user.email, emailCurrentPassword);
      await reauthenticateWithCredential(user, credential);
      await updateEmail(user, next);
      await setDoc(
        doc(db, "admin", user.uid),
        { email: next, updatedAt: serverTimestamp() },
        { merge: true }
      );
      await user.reload();
      syncUserFromAuth();
      newEmail = "";
      emailCurrentPassword = "";
      emailSuccess = "Success — login email updated.";
    } catch (e: any) {
      const code = e?.code || "";
      if (code === "auth/email-already-in-use") {
        emailError = "That email is already used by another account.";
      } else if (code === "auth/invalid-email") {
        emailError = "Invalid email address.";
      } else if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential" ||
        code === "auth/invalid-login-credentials"
      ) {
        emailError = "Current password is incorrect.";
      } else if (code === "auth/requires-recent-login") {
        emailError = "For security, log out, sign in again, then change your email.";
      } else {
        emailError = e.message || "Failed to change email.";
      }
    } finally {
      emailSaving = false;
    }
  }
</script>

<div class="page">
  <header>
    <a href={to("/")} class="back-link"><i class="fa fa-arrow-left" aria-hidden="true"></i> Back to Dashboard</a>
    <h1>Settings</h1>
  </header>

  <div class="tabs" role="tablist">
    <button type="button" class:active={tab === "account"} on:click={() => (tab = "account")}>My account</button>
    <button type="button" class:active={tab === "password"} on:click={() => (tab = "password")}>Password</button>
    <button type="button" class:active={tab === "store"} on:click={() => (tab = "store")}>Store</button>
    <button type="button" class:active={tab === "display"} on:click={() => (tab = "display")}>Display</button>
  </div>

  {#if loading && tab === "store"}
    <p>Loading settings...</p>
  {:else if tab === "display"}
    {#if displaySuccess}
      <div class="success">{displaySuccess}</div>
    {/if}
    {#if displayError}
      <div class="error">{displayError}</div>
    {/if}

    {#if displayLoading}
      <p>Loading display settings…</p>
    {:else}
      <section class="section-card">
        <h2>System display settings</h2>
        <p class="section-desc">
          Logo and favicon appear on your public shop (header, browser tab, and installed app icon). Changes apply
          after customers refresh the shop.
        </p>

        <div class="form-group">
          <label for="shopLogoFile">Shop logo</label>
          <div class="branding-row">
            <div class="branding-preview logo-preview">
              {#if shopLogoUrl}
                <img src={shopLogoUrl} alt="Current shop logo preview" />
              {:else}
                <span class="branding-placeholder">Default logo</span>
              {/if}
            </div>
            <div class="branding-actions">
              <label class="photo-upload-btn">
                <input
                  id="shopLogoFile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  on:change={onShopLogoSelected}
                  disabled={logoUploading || displaySaving}
                />
                {logoUploading ? "Uploading…" : "Upload logo"}
              </label>
              {#if shopLogoUrl}
                <button type="button" class="text-btn" disabled={displaySaving} on:click={clearShopLogo}>
                  Use default logo
                </button>
              {/if}
            </div>
          </div>
          <input
            type="text"
            class="hint-field"
            readonly
            tabindex="-1"
            value=""
            placeholder="Recommended: PNG with transparent background, about 400 × 96 px (wide header logo)"
          />
        </div>

        <div class="form-group">
          <label for="shopFaviconFile">Favicon &amp; app icon</label>
          <div class="branding-row">
            <div class="branding-preview favicon-preview">
              {#if shopFaviconUrl}
                <img src={shopFaviconUrl} alt="Current favicon preview" />
              {:else}
                <span class="branding-placeholder">Default icon</span>
              {/if}
            </div>
            <div class="branding-actions">
              <label class="photo-upload-btn">
                <input
                  id="shopFaviconFile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  on:change={onShopFaviconSelected}
                  disabled={faviconUploading || displaySaving}
                />
                {faviconUploading ? "Uploading…" : "Upload favicon"}
              </label>
              {#if shopFaviconUrl}
                <button type="button" class="text-btn" disabled={displaySaving} on:click={clearShopFavicon}>
                  Use default icon
                </button>
              {/if}
            </div>
          </div>
          <input
            type="text"
            class="hint-field"
            readonly
            tabindex="-1"
            value=""
            placeholder="Recommended: square PNG, 192 × 192 px (512 × 512 px for sharpest install icon)"
          />
        </div>
      </section>
    {/if}
  {:else if tab === "account"}
    {#if photoSuccess}
      <div class="success">{photoSuccess}</div>
    {/if}
    {#if photoError}
      <div class="error">{photoError}</div>
    {/if}
    {#if emailSuccess}
      <div class="success">{emailSuccess}</div>
    {/if}
    {#if emailError}
      <div class="error">{emailError}</div>
    {/if}

    <section class="section-card account-card">
      <h2>Profile photo</h2>
      <p class="section-desc">Shown in the top bar when you are logged in.</p>
      <div class="profile-row">
        {#if profilePhotoURL}
          <img class="profile-avatar" src={profilePhotoURL} alt="" />
        {:else}
          <div class="profile-avatar placeholder">{(loginEmail || "A").slice(0, 1).toUpperCase()}</div>
        {/if}
        <label class="photo-upload-btn">
          <input type="file" accept="image/*" on:change={onProfilePhotoSelected} disabled={photoUploading} />
          {photoUploading ? "Uploading…" : "Change photo"}
        </label>
      </div>
    </section>

    <form class="account-form" on:submit|preventDefault={handleChangeEmail}>
      <section class="section-card">
        <h2>Login email</h2>
        <p class="section-desc">Current: <strong>{loginEmail || "—"}</strong></p>
        <div class="form-group">
          <label for="newEmail">New email address</label>
          <input id="newEmail" type="email" bind:value={newEmail} required autocomplete="email" />
        </div>
        <div class="form-group">
          <label for="emailCurrentPassword">Current password (required)</label>
          <input
            id="emailCurrentPassword"
            type="password"
            bind:value={emailCurrentPassword}
            required
            autocomplete="current-password"
          />
        </div>
        <button type="submit" class="save-btn" disabled={emailSaving}>
          {emailSaving ? "Updating…" : "Update login email"}
        </button>
      </section>
    </form>

    <p class="account-hint">
      To change your password, open the
      <button type="button" class="linkish" on:click={() => (tab = "password")}>Password</button> tab.
    </p>
  {:else if tab === "password"}
    {#if passwordSuccess}
      <div class="success">{passwordSuccess}</div>
    {/if}
    {#if passwordError}
      <div class="error">{passwordError}</div>
    {/if}

    <form class="password-form" on:submit|preventDefault={handleChangePassword}>
      <section class="section-card">
        <h2>Change Password</h2>
        <p class="section-desc">Re-enter your current password, then set a new one for this admin account.</p>

        <div class="form-group">
          <label for="currentPassword">Current password</label>
          <div class="password-field">
            {#if showCurrent}
              <input
                id="currentPassword"
                type="text"
                bind:value={currentPassword}
                required
                autocomplete="current-password"
              />
            {:else}
              <input
                id="currentPassword"
                type="password"
                bind:value={currentPassword}
                required
                autocomplete="current-password"
              />
            {/if}
            <button type="button" class="eye" on:click={() => (showCurrent = !showCurrent)}>{showCurrent ? "Hide" : "Show"}</button>
          </div>
        </div>

        <div class="form-group">
          <label for="newPassword">New password</label>
          <div class="password-field">
            {#if showNew}
              <input
                id="newPassword"
                type="text"
                bind:value={newPassword}
                required
                minlength="6"
                autocomplete="new-password"
              />
            {:else}
              <input
                id="newPassword"
                type="password"
                bind:value={newPassword}
                required
                minlength="6"
                autocomplete="new-password"
              />
            {/if}
            <button type="button" class="eye" on:click={() => (showNew = !showNew)}>{showNew ? "Hide" : "Show"}</button>
          </div>
          <small>At least 6 characters.</small>
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirm new password</label>
          <input
            id="confirmPassword"
            type="password"
            bind:value={confirmPassword}
            required
            minlength="6"
            autocomplete="new-password"
          />
        </div>
      </section>

      <div class="submit-bar">
        <button type="submit" class="save-btn" disabled={passwordSaving}>
          {passwordSaving ? "Updating..." : "Update Password"}
        </button>
      </div>
    </form>
  {:else}
    {#if successMsg}
      <div class="success">{successMsg}</div>
    {/if}
    {#if errorMsg}
      <div class="error">{errorMsg}</div>
    {/if}

    <form on:submit|preventDefault={handleSave}>
      <section class="section-card">
        <div class="section-header">
          <h2><i class="fa fa-credit-card" aria-hidden="true"></i> Mobile Money (MTN / Airtel)</h2>
          <span class="active-badge {activeProvider}">
            Default: {activeProvider === 'airtel' ? 'Airtel Money' : 'MTN Mobile Money'}
          </span>
        </div>
        <p class="section-desc">
          Customers choose MTN or Airtel at checkout. Paste API credentials here when you receive them.
        </p>

        <div class="provider-selector">
          <button
            type="button"
            class="provider-option {activeProvider === 'mtn' ? 'selected' : ''}"
            on:click={() => (activeProvider = 'mtn')}
          >
            <div class="provider-radio">
              <span class="dot {activeProvider === 'mtn' ? 'active' : ''}"></span>
            </div>
            <div class="provider-info">
              <span class="provider-title">MTN Mobile Money</span>
              <span class="provider-tag">Direct MTN API</span>
            </div>
          </button>

          <button
            type="button"
            class="provider-option {activeProvider === 'airtel' ? 'selected' : ''}"
            on:click={() => (activeProvider = 'airtel')}
          >
            <div class="provider-radio">
              <span class="dot {activeProvider === 'airtel' ? 'active' : ''}"></span>
            </div>
            <div class="provider-info">
              <span class="provider-title">Airtel Money</span>
              <span class="provider-tag">Direct Airtel API</span>
            </div>
          </button>
        </div>

        <div class="credentials-box {activeProvider === 'mtn' ? 'highlight' : ''}">
          <h3>MTN Mobile Money credentials</h3>
          <div class="form-group">
            <label for="mtnEnv">Environment</label>
            <select id="mtnEnv" bind:value={mtnEnvironment}>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div class="form-group">
            <label for="mtnApiUser">API User</label>
            <input id="mtnApiUser" type="text" bind:value={mtnApiUser} placeholder="MTN API user" />
          </div>
          <div class="form-group">
            <label for="mtnApiKey">API Key</label>
            <input id="mtnApiKey" type="password" bind:value={mtnApiKey} placeholder="MTN API key" />
          </div>
          <div class="form-group">
            <label for="mtnSubKey">Subscription Key</label>
            <input id="mtnSubKey" type="password" bind:value={mtnSubscriptionKey} placeholder="Ocp-Apim-Subscription-Key" />
          </div>
        </div>

        <div class="credentials-box {activeProvider === 'airtel' ? 'highlight' : ''}">
          <h3>Airtel Money credentials</h3>
          <div class="form-group">
            <label for="airtelEnv">Environment</label>
            <select id="airtelEnv" bind:value={airtelEnvironment}>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div class="form-group">
            <label for="airtelClientId">Client ID</label>
            <input id="airtelClientId" type="text" bind:value={airtelClientId} placeholder="Airtel client id" />
          </div>
          <div class="form-group">
            <label for="airtelClientSecret">Client Secret</label>
            <input id="airtelClientSecret" type="password" bind:value={airtelClientSecret} placeholder="Airtel client secret" />
          </div>
        </div>
      </section>

      <!-- SECTION: GENERAL SETTINGS -->
      <section class="section-card">
        <h2><i class="fa fa-comments-o" aria-hidden="true"></i> Customer Support</h2>
        <div class="form-group">
          <label for="whatsapp">WhatsApp Support Number</label>
          <input
            id="whatsapp"
            type="text"
            bind:value={whatsappNumber}
            placeholder="256703055006"
          />
          <small>Include country code without plus sign (e.g. 256703055006). Shown on the shop. Leave empty to hide WhatsApp.</small>
        </div>
        <div class="form-group">
          <label for="supportEmail">Support email</label>
          <input id="supportEmail" type="email" bind:value={supportEmail} placeholder="info@bagzappleservices.com" />
          <small>Shown on the shop You page. Leave empty to keep the current shop email.</small>
        </div>
        <div class="form-group">
          <label for="callNumber">Calling number</label>
          <input id="callNumber" type="text" bind:value={callNumber} placeholder="+256…" />
          <small>Different from WhatsApp. Leave empty to hide the Call button.</small>
        </div>
      </section>

      <section class="section-card">
        <h2><i class="fa fa-share-alt" aria-hidden="true"></i> Social media</h2>
        <p class="section-help">
          Social links have their own page where you can add, edit, hide, reorder and delete them.
        </p>
        <a class="social-page-link" href={to("/social-links")}>Manage social links <i class="fa fa-arrow-right" aria-hidden="true"></i></a>
      </section>

      <div class="submit-bar">
        <button type="submit" class="save-btn" disabled={saving}>
          {saving ? "Saving Changes..." : "Save All Settings"}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .page {
    max-width: 760px;
    margin: 0 auto;
    padding: 24px 20px 60px;
    font-family: system-ui, -apple-system, sans-serif;
    color: #1f2937;
  }

  header {
    margin-bottom: 16px;
  }

  .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    background: #fff;
    padding: 6px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    width: fit-content;
  }

  .tabs button {
    border: 0;
    background: transparent;
    padding: 10px 16px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    color: #6b7280;
  }

  .tabs button.active {
    background: #eef7fc;
    color: #135fa3;
  }

  .account-form {
    margin-top: 16px;
  }
  .account-hint {
    margin-top: 16px;
    font-size: 14px;
    color: #64748b;
  }
  .linkish {
    border: 0;
    background: none;
    padding: 0;
    color: #135fa3;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  }
  .profile-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .profile-avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #e6edf5;
  }
  .profile-avatar.placeholder {
    display: grid;
    place-items: center;
    background: #1673c4;
    color: #fff;
    font-size: 28px;
    font-weight: 700;
  }
  .photo-upload-btn {
    display: inline-flex;
    align-items: center;
    padding: 10px 16px;
    border: 1px solid #9fd6f0;
    border-radius: 8px;
    font-weight: 600;
    color: #13344f;
    cursor: pointer;
    background: #fff;
  }
  .photo-upload-btn input {
    display: none;
  }

  .branding-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    margin-bottom: 8px;
  }

  .branding-preview {
    display: grid;
    place-items: center;
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
    overflow: hidden;
  }

  .logo-preview {
    width: min(100%, 280px);
    min-height: 72px;
    padding: 12px;
    background: linear-gradient(180deg, #2ba8e0 0%, #135fa3 100%);
  }

  .logo-preview img {
    max-width: 100%;
    max-height: 56px;
    object-fit: contain;
  }

  .favicon-preview {
    width: 72px;
    height: 72px;
    background: #0a0a0a;
  }

  .favicon-preview img {
    width: 56px;
    height: 56px;
    object-fit: contain;
  }

  .branding-placeholder {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 600;
  }

  .branding-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .hint-field {
    width: 100%;
    margin-top: 4px;
    border: 1px dashed #e2e8f0;
    background: #f8fafc;
    color: #64748b;
    font-size: 13px;
    cursor: default;
  }

  .hint-field::placeholder {
    color: #64748b;
    opacity: 1;
  }

  .text-btn {
    border: 0;
    background: none;
    padding: 0;
    color: #64748b;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  }

  .text-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .password-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .password-field {
    display: flex;
    gap: 8px;
  }

  .password-field input {
    flex: 1;
  }

  .eye {
    border: 1px solid #d1d5db;
    background: #fff;
    border-radius: 6px;
    padding: 0 12px;
    cursor: pointer;
    font-size: 13px;
    color: #4b5563;
  }

  .back-link {
    color: #1673c4;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
  }

  h1 {
    margin-top: 8px;
    margin-bottom: 0;
    font-size: 28px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .section-header h2,
  .section-card h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .section-desc {
    font-size: 14px;
    color: #6b7280;
    margin-top: 4px;
    margin-bottom: 16px;
  }

  .active-badge {
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .active-badge.nylonpay {
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
  }

  .active-badge.pesapal {
    background: #eff6ff;
    color: #2563eb;
    border: 1px solid #bfdbfe;
  }

  .provider-selector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }

  @media (max-width: 600px) {
    .provider-selector {
      grid-template-columns: 1fr;
    }
  }

  .provider-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    background: #fafafa;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
  }

  .provider-option:hover {
    border-color: #9fd6f0;
    background: #fffaf0;
  }

  .provider-option.selected {
    border-color: #1673c4;
    background: #eef7fc;
  }

  .provider-radio {
    margin-top: 2px;
  }

  .dot {
    display: block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid #d1d5db;
    background: #ffffff;
  }

  .dot.active {
    border-color: #1673c4;
    background: #1673c4;
    box-shadow: inset 0 0 0 3px #ffffff;
  }

  .provider-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .provider-title {
    font-weight: 700;
    font-size: 15px;
    color: #111827;
  }

  .provider-tag {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    color: #1673c4;
    text-transform: uppercase;
  }

  .provider-details {
    font-size: 12px;
    color: #4b5563;
    line-height: 1.4;
  }

  .credentials-box {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .credentials-box.highlight {
    border-color: #cbe8f7;
    background: #fffaf5;
  }

  .credentials-box h3 {
    margin-top: 0;
    margin-bottom: 12px;
    font-size: 15px;
    font-weight: 600;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  label {
    font-weight: 600;
    font-size: 13px;
    color: #374151;
  }

  input,
  select {
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    background: #ffffff;
    font-family: inherit;
  }

  input:focus,
  select:focus {
    outline: none;
    border-color: #1673c4;
    box-shadow: 0 0 0 2px rgba(22, 115, 196, 0.2);
  }

  small {
    color: #6b7280;
    font-size: 12px;
  }

  .social-page-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #1673c4;
    font-weight: 600;
    text-decoration: none;
  }

  .section-help {
    margin: -4px 0 14px;
    color: #6b7280;
    font-size: 13px;
  }

  .submit-bar {
    display: flex;
    justify-content: flex-end;
  }

  .save-btn {
    padding: 12px 24px;
    background: #1673c4;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .save-btn:hover:not(:disabled) {
    background: #135fa3;
  }

  .save-btn:disabled {
    background: #d1d5db;
    cursor: not-allowed;
  }

  .success {
    background: #ecfdf5;
    color: #065f46;
    border: 1px solid #a7f3d0;
    padding: 12px 16px;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 14px;
  }

  .error {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
    padding: 12px 16px;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 14px;
  }
</style>
