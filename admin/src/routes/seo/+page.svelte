<script lang="ts">
  import { onMount } from "svelte";
  import { doc, getDoc, setDoc } from "firebase/firestore";
  import { db } from "$lib/firebase";

  const SITE = "https://bagzappleservices.com";
  const pages = [
    {
      key: "home",
      label: "Home",
      path: `${SITE}/`,
      title: "Bagz Apple Services | Authentic iPhones & Samsung in Kampala",
      description: "Buy brand-new and certified iPhones, Google Pixel, Samsung Galaxy, MacBooks, Apple Watch and accessories at Bagz Apple Services, Kampala. Swap & top-up, warranty, same-day delivery.",
      keywords: "Bagz Apple Services, iPhone price Uganda, buy iPhone Kampala, Google Pixel Uganda, Samsung Uganda, Apple accessories Kampala, phone swap Uganda"
    },
    {
      key: "newIn",
      label: "New in",
      path: `${SITE}/`,
      title: "New Arrivals | Latest iPhones & Gadgets in Uganda | Bagz",
      description: "The newest phones and gadgets at Bagz Apple Services — latest iPhone, Pixel and Samsung models, priced in UGX with same-day delivery in Kampala.",
      keywords: "new iPhone Uganda, latest phones Kampala, new arrivals Bagz, iPhone 18 Pro price Uganda"
    },
    {
      key: "categories",
      label: "Categories",
      path: `${SITE}/`,
      title: "Shop by Category | iPhone, Pixel, Samsung, MacBook, Watch | Bagz",
      description: "Browse Bagz categories: iPhones, Google Pixel, Samsung Galaxy & Z series, MacBooks, iPads, Apple Watch, AirPods, audio and accessories. Order online in Uganda.",
      keywords: "iPhones Uganda, Google Pixel Kampala, Samsung Z Fold Uganda, MacBook Uganda, Apple Watch Kampala, phone accessories Uganda"
    },
    {
      key: "search",
      label: "Search",
      path: `${SITE}/`,
      title: "Search Phones & Gadgets | Bagz Apple Services",
      description: "Search Bagz for iPhones, Pixel, Samsung, MacBooks, watches and accessories. Find your device and pay with MTN or Airtel Money.",
      keywords: "search iPhone Uganda, find phone Kampala, Bagz search"
    },
    {
      key: "cart",
      label: "Cart",
      path: `${SITE}/`,
      title: "Your Cart | Bagz Apple Services",
      description: "Review the items in your Bagz cart, check the UGX total and delivery, then continue to checkout.",
      keywords: "Bagz cart, buy phone online Kampala"
    },
    {
      key: "checkout",
      label: "Checkout",
      path: `${SITE}/`,
      title: "Secure Checkout | MTN & Airtel Money | Bagz Apple Services",
      description: "Pay for your Bagz order with MTN Mobile Money, Airtel Money or card. Same-day delivery in Kampala, prices in UGX.",
      keywords: "mobile money phone checkout Uganda, Bagz checkout"
    },
    {
      key: "orders",
      label: "My orders",
      path: `${SITE}/`,
      title: "Track Your Order | Bagz Apple Services",
      description: "See your Bagz orders, payment status and delivery updates.",
      keywords: "track order Bagz, delivery status Kampala"
    },
    {
      key: "support",
      label: "Support",
      path: `${SITE}/help/support`,
      title: "Help, Warranty & Support | Bagz Apple Services",
      description: "Get help with a Bagz order, warranty claim, swap or repair. Call or WhatsApp Bagz Apple Services, Kampala.",
      keywords: "Bagz support, iPhone warranty Kampala, phone repair Kampala, Bagz WhatsApp"
    }
  ];

  let tab = "pages";
  let site = { title: "", description: "", keywords: "" };
  let pageMap: Record<string, { title: string; description: string; keywords: string }> = {};
  let openKey = "";
  let loading = true;
  let saving = false;
  let message = "";

  if (!db) throw new Error("Firebase is not configured");
  const firestore = db;

  onMount(async () => {
    const snap = await getDoc(doc(firestore, "settings", "seo"));
    const data = snap.exists() ? snap.data() : {};
    site = {
      title: data.site?.title || pages[0].title,
      description: data.site?.description || pages[0].description,
      keywords: data.site?.keywords || pages[0].keywords
    };
    for (const page of pages) {
      const row = data.pages?.[page.key] || {};
      pageMap[page.key] = {
        title: row.title || page.title,
        description: row.description || page.description,
        keywords: row.keywords || page.keywords
      };
    }
    loading = false;
  });

  async function save() {
    saving = true;
    message = "";
    try {
      await setDoc(doc(firestore, "settings", "seo"), { site, pages: pageMap }, { merge: true });
      message = "Saved.";
    } catch (error: any) {
      message = error.message || "Could not save.";
    } finally {
      saving = false;
    }
  }
</script>

<h1>SEO</h1>

<div class="tabs">
  <button type="button" class:on={tab === "pages"} on:click={() => (tab = "pages")}>Page SEO</button>
  <button type="button" class:on={tab === "site"} on:click={() => (tab = "site")}>Site defaults</button>
</div>

{#if loading}
  <p>Loading...</p>
{:else if tab === "site"}
  <label>Default site title<input bind:value={site.title} maxlength="120" /></label>
  <label>Default meta description<textarea bind:value={site.description} rows="3" maxlength="320"></textarea></label>
  <label>Default keywords<input bind:value={site.keywords} maxlength="500" /></label>
{:else}
  {#each pages as page}
    <section>
      <button type="button" class="row" on:click={() => (openKey = openKey === page.key ? "" : page.key)}>
        <span>
          <strong>{page.label}</strong>
          <small>{page.path}</small>
        </span>
        <span>{openKey === page.key ? "Hide" : "Edit SEO"}</span>
      </button>
      {#if openKey === page.key}
        <label>Meta title<input bind:value={pageMap[page.key].title} maxlength="120" /></label>
        <label>Meta description<textarea bind:value={pageMap[page.key].description} rows="3" maxlength="320"></textarea></label>
        <label>Keywords<input bind:value={pageMap[page.key].keywords} maxlength="500" /></label>
      {/if}
    </section>
  {/each}
{/if}

<button type="button" class="save" on:click={save} disabled={saving || loading}>{saving ? "Saving…" : "Save SEO settings"}</button>
{#if message}<p>{message}</p>{/if}

<style>
  h1 { margin: 0 0 8px; font-size: 28px; }
  .tabs { display: flex; gap: 8px; margin: 16px 0; }
  .tabs button, .save { border: 1px solid #e7e5e4; background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
  .tabs button.on, .save { background: #135fa3; color: #fff; border-color: #135fa3; }
  section, label { display: block; background: #fff; border: 1px solid #e7e5e4; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
  .row { width: 100%; display: flex; justify-content: space-between; background: none; border: 0; cursor: pointer; text-align: left; }
  small { display: block; color: #64748b; }
  input, textarea { width: 100%; margin-top: 6px; padding: 8px; border: 1px solid #d5dfe9; border-radius: 8px; }
  .save { margin-top: 8px; }
</style>
