<script lang="ts">
  import { page } from "$app/stores";
  import { onMount, onDestroy } from "svelte";
  import { fetchTicket } from "$lib/data/tickets";
  import { httpsCallable } from "firebase/functions";
  import { getFunctions } from "firebase/functions";
  import { app } from "$lib/firebase";
  import { goto } from "$app/navigation";
  import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
  import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

  const ticketId = $page.params.id;
  const db = getFirestore(app);
  const storage = getStorage(app);

  let ticket: any = null;
  let loading = true;
  let errorMsg = "";
  let processing = false;
  let creditAmount = 0;

  let messages: any[] = [];
  let newMessage = "";
  let unsubscribe: (() => void) | null = null;
  let adminName = "Admin";
  let selectedFile: File | null = null;
  let selectedMediaType = "";
  let uploading = false;

  onMount(async () => {
    try {
      ticket = await fetchTicket(ticketId);
      creditAmount = ticket.walletCreditAmount || 0;

      const userDoc = await getDoc(doc(db, "user", ticket.userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
      }

      const adminUser = await getDoc(doc(db, "admin", "main"));
      if (adminUser.exists()) {
        adminName = adminUser.data()?.name || "Admin";
      }

      const messagesRef = collection(db, "tickets", ticketId, "messages");
      const q = query(messagesRef, orderBy("createdAt", "asc"));
      unsubscribe = onSnapshot(q, (snapshot) => {
        messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      });
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });

  async function sendMessage() {
    if (!newMessage.trim() && !selectedFile) return;
    const text = newMessage.trim();
    newMessage = "";
    uploading = true;

    try {
      let mediaUrl = "";
      let mediaType = "";

      if (selectedFile) {
        mediaType = selectedMediaType;
        const fileName = `chat/${Date.now()}_${selectedFile.name}`;
        const storageRef = ref(storage, `tickets/${ticketId}/${fileName}`);
        await uploadBytes(storageRef, selectedFile);
        mediaUrl = await getDownloadURL(storageRef);
        selectedFile = null;
        selectedMediaType = "";
        const fileInput = document.getElementById('chatFileInput') as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      }

      const messagesRef = collection(db, "tickets", ticketId, "messages");
      await addDoc(messagesRef, {
        senderId: "admin",
        senderName: adminName,
        senderRole: "admin",
        text,
        mediaUrl,
        mediaType,
        createdAt: serverTimestamp()
      });
    } catch (e: any) {
      errorMsg = "Failed to send: " + e.message;
    } finally {
      uploading = false;
    }
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      selectedFile = input.files[0];
      const mimeType = selectedFile.type;
      selectedMediaType = mimeType.startsWith("video/") ? "video" : "image";
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function resolveTicket() {
    if (!confirm(`Resolve this ticket and credit UGX ${creditAmount.toLocaleString()} to the user's wallet?`)) return;
    processing = true;
    errorMsg = "";
    try {
      const functions = getFunctions(app);
      const adminVerifyTicket = httpsCallable(functions, 'adminVerifyTicket');
      await adminVerifyTicket({ ticketId, action: "resolve", creditAmount });
      ticket.status = "Resolved";
      ticket.walletCreditAmount = creditAmount;
      ticket = { ...ticket };
      alert("Ticket resolved and wallet credited successfully!");
    } catch (e: any) {
      errorMsg = "Error: " + e.message;
    } finally {
      processing = false;
    }
  }

  async function rejectTicket() {
    if (!confirm("Reject this ticket? No credit will be issued.")) return;
    processing = true;
    errorMsg = "";
    try {
      const functions = getFunctions(app);
      const adminVerifyTicket = httpsCallable(functions, 'adminVerifyTicket');
      await adminVerifyTicket({ ticketId, action: "reject" });
      ticket.status = "Rejected";
      ticket = { ...ticket };
      alert("Ticket rejected.");
    } catch (e: any) {
      errorMsg = "Error: " + e.message;
    } finally {
      processing = false;
    }
  }

  function formatDate(timestamp: any) {
    if (!timestamp?.seconds) return "N/A";
    return new Date(timestamp.seconds * 1000).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "Open": return "#1673c4";
      case "Under Review": return "#0d6efd";
      case "Resolved": return "#198754";
      case "Rejected": return "#dc3545";
      case "Closed": return "#6c757d";
      default: return "#6c757d";
    }
  }

  $: isClosed = ticket?.status === "Resolved" || ticket?.status === "Rejected" || ticket?.status === "Closed";
</script>

<h1>Ticket Review</h1>

{#if loading}
  <p>Loading...</p>
{:else if errorMsg && !ticket}
  <div style="color: red">{errorMsg}</div>
{:else if ticket}
  {#if errorMsg}
    <div style="color: red; margin-bottom: 10px;">{errorMsg}</div>
  {/if}

  <div class="ticket-grid">
    <div class="card">
      <h3>Ticket Info</h3>
      <p><strong>Issue Type:</strong> {ticket.issueType}</p>
      <p><strong>Status:</strong>
        <span class="status-badge" style="background-color: {getStatusColor(ticket.status)}">
          {ticket.status}
        </span>
      </p>
      <p><strong>Order #:</strong> #{ticket.orderNumber}</p>
      <p><strong>User ID:</strong> <span class="mono">{ticket.userId}</span></p>
      <p><strong>Created:</strong> {formatDate(ticket.createdAt)}</p>
      <p><strong>Updated:</strong> {formatDate(ticket.updatedAt)}</p>
    </div>

    <div class="card">
      <h3>Description</h3>
      <p class="description">{ticket.description}</p>
    </div>

    {#if ticket.mediaUrls && ticket.mediaUrls.length > 0}
      <div class="card full-width">
        <h3>Evidence ({ticket.mediaUrls.length} files)</h3>
        <div class="media-grid">
          {#each ticket.mediaUrls as url}
            <a href={url} target="_blank" rel="noopener noreferrer">
              {#if url.includes('video')}
                <video src={url} controls class="media-thumb"></video>
              {:else}
                <img src={url} alt="Evidence" class="media-thumb" />
              {/if}
            </a>
          {/each}
        </div>
      </div>
    {/if}

    {#if ticket.status === "Open" || ticket.status === "Under Review"}
      <div class="card full-width">
        <h3>Actions</h3>
        <div class="action-row">
          <div class="credit-input">
            <label>
              Wallet Credit Amount (UGX)
              <input type="number" bind:value={creditAmount} min="0" step="1000" />
            </label>
          </div>
          <div class="action-buttons">
            <button class="btn btn-success" on:click={resolveTicket} disabled={processing}>
              {processing ? 'Processing...' : 'Resolve & Credit'}
            </button>
            <button class="btn btn-danger" on:click={rejectTicket} disabled={processing}>
              {processing ? 'Processing...' : 'Reject'}
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if ticket.status === "Resolved"}
      <div class="card full-width resolved-banner">
        <h3>Resolved</h3>
        <p>Credited <strong>UGX {ticket.walletCreditAmount?.toLocaleString()}</strong> to user's wallet.</p>
      </div>
    {/if}

    <div class="card full-width">
      <h3>Live Chat</h3>
      <div class="chat-container">
        {#if messages.length === 0}
          <p class="chat-empty">No messages yet. Start the conversation below.</p>
        {:else}
          <div class="chat-messages">
            {#each messages as msg}
              <div class="chat-bubble {msg.senderRole === 'admin' ? 'chat-admin' : 'chat-user'}">
                <span class="chat-sender">{msg.senderName}</span>
                {#if msg.mediaUrl}
                  {#if msg.mediaType === 'image'}
                    <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
                      <img src={msg.mediaUrl} alt="Shared image" class="chat-media" />
                    </a>
                  {:else if msg.mediaType === 'video'}
                    <video src={msg.mediaUrl} controls class="chat-media"></video>
                  {/if}
                {/if}
                {#if msg.text}
                  <p class="chat-text">{msg.text}</p>
                {/if}
                <span class="chat-time">{msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
              </div>
            {/each}
          </div>
        {/if}

        {#if !isClosed}
          {#if selectedFile}
            <div class="media-preview">
              {#if selectedMediaType === 'image'}
                <img src={URL.createObjectURL(selectedFile)} alt="Preview" class="preview-thumb" />
              {:else}
                <video src={URL.createObjectURL(selectedFile)} controls class="preview-thumb"></video>
              {/if}
              <button class="btn-remove-media" on:click={() => { selectedFile = null; selectedMediaType = ""; }}>✕</button>
            </div>
          {/if}
          <div class="chat-input-row">
            <label class="btn-attach" for="chatFileInput">📎</label>
            <input type="file" id="chatFileInput" accept="image/*,video/*" on:change={handleFileSelect} style="display:none" />
            <input
              type="text"
              bind:value={newMessage}
              on:keydown={handleKeydown}
              placeholder="Type a message..."
              class="chat-input"
            />
            <button class="btn btn-send" on:click={sendMessage} disabled={uploading || (!newMessage.trim() && !selectedFile)}>
              {uploading ? 'Sending...' : 'Send'}
            </button>
          </div>
        {:else}
          <p class="chat-closed">This ticket is closed. Chat is no longer active.</p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .ticket-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .card {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    padding: 20px;
    border-radius: 8px;
  }
  .full-width { grid-column: 1 / -1; }
  h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #135fa3;
  }
  p { margin: 5px 0; }
  .mono { font-family: monospace; font-size: 12px; word-break: break-all; }
  .description { white-space: pre-wrap; line-height: 1.6; }
  .status-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    color: white;
    font-size: 12px;
    font-weight: 500;
  }
  .media-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
    margin-top: 10px;
  }
  .media-thumb {
    width: 100%;
    height: 150px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid #dee2e6;
  }
  .action-row {
    display: flex;
    gap: 20px;
    align-items: flex-end;
    flex-wrap: wrap;
  }
  .credit-input label {
    display: block;
    font-weight: 500;
    margin-bottom: 5px;
  }
  .credit-input input {
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    width: 200px;
  }
  .action-buttons {
    display: flex;
    gap: 10px;
  }
  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: white;
    font-weight: 500;
  }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-success { background-color: #198754; }
  .btn-danger { background-color: #dc3545; }
  .resolved-banner {
    background-color: #d1e7dd;
    border-color: #badbcc;
  }
  .resolved-banner h3 { color: #198754; }
  .chat-container { margin-top: 10px; }
  .chat-empty { color: #888; font-size: 13px; }
  .chat-messages {
    max-height: 300px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #e9ecef;
    margin-bottom: 10px;
  }
  .chat-bubble {
    max-width: 70%;
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 13px;
  }
  .chat-user {
    align-self: flex-start;
    background: #e9ecef;
    border-bottom-left-radius: 4px;
  }
  .chat-admin {
    align-self: flex-end;
    background: #1673c4;
    color: white;
    border-bottom-right-radius: 4px;
  }
  .chat-admin .chat-sender,
  .chat-admin .chat-time { color: rgba(255,255,255,0.8); }
  .chat-sender {
    display: block;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 2px;
    color: #888;
  }
  .chat-text {
    margin: 0;
    line-height: 1.4;
    white-space: pre-wrap;
  }
  .chat-time {
    display: block;
    font-size: 10px;
    margin-top: 4px;
    color: #aaa;
  }
  .chat-media {
    max-width: 200px;
    max-height: 200px;
    border-radius: 8px;
    margin-bottom: 4px;
    display: block;
  }
  .chat-input-row {
    display: flex;
    gap: 8px;
  }
  .chat-input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 14px;
  }
  .btn-send {
    padding: 10px 20px;
    background: #1673c4;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }
  .btn-send:disabled { opacity: 0.5; cursor: not-allowed; }
  .chat-closed { color: #888; font-size: 13px; font-style: italic; margin-top: 10px; }
  .media-preview { position: relative; display: inline-block; margin-bottom: 8px; }
  .preview-thumb { width: 150px; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #dee2e6; }
  .btn-remove-media {
    position: absolute; top: 4px; right: 4px;
    background: #dc3545; color: white; border: none; border-radius: 50%;
    width: 24px; height: 24px; cursor: pointer; font-size: 12px;
    display: flex; align-items: center; justify-content: center;
  }
  .btn-attach {
    background: #f8f9fa; border: 1px solid #ccc; border-radius: 6px;
    padding: 8px 12px; cursor: pointer; font-size: 16px;
  }
</style>
