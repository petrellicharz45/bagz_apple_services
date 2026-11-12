<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { doc, getDoc } from "firebase/firestore";
  import { db } from "$lib/firebase";
  import ColorPickerField from "$lib/components/ColorPickerField.svelte";
  import ProductSeoFields from "$lib/components/ProductSeoFields.svelte";
  import { DELIVERY_OPTIONS } from "$lib/deliveryEstimate";
  import { createProduct } from "$lib/products/productSave";
  import { SHOW_COLOR_TOOLS } from "$lib/products/photoNames";
  import { DEFAULT_GROUPS, categoryOptions, loadGroups } from "$lib/data/groups";

  let GROUP_OPTIONS: string[] = [...DEFAULT_GROUPS];

  type Draft = {
    key: string;
    open: boolean;
    name: string;
    category: string;
    price: number;
    deliveryEstimate: string;
    description: string;
    sizes: string;
    colors: string;
    stock: number;
    stockPerSize: string;
    offer: number;
    groups: string[];
    special: boolean;
    imageFiles: File[];
    imageNames: string;
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string;
    slug: string;
  };

  function emptyDraft(): Draft {
    return {
      key: crypto.randomUUID(),
      open: true,
      name: "",
      category: "",
      price: 0,
      deliveryEstimate: "5",
      description: "",
      sizes: "",
      colors: "",
      stock: 0,
      stockPerSize: "",
      offer: 0,
      groups: [],
      special: false,
      imageFiles: [],
      imageNames: "",
      seoTitle: "",
      seoDescription: "",
      seoKeywords: "",
      slug: ""
    };
  }

  let categories: string[] = ["Clothing", "Shoes", "Accessories", "Bags", "Jewelry", "Beauty"];
  let drafts: Draft[] = [emptyDraft(), emptyDraft()];
  let saving = false;
  let progress = "";
  let errorMsg = "";
  let successMsg = "";

  onMount(async () => {
    GROUP_OPTIONS = await loadGroups();
    try {
      const snap = await getDoc(doc(db, "settings", "categories"));
      if (snap.exists()) categories = categoryOptions(Object.keys(snap.data()));
    } catch {
      /* keep defaults */
    }
  });

  function addRow() {
    drafts = [...drafts, emptyDraft()];
  }

  function removeRow(key: string) {
    if (drafts.length <= 1) return;
    drafts = drafts.filter((d) => d.key !== key);
  }

  function onFilesChange(draft: Draft, e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    draft.imageFiles = Array.from(input.files || []);
    draft.imageNames = draft.imageFiles.map((f) => f.name).join(", ");
    drafts = drafts;
  }

  function recalcStock(draft: Draft) {
    if (draft.sizes && draft.stockPerSize) {
      draft.stock = draft.stockPerSize
        .split(",")
        .map((s) => parseInt(s.trim(), 10) || 0)
        .reduce((a, b) => a + b, 0);
    }
    drafts = drafts;
  }

  async function saveAll() {
    errorMsg = "";
    successMsg = "";
    const active = drafts.filter((d) => d.name.trim() || d.imageFiles.length);
    if (active.length === 0) {
      errorMsg = "Add at least one product with a name and images.";
      return;
    }

    saving = true;
    let saved = 0;
    const errors: string[] = [];

    for (let i = 0; i < active.length; i++) {
      const d = active[i];
      progress = `Uploading product ${i + 1} of ${active.length}: ${d.name || "Untitled"}…`;
      try {
        await createProduct({
          name: d.name,
          category: d.category,
          price: Number(d.price) || 0,
          deliveryEstimate: d.deliveryEstimate,
          description: d.description,
          sizes: d.sizes,
          colors: d.colors,
          stock: d.stock,
          stockPerSize: d.stockPerSize,
          offer: d.offer,
          groups: d.groups,
          special: d.special,
          imageFiles: d.imageFiles,
          seoOverrides: {
            seoTitle: d.seoTitle,
            seoDescription: d.seoDescription,
            seoKeywords: d.seoKeywords,
            slug: d.slug
          }
        });
        saved++;
      } catch (e: any) {
        errors.push(e.message || `Product ${i + 1} failed`);
      }
    }

    saving = false;
    progress = "";

    if (saved === active.length) {
      successMsg = `Saved ${saved} product(s).`;
      setTimeout(() => goto("/products"), 1200);
    } else if (saved > 0) {
      successMsg = `Saved ${saved} of ${active.length}.`;
      errorMsg = errors.join(" · ");
    } else {
      errorMsg = errors.join(" · ") || "Nothing was saved.";
    }
  }
</script>

<h1>Bulk add products</h1>
<p class="lead">
  Add many products in one go. Each row has its own images, sizes, colors, delivery time, and SEO.
  Empty rows are skipped.
</p>

