<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { fetchOrder, deleteOrder } from "$lib/data/orders";
  import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
  import { db } from "$lib/firebase";
  import { httpsCallable } from "firebase/functions";
  import { getFunctions } from "firebase/functions";
  import { app } from "$lib/firebase";
  import { goto } from "$app/navigation";
  import { logAdminAudit } from "$lib/data/auditLog";
  import { emailCustomerUpdate, customerEmailEnabled } from "$lib/email/orderEmail";

  /** Email the customer when their order changes (needs an email on the order + EmailJS keys). */
  let notifyCustomer = true;
  let emailNote = "";
  const EMAIL_STATUSES = ["Confirmed", "Shipped", "Delivered", "Canceled"];

  async function tellCustomer(kind: string) {
    emailNote = "";
    if (!notifyCustomer) return;
    const r = await emailCustomerUpdate(order, kind);
    emailNote =
      r === "sent"
        ? `Customer emailed at ${order.customerEmail}.`
        : r === "no-email"
          ? "No email on this order, so the customer was not emailed. Call them instead."
          : r === "off"
            ? "Customer emails are not set up yet (EmailJS keys in admin/.env)."
            : "The update was saved, but the customer email could not be sent.";
  }

  const orderId = $page.params.id;

  let order: any = null;
  let loading = true;
  let errorMsg = "";
  
  let newStatus = "";
  let updating = false;

  onMount(async () => {
    try {
      order = await fetchOrder(orderId);
      newStatus = order.orderStatus || "Pending";
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      loading = false;
    }
  });

  function statusStamp(status: string) {
    const key: Record<string, string> = {
      Confirmed: "confirmedAt",
      Shipped: "shippedAt",
      Delivered: "deliveredAt",
      Canceled: "canceledAt"
    };
    const patch: Record<string, unknown> = {
      orderStatus: status,
      statusUpdatedAt: serverTimestamp()
    };
    if (key[status]) patch[key[status]] = serverTimestamp();
    return patch;
  }

  async function writeStatus(status: string) {
    const patch = statusStamp(status);
    await updateDoc(doc(db, "order", order.id), patch);
    if (order.userId) {
      try {
        await updateDoc(doc(db, "user", order.userId, "order", order.id), patch);
      } catch {
        /* The shopper copy is optional. */
      }
    }
  }

  async function updateStatus() {
    updating = true;
    errorMsg = "";
    try {
      const functions = getFunctions(app);
      const adminUpdateOrderStatus = httpsCallable(functions, 'adminUpdateOrderStatus');
      
      try {
        await adminUpdateOrderStatus({ orderId: order.id, status: newStatus });
      } catch (fnError: any) {
        errorMsg = "Status saved. Stock was not changed automatically: update the product's stock if needed.";
      }
      const previous = order.orderStatus;
      await writeStatus(newStatus);
      order.orderStatus = newStatus;
      order = { ...order }; // Trigger Svelte UI update
      await logAdminAudit("order.status", "order", `Status set to ${newStatus}`, order.id);
      if (newStatus !== previous && EMAIL_STATUSES.includes(newStatus)) await tellCustomer(newStatus);
      if (!errorMsg) alert(`Order status updated to ${newStatus}.${emailNote ? "\n" + emailNote : ""}`);
    } catch (e: any) {
      errorMsg = "Error updating order: " + e.message;
    } finally {
      updating = false;
    }
  }

  async function confirmPayment() {
    if (!confirm("Are you sure you have verified receipt of this mobile money payment?")) return;
    
    updating = true;
    errorMsg = "";
    try {
      const functions = getFunctions(app);
      const adminConfirmManualPayment = httpsCallable(functions, 'adminConfirmManualPayment');
      
      try {
        await adminConfirmManualPayment({ orderId: order.id });
      } catch (fnError: any) {
        errorMsg = "Saved on the order. " + fnError.message;
      }
      await writeStatus("Confirmed");
      // Svelte reactivity requires reassignment to trigger a UI update
      order.paymentStatus = "Paid";
      order.orderStatus = "Confirmed";
      order = { ...order }; 
      newStatus = "Confirmed";
      await logAdminAudit("order.payment_confirmed", "order", "Manual payment confirmed", order.id);
      alert("Payment confirmed successfully!");
    } catch (e: any) {
      errorMsg = "Error confirming payment: " + e.message;
    } finally {
      updating = false;
    }
  }

  /** Cash on delivery: the rider collected the money. */
  async function markCashReceived() {
    if (!confirm(`Mark ${order.totalPrice} ${order.currency || "UGX"} as received for this order?`)) return;
    updating = true;
    errorMsg = "";
    try {
      const patch: Record<string, any> = {
        paymentStatus: "paid",
        amountPaid: Number(order.totalPrice) || 0,
        paidAt: serverTimestamp()
      };
      await updateDoc(doc(db, "order", order.id), patch);
      order = { ...order, paymentStatus: "paid", amountPaid: patch.amountPaid };
      await logAdminAudit("order.cash_received", "order", "Cash on delivery received", order.id);
      await tellCustomer("paid");
    } catch (e: any) {
      errorMsg = "Could not save: " + e.message;
    } finally {
      updating = false;
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this order completely? This cannot be undone.")) return;
    updating = true;
    errorMsg = "";
    try {
      await deleteOrder(orderId, order.userId);
      alert("Order deleted.");
      goto("/orders");
    } catch (e: any) {
      errorMsg = "Error deleting order: " + e.message;
      updating = false;
    }
  }
</script>

<h1>Order Details: {orderId}</h1>

{#if loading}
  <p>Loading...</p>
{:else if errorMsg && !order}
  <div style="color: red">{errorMsg}</div>
{:else if order}
  {#if errorMsg}
    <div style="color: red; margin-bottom: 10px;">{errorMsg}</div>
  {/if}

  <div class="order-grid">
    <div class="card">
      <h3>Shipping Info</h3>
      <!-- Address schema: label, address, street, city, state, phone, latitude, longitude -->
      {#if order.customerName}
        <p><strong>Customer:</strong> {order.customerName}</p>
      {/if}
      <p><strong>Name/Label:</strong> {order.address?.label}</p>
      <p><strong>Phone:</strong>
        {#if order.address?.phone || order.customerPhone}
          <a href="tel:{order.address?.phone || order.customerPhone}">{order.address?.phone || order.customerPhone}</a>
        {/if}
      </p>
      {#if order.customerEmail}
        <p><strong>Email:</strong> <a href="mailto:{order.customerEmail}">{order.customerEmail}</a></p>
      {/if}
      {#if order.note}
        <p><strong>Customer note:</strong> {order.note}</p>
      {/if}
      <p><strong>Address:</strong> {order.address?.address}</p>
      <p><strong>Street:</strong> {order.address?.street}</p>
      <p><strong>City/State:</strong> {order.address?.city}, {order.address?.state}</p>
      {#if order.isUpCountry !== undefined}
        <p><strong>Type:</strong> {order.isUpCountry ? 'Up-Country' : 'Kampala'}</p>
      {/if}
      {#if order.deliveredAt?.seconds}
        <p><strong>Delivered:</strong> {new Date(order.deliveredAt.seconds * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
      {/if}
      {#if order.ticketWindowEnd?.seconds}
        <p><strong>Report Window Expires:</strong> {new Date(order.ticketWindowEnd.seconds * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
      {/if}
      {#if order.address?.latitude && order.address?.longitude && order.address.latitude !== 0}
        <a class="map-link" href="https://www.google.com/maps?q={order.address.latitude},{order.address.longitude}" target="_blank" rel="noopener noreferrer">
          View on Google Maps
        </a>
      {/if}
    </div>
    
    <div class="card">
      <h3>Payment Info</h3>
      {#if order.paymentMethod}
        <p><strong>Method:</strong> {order.paymentMethod}</p>
      {/if}
      <p><strong>Status:</strong> {String(order.paymentStatus || "").replaceAll("_", " ")}</p>
      {#if order.paymentStatus === "cash_on_delivery"}
        <p class="cod-note">Collect cash or Mobile Money on delivery, then mark it received.</p>
        <button class="btn btn-success" type="button" on:click={markCashReceived} disabled={updating}>
          {updating ? "Saving..." : "Cash received"}
        </button>
      {/if}
      {#if order.clientPriced}
        <p class="cod-note">Prices come from the website checkout: confirm them on the call.</p>
      {/if}
      <p><strong>Total:</strong> {order.totalPrice} {order.currency || 'UGX'}</p>
      {#if order.mobileMoneyName || order.mobileMoneyNumber}
        <div class="mm-info">
          <h4>Mobile Money Details</h4>
          <p><strong>Name:</strong> {order.mobileMoneyName}</p>
          <p><strong>Number:</strong> {order.mobileMoneyNumber}</p>
          {#if order.paymentStatus === 'Awaiting Confirmation'}
            <button class="btn btn-success" type="button" on:click={confirmPayment} disabled={updating}>
              {updating ? 'Processing...' : 'Confirm Payment Received'}
            </button>
          {/if}
        </div>
      {/if}
      {#if order.paymentProvider}
        <p><strong>Provider:</strong> {order.paymentProvider}</p>
      {/if}
      {#if order.providerReference}
        <p><strong>Ref:</strong> {order.providerReference}</p>
      {/if}
    </div>
    
    <div class="card full-width">
      <h3>Fulfillment</h3>
      <label>
        Current Status:
        <select bind:value={newStatus}>
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Shipped">Shipped</option>
          <option value="Delivered">Delivered</option>
          <option value="Canceled">Canceled</option>
        </select>
      </label>
      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <button class="btn btn-primary" type="button" on:click={updateStatus} disabled={updating}>
          {updating ? 'Updating...' : 'Update Status'}
        </button>
        <button class="btn btn-danger" type="button" on:click={handleDelete} disabled={updating}>
          Delete Order
        </button>
      </div>
      <label class="notify-row">
        <input type="checkbox" bind:checked={notifyCustomer} />
        Email the customer about this update
        {#if !order.customerEmail}<span class="cod-note">(no email on this order)</span>
        {:else if !customerEmailEnabled}<span class="cod-note">(customer emails not set up yet)</span>{/if}
      </label>
      {#if emailNote}<p class="cod-note">{emailNote}</p>{/if}
    </div>

    <div class="card full-width">
      <h3>Products</h3>
      <table class="products-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Color</th>
            <th>Size</th>
            <th>Qty</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {#if order.products && order.products.length > 0}
            {#each order.products as product}
              <tr>
                <td>
                  <div class="prod-cell">
                    {#if product.product?.images?.[0]}
                      <img class="prod-thumb" src={product.product.images[0]} alt="" loading="lazy" />
                    {:else}
                      <span class="prod-thumb empty" aria-hidden="true"><i class="fa fa-picture-o"></i></span>
                    {/if}
                    <span>{product.product?.name || 'Unknown'}</span>
                  </div>
                </td>
                <td>
                  {#if product.selectedColor}
                    <div class="color-swatch" style="background-color: #{product.selectedColor.toString(16).padStart(8, '0').substring(2)}"></div>
                  {:else if product.selectedColorName}
                    {product.selectedColorName}
                  {:else}
                    N/A
                  {/if}
                </td>
                <td>{product.selectedSize || 'N/A'}</td>
                <td>{product.quantity}</td>
                <td>{product.product?.price || 0}</td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="5">No products found in this order.</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<style>
  .prod-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .prod-thumb {
    width: 64px;
    height: 64px;
    border-radius: 8px;
    object-fit: cover;
    background: #f1f3f5;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #9aa5b1;
    font-size: 22px;
  }
  .notify-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 0.92rem;
    flex-wrap: wrap;
  }
  .cod-note {
    font-size: 0.85rem;
    color: #5b6670;
    margin: 4px 0 8px;
  }
  .order-grid {
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
  .full-width {
    grid-column: 1 / -1;
  }
  h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #135fa3;
  }
  p {
    margin: 5px 0;
  }
  label {
    display: block;
    margin-bottom: 10px;
    font-weight: 500;
  }
  select {
    display: block;
    margin-top: 5px;
    padding: 8px;
    width: 100%;
    max-width: 300px;
    border-radius: 4px;
    border: 1px solid #ccc;
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
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-primary { background-color: #28a745; }
  .btn-success { background-color: #198754; margin-top: 10px; width: 100%; }
  
  .mm-info {
    background-color: #e9ecef;
    padding: 10px;
    border-radius: 4px;
    margin-top: 10px;
  }
  .mm-info h4 {
    margin-top: 0;
    margin-bottom: 5px;
    font-size: 14px;
    color: #495057;
  }

  .products-table {
    width: 100%;
    border-collapse: collapse;
  }
  .products-table th, .products-table td {
    border: 1px solid #dee2e6;
    padding: 10px;
    text-align: left;
  }
  .products-table th {
    background-color: #e9ecef;
  }
  .color-swatch {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid #ccc;
  }
  .btn-danger {
    background-color: #dc3545;
  }
  .btn-danger:hover {
    background-color: #c82333;
  }
  .map-link {
    display: inline-block;
    margin-top: 10px;
    padding: 8px 16px;
    background-color: #198754;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
  }
  .map-link:hover {
    background-color: #157347;
  }
</style>
