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
        errorMsg = "Saved on the order. Stock was not adjusted: " + fnError.message;
      }
      await writeStatus(newStatus);
      order.orderStatus = newStatus;
      order = { ...order }; // Trigger Svelte UI update
      await logAdminAudit("order.status", "order", `Status set to ${newStatus}`, order.id);
      if (!errorMsg) alert("Order status updated successfully!");
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
      <p><strong>Name/Label:</strong> {order.address?.label}</p>
      <p><strong>Phone:</strong> {order.address?.phone || order.customerPhone}</p>
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
      <p><strong>Status:</strong> {order.paymentStatus}</p>
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
                <td>{product.product?.name || 'Unknown'}</td>
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
    color: #ea580c;
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
