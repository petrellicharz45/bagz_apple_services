<script lang="ts">
  import { onMount } from "svelte";
  import { doc, getDoc, setDoc } from "firebase/firestore";
  import { db } from "$lib/firebase";

  const pages = [
    {
      key: "home",
      label: "Home",
      path: "https://fancydealsug.com/",
      title: "Fancy Deals Uganda | Online Shopping, Fashion & Best Prices in Kampala",
      description: "Shop fashion, shoes, electronics, home and beauty at Fancy Deals Uganda. Kampala delivery, MTN and Airtel Money checkout, and daily deals in UGX.",
      keywords: "Fancy Deals Uganda, online shopping Uganda, buy online Kampala, ecommerce Uganda, fashion deals Uganda, MTN Mobile Money shop, Airtel Money shopping"
    },
    {
      key: "newIn",
      label: "New in",
      path: "https://fancydealsug.com/",
      title: "New Arrivals Uganda | Latest Fashion & Products | Fancy Deals",
      description: "See what just landed at Fancy Deals Uganda. New clothes, shoes, bags, electronics and home items, priced in UGX with delivery in Kampala.",
      keywords: "new arrivals Uganda, latest fashion Kampala, new products online Uganda, Fancy Deals new in"
    },
    {
      key: "categories",
      label: "Categories",
      path: "https://fancydealsug.com/",
      title: "Shop by Category in Uganda | Clothes, Shoes, Electronics | Fancy Deals",
      description: "Browse Fancy Deals categories: women's clothing, men's shoes, bags, wigs, beauty, home and living, and electronics. Order online in Uganda.",
      keywords: "shop categories Uganda, women's clothing Kampala, men's shoes Uganda, home and living Uganda, beauty products Kampala"
    },
    {
      key: "search",
      label: "Search",
      path: "https://fancydealsug.com/",
      title: "Search Products in Uganda | Fancy Deals",
      description: "Search Fancy Deals for clothes, shoes, bags, electronics and home goods. Find a product and pay with MTN or Airtel Money.",
      keywords: "search products Uganda, find shoes Kampala, buy bags online Uganda, Fancy Deals search"
    },
    {
      key: "cart",
      label: "Cart",
      path: "https://fancydealsug.com/",
      title: "Your Cart | Fancy Deals Uganda",
      description: "Review the items in your Fancy Deals cart, check the UGX total and delivery, then continue to mobile money checkout.",
      keywords: "shopping cart Uganda, Fancy Deals cart, online order Kampala"
    },
    {
      key: "checkout",
      label: "Checkout",
      path: "https://fancydealsug.com/",
      title: "Checkout with Mobile Money | MTN & Airtel | Fancy Deals Uganda",
      description: "Pay for your Fancy Deals order with MTN Mobile Money or Airtel Money. Delivery in Kampala and outside Kampala, prices in UGX.",
      keywords: "mobile money checkout Uganda, pay with MTN Mobile Money, Airtel Money online shop, Fancy Deals checkout"
    },
    {
      key: "orders",
      label: "My orders",
      path: "https://fancydealsug.com/",
      title: "Track Your Order | Fancy Deals Uganda",
      description: "See your Fancy Deals orders, payment status and delivery updates. Shop online in Uganda and follow the order from your account.",
      keywords: "track order Uganda, Fancy Deals orders, delivery status Kampala"
    },
    {
      key: "support",
      label: "Support",
      path: "https://fancydealsug.com/help/support",
      title: "Help & Customer Support | Fancy Deals Uganda",
      description: "Get help with a Fancy Deals order, delivery, payment or product. Contact Fancy Deals Uganda customer support.",
      keywords: "Fancy Deals support, customer care Uganda, online shop help Kampala, delivery help Uganda"
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
      title: data.site?.title || "Fancy Deals Uganda | Online Shopping, Fashion & Best Prices in Kampala",
      description: data.site?.description || "Shop fashion, shoes, electronics, home and beauty at Fancy Deals Uganda. Kampala delivery, MTN and Airtel Money checkout, and daily deals in UGX.",
      keywords: data.site?.keywords || "Fancy Deals Uganda, online shopping Uganda, buy online Kampala, ecommerce Uganda, MTN Mobile Money shop, Airtel Money shopping"
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
  .tabs button.on, .save { background: #ea580c; color: #fff; border-color: #ea580c; }
  section, label { display: block; background: #fff; border: 1px solid #e7e5e4; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
  .row { width: 100%; display: flex; justify-content: space-between; background: none; border: 0; cursor: pointer; text-align: left; }
  small { display: block; color: #78716c; }
  input, textarea { width: 100%; margin-top: 6px; padding: 8px; border: 1px solid #d6d3d1; border-radius: 8px; }
  .save { margin-top: 8px; }
</style>
