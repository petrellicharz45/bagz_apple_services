/**
 * schema.org structured data for Google (JSON-LD). Used at runtime (pageSeo.js) and at build time
 * (scripts/prerender-seo.mjs), so search engines see the same data either way.
 * Pure module: no browser or Firebase imports.
 */
import { BRAND } from "./brand.js";
import { categoryPath, productPath, productBrand } from "./seoPaths.js";

const clean = (obj) => JSON.parse(JSON.stringify(obj)); // drop undefined

/** Organization + WebSite + one ElectronicsStore per branch (local SEO / Google Maps). */
export function siteGraph(base) {
  const org = `${base}/#organization`;
  const sameAs = Object.values(BRAND.social || {}).filter((u) => /^https:\/\//.test(u));
  return clean({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": org,
        name: BRAND.name,
        alternateName: BRAND.shortName,
        url: `${base}/`,
        logo: { "@type": "ImageObject", url: `${base}${BRAND.logo}` },
        image: `${base}${BRAND.ogImage}`,
        slogan: BRAND.tagline,
        description: BRAND.description,
        email: BRAND.contact.email,
        telephone: BRAND.contact.phoneTel,
        areaServed: { "@type": "Country", name: "Uganda" },
        sameAs: sameAs.length ? sameAs : undefined,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          telephone: BRAND.contact.phoneTel,
          email: BRAND.contact.email,
          areaServed: "UG",
          availableLanguage: ["English"]
        }
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: `${base}/`,
        name: BRAND.name,
        alternateName: BRAND.shortName,
        publisher: { "@id": org },
        inLanguage: "en-UG",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${base}/?q={search_term_string}` },
          "query-input": "required name=search_term_string"
        }
      },
      ...BRAND.branches.map((b) => ({
        "@type": "ElectronicsStore",
        "@id": `${base}/#store-${b.id}`,
        name: `${BRAND.name} — ${b.name}`,
        parentOrganization: { "@id": org },
        url: `${base}/`,
        image: `${base}${BRAND.ogImage}`,
        logo: `${base}${BRAND.logo}`,
        telephone: BRAND.contact.phoneTel,
        email: BRAND.contact.email,
        priceRange: "UGX",
        currenciesAccepted: "UGX",
        paymentAccepted: "Cash, Mobile Money, Card",
        address: {
          "@type": "PostalAddress",
          streetAddress: b.address,
          addressLocality: "Kampala",
          addressRegion: "Central Region",
          addressCountry: "UG"
        },
        // Only Sunday hours are confirmed by the client; weekday hours are left out until known.
        openingHoursSpecification: [
          { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: "11:00", closes: "17:00" }
        ]
      }))
    ]
  });
}

/** Product + Offer (price/availability) + breadcrumb for one product page. */
export function productGraph(base, product, { price, image, images = [], description } = {}) {
  const url = `${base}${productPath(product)}`;
  const brand = productBrand(product.name);
  const inStock = Number(product.stock) > 0;
  const condition = /brand new|sealed/i.test(product.name)
    ? "https://schema.org/NewCondition"
    : /refurb|pre-?owned|used|uk used/i.test(product.name)
      ? "https://schema.org/UsedCondition"
      : undefined;
  return clean({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: product.name,
        url,
        image: images.length ? images : image ? [image] : undefined,
        description: (description || product.seoDescription || "").slice(0, 5000) || undefined,
        sku: String(product.wpId || product.id),
        category: product.category,
        brand: brand ? { "@type": "Brand", name: brand } : undefined,
        offers: {
          "@type": "Offer",
          url,
          priceCurrency: "UGX",
          price: Math.round(price),
          availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: condition,
          seller: { "@id": `${base}/#organization` },
          areaServed: "UG"
        }
      },
      breadcrumb(base, [
        ["Home", "/"],
        [product.category, categoryPath(product.category)],
        [product.name, productPath(product)]
      ])
    ]
  });
}

/** Category landing page: collection + item list + breadcrumb. */
export function categoryGraph(base, category, products) {
  const url = `${base}${categoryPath(category)}`;
  return clean({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: `${category} in Uganda — ${BRAND.name}`,
        isPartOf: { "@id": `${base}/#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: products.length,
          itemListElement: products.slice(0, 50).map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${base}${productPath(p)}`,
            name: p.name
          }))
        }
      },
      breadcrumb(base, [
        ["Home", "/"],
        [category, categoryPath(category)]
      ])
    ]
  });
}

export function breadcrumb(base, items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: `${base}${path}`
    }))
  };
}
