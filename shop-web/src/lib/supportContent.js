/** Help / legal pages for the shop (HTML fragments). */

import { CONTACT, SUPPORT_PHONE_TEL, ORDER_WHATSAPP_E164 } from "./shopContact.js";

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

const faqBlock = `
<h2>Frequently asked questions</h2>
<details open>
  <summary>How do I place an order?</summary>
  <p>Browse products, add items to your cart, then go to checkout. Enter your name, phone, and delivery address. Pay with Mobile Money (MTN or Airtel) when prompted.</p>
</details>
<details>
  <summary>How long does delivery take?</summary>
  <p>Delivery time is shown on each product (typically 2–14 days depending on the item). You will see updates under <strong>Orders &amp; Account → Your orders</strong>.</p>
</details>
<details>
  <summary>Can I cancel or change my order?</summary>
  <p>Contact us within 2 hours of placing the order if you need to change the address or cancel. Once the order is packed, changes may not be possible.</p>
</details>
<details>
  <summary>What payment methods do you accept?</summary>
  <p>We accept MTN Mobile Money and Airtel Money on the web checkout. Cash on delivery may be offered on selected items—check the product page.</p>
</details>
<details>
  <summary>How do refunds work?</summary>
  <p>If an item is wrong, damaged, or never arrives, open a ticket via email with your order ID. Eligible refunds are returned to the same payment number within 5–10 business days after approval.</p>
</details>
`;

