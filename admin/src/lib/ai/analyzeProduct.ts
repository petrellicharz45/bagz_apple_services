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
    description: `${name} — a ${cat.toLowerCase()} pick for Fancy Deals Uganda. Comfortable, practical, and great value for everyday use. Order today with local delivery options.`,
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
    categories.length > 0 ? categories.join('", "') : "Clothing, Shoes, Accessories, Bags, Jewelry";

  const prompt = `You are an e-commerce copywriter for Uganda (Fancy Deals shop).
Look at the product image and return ONLY one JSON object with these keys:
- "name": short product title (max 10 words)${productName ? ` (hint: ${productName})` : ""}
- "category": exactly ONE from: ${categoryList}${category ? ` (hint: ${category})` : ""}
- "description": 2-3 sentences (material, style, who it's for)
- "colors": array of 2-4 dominant HEX colors like "#FF5733"

Example: {"name":"Kids Baseball Cap","category":"Accessories","description":"...","colors":["#1E3A5F","#FFFFFF"]}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://fancydeals.ug",
      "X-Title": "Fancy Deals Admin"
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
