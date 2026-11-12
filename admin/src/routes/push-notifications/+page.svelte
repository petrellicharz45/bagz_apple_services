<script lang="ts">
  import { httpsCallable } from "firebase/functions";
  import { getFunctions } from "firebase/functions";
  import { app } from "$lib/firebase";

  let title = "";
  let body = "";
  let topic = "new-products";
  let loading = false;
  let message = "";

  async function sendNotification() {
    if (!confirm(`Are you sure you want to send this push notification to all users subscribed to "${topic}"?`)) return;

    loading = true;
    message = "";

    try {
      const functions = getFunctions(app);
      const adminSendPromoNotification = httpsCallable(functions, "adminSendPromoNotification");

      await adminSendPromoNotification({ title, body, topic });

      message = `Success! Sent notification to topic "${topic}"`;
      title = "";
      body = "";
    } catch (e: any) {
      message = "Error: " + e.message;
    } finally {
      loading = false;
    }
  }
</script>

<h1>Push notifications</h1>

<p>Broadcast push notifications to Android app users via Firebase Cloud Messaging.</p>

{#if message}
  <div class="msg" class:error={message.startsWith("Error")}>{message}</div>
{/if}

<form on:submit|preventDefault={sendNotification}>
  <label>
    Target Topic
    <select bind:value={topic}>
      <option value="new-products">New Products (Default)</option>
      <option value="offers">Special Offers</option>
    </select>
  </label>
  <label>
    Title
    <input type="text" bind:value={title} required placeholder="e.g. 50% Off Summer Sale!" />
  </label>
  <label>
    Message Body
    <textarea bind:value={body} required rows="4" placeholder="Type your full promotional message here..."></textarea>
  </label>

  <button class="btn btn-primary" type="submit" disabled={loading}>
    {loading ? "Sending..." : "Broadcast Notification"}
  </button>
</form>

<style>
  form {
    max-width: 500px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  label {
    display: flex;
    flex-direction: column;
    font-weight: 500;
  }
  input,
  select,
  textarea {
    padding: 10px;
    margin-top: 5px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: inherit;
  }
  .msg {
    padding: 12px;
    background: #e0f7fa;
    margin-bottom: 20px;
    border-radius: 4px;
  }
  .msg.error {
    background: #ffebee;
    color: #c62828;
  }

  .btn {
    padding: 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
    color: white;
  }
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-primary {
    background-color: #1673c4;
  }
</style>
