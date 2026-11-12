import {
  PUBLIC_CLOUDINARY_CLOUD_NAME,
  PUBLIC_CLOUDINARY_UPLOAD_PRESET
} from "$env/static/public";

type CloudinaryUploadResponse = {
  secure_url?: string;
  error?: { message?: string };
};

/** Upload a JPEG blob to Cloudinary (unsigned preset). Returns HTTPS URL. */
export async function uploadProductImage(
  blob: Blob,
  publicId: string,
  folder = "product/images",
  filename?: string
): Promise<string> {
  const cloud = PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const preset = PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloud || !preset) {
    throw new Error(
      "Missing PUBLIC_CLOUDINARY_CLOUD_NAME or PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env"
    );
  }

  const body = new FormData();
  body.append("file", blob, filename || `${publicId}.jpg`);
  body.append("upload_preset", preset);
  body.append("folder", folder);
  body.append("public_id", publicId);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    { method: "POST", body }
  );
  const data = (await res.json()) as CloudinaryUploadResponse;
  if (!res.ok || !data.secure_url) {
    throw new Error(data.error?.message || "Cloudinary upload failed");
  }
  return data.secure_url;
}
