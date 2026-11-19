/** Help / legal pages for the shop (HTML fragments). */

import { CONTACT, SUPPORT_PHONE_TEL, ORDER_WHATSAPP_E164 } from "./contactInfo.js";
import { BRAND } from "./brand.js";

export const SUPPORT_TOPIC_IDS = [
  "support",
  "about",
  "shipping",
  "safety",
  "chat",
  "protection",
  "privacy",
  "terms",
  "seller"
];

export function supportTopicFromPath(pathname) {
  const m = pathname.match(/^\/help\/([^/?#]+)/);
  if (!m) return null;
  const id = decodeURIComponent(m[1]);
  return SUPPORT_TOPIC_IDS.includes(id) ? id : null;
}

export function supportPath(topicId) {
  return `/help/${topicId}`;
}

const branchList = BRAND.branches
  .map((b) => `<li><strong>${b.name}:</strong> ${b.address}</li>`)
  .join("");

const contactCard = `
<div class="contact-card">
  <p><strong>Phone / WhatsApp:</strong> <a href="tel:${SUPPORT_PHONE_TEL}">${CONTACT.phone}</a> · <a href="https://wa.me/${ORDER_WHATSAPP_E164}" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a></p>
  <p><strong>Email:</strong> <a href="mailto:${CONTACT.email}">${CONTACT.email}</a></p>
  <p><strong>Hours:</strong> ${CONTACT.hours}</p>
  <ul>${branchList}</ul>
</div>`;

const faqBlock = `
<h2>Frequently asked questions</h2>
<details open>
  <summary>Are your devices original?</summary>
  <p>Yes. Every phone, laptop, watch and accessory we sell is 100% authentic. Each listing states the condition, for example <strong>Brand new (sealed)</strong> or <strong>Certified pre-owned</strong>.</p>
</details>
<details>
  <summary>How do I place an order?</summary>
  <p>Add items to your cart and go to checkout. Enter your name, phone and delivery address, then pay with MTN Mobile Money, Airtel Money or card. You can also order by phone or WhatsApp.</p>
</details>
<details>
  <summary>How fast is delivery?</summary>
  <p>Same-day delivery within Kampala for orders confirmed during business hours. Upcountry orders go by courier and usually arrive in 1–3 days. You can also pick up from either branch.</p>
</details>
<details>
  <summary>Can I swap my old phone?</summary>
  <p>Yes. Tell us about your current device and we will give you a swap value. Top up the difference and take home a new device. See <a href="/help/seller">Swap &amp; top-up</a>.</p>
</details>
<details>
  <summary>Do devices come with a warranty?</summary>
  <p>Yes. Warranty terms are shown on each product and on your receipt. See <a href="/help/protection">Warranty &amp; authenticity</a>.</p>
</details>
<details>
  <summary>Are prices fixed?</summary>
  <p>Prices are in UGX and may change over time with supplier prices. The price shown at checkout is the price you pay.</p>
</details>
`;

export const SUPPORT_PAGES = {
  support: {
    title: "Support center & FAQ",
    description: "Help with orders, delivery, swaps, warranty and repairs at Bagz Apple Services.",
    body: `
<p class="lead">We are here to help before and after you buy. The fastest way to reach us is a call or WhatsApp.</p>
${contactCard}
${faqBlock}
<p>Before contacting us about an order, have your <strong>order ID</strong> and the <strong>phone number</strong> used at checkout ready.</p>
`
  },
  about: {
    title: "About Bagz Apple Services",
    description: "Kampala's trusted Apple & tech hub.",
    body: `
<p class="lead"><strong>Bagz Apple Services</strong> is Kampala's trusted Apple &amp; tech hub: an <strong>${BRAND.tagline}</strong>.</p>
<h2>What we offer</h2>
<ul>
  <li>Brand-new and certified iPhones, Google Pixel and Samsung Galaxy (including Z Fold / Z Flip)</li>
  <li>MacBooks, iPads, Apple Watch, AirPods and audio</li>
  <li>Original chargers, cables, cases, screen protectors and accessories</li>
  <li>Swap &amp; top-up on your current device</li>
  <li>Repairs and after-sales support through <strong>Bagz Service+</strong></li>
</ul>
<h2>Why choose Bagz?</h2>
<ul>
  <li><strong>${BRAND.promises.authentic}</strong></li>
  <li><strong>${BRAND.promises.warranty}</strong></li>
  <li><strong>${BRAND.promises.delivery}</strong></li>
  <li>Pay with MTN Mobile Money, Airtel Money or card</li>
</ul>
<h2>Visit us</h2>
<ul>${branchList}</ul>
`
  },
  shipping: {
    title: "Delivery & pickup",
    description: "Same-day delivery in Kampala, upcountry courier and in-store pickup.",
    body: `
<p class="lead">Get your device the same day in Kampala, or pick it up from one of our branches.</p>
<h2>Kampala</h2>
<p>Same-day delivery for orders confirmed during business hours. Our rider calls you before arrival.</p>
<h2>Upcountry</h2>
<p>We send by trusted courier. Most towns receive orders in 1–3 days. Any delivery fee is shown at checkout before you pay.</p>
<h2>Pickup</h2>
<ul>${branchList}</ul>
<h2>Problems with delivery</h2>
<p>If a package is late or arrives damaged, call or WhatsApp <a href="tel:${SUPPORT_PHONE_TEL}">${CONTACT.phone}</a> with your order ID and photos within 24 hours.</p>
`
  },
  safety: {
    title: "Safety centre",
    description: "Account security, safe payments, and avoiding scams.",
    body: `
<p class="lead">Your safety matters. Follow these tips when buying from Bagz online.</p>
<h2>Secure your account</h2>
<ul>
  <li>Use a strong, unique password for your Bagz account.</li>
  <li>Never share your mobile money PIN with anyone, including people claiming to be support.</li>
  <li>Sign out on shared devices.</li>
</ul>
<h2>Recognise scams</h2>
<ul>
  <li>We will <strong>never</strong> ask you to send money to a personal number outside the official checkout.</li>
  <li>Official support only uses <strong>${CONTACT.email}</strong> and <strong>${CONTACT.phone}</strong>.</li>
  <li>Only trust <strong>${BRAND.domain}</strong> and the social accounts linked on this site.</li>
</ul>
<h2>Report a concern</h2>
<p>Email <a href="mailto:${CONTACT.email}">${CONTACT.email}</a> with “Safety report” in the subject. Include screenshots if possible.</p>
`
  },
  chat: {
    title: "Chat with Bagz",
    description: "Call or WhatsApp Bagz Apple Services.",
    body: `
<p class="lead">Talk to a real person about a device, a swap, an order or a repair.</p>
${contactCard}
<h2>What to send</h2>
<p>Your name, the device you are interested in (or your order ID), and for swaps or repairs a few clear photos of your current device.</p>
`
  },
  protection: {
    title: "Warranty & authenticity",
    description: "Every device is authentic and covered by warranty.",
    body: `
<p class="lead">Every device from Bagz is <strong>100% authentic</strong> and comes with a warranty.</p>
<h2>What the warranty covers</h2>
<ul>
  <li>Manufacturing faults that appear under normal use during the warranty period</li>
  <li>Hardware failure not caused by drops, liquid, or unauthorised repair</li>
</ul>
<p>The warranty length for each device is shown on the product page and on your receipt.</p>
<h2>Not covered</h2>
<ul>
  <li>Physical or liquid damage, cracked screens and bent frames</li>
  <li>Devices opened or repaired outside Bagz Service+</li>
  <li>Normal wear of batteries, cases and cables</li>
</ul>
<h2>How to make a claim</h2>
<ol>
  <li>Call or WhatsApp <a href="tel:${SUPPORT_PHONE_TEL}">${CONTACT.phone}</a> with your order ID or receipt.</li>
  <li>Bring the device to either branch for inspection.</li>
  <li>We repair or replace eligible devices. Larger repairs may take a few working days.</li>
</ol>
<p>See also <a href="/help/terms">Terms of use</a>.</p>
`
  },
  privacy: {
    title: "Privacy policy",
    description: "How Bagz Apple Services collects and uses your personal data.",
    body: `
<p class="lead">Last updated: November 2026. This policy explains how Bagz Apple Services (“we”, “us”) handles your information when you use our website and app.</p>
<h2>Information we collect</h2>
<ul>
  <li><strong>Account:</strong> name, email, phone number, delivery addresses</li>
  <li><strong>Orders:</strong> products purchased, payment status, delivery details</li>
  <li><strong>Technical:</strong> device type, browser, approximate location (for fraud prevention), cookies for sign-in and cart</li>
</ul>
<h2>How we use it</h2>
<ul>
  <li>Process orders and payments</li>
  <li>Deliver products and send order updates</li>
  <li>Improve the shop and prevent fraud</li>
  <li>Send marketing only if you opt in (you can opt out anytime)</li>
</ul>
<h2>Sharing</h2>
<p>We share data only with payment partners, delivery couriers, and cloud providers needed to run the service. We do not sell your personal data.</p>
<h2>Your rights</h2>
<p>You may request access, correction, or deletion of your account data by emailing <a href="mailto:${CONTACT.email}">${CONTACT.email}</a>.</p>
<h2>Security</h2>
<p>We use industry-standard encryption and access controls. Keep your account password private.</p>
`
  },
  terms: {
    title: "Terms of use",
    description: "Terms and conditions for using Bagz Apple Services.",
    body: `
<p class="lead">By using Bagz Apple Services you agree to these terms. Please read them before placing an order.</p>
<h2>Shopping</h2>
<ul>
  <li>Product photos are for illustration; colour and packaging may vary slightly. Each listing states the device condition.</li>
  <li>Prices are subject to variation over time; the price confirmed at checkout applies.</li>
  <li>Prices are in <strong>UGX</strong> unless stated otherwise. Promotions may change without notice.</li>
  <li>We may cancel orders suspected of fraud or pricing errors, with a full refund.</li>
</ul>
<h2>Payments</h2>
<p>Payment is due at checkout via approved methods. You authorise us to charge the amount shown, including applicable shipping and taxes.</p>
<h2>Delivery &amp; returns</h2>
<p>Delivery options are in <a href="/help/shipping">Delivery &amp; pickup</a>. Warranty rules are in <a href="/help/protection">Warranty &amp; authenticity</a>. Sealed devices can only be returned unopened.</p>
<h2>Accounts</h2>
<p>You are responsible for activity on your account. Notify us immediately if you suspect unauthorised access.</p>
<h2>Limitation of liability</h2>
<p>To the extent permitted by Ugandan law, Bagz is not liable for indirect losses. Our liability for any order is limited to the amount you paid for that order.</p>
<h2>Changes</h2>
<p>We may update these terms; continued use after changes means you accept the updated terms.</p>
<p>Questions: <a href="mailto:${CONTACT.email}">${CONTACT.email}</a></p>
`
  },
  seller: {
    title: "Swap & top-up",
    description: "Trade in your current phone and top up for a new one.",
    body: `
<p class="lead"><strong>Swap &amp; top-ups are accepted</strong> (T&amp;Cs apply). Trade in your current device and pay only the difference.</p>
<h2>How it works</h2>
<ol>
  <li>WhatsApp <a href="https://wa.me/${ORDER_WHATSAPP_E164}" target="_blank" rel="noopener noreferrer">${CONTACT.phone}</a> with your device model, storage, battery health and clear photos (front, back, sides).</li>
  <li>We send an estimated swap value.</li>
  <li>Bring the device to a branch for a final check.</li>
  <li>Top up the difference and leave with your new device.</li>
</ol>
<h2>What we accept</h2>
<ul>
  <li>iPhones, Google Pixel and Samsung Galaxy in working condition</li>
  <li>iCloud / Google account removed and device not blacklisted</li>
  <li>Original ID of the owner may be required</li>
</ul>
<p>Final value depends on condition, battery health, and market price on the day.</p>
`
  }
};

export function getSupportPage(topicId) {
  return SUPPORT_PAGES[topicId] || SUPPORT_PAGES.support;
}