{#if errorMsg}
  <div class="alert err">{errorMsg}</div>
{/if}
{#if successMsg}
  <div class="alert ok">{successMsg}</div>
{/if}
{#if progress}
  <p class="progress">{progress}</p>
{/if}

<div class="toolbar">
  <button type="button" class="btn secondary" on:click={addRow} disabled={saving}>+ Add another product</button>
  <button type="button" class="btn primary" on:click={saveAll} disabled={saving}>
    {saving ? "Saving…" : `Save all (${drafts.length} rows)`}
  </button>
  <a href="/products/new" class="link">Single product form</a>
</div>

{#each drafts as draft, index (draft.key)}
  <section class="card" class:collapsed={!draft.open}>
    <header class="card-head">
      <button
        type="button"
        class="toggle"
        on:click={() => {
          draft.open = !draft.open;
          drafts = drafts;
        }}
      >
        {draft.open ? "▼" : "▶"} Product {index + 1}: {draft.name.trim() || "Untitled"}
      </button>
      {#if drafts.length > 1}
        <button type="button" class="remove" on:click={() => removeRow(draft.key)} disabled={saving}>
          Remove
        </button>
      {/if}
    </header>

    {#if draft.open}
      <div class="grid">
        <label class="images-block full">
          Images (required)
          <input
            type="file"
            multiple
            accept="image/*"
            on:change={(e) => onFilesChange(draft, e)}
          />
          <small>{draft.imageNames || "Choose one or more photos for this product"}</small>
        </label>

        <label>
          Name
          <input type="text" bind:value={draft.name} placeholder="Product name" />
        </label>
        <label>
          Category
          <select bind:value={draft.category}>
            <option value="">Select category</option>
            {#each categories as cat}
              <option value={cat}>{cat}</option>
            {/each}
          </select>
        </label>
        <label>
          Price (UGX)
          <input type="number" bind:value={draft.price} min="0" step="1" />
        </label>
        <label>
          Estimated delivery
          <select bind:value={draft.deliveryEstimate}>
            {#each DELIVERY_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Offer %
          <input type="number" bind:value={draft.offer} min="0" max="100" />
        </label>
        <label class="full">
          Description
          <textarea bind:value={draft.description} rows="2" />
        </label>

        <fieldset class="full groups">
          <legend>Groups</legend>
          <div class="chips">
            {#each GROUP_OPTIONS as group}
              <label class="chip">
                <input type="checkbox" value={group} bind:group={draft.groups} />
                {group}
              </label>
            {/each}
          </div>
        </fieldset>

        <label>
          Sizes (comma-separated)
          <input type="text" bind:value={draft.sizes} placeholder="S,M,L" />
        </label>
        <label>
          Stock per size
          <input
            type="text"
            bind:value={draft.stockPerSize}
            placeholder="2,7,3"
            on:input={() => recalcStock(draft)}
          />
        </label>
        <label>
          Total stock
          <input type="number" bind:value={draft.stock} min="0" />
        </label>
        {#if SHOW_COLOR_TOOLS}
          <div class="full">
            <span>Colors</span>
            <ColorPickerField bind:value={draft.colors} />
          </div>
        {/if}

        <label class="check full">
          <input type="checkbox" bind:checked={draft.special} />
          Mark as special product
        </label>

        <div class="full">
          <ProductSeoFields
            name={draft.name}
            category={draft.category}
            description={draft.description}
            price={draft.price}
            groups={draft.groups}
            bind:seoTitle={draft.seoTitle}
            bind:seoDescription={draft.seoDescription}
            bind:seoKeywords={draft.seoKeywords}
            bind:slug={draft.slug}
          />
        </div>
      </div>
    {/if}
  </section>
{/each}

<style>
  h1 {
    margin: 0 0 8px;
  }
  .lead {
    color: #64748b;
    margin: 0 0 20px;
    max-width: 720px;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
  }
  .btn {
    border: none;
    border-radius: 8px;
    padding: 10px 18px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn.primary {
    background: linear-gradient(135deg, #ea580c, #f97316);
    color: #fff;
  }
  .btn.secondary {
    background: #fff;
    border: 1px solid #e2e8f0;
    color: #0f172a;
  }
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .link {
    color: #ea580c;
    font-weight: 600;
    text-decoration: none;
  }
  .alert {
    padding: 12px 14px;
    border-radius: 8px;
    margin-bottom: 12px;
  }
  .alert.err {
    background: #fef2f2;
    color: #b91c1c;
  }
  .alert.ok {
    background: #ecfdf5;
    color: #047857;
  }
  .progress {
    font-weight: 600;
    color: #c2410c;
  }
  .card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    margin-bottom: 14px;
    overflow: hidden;
  }
  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }
  .toggle {
    border: none;
    background: none;
    font-weight: 700;
    cursor: pointer;
    text-align: left;
    flex: 1;
  }
  .remove {
    border: none;
    background: #fee2e2;
    color: #b91c1c;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 16px;
    padding: 16px;
  }
  @media (max-width: 800px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .full {
    grid-column: 1 / -1;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
  }
  input,
  select,
  textarea {
    font: inherit;
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
  }
  .images-block {
    padding: 12px;
    border: 1px dashed #fdba74;
    border-radius: 8px;
    background: #fffbeb;
  }
  .groups .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    flex-direction: row;
    align-items: center;
    font-weight: 400;
    font-size: 13px;
  }
  .check {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
</style>
