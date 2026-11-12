<script lang="ts">
  import { onMount } from "svelte";
  import { fetchAllProducts } from "$lib/data/products";
  import { fetchOrders } from "$lib/data/orders";
  import { paidOrdersOnly, salesTotal, buildDailySalesSeries } from "$lib/commerce/orderSales";
  import { fetchAllUsersAndAdmins } from "$lib/data/users";
  import { fetchTickets } from "$lib/data/tickets";

  let loading = true;
  let products: any[] = [];
  let orders: any[] = [];
  let customers = 0;
  let openTickets = 0;

  onMount(async () => {
    try {
      const [productItems, orderRes, users, ticketRes] = await Promise.all([
        fetchAllProducts().catch(() => []),
        fetchOrders(80).catch(() => ({ items: [] })),
        fetchAllUsersAndAdmins().catch(() => []),
        fetchTickets(40).catch(() => ({ items: [] }))
      ]);
      products = productItems;
      orders = orderRes.items || [];
      customers = users.length;
      openTickets = (ticketRes.items || []).filter((t: any) => (t.status || "").toLowerCase() !== "closed").length;
    } finally {
      loading = false;
    }
  });

  function ugx(n: number) {
    return `UGX ${Math.round(n).toLocaleString("en-UG")}`;
  }

  function asDate(val: any) {
    if (!val) return null;
    if (val.seconds) return new Date(val.seconds * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  $: paidOrders = paidOrdersOnly(orders);
  $: revenue = salesTotal(orders);
  $: lowStock = products.filter((p) => Number(p.stock || 0) <= 5);
  $: inStock = products.filter((p) => Number(p.stock || 0) > 5).length;
  $: outStock = products.filter((p) => Number(p.stock || 0) <= 0).length;
  $: lowOnly = products.filter((p) => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 5).length;
  $: kpis = [
    { label: "Total Products", value: String(products.length), tone: "green", hint: "Live catalog", dot: "green" },
    { label: "Total Orders", value: String(orders.length), tone: "blue", hint: "Latest fetched", dot: "blue" },
    { label: "Total Customers", value: String(customers), tone: "purple", hint: "Registered users", dot: "purple" },
    { label: "Total Sales", value: ugx(revenue), tone: "gold", hint: "Paid orders only", dot: "gold" },
    { label: "Low Stock Items", value: String(lowStock.length), tone: "red", hint: "Stock ≤ 5", dot: "red" }
  ];

  $: salesDays = buildDailySalesSeries(orders, 7);
  $: linePoints = toLine(salesDays);
  $: donut = donutParts(inStock, lowOnly, outStock, products.length);
  $: recentOrders = orders.slice(0, 6);
  $: topSelling = buildTopSelling(paidOrders, products);
  $: recentCustomers = uniqueCustomers(orders).slice(0, 5);

  function toLine(days: { total: number }[]) {
    const max = Math.max(...days.map((d) => d.total), 1);
    return days
      .map((d, i) => {
        const x = 20 + (i * 260) / Math.max(days.length - 1, 1);
        const y = 150 - (d.total / max) * 120;
        return `${x},${y}`;
      })
      .join(" ");
  }

  function donutParts(ok: number, low: number, out: number, total: number) {
    const t = Math.max(total, 1);
    const c = 2 * Math.PI * 36;
    const a = (ok / t) * c;
    const b = (low / t) * c;
    const d = (out / t) * c;
    return { c, a, b, d, ok, low, out };
  }

  function buildTopSelling(orderList: any[], catalog: any[]) {
    const counts: Record<string, { name: string; qty: number; image?: string; category?: string; price?: number }> = {};
    for (const order of orderList) {
      for (const item of order.products || []) {
        const product = item.product || item;
        const id = product.id || product.name;
        if (!id) continue;
        if (!counts[id]) {
          counts[id] = {
            name: product.name || "Product",
            qty: 0,
            image: product.images?.[0],
            category: product.category,
            price: product.price
          };
        }
        counts[id].qty += Number(item.quantity || 1);
      }
    }
    const ranked = Object.values(counts).sort((a, b) => b.qty - a.qty).slice(0, 5);
    if (ranked.length) return ranked;
    return catalog.slice(0, 5).map((p) => ({
      name: p.name,
      qty: 0,
      image: p.images?.[0],
      category: p.category,
      price: p.price
    }));
  }

  function uniqueCustomers(orderList: any[]) {
    const map = new Map<string, { name: string; phone: string }>();
    for (const order of orderList) {
      const phone = order.address?.phone || order.customerPhone || order.id;
      if (map.has(phone)) continue;
      map.set(phone, {
        name: order.address?.fullName || order.mobileMoneyName || "Customer",
        phone
      });
    }
    return [...map.values()];
  }

  function formatDate(val: any) {
    const d = asDate(val);
    if (!d) return "N/A";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  }

  function statusClass(status: string) {
    const s = (status || "").toLowerCase();
    if (s.includes("deliver") || s.includes("confirm") || s.includes("paid")) return "ok";
    if (s.includes("ship")) return "info";
    if (s.includes("cancel") || s.includes("reject") || s.includes("fail")) return "bad";
    return "warn";
  }
</script>

{#if loading}
  <p class="page-intro">Loading dashboard…</p>
{:else}
  <div class="welcome">
    <div class="welcome-copy">
      <span class="welcome-tag">Welcome back,</span>
      <h2>Welcome Back, Admin!</h2>
      <p>Here’s what’s happening at Bagz Apple Services today.</p>
    </div>
    <div class="welcome-art" aria-hidden="true">
      <div class="laptop">
        <div class="screen">
          <span class="cart-ico"><i class="fa fa-shopping-cart" aria-hidden="true"></i></span>
        </div>
      </div>
    </div>
  </div>

  <div class="kpis">
    {#each kpis as kpi}
      <article class="kpi {kpi.tone}">
        <div class="kpi-icon"></div>
        <div class="kpi-body">
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
          <small><i class="status-dot {kpi.dot}"></i>{kpi.hint}</small>
        </div>
      </article>
    {/each}
  </div>

  <div class="mid">
    <section class="panel sales">
      <header>
        <h3><span class="panel-ico sales-ico"></span> Sales Overview</h3>
        <span class="range-pill"><i class="fa fa-calendar" aria-hidden="true"></i> Last 7 days</span>
      </header>
      <svg viewBox="0 0 300 180" class="chart">
        <polyline fill="none" stroke="#1673c4" stroke-width="3" points={linePoints} />
        {#each salesDays as day, i}
          <text x={20 + (i * 260) / Math.max(salesDays.length - 1, 1)} y="172" text-anchor="middle" font-size="9" fill="#94a3b8">{day.label}</text>
        {/each}
      </svg>
      <div class="sales-meta">
        <div>
          <span>Total Sales (paid)</span>
          <strong>{ugx(revenue)}</strong>
          <em class="delta flat">—</em>
        </div>
        <div>
          <span>Total Orders</span>
          <strong>{orders.length}</strong>
          <em class="delta up">+100%</em>
        </div>
        <div>
          <span>Open tickets</span>
          <strong>{openTickets}</strong>
          <em class="delta flat">—</em>
        </div>
      </div>
    </section>

    <section class="panel">
      <header>
        <h3><span class="panel-ico orders-ico"></span> Recent Orders</h3>
        <a href="/orders">View all →</a>
      </header>
      <table>
        <thead>
          <tr><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th></tr>
        </thead>
        <tbody>
          {#each recentOrders as order}
            <tr>
              <td><a href={`/orders/${order.id}`}>#{String(order.orderId || order.id).slice(-6)}</a></td>
              <td>{order.address?.fullName || order.address?.phone || "Customer"}</td>
              <td>{ugx(Number(order.totalPrice || 0))}</td>
              <td><span class="pill {statusClass(order.orderStatus)}">{order.orderStatus || "Pending"}</span></td>
            </tr>
          {:else}
            <tr><td colspan="4">No orders yet</td></tr>
          {/each}
        </tbody>
      </table>
    </section>
  </div>

  <div class="bottom">
    <section class="panel">
      <header>
        <h3>Top Selling Products</h3>
        <a href="/products">View all</a>
      </header>
      {#each topSelling as item}
        <div class="row">
          {#if item.image}
            <img src={item.image} alt="" />
          {:else}
            <div class="ph"></div>
          {/if}
          <div class="grow">
            <strong>{item.name}</strong>
            <small>{item.category || "Catalog"}</small>
          </div>
          <div class="end">
            <strong>{item.qty}</strong>
            <small>Qty</small>
          </div>
        </div>
      {/each}
    </section>

    <section class="panel stock">
      <header>
        <h3>Stock Status</h3>
      </header>
      <svg viewBox="0 0 100 100" class="donut">
        <circle cx="50" cy="50" r="36" fill="none" stroke="#e2e8f0" stroke-width="12" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="#22c55e" stroke-width="12" stroke-dasharray="{donut.a} {donut.c}" transform="rotate(-90 50 50)" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="#f59e0b" stroke-width="12" stroke-dasharray="{donut.b} {donut.c}" stroke-dashoffset="{-donut.a}" transform="rotate(-90 50 50)" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="#ef4444" stroke-width="12" stroke-dasharray="{donut.d} {donut.c}" stroke-dashoffset="{-(donut.a + donut.b)}" transform="rotate(-90 50 50)" />
        <text x="50" y="48" text-anchor="middle" font-size="12" font-weight="700">{products.length}</text>
        <text x="50" y="60" text-anchor="middle" font-size="7" fill="#64748b">Items</text>
      </svg>
      <ul>
        <li><i class="ok"></i> In stock {inStock}</li>
        <li><i class="low"></i> Low stock {lowOnly}</li>
        <li><i class="out"></i> Out of stock {outStock}</li>
      </ul>
    </section>

    <section class="panel">
      <header>
        <h3>Low Stock Alerts</h3>
        <a href="/products">View all</a>
      </header>
      {#each lowStock.slice(0, 5) as item}
        <div class="row">
          {#if item.images?.[0]}
            <img src={item.images[0]} alt="" />
          {:else}
            <div class="ph"></div>
          {/if}
          <div class="grow">
            <strong>{item.name}</strong>
            <small>{item.category}</small>
          </div>
          <span class="pill bad">{item.stock ?? 0} left</span>
        </div>
      {:else}
        <p class="empty">No low-stock products.</p>
      {/each}
    </section>

    <section class="panel">
      <header>
        <h3>Recent Customers</h3>
      </header>
      {#each recentCustomers as person}
        <div class="row">
          <div class="avatar">{person.name.slice(0, 1)}</div>
          <div class="grow">
            <strong>{person.name}</strong>
            <small>{person.phone}</small>
          </div>
        </div>
      {:else}
        <p class="empty">No customer orders yet.</p>
      {/each}
      <div class="actions">
        <a class="btn teal" href="/products/new">+ Add Product</a>
        <a class="btn navy" href="/orders">View Orders</a>
        <a class="btn ghost" href="/tickets">Open Tickets</a>
      </div>
    </section>
  </div>
{/if}

<style>
  .welcome {
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 22px 24px;
    border-radius: 18px;
    background: linear-gradient(135deg, #eef7fc 0%, #e0f1fa 45%, #fff 100%);
    border: 1px solid #cbe8f7;
    box-shadow: 0 10px 28px rgba(19, 95, 163, 0.08);
  }
  .welcome-tag {
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    color: #135fa3;
    margin-bottom: 4px;
  }
  .welcome h2 {
    margin: 0;
    font-size: 28px;
    color: #13344f;
  }
  .welcome p {
    margin: 8px 0 0;
    color: #64748b;
    max-width: 520px;
  }
  .welcome-art {
    flex: none;
    width: 160px;
    height: 110px;
    position: relative;
  }
  .laptop {
    width: 140px;
    height: 90px;
    margin: 0 auto;
    border-radius: 10px 10px 4px 4px;
    background: linear-gradient(180deg, #9fd6f0, #1673c4);
    padding: 10px 12px 16px;
    box-shadow: 0 12px 24px rgba(22, 115, 196, 0.35);
  }
  .screen {
    height: 100%;
    border-radius: 6px;
    background: #eef7fc;
    display: grid;
    place-items: center;
    font-size: 28px;
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 16px;
  }
  .kpi {
    background: #fff;
    border-radius: 16px;
    padding: 16px;
    display: flex;
    gap: 12px;
    box-shadow: 0 8px 24px rgba(15, 39, 68, 0.05);
  }
  .kpi-icon {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    flex: none;
  }
  .kpi.green .kpi-icon { background: #dcfce7; }
  .kpi.blue .kpi-icon { background: #dbeafe; }
  .kpi.purple .kpi-icon { background: #ede9fe; }
  .kpi.gold .kpi-icon { background: #fef3c7; }
  .kpi.red .kpi-icon { background: #fee2e2; }
  .kpi span, .kpi small {
    display: block;
    color: #64748b;
    font-size: 12px;
  }
  .kpi strong {
    display: block;
    font-size: 20px;
    margin: 4px 0;
  }
  .kpi-body {
    min-width: 0;
  }
  .kpi small {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;
  }
  .status-dot.green { background: #22c55e; }
  .status-dot.blue { background: #3b82f6; }
  .status-dot.purple { background: #a855f7; }
  .status-dot.gold { background: #f59e0b; }
  .status-dot.red { background: #ef4444; }
  .panel-ico {
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 6px;
    margin-right: 6px;
    vertical-align: -3px;
  }
  .sales-ico {
    background: linear-gradient(180deg, #2ba8e0, #135fa3);
  }
  .orders-ico {
    background: linear-gradient(180deg, #9fd6f0, #1673c4);
  }
  .range-pill {
    font-size: 12px;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    padding: 6px 10px;
  }
  .sales-meta em {
    display: inline-block;
    margin-top: 4px;
    font-style: normal;
    font-size: 11px;
    font-weight: 700;
    border-radius: 999px;
    padding: 2px 8px;
  }
  .delta.up {
    background: #dcfce7;
    color: #166534;
  }
  .delta.flat {
    background: #f1f5f9;
    color: #64748b;
  }
  .mid, .bottom {
    display: grid;
    gap: 14px;
    margin-bottom: 14px;
  }
  .mid {
    grid-template-columns: 1.2fr 1fr;
  }
  .bottom {
    grid-template-columns: 1.1fr 0.8fr 1fr 0.9fr;
  }
  .panel {
    background: #fff;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 8px 24px rgba(15, 39, 68, 0.05);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  h3 {
    margin: 0;
    font-size: 16px;
  }
  header a, header span {
    font-size: 12px;
    color: #135fa3;
    text-decoration: none;
    font-weight: 600;
  }
  .chart {
    width: 100%;
    height: 180px;
  }
  .sales-meta {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .sales-meta span {
    display: block;
    color: #64748b;
    font-size: 12px;
  }
  table {
    width: 100%;
    font-size: 13px;
  }
  th {
    color: #94a3b8;
    font-weight: 600;
  }
  .pill {
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 700;
  }
  .pill.ok { background: #dcfce7; color: #166534; }
  .pill.info { background: #dbeafe; color: #1d4ed8; }
  .pill.warn { background: #e0f1fa; color: #13344f; }
  .pill.bad { background: #fee2e2; color: #b91c1c; }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid #f1f5f9;
  }
  .row img, .ph, .avatar {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    object-fit: cover;
    background: #e2e8f0;
    flex: none;
  }
  .avatar {
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #12b5a0;
    color: #fff;
    font-weight: 700;
  }
  .grow { flex: 1; min-width: 0; }
  .grow strong, .end strong { display: block; font-size: 13px; }
  .grow small, .end small { color: #94a3b8; font-size: 11px; }
  .stock {
    text-align: center;
  }
  .donut {
    width: 150px;
    height: 150px;
    margin: 0 auto;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    text-align: left;
    font-size: 13px;
  }
  li {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 6px 0;
  }
  i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  i.ok { background: #22c55e; }
  i.low { background: #f59e0b; }
  i.out { background: #ef4444; }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
  }
  .btn {
    display: block;
    text-align: center;
    text-decoration: none;
    border-radius: 10px;
    padding: 10px;
    font-weight: 700;
    font-size: 13px;
  }
  .teal { background: #12b5a0; color: #fff; }
  .navy { background: #0d2137; color: #fff; }
  .ghost { background: #eef6f5; color: #0f766e; }
  .empty { color: #94a3b8; font-size: 13px; }
  @media (max-width: 1200px) {
    .kpis, .mid, .bottom {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-width: 800px) {
    .kpis, .mid, .bottom {
      grid-template-columns: 1fr;
    }
    .welcome {
      flex-direction: column;
      align-items: flex-start;
    }
    .welcome-art {
      display: none;
    }
  }
</style>
