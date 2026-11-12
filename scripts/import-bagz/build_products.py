"""
Build Bagz Apple Services products from the current WooCommerce site (bagzappleservices.com).

  python scripts/import-bagz/build_products.py            # build products.json (uploads photos, writes copy)
  python scripts/import-bagz/build_products.py --no-ai    # skip AI copy (use templates)

Then review scripts/import-bagz/out/products.json and write it with:
  node scripts/import-bagz/write_products.mjs           (dry run)
  node scripts/import-bagz/write_products.mjs --write

Rules agreed with the client:
- Source: the Bagz WooCommerce Store API (their own names, prices, descriptions and photos).
- Template/demo items (dollar-like prices, "Brand N" brands, the "sound" demo category) are skipped.
- Products without a real photo are imported hidden (hidden=true, hiddenReason="no-photo").
- In-stock products get stock 5, out-of-stock 0 (review later in Admin -> Inventory).
- Existing Bagz descriptions are kept (cleaned of HTML and spam); AI writes copy only where missing,
  without inventing specs that are not in the product name.
"""
import html
import io
import json
import os
import re
import subprocess
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor

LOCK = threading.Lock()

import requests
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(os.path.dirname(__file__), "out")
CACHE = os.path.join(os.path.dirname(__file__), ".cache")
os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

API = "https://bagzappleservices.com/wp-json/wc/store/v1/products"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 BagzCatalogImport"}
USE_AI = "--no-ai" not in sys.argv
LOCAL_IMAGES = r"D:\bagzapple"


def env(path):
    vals = {}
    for line in open(path, encoding="utf-8"):
        m = re.match(r'^([A-Z_]+)="?([^"\n]*)"?', line)
        if m:
            vals[m.group(1)] = m.group(2).strip()
    return vals


ADMIN_ENV = env(os.path.join(ROOT, "admin", ".env"))
CLOUD = ADMIN_ENV.get("PUBLIC_CLOUDINARY_CLOUD_NAME", "")
PRESET = ADMIN_ENV.get("PUBLIC_CLOUDINARY_UPLOAD_PRESET", "")
OPENROUTER = ADMIN_ENV.get("OPENROUTER_API_KEY", "")


# ---------------------------------------------------------------- fetch
def fetch_all():
    items, page = [], 1
    while True:
        r = requests.get(API, params={"per_page": 100, "page": page}, headers=UA, timeout=60)
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        items += batch
        page += 1
    return items


# ---------------------------------------------------------------- cleaning
SPAM = re.compile(r"casino|kasino|\bbet\b|betting|slot|gambl|apuesta|poker|bonus code", re.I)