export const SUPPORT_PAGES = {
  support: {
    title: "Support center & FAQ",
    description: "Help with orders, delivery, payments, and returns on Fancy Deals Uganda.",
    body: `
<p class="lead">We are here to help you shop safely and get your order on time. Reach us any time—responses are fastest during business hours.</p>
<div class="contact-card">
  <p><strong>Email:</strong> <a href="mailto:${CONTACT.email}">${CONTACT.email}</a></p>
  <p><strong>Phone / WhatsApp:</strong> <a href="tel:${SUPPORT_PHONE_TEL}">${CONTACT.phone}</a></p>
  <p><strong>Hours:</strong> ${CONTACT.hours}</p>
</div>
${faqBlock}
<p>Before contacting us, have your <strong>order ID</strong> and the <strong>phone number</strong> used at checkout ready.</p>
`
  },
  about: {
    title: "About Fancy Deals",
    description: "Who we are and how Fancy Deals Uganda serves online shoppers.",
    body: `
<p class="lead"><strong>Fancy Deals Uganda</strong> is an online marketplace focused on value, variety, and reliable delivery across Uganda.</p>
<h2>What we offer</h2>
<ul>
  <li>Fashion, electronics, home goods, and everyday essentials at competitive UGX prices</li>
  <li>Secure Mobile Money checkout</li>
  <li>Delivery estimates on every product page</li>
  <li>Customer support in English (Luganda assistance on request)</li>
</ul>
<h2>Our promise</h2>
<p>We work with trusted suppliers and verify listings before they go live. If something goes wrong with your order, our purchase protection and support team will help you resolve it fairly.</p>
<p>Thank you for shopping with us.</p>
`
  },
  shipping: {
    title: "Shipping & delivery",
    description: "Delivery times, fees, and tracking for Fancy Deals Uganda orders.",
    body: `
<p class="lead">Delivery options and estimated arrival times are shown on each product. Times may vary for upcountry addresses.</p>
<h2>How shipping works</h2>
<ol>
  <li>You complete checkout with a valid Uganda phone number and delivery address.</li>
  <li>We confirm your order and prepare items for dispatch.</li>
  <li>A courier or partner delivers to your address. You may receive an SMS or call before delivery.</li>
</ol>
<h2>Delivery areas</h2>
<p>We deliver to Kampala, Wakiso, and major towns nationwide. Remote areas may need an extra 1–3 days—contact support if you are unsure.</p>
<h2>Fees</h2>
<p>Many items include <strong>free or low-cost shipping</strong> as shown on the product card. Any shipping fee is displayed at checkout before you pay.</p>
<h2>Problems with delivery</h2>
<p>If your package is late, damaged, or missing, email <a href="mailto:${CONTACT.email}">${CONTACT.email}</a> with photos and your order ID within 48 hours of the expected delivery date.</p>
`
  },
  safety: {
    title: "Safety centre",
    description: "Account security, safe payments, and reporting scams on Fancy Deals.",
    body: `
<p class="lead">Your safety matters. Follow these tips when shopping online with Fancy Deals.</p>
<h2>Secure your account</h2>
<ul>
  <li>Use a strong, unique password for your Fancy Deals account.</li>
  <li>Never share your mobile money PIN with anyone—including people claiming to be support.</li>
  <li>Sign out on shared devices.</li>
</ul>
<h2>Recognise scams</h2>
<ul>
  <li>We will <strong>never</strong> ask you to send money to a personal number outside the official checkout.</li>
  <li>Official support only uses <strong>${CONTACT.email}</strong> and numbers listed on this site.</li>
  <li>Be wary of “too good to be true” links on social media—use <strong>fancydeals.ug</strong> or this official shop URL only.</li>
</ul>
<h2>Report a concern</h2>
<p>Email <a href="mailto:${CONTACT.email}">${CONTACT.email}</a> with “Safety report” in the subject. Include screenshots if possible. We investigate every report.</p>
`
  },
  chat: {
    title: "Chat with Fancy Deals",
    description: "Contact Fancy Deals Uganda for order help.",
    body: `
<p class="lead">Live chat is rolling out soon. You can still reach us quickly using the options below.</p>
<h2>Fastest ways to reach us</h2>
<ul>
  <li><strong>Email:</strong> <a href="mailto:${CONTACT.email}">${CONTACT.email}</a> (include order ID)</li>
  <li><strong>WhatsApp / phone:</strong> <a href="https://wa.me/${ORDER_WHATSAPP_E164}" target="_blank" rel="noopener noreferrer">${CONTACT.phone}</a></li>
</ul>
<h2>What to send</h2>
<p>Your full name, phone number used at checkout, order ID or product link, and a short description of the issue. Photos help for damaged items.</p>
<p><strong>Hours:</strong> ${CONTACT.hours}</p>
`
  },
  protection: {
    title: "Fancy Deals purchase protection",
    description: "Delivery guarantee and buyer protection on eligible orders.",
    body: `
<p class="lead">Purchase protection helps when something goes wrong with an eligible order.</p>
<h2>You are covered when</h2>
<ul>
  <li>Your order does not arrive within the stated delivery window (after investigation with the courier)</li>
  <li>You receive the wrong item or a significantly different product than described</li>
  <li>An item arrives damaged and cannot be used as intended</li>
</ul>
<h2>How to make a claim</h2>
<ol>
  <li>Contact <a href="mailto:${CONTACT.email}">${CONTACT.email}</a> within <strong>7 days</strong> of delivery (or within 7 days after the latest estimated delivery date if the package never arrived).</li>
  <li>Provide order ID, photos, and your payment phone number used for payment.</li>
  <li>Our team will review and respond within 2–3 business days.</li>
</ol>
<h2>Outcomes</h2>
<p>Depending on the case we may offer a replacement, partial refund, or full refund to your Mobile Money wallet. Items must be returned when requested in original packaging where possible.</p>
<p>See also <a href="/help/terms">Terms of use</a> for full policy details.</p>
`
  },
  privacy: {
    title: "Privacy policy",
    description: "How Fancy Deals Uganda collects and uses your personal data.",
    body: `
<p class="lead">Last updated: October 2026. This policy explains how Fancy Deals Uganda (“we”, “us”) handles your information when you use our website and app.</p>
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
    description: "Terms and conditions for using Fancy Deals Uganda.",
    body: `
<p class="lead">By using Fancy Deals Uganda you agree to these terms. Please read them before placing an order.</p>
<h2>Shopping</h2>
<ul>
  <li>Product images and descriptions are provided by sellers and Fancy Deals; minor variations may occur.</li>
  <li>Prices are in <strong>UGX</strong> unless stated otherwise. Promotions may change without notice.</li>
  <li>We may cancel orders suspected of fraud or pricing errors, with a full refund.</li>
</ul>
<h2>Payments</h2>
<p>Payment is due at checkout via approved methods. You authorise us to charge the amount shown, including applicable shipping and taxes.</p>
<h2>Delivery &amp; returns</h2>
<p>Delivery estimates are shown per product. Return and refund rules are described in <a href="/help/protection">Purchase protection</a> and our support FAQ.</p>
<h2>Accounts</h2>
<p>You are responsible for activity on your account. Notify us immediately if you suspect unauthorised access.</p>
<h2>Limitation of liability</h2>
<p>To the extent permitted by Ugandan law, Fancy Deals is not liable for indirect losses. Our liability for any order is limited to the amount you paid for that order.</p>
<h2>Changes</h2>
<p>We may update these terms; continued use after changes means you accept the updated terms.</p>
<p>Questions: <a href="mailto:${CONTACT.email}">${CONTACT.email}</a></p>
`
  },
  seller: {
    title: "Sell on Fancy Deals",
    description: "Become a seller on Fancy Deals Uganda.",
    body: `
<p class="lead">Want to list products on Fancy Deals? We welcome quality sellers across Uganda.</p>
<h2>Who can sell</h2>
<ul>
  <li>Registered businesses or individuals with verifiable contact details</li>
  <li>Sellers who can fulfill orders within stated delivery times</li>
  <li>Categories: fashion, electronics, home, beauty, and more</li>
</ul>
<h2>How to apply</h2>
<p>Email <a href="mailto:${CONTACT.email}">${CONTACT.email}</a> with subject <strong>Seller application</strong> and include:</p>
<ul>
  <li>Business or trading name</li>
  <li>Phone and location</li>
  <li>Sample product photos and categories</li>
</ul>
<p>Our team will reply with onboarding steps and commission details.</p>
`
  }
};

export function getSupportPage(topicId) {
  return SUPPORT_PAGES[topicId] || SUPPORT_PAGES.support;
}
