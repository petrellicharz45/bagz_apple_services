/** Resize and JPEG-compress product photos before Storage upload. */
const GALLERY_MAX = 1080;
const CARD_MAX = 480;
const GALLERY_QUALITY = 0.72;
const CARD_QUALITY = 0.7;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not compress image"));
      },
      "image/jpeg",
      quality
    );
  });
}

export async function resizeToJpeg(
  source: Blob,
  maxSide: number,
  quality: number
): Promise<Blob> {
  const src = URL.createObjectURL(source);
  try {
    const img = await loadImage(src);
    let width = img.width;
    let height = img.height;
    if (width < 1 || height < 1) return source;
    const longest = Math.max(width, height);
    if (longest > maxSide) {
      const scale = maxSide / longest;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return source;
    ctx.drawImage(img, 0, 0, width, height);
    return await canvasToBlob(canvas, quality);
  } finally {
    URL.revokeObjectURL(src);
  }
}

export async function fileToGalleryJpeg(file: File): Promise<File> {
  const blob = await resizeToJpeg(file, GALLERY_MAX, GALLERY_QUALITY);
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg"
  });
}

export async function fileToCardJpeg(file: File): Promise<File> {
  const blob = await resizeToJpeg(file, CARD_MAX, CARD_QUALITY);
  return new File([blob], file.name.replace(/\.[^.]+$/, "_card.jpg"), {
    type: "image/jpeg"
  });
}

export async function blobToGalleryJpeg(blob: Blob): Promise<Blob> {
  return resizeToJpeg(blob, GALLERY_MAX, GALLERY_QUALITY);
}

export async function blobToCardJpeg(blob: Blob): Promise<Blob> {
  return resizeToJpeg(blob, CARD_MAX, CARD_QUALITY);
}

export { GALLERY_MAX, CARD_MAX };