def html_to_text(raw):
    t = raw or ""
    t = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", "", t)
    t = re.sub(r"(?i)<br\s*/?>", "\n", t)
    t = re.sub(r"(?i)<li[^>]*>", "\n• ", t)
    t = re.sub(r"(?i)</(p|div|h[1-6]|li|ul|ol|tr)>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t).replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in t.split("\n")]
    lines = [ln for ln in lines if ln and not SPAM.search(ln) and not re.search(r"https?://", ln)]
    out, blank = [], False
    for ln in lines:
        out.append(ln)
    text = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def is_demo(p):
    price = int(p["prices"]["price"] or 0)
    slugs = {c["slug"] for c in p["categories"]}
    brands_attr = [t["name"] for a in p.get("attributes", []) if a["name"].lower() == "brands" for t in a["terms"]]
    if "sound" in slugs:
        return "demo category 'sound'"
    if any(re.match(r"^Brand \d+$", b) for b in brands_attr):
        return "demo 'Brand N' item"
    if 0 < price < 5000:
        return f"demo price {price}"
    return None


def cap_words(name):
    rep = {
        "pro": "Pro", "max": "Max", "plus": "Plus", "ultra": "Ultra", "mini": "mini", "air": "Air",
        "fold": "Fold", "flip": "Flip", "fe": "FE", "classic": "Classic", "watch": "Watch",
    }
    return " ".join(rep.get(w.lower(), w) if w.isalpha() else w for w in name.split())


def normalize_name(raw, slugs):
    n = html.unescape(raw).replace("\u2013", "-").replace("\u2014", "-")
    n = re.sub(r"\s+", " ", n).strip()
    n = re.sub(r"(?i)\biphone\b", "iPhone", n)
    n = re.sub(r"(?i)\bipad\b", "iPad", n)
    n = re.sub(r"(?i)\bmacbook\b", "MacBook", n)
    n = re.sub(r"(?i)\bairpods\b", "AirPods", n)
    n = re.sub(r"(?i)\bjbl\b", "JBL", n)
    n = re.sub(r"(?i)(\d+)nc\b", r"\1NC", n)
    n = re.sub(r"(?i)\bXS ?max\b", "XS Max", n)
    n = re.sub(r"(?i)pro\s*max", " Pro Max", n)                 # 16promax1TB -> 16 Pro Max1TB
    n = re.sub(r"(?i)(\d)(pro|plus|mini)\b", r"\1 \2", n)       # 14pro -> 14 pro
    n = re.sub(r"(?i)\b(max|pro|plus)(\d)", r"\1 \2", n)        # Max1TB -> Max 1TB, Pro14 -> Pro 14
    n = re.sub(r"(?i)\b(iphone \d+)\+", r"\1 Plus", n)          # 14+ -> 14 Plus
    n = re.sub(r"(?i)(\d+(?:\.\d+)?)\s*inch\b", r"\1-inch", n)  # 13.6inch -> 13.6-inch
    n = re.sub(r"(?i)\b(M\d)\s*chip\b", r"\1 chip", n)          # M3chip -> M3 chip
    n = re.sub(r"(?i)\bwatch\s*(\d)", r"Watch \1", n)           # Watch8 -> Watch 8
    n = re.sub(r"(?i)\bwatch s(\d{1,2})\b", r"Watch Series \1", n)
    n = re.sub(r"(?i)\b([AMS]\d{2})g\b", r"\1", n)              # M35g -> M35
    n = re.sub(r"(?i)\b([45])g\b", r"\1G", n)                   # 5g -> 5G
    n = re.sub(r"(?i)(\d+)\s*gb\b", r"\1GB", n)
    n = re.sub(r"(?i)(\d+)\s*tb\b", r"\1TB", n)
    n = re.sub(r"(?i)(\d+)\s*mm\b", r"\1mm", n)
    n = cap_words(n)
    # Samsung shorthand: "A56 5G 128/8", "Tabs S10 Ultra", "Z Fold 7 512GB", "Flip 7 256 gb"
    # Samsung "128/8" = storage/RAM (only when the first number is a real storage size)
    n = re.sub(r"\b(32|64|128|256|512|1024)/(\d{1,2})\b", r"\1GB/\2GB RAM", n)
    n = re.sub(r"(?i)\b(XL|Pro|Fold|Ultra|Plus) (128|256|512)$", r"\1 \2GB", n)
    n = re.sub(r"(?i)^buds", "Samsung Galaxy Buds", n)
    n = re.sub(r"(?i)^AirPods", "Apple AirPods", n)
    n = re.sub(r"(?i)^partybox", "JBL PartyBox", n)
    n = re.sub(r"(?i)smart watch", "Smart Watch", n)
    n = re.sub(r"(?i)^tabs?\s+", "Samsung Galaxy Tab ", n)
    n = re.sub(r"(?i)^(z\s*)?fold\s*(\d)", r"Samsung Galaxy Z Fold\2", n)
    n = re.sub(r"(?i)^(z\s*)?flip\s*(\d)", r"Samsung Galaxy Z Flip\2", n)
    n = re.sub(r"(?i)^samsung\s+(?!galaxy)", "Samsung Galaxy ", n)
    if re.match(r"^[AMS]\d{2}", n):
        n = "Samsung Galaxy " + n
    if re.match(r"(?i)^galaxy\b", n):
        n = "Samsung " + n
    if re.match(r"(?i)^pixel\b", n):
        n = "Google " + n
    if "samsung-galaxy-watch" in slugs and not re.search(r"(?i)samsung|galaxy", n):
        n = "Samsung Galaxy " + n
    if re.match(r"^iPhone\b", n):
        n = "Apple " + n
    n = re.sub(r"(?i)\bapple apple\b", "Apple", n)
    n = re.sub(r"\s+", " ", n).strip(" -")
    return n


def category_for(name, slugs):
    n = name.lower()
    if re.search(r"case|cover|charger|cable|protector|power ?bank|magsafe|smart ?tag|airtag", n) and not re.search(r"iphone \d+ ?(pro|plus|max)? ?\d+gb", n):
        return "Accessories"
    if "iphone" in n:
        return "iPhones"
    if "watch" in n or slugs & {"watches", "samsung-galaxy-watch", "apple-watches"}:
        return "Watches"
    if "pixel" in n:
        return "Google Pixel"
    if "ipad" in n:
        return "iPads"
    if "macbook" in n or slugs & {"macbook", "mac"}:
        return "MacBooks"
    if re.search(r"headphone|headset|speaker|buds|airpod|earphone|\bmic\b|microphone|jbl|sony|bose|sound ?bar|anc", n) or slugs & {
        "jbl-bluetooth-speakers", "jbl-bluetooth-headsets", "airpods", "samsung-galaxy-buds", "sony", "mics", "microphones", "bagz-apple"}:
        return "AirPods & Audio"
    if "samsung" in n or slugs & {"samsung-s-series", "samsung-a-series", "samsung-z-series", "samsung-m-series", "samsung-galaxy-tab"}:
        return "Samsung"
    if slugs & {"accessories", "power-cables", "phone-cases", "p-bank", "bagz-accessories"}:
        return "Accessories"
    return None


# ---------------------------------------------------------------- images
CACHE_IMG = os.path.join(CACHE, "images.json")
img_cache = json.load(open(CACHE_IMG, encoding="utf-8")) if os.path.exists(CACHE_IMG) else {}


def cloud_upload(jpeg_bytes, public_id, folder):
    path = os.path.join(CACHE, "upload.jpg")
    r = requests.post(
        f"https://api.cloudinary.com/v1_1/{CLOUD}/image/upload",
        data={"upload_preset": PRESET, "folder": folder, "public_id": public_id},
        files={"file": (f"{public_id}.jpg", jpeg_bytes, "image/jpeg")},
        timeout=120,
    )
    d = r.json()
    if "secure_url" not in d:
        raise RuntimeError(d.get("error", {}).get("message", "upload failed"))
    return d["secure_url"]


def to_jpeg(raw, max_side, quality):
    im = Image.open(io.BytesIO(raw))
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[3])
        im = bg
    im = im.convert("RGB")
    im.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    return buf.getvalue()


