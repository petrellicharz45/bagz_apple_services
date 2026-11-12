const KEY = "bagz_browse_v1";
const MAX = 12;

export function pushBrowse(product) {
  if (!product?.id) return;
  try {
    const list = read().filter((p) => p.id !== product.id);
    list.unshift({
      id: product.id,
      name: product.name,
      category: product.category,
      cardImage: product.cardImage,
      images: product.images,
      price: product.price,
      offerPercentage: product.offerPercentage
    });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
