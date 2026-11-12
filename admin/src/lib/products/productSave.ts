import { doc, setDoc } from "firebase/firestore";
import { db } from "$lib/firebase";
import { fileToCardJpeg, fileToGalleryJpeg } from "$lib/images/productImage";
import { uploadProductImage } from "$lib/images/cloudinaryUpload";
import { deliveryFieldsFromSelection } from "$lib/deliveryEstimate";
import { resolveProductSeo, type ProductSeoFields } from "$lib/seo/productSeo";

export type CreateProductInput = {
  name: string;
  category: string;
  price: number;
  deliveryEstimate: string;
  description?: string;
  sizes?: string;
  colors?: string;
  stock: number;
  stockPerSize?: string;
  offer?: number;
  saleStart?: string;
  saleEnd?: string;
  groups?: string[];
  special?: boolean;
  imageFiles: File[];
  seoOverrides?: Partial<ProductSeoFields>;
};

export function parseColorInts(colorsStr: string): number[] | null {
  if (!colorsStr?.trim()) return null;
  return colorsStr
    .split(",")
    .map((c) => {
      const hex = c.trim().replace("#", "");
      const argb = hex.length === 6 ? "FF" + hex : hex;
      return parseInt(argb, 16) | 0;
    })
    .filter((n) => !isNaN(n));
}

export async function createProduct(input: CreateProductInput): Promise<string> {
  if (!input.imageFiles?.length) {
    throw new Error(`“${input.name || "Product"}”: add at least one image.`);
  }
  if (!input.name?.trim()) throw new Error("Product name is required.");
  if (!input.category) throw new Error(`“${input.name}”: select a category.`);

  const id = crypto.randomUUID();
  const uploadedImageUrls: string[] = [];
  let cardImageUrl = "";

  for (let i = 0; i < input.imageFiles.length; i++) {
    const file = input.imageFiles[i];
    const galleryFile = await fileToGalleryJpeg(file);
    const imageId = crypto.randomUUID();
    const downloadUrl = await uploadProductImage(galleryFile, imageId);
    uploadedImageUrls.push(downloadUrl);
    if (i === 0) {
      const cardFile = await fileToCardJpeg(file);
      cardImageUrl = await uploadProductImage(cardFile, `${imageId}_card`);
    }
  }

  const sizes = input.sizes
    ? input.sizes.split(",").map((s) => s.trim()).filter(Boolean)
    : null;
  const colors = parseColorInts(input.colors || "");

  let sizeStock: Record<string, number> = {};
  if (sizes && input.stockPerSize && (!colors || colors.length === 0)) {
    const stockValues = input.stockPerSize.split(",").map((s) => parseInt(s.trim(), 10) || 0);
    sizes.forEach((size, i) => {
      if (i < stockValues.length && stockValues[i] > 0) {
        sizeStock[size] = stockValues[i];
      }
    });
  }

  const offer = input.offer ?? 0;
  const groups = input.groups ?? [];

  const seo = resolveProductSeo(
    {
      name: input.name.trim(),
      category: input.category,
      description: input.description,
      price: input.price,
      groups,
      productId: id
    },
    input.seoOverrides
  );

  const productData: Record<string, unknown> = {
    id,
    name: input.name.trim(),
    nameLowercase: input.name.trim().toLowerCase(),
    category: input.category,
    price: input.price,
    offerPercentage: offer > 0 ? offer : null,
    saleStartAt: offer > 0 && input.saleStart ? new Date(input.saleStart).getTime() : null,
    saleEndAt: offer > 0 && input.saleEnd ? new Date(input.saleEnd).getTime() : null,
    ...deliveryFieldsFromSelection(input.deliveryEstimate || "5"),
    groups,
    createdAt: Date.now(),
    description: input.description?.trim() ? input.description.trim() : null,
    sizes,
    colors,
    images: uploadedImageUrls,
    cardImage: cardImageUrl,
    stock: input.stock || 0,
    sizeStock,
    special: !!input.special,
    seoTitle: seo.seoTitle,
    seoDescription: seo.seoDescription,
    seoKeywords: seo.seoKeywords,
    slug: seo.slug
  };

  await setDoc(doc(db, "product", id), productData);
  return id;
}