def process_image(key, raw):
    """Upload gallery (1080) + card (480) versions once; cached by source key."""
    if key in img_cache:
        return img_cache[key]
    gallery = cloud_upload(to_jpeg(raw, 1080, 80), re.sub(r"[^a-z0-9-]", "-", key.lower())[-60:], "product/images")
    card = cloud_upload(to_jpeg(raw, 480, 75), re.sub(r"[^a-z0-9-]", "-", key.lower())[-55:] + "_card", "product/images")
    with LOCK:
        img_cache[key] = {"gallery": gallery, "card": card}
        json.dump(dict(img_cache), open(CACHE_IMG, "w", encoding="utf-8"), indent=1)
    return img_cache[key]


def remote_images(p):
    out = []
    for i, im in enumerate((p.get("images") or [])[:5]):
        src = im.get("src", "")
        if not src or "placeholder" in src:
            continue
        key = f"wp{p['id']}-{i}"
        try:
            if key not in img_cache:
                for attempt in range(4):
                    try:
                        r = requests.get(src, headers=UA, timeout=60)
                        r.raise_for_status()
                        break
                    except requests.RequestException:
                        if attempt == 3:
                            raise
                        time.sleep(2 * (attempt + 1))
                process_image(key, r.content)
            out.append(img_cache[key])
        except Exception as e:  # noqa: BLE001
            print(f"   ! image failed for {p['id']}: {e}")
    return out


