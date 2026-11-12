export type AnalyzeProductResult = {
  name?: string;
  category?: string;
  description?: string;
  colors?: string[];
};

function extractJSON(text: string): AnalyzeProductResult {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
  }
  cleaned = cleaned.replace(/\/\/.*$/gm, "");
  try {
    return JSON.parse(cleaned) as AnalyzeProductResult;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as AnalyzeProductResult;
  }
  throw new Error("AI returned invalid JSON");
}

export function templateProductCopy(
  productName: string,
  category: string
): AnalyzeProductResult {
  const name = productName?.trim() || "This product";
  const cat = category?.trim() || "item";
  return {
    description: `${name} from Bagz Apple Services, Kampala. 100% authentic, with warranty and same-day delivery in Kampala. Swap & top-up accepted.`,
    colors: ["#1F2937", "#FFFFFF"]
  };
}

const DEFAULT_VISION_MODEL = "google/gemini-2.5-flash";

export async function analyzeWithOpenRouter(
  apiKey: string,
  imageBase64: string,
  categories: string[],
  productName = "",
  category = "",
  model = DEFAULT_VISION_MODEL
): Promise<AnalyzeProductResult> {
  const categoryList =
    categories.length > 0 ? categories.join('", "') : "iPhones, Google Pixel, Samsung, MacBooks & iPads, Apple Watch, Audio, Accessories";

  const prompt = `You are an e-commerce copywriter for Bagz Apple Services, an authentic Apple & tech store in Kampala, Uganda.
Look at the product image and return ONLY one JSON object with these keys:
- "name": short product title (max 10 words)${productName ? ` (hint: ${productName})` : ""}
- "category": exactly ONE from: ${categoryList}${category ? ` (hint: ${category})` : ""}
- "description": 2-3 sentences (model, key specs such as storage/chip/camera, condition if visible, who it's for). Never invent prices or warranty terms
- "colors": array of 2-4 dominant HEX colors like "#FF5733"

Example: {"name":"iPhone 17 Pro Max 256GB Cosmic Orange","category":"iPhones","description":"...","colors":["#1E3A5F","#FFFFFF"]}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://bagzappleservices.com",
      "X-Title": "Bagz Admin"
    },
    body: JSON.stringify({
      model: model || DEFAULT_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageBase64 } }
          ]
        }
      ],
      max_tokens: 512
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vision API (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty AI response");
  }

  const parsed = extractJSON(content);
  return {
    name: parsed.name || productName,
    category: parsed.category || category,
    description: parsed.description || "",
    colors: Array.isArray(parsed.colors) ? parsed.colors : []
  };
}
