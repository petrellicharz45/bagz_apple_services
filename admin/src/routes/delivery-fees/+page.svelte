<script lang="ts">
  import { onMount } from "svelte";
  import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
  import { db } from "$lib/firebase";
  import { showSuccessToast } from "$lib/stores/toast";
  import { parseDeliveryFeeInput } from "$lib/deliveryFees";

  let deliveryFeeKampala = "" as number | "";
  let deliveryFeeOutsideKampala = "" as number | "";
  let loading = true;
  let saving = false;
  let errorMsg = "";

  onMount(async () => {
    try {
      const snap = await getDoc(doc(db, "settings", "delivery_fees"));
      if (snap.exists()) {
        const data = snap.data();
        deliveryFeeKampala =
          data.deliveryFeeKampala != null ? data.deliveryFeeKampala : "";
        deliveryFeeOutsideKampala =
          data.deliveryFeeOutsideKampala != null ? data.deliveryFeeOutsideKampala : "";
      }
    } catch (e: unknown) {
      errorMsg = e instanceof Error ? e.message : "Could not load delivery fees.";
    } finally {
      loading = false;
    }
  });

  async function handleSave() {
    saving = true;
    errorMsg = "";
    try {
      await setDoc(
        doc(db, "settings", "delivery_fees"),
        {
          deliveryFeeKampala: parseDeliveryFeeInput(deliveryFeeKampala),
          deliveryFeeOutsideKampala: parseDeliveryFeeInput(deliveryFeeOutsideKampala),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      showSuccessToast("Delivery fees saved — they apply to all products in the shop.");
    } catch (e: unknown) {
      errorMsg = e instanceof Error ? e.message : "Save failed.";
    } finally {
      saving = false;
    }
  }
</script>

<h1>Delivery fees</h1>
<p class="lead">
  Set shipping fees once here. Every product page in the shop shows these amounts (unless a product has
  <strong>free shipping</strong> enabled on the product form).
</p>

{#if errorMsg}
  <p class="error">{errorMsg}</p>
{/if}

{#if loading}
  <p>Loading…</p>
{:else}
  <form class="form" on:submit|preventDefault={handleSave}>
    <label>
      Within Kampala (UGX)
      <input
        type="number"
        bind:value={deliveryFeeKampala}
        min="0"
        step="500"
        placeholder="e.g. 4700"
      />
      <small>Shown as “+ shipping from … within Kampala” on product pages.</small>
    </label>
    <label>
      Outside Kampala (UGX)
      <input
        type="number"
        bind:value={deliveryFeeOutsideKampala}
        min="0"
        step="500"
        placeholder="e.g. 8000"
      />
      <small>Shown together with the Kampala fee on every product.</small>
    </label>
    <button type="submit" class="primary" disabled={saving}>
      {saving ? "Saving…" : "Save delivery fees"}
    </button>
  </form>
{/if}

<style>
  .lead {
    color: #667085;
    max-width: 52ch;
    line-height: 1.5;
  }
  .error {
    color: #b42318;
  }
  .form {
    display: grid;
    gap: 20px;
    max-width: 420px;
    margin-top: 24px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
  }
  input {
    padding: 10px 12px;
    border: 1px solid #d0d5dd;
    border-radius: 8px;
    font-size: 15px;
  }
  small {
    font-weight: 400;
    color: #667085;
    font-size: 12px;
  }
  .primary {
    justify-self: start;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    background: #135fa3;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }
  .primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