# Client-supplied photos for iPhones missing a photo on the old site.
LOCAL_BY_MODEL = [
    (r"iphone duo", "iphone-duo-star-white-front-back.jpg"),
    (r"iphone 18 pro max", "iphone18-promax 512.jpg"),
    (r"iphone 18 pro", "iphone18_pro.jpg"),
    (r"iphone 17 pro max", "iphone17promx.jpg"),
    (r"iphone 17 pro", "1.jpg"),
    (r"iphone air", "Air2.jpg"),
    (r"iphone 17", "iphone17 (1).jpg"),
]


def local_images(name):
    n = name.lower()
    for pattern, fname in LOCAL_BY_MODEL:
        if re.search(pattern, n):
            path = os.path.join(LOCAL_IMAGES, fname)
            if os.path.exists(path):
                return [process_image("local-" + fname, open(path, "rb").read())]
    return []


# ---------------------------------------------------------------- copy
CACHE_AI = os.path.join(CACHE, "ai.json")
ai_cache = json.load(open(CACHE_AI, encoding="utf-8")) if os.path.exists(CACHE_AI) else {}

DEVICE_CATS = {"iPhones", "Samsung", "Google Pixel", "MacBooks", "iPads", "Watches"}


def ai_copy(name, category, hint):
    key = f"{name}|{category}"
    if key in ai_cache:
        return ai_cache[key]
    device = category in DEVICE_CATS
    prompt = f"""Write product copy for Bagz Apple Services, an authentic Apple & tech store in Kampala, Uganda.
Product name (exact, do not change): {name}
Category: {category}
Existing notes from the store (may be empty): {hint[:600]}

Return ONLY JSON: {{"description": "...", "seoDescription": "..."}}
- "description": plain text, no markdown. First a 2-sentence intro ("Buy the authentic {name} in Kampala at Bagz Apple Services. ...").
  Then a blank line, then "Key Highlights:" and 4-6 lines starting with "• ".
  Only state facts that are in the product name or the store notes (storage, RAM, size, model). NEVER invent chips, cameras,
  screen sizes, battery, release dates or other specs. Highlights may include: "• 100% Authentic{' & Factory Sealed' if 'brand new' in name.lower() else ''}",
  {'"• Warranty: 18-Month Local Warranty", ' if device else ''}"• Delivery: Same-Day Delivery in Kampala", "• Swap & Top-Up Accepted (T&Cs apply)" (phones only).
- "seoDescription": max 150 characters, mentions the product name, Kampala/Uganda and Bagz Apple Services.
"""
    r = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {OPENROUTER}", "Content-Type": "application/json",
                 "HTTP-Referer": "https://bagzappleservices.com", "X-Title": "Bagz catalog import"},
        json={"model": "google/gemini-2.5-flash", "messages": [{"role": "user", "content": prompt}],
              "response_format": {"type": "json_object"}, "temperature": 0.4, "max_tokens": 700},
        timeout=120,
    )
    r.raise_for_status()
    content = r.json()["choices"][0]["message"]["content"]
    content = re.sub(r"^```(json)?|```$", "", content.strip()).strip()
    data = json.loads(content)
    with LOCK:
        ai_cache[key] = {"description": data["description"].strip(), "seoDescription": data["seoDescription"].strip()[:155]}
        json.dump(dict(ai_cache), open(CACHE_AI, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    return ai_cache[key]


SPEC = re.compile(
    r"(\d+\s?GB\s?RAM|\d+\s?(?:GB|TB)(?=\s?(?:storage|rom|capacity))|\d[\d,]*\s?mAh|\d+\s?Hz|[\d.]+\s?(?:″|\"|-?inch)|\d+\s?MP\b|\bIP\d\w\b|\d+\s?nm\b|"
    r"\bA\d{2}\b|\bM\d\b|Snapdragon|Exynos|Tensor|Bionic|Gorilla|\bS\d{1,2} chip|nits)", re.I)


def drop_unsupported_specs(text, source):
    """Remove AI bullet lines that state a spec not present in the product name / Bagz's own text."""
    src = re.sub(r"\s+", " ", source.lower()).replace("″", '"')
    kept = []
    for line in text.split("\n"):
        specs = [m.group(0).lower().replace("″", '"') for m in SPEC.finditer(line)]
        specs = [re.sub(r"\s+", " ", x) for x in specs]
        if specs and any(x not in src and x.replace(" ", "") not in src.replace(" ", "") for x in specs):
            continue
        kept.append(line)
    return "\n".join(kept).strip()


def template_copy(name, category):
    device = category in DEVICE_CATS
    lines = [f"Buy the authentic {name} in Kampala at Bagz Apple Services.", "", "Key Highlights:", "• 100% Authentic"]
    if device:
        lines.append("• Warranty: 18-Month Local Warranty")
    lines.append("• Delivery: Same-Day Delivery in Kampala")
    return {"description": "\n".join(lines),
            "seoDescription": f"Buy {name} in Kampala, Uganda at Bagz Apple Services. 100% authentic, same-day delivery."[:155]}


def truncate(t, n):
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(t) <= n else t[: n - 1].rstrip() + "…"


def slugify(name, pid):
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:72]
    return f"{base}-{pid}"


# ---------------------------------------------------------------- main
def main():
    print("Fetching products from bagzappleservices.com …")
    items = fetch_all()
    print(f"  {len(items)} products on the old site")
    skipped, products, seen = [], [], {}
    now = int(time.time() * 1000)

    for idx, p in enumerate(items):
        slugs = {c["slug"] for c in p["categories"]}
        reason = is_demo(p)
        price = int(p["prices"]["price"] or 0)
        regular = int(p["prices"]["regular_price"] or 0) or price
        if not reason and price <= 0:
            reason = "no price"
        name = normalize_name(p["name"], slugs)
        category = category_for(name, slugs)
        if not reason and not category:
            reason = "no matching category"
        key = name.lower()
        if reason:
            skipped.append({"wpId": p["id"], "name": html.unescape(p["name"]), "reason": reason})
            continue
        entry = {"wp": p, "name": name, "category": category, "price": regular, "sale": price, "order": idx}
        if key in seen:
            # Same product listed twice on the old site: keep the one with more photos / longer text.
            prev = seen[key]
            score = lambda e: (len(e["wp"].get("images") or []), len(e["wp"]["description"] or ""))
            keep, drop = (entry, prev) if score(entry) > score(prev) else (prev, entry)
            skipped.append({"wpId": drop["wp"]["id"], "name": html.unescape(drop["wp"]["name"]),
                            "reason": f"duplicate of {keep['wp']['id']}"})
            if keep is entry:
                products[products.index(prev)] = entry
                seen[key] = entry
            continue
        seen[key] = entry
        products.append(entry)

    print(f"  importing {len(products)}, skipping {len(skipped)}")
    if "--preview" in sys.argv:
        for e in products:
            sale = f"  (sale {e['sale']:,})" if e["sale"] < e["price"] else ""
            print(f"  {e['category']:16} | {e['name'][:60]:60} | UGX {e['price']:>10,}{sale} | photos {len(e['wp'].get('images') or [])}"
                  f"{' | VARIABLE' if e['wp']['type']=='variable' else ''}")
        print()
        print("Skipped:")
        for s_ in skipped:
            print(f"  {s_['name'][:50]:50} — {s_['reason']}")
        return

    def build(entry):
        p, name, category = entry["wp"], entry["name"], entry["category"]
        imgs = remote_images(p)
        if not imgs:
            imgs = local_images(name)
        desc = html_to_text(p["description"])
        short = html_to_text(p["short_description"])
        if len(desc) >= 120:
            description = desc
            seo_desc = truncate(short or desc, 150)
            copy_source = "bagz"
        else:
            hint = (short + "\n" + desc).strip()
            try:
                c = ai_copy(name, category, hint) if USE_AI and OPENROUTER else template_copy(name, category)
                copy_source = "ai" if USE_AI and OPENROUTER else "template"
            except Exception as e:  # noqa: BLE001
                print(f"   ! AI failed for {name}: {e}; using template")
                c, copy_source = template_copy(name, category), "template"
            # Old short notes were often copy-pasted from other models (e.g. S25 text describing the
            # S25 Ultra), so only specs that are in the product name itself are trusted.
            description = drop_unsupported_specs(c["description"], name)
            # Always end with the store promises that apply to this kind of product.
            promises = []
            if category in DEVICE_CATS and "warranty" not in description.lower():
                promises.append("• Warranty: 18-Month Local Warranty")
            if "delivery" not in description.lower():
                promises.append("• Delivery: Same-Day Delivery in Kampala")
            if category in {"iPhones", "Samsung", "Google Pixel"} and "swap" not in description.lower():
                promises.append("• Swap & Top-Up Accepted (T&Cs apply)")
            if promises:
                description = description.rstrip() + "\n" + "\n".join(promises)
            seo_desc = c["seoDescription"]
            if SPEC.search(seo_desc) and drop_unsupported_specs(seo_desc, name) != seo_desc:
                seo_desc = f"Buy {name} in Kampala, Uganda at Bagz Apple Services. 100% authentic, same-day delivery."[:155]
        pid = f"wp-{p['id']}"
        offer = round((entry["price"] - entry["sale"]) / entry["price"] * 100, 4) if entry["sale"] < entry["price"] else 0
        groups = []
        if re.search(r"(?i)brand new|sealed", name):
            groups.append("Brand New")
        if offer > 0:
            groups.append("Deals")
        # Obvious typos on the old site (e.g. Z Flip6 at UGX 22,500,000) are imported hidden for review.
        price_check = bool(re.search(r"(?i)z flip", name) and entry["price"] > 10_000_000)
        hidden = not imgs or price_check
        variable_note = ""
        if p["type"] == "variable":
            variable_note = "Has options on the old site — price shown is the lowest option; review in Admin."
        return {
            "id": pid,
            "name": name,
            "nameLowercase": name.lower(),
            "category": category,
            "price": entry["price"],
            "offerPercentage": offer if offer > 0 else None,
            "saleStartAt": None,
            "saleEndAt": None,
            "groups": groups,
            "createdAt": None,  # filled by the writer (keeps old-site order)
            "order": entry["order"],
            "description": description,
            "sizes": None,
            "colors": None,
            "images": [i["gallery"] for i in imgs],
            "cardImage": imgs[0]["card"] if imgs else "",
            "stock": 5 if p["is_in_stock"] else 0,
            "sizeStock": {},
            "special": False,
            "hidden": hidden,
            "hiddenReason": "price-check" if price_check else ("no-photo" if hidden else None),
            "seoTitle": truncate(f"{name} Price in Uganda | Bagz Apple Services", 70),
            "seoDescription": seo_desc,
            "seoKeywords": ", ".join(dict.fromkeys([name, category, f"{name} price in Uganda", "Kampala", "Bagz Apple Services",
                                                    "buy online Uganda"])),
            "slug": slugify(name, p["id"]),
            "source": "bagz-wp",
            "wpId": p["id"],
            "wpUrl": p["permalink"],
            "importNote": variable_note or None,
            "_copySource": copy_source,
        }

    with ThreadPoolExecutor(max_workers=3) as pool:
        built = list(pool.map(build, products))

    json.dump(built, open(os.path.join(OUT, "products.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    json.dump(skipped, open(os.path.join(OUT, "skipped.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    by_cat = {}
    for b in built:
        c = by_cat.setdefault(b["category"], [0, 0])
        c[0] += 1
        c[1] += 0 if b["hidden"] else 1
    print("\nResult (category: total / visible with photo):")
    for c, (t, v) in sorted(by_cat.items()):
        print(f"  {c:18} {t:3} / {v}")
    print(f"\nCopy: {sum(b['_copySource']=='bagz' for b in built)} kept from Bagz, "
          f"{sum(b['_copySource']=='ai' for b in built)} AI, {sum(b['_copySource']=='template' for b in built)} template")
    print(f"Skipped {len(skipped)} → out/skipped.json")


if __name__ == "__main__":
    main()
