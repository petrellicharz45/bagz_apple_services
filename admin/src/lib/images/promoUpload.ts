import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  PUBLIC_CLOUDINARY_CLOUD_NAME,
  PUBLIC_CLOUDINARY_UPLOAD_PRESET
} from "$env/static/public";
import { storage } from "$lib/firebase";
import { uploadProductImage } from "$lib/images/cloudinaryUpload";

/** Cloudinary when configured (works on the free Firebase plan); otherwise Firebase Storage. */
export const useCloudinary = Boolean(
  PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() && PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim()
);

/** Resize + JPEG-compress, painting white behind transparent PNGs so they don't turn black. */
export async function compressImage(file: File, maxWidth: number, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not read image"));
      i.src = url;
    });
    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not compress image"))), "image/jpeg", quality)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Validate, compress and upload a promo image; returns its https URL. */
export async function uploadPromoImage(file: File, id: string, folder: string, maxWidth: number): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Image is larger than 20 MB.");
  const blob = await compressImage(file, maxWidth);
  if (useCloudinary) return uploadProductImage(blob, id, folder, `${id}.jpg`);
  if (!storage) throw new Error("No image storage configured (set Cloudinary keys in admin .env).");
  const fileRef = ref(storage, `${folder}/${id}.jpg`);
  await uploadBytes(fileRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(fileRef);
}
