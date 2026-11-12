import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAdmin } from "./auth/assertAdmin";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "nvidia/nemotron-nano-12b-v2-vl";
const OPENROUTER_VISION_MODEL =
  (process.env.OPENROUTER_VISION_MODEL || "").trim() || "google/gemini-2.5-flash";

function extractJSON(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
  }
  // Strip JS-style comments
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  // Try parsing as-is first
  try {
    return JSON.parse(cleaned);
  } catch {}
  // Try to find JSON object in the text
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // Strip comments from matched JSON too
      const stripped = match[0].replace(/\/\/.*$/gm, '');
      return JSON.parse(stripped);
    }
  }
  throw new Error("No valid JSON found in response: " + cleaned.substring(0, 200));
}

async function analyzeWithOpenRouter(
  imageUrl: string,
  categories: string[],
  productName = "",
  category = ""
): Promise<{ name: string; category: string; description: string; colors: string[] }> {
  if (!OPENROUTER_API_KEY.trim()) {
    throw new Error("OPENROUTER_API_KEY is not configured on Cloud Functions.");
  }
  const categoryList =
    categories.length > 0 ? categories.join('", "') : "iPhones, Google Pixel, Samsung, MacBooks & iPads, Apple Watch, Audio, Accessories";

  const prompt = `You are an e-commerce copywriter for Bagz Apple Services, an authentic Apple & tech store in Kampala, Uganda.
Look at the product image and return ONLY one JSON object with these keys:
- "name": short product title (max 10 words).${productName ? ` The admin typed the exact model: "${productName}". Use it as the name and do NOT change the model, generation or storage.` : " If you cannot read the exact model from the photo, use a generic name such as \"Apple iPhone (Pro model)\" — never guess a model number or year."}
- "category": exactly ONE from: ${categoryList}${category ? ` (hint: ${category})` : ""}
- "description": 2-3 sentences about what is visible (design, colour/finish, camera layout, what is in the box) and who it suits. Only mention a chip, storage size, battery or other spec if it is part of the product name given above; never guess specs, model years, prices or warranty terms
- "colors": array of 2-4 dominant HEX colors like "#FF5733"

Example: {"name":"iPhone 17 Pro Max 256GB Cosmic Orange","category":"iPhones","description":"...","colors":["#1E3A5F","#FFFFFF"]}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://bagzappleservices.com",
      "X-Title": "Bagz Admin"
    },
    body: JSON.stringify({
      model: OPENROUTER_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 512
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty OpenRouter response");
  }

  const parsed = extractJSON(content);
  return {
    name: parsed.name || productName || "",
    category: parsed.category || category || "",
    description: parsed.description || "",
    colors: Array.isArray(parsed.colors) ? parsed.colors : []
  };
}

async function callNvidia(messages: any[], maxTokens: number = 512): Promise<any> {
  if (!NVIDIA_API_KEY.trim()) {
    throw new Error(
      "NVIDIA_API_KEY is not configured on Cloud Functions. Set OPENROUTER_API_KEY instead and redeploy adminAnalyzeProduct."
    );
  }
  const response = await fetch(NVIDIA_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NVIDIA_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NVIDIA API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

export const adminGenerateCaption = onCall({ cors: true, timeoutSeconds: 60, memory: "512MiB" }, async (request) => {
  await assertAdmin(request);
  const { imageBase64 } = request.data;

  if (!imageBase64) {
    throw new HttpsError("invalid-argument", "Missing imageBase64");
  }

  try {
    const content = await callNvidia([
      {
        role: "user",
        content: [
          { type: "text", text: "You are a professional e-commerce copywriter. Write a very short, catchy, and trendy promotional caption (maximum 3 to 5 words) for a store banner featuring this exact image. Do not use quotes, punctuation, or hashtags." },
          { type: "image_url", image_url: { url: imageBase64 } }
        ]
      }
    ], 50);

    return { caption: content.replace(/["']/g, '') };
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

export const adminAnalyzeProduct = onCall({ cors: true, timeoutSeconds: 60, memory: "512MiB" }, async (request) => {
  await assertAdmin(request);
  const { imageUrl, imageBase64, categories, productName, category } = request.data;

  const imageContent = imageBase64
    ? { type: "image_url", image_url: { url: imageBase64 } }
    : { type: "image_url", image_url: { url: imageUrl } };

  if (!imageContent.image_url.url) {
    throw new HttpsError("invalid-argument", "No image provided for analysis.");
  }

  const categoryList = Array.isArray(categories) ? categories.map(String) : [];
  const nameHint = typeof productName === "string" ? productName : "";
  const categoryHint = typeof category === "string" ? category : "";

  try {
    if (OPENROUTER_API_KEY.trim()) {
      return await analyzeWithOpenRouter(
        imageContent.image_url.url,
        categoryList,
        nameHint,
        categoryHint
      );
    }

    const categoryListStr = categoryList.length > 0
      ? categoryList.join('", "')
      : "iPhones, Google Pixel, Samsung, MacBooks & iPads, Apple Watch, Audio, Accessories";

    // Call 1: Name + Category (short, focused prompt)
    const namePromise = callNvidia([
      {
        role: "user",
        content: [
          { type: "text", text: `Look at this product image. Return ONLY a JSON object with 2 keys:\n"name" - a short catchy product name (max 10 words)\n"category" - pick ONE from: ${categoryListStr}\n\nExample: {"name":"Red Floral Summer Dress","category":"Clothing"}` },
          imageContent
        ]
      }
    ], 100);

    // Call 2: Description + Colors
    const descPromise = callNvidia([
      {
        role: "user",
        content: [
          { type: "text", text: `Look at this product image. Return ONLY a JSON object with 2 keys:\n"description" - 2-3 sentences about style, material, and feel\n"colors" - array of 2-4 dominant HEX colors\n\nExample: {"description":"A beautiful lightweight dress...","colors":["#FF5733","#FFFFFF"]}` },
          imageContent
        ]
      }
    ], 300);

    const [nameResult, descResult] = await Promise.all([namePromise, descPromise]);

    const nameData = extractJSON(nameResult);
    const descData = extractJSON(descResult);

    return {
      name: nameData.name || "",
      category: nameData.category || "",
      description: descData.description || "",
      colors: descData.colors || []
    };
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

export const aiScanProduct = onCall({ cors: true, timeoutSeconds: 60, memory: "512MiB" }, async (request) => {
  const { imageBase64 } = request.data;

  if (!imageBase64) {
    throw new HttpsError("invalid-argument", "Missing imageBase64");
  }

  const promptText = `Analyze this electronics / phone accessory product image. Return ONLY a JSON object, nothing else.

Rules:
- "itemType": The item type (e.g., "Dress", "Shoes", "Bag", "Top")
- "description": Short 3-5 word description
- "keywords": Array of 3-5 descriptive keywords

Response format (ONLY this JSON):
{"itemType": "Dress", "description": "Red floral summer dress", "keywords": ["red", "floral", "summer"]}`;

  try {
    const content = await callNvidia([
      {
        role: "user",
        content: [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: imageBase64 } }
        ]
      }
    ], 256);

    return extractJSON(content);
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

export const adminCategorizeSubcategoryImage = onCall({ cors: true, timeoutSeconds: 60, memory: "512MiB" }, async (request) => {
  const { imageBase64 } = request.data;
  if (!imageBase64) throw new HttpsError("invalid-argument", "Missing imageBase64");

  const promptText = `Analyze this electronics / phone accessory product image. Return ONLY a JSON object, nothing else.

Assign it to one of these Main Categories: "Clothing", "Shoes", "Accessories", "Bags", "Jewelry".
Provide a short plural Subcategory name (e.g., "Dresses", "Sneakers", "Watches").

Response format (ONLY this JSON):
{"mainCategory": "Clothing", "subcategoryName": "Dresses"}`;

  try {
    const content = await callNvidia([
      {
        role: "user",
        content: [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: imageBase64 } }
        ]
      }
    ], 128);

    return extractJSON(content);
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});
