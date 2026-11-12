import { get, writable } from "svelte/store";
import { fetchAllProductsPaged } from "$lib/data/products";

export const productCatalog = writable<any[]>([]);

let inflight: Promise<any[]> | null = null;
let loaded = false;

export function invalidateProductCatalog() {
  loaded = false;
}

export function loadProductCatalog(force = false): Promise<any[]> {
  if (loaded && !force) return Promise.resolve(get(productCatalog));
  if (inflight && !force) return inflight;
  inflight = fetchAllProductsPaged((soFar) => {
    productCatalog.set(soFar);
  })
    .then((all) => {
      productCatalog.set(all);
      loaded = true;
      return all;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
