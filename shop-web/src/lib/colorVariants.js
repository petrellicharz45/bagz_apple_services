import { colorToDisplay, coverUrl, colorLabelFromValue } from "./catalog.js";
import { galleryImagesForProduct } from "./productPhotos.js";

/**
 * Shop color choices: backend colors + gallery thumb per color.
 * @returns {{ value: string, label: string, imageUrl: string, galleryIndex: number }[]}
 */
export function productColorChoices(product) {
  const raw = Array.isArray(product?.colors) ? product.colors : [];
  if (!raw.length) return [];

  const images = galleryImagesForProduct(product);
  const indices = Array.isArray(product?.colorImageIndices) ? product.colorImageIndices : [];

  return raw
    .map((c, i) => {
      const value = colorToDisplay(c);
      if (!value) return null;
      let galleryIndex =
        typeof indices[i] === "number" && Number.isFinite(indices[i]) ? indices[i] : i;
      if (images.length > 0) {
        galleryIndex = Math.max(0, Math.min(galleryIndex, images.length - 1));
      } else {
        galleryIndex = 0;
      }
      const imageUrl = images[galleryIndex] || images[0] || coverUrl(product) || "";
      return {
        value,
        label:
          (Array.isArray(product?.colorLabels) && product.colorLabels[i]?.trim()) ||
          colorLabelFromValue(value),
        imageUrl,
        galleryIndex
      };
    })
    .filter(Boolean);
}
