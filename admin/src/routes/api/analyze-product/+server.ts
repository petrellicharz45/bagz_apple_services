import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { OPENROUTER_API_KEY } from "$env/static/private";
import { env } from "$env/dynamic/private";
import { analyzeWithOpenRouter, templateProductCopy } from "$lib/ai/analyzeProduct";

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    const categories = Array.isArray(body.categories) ? body.categories.map(String) : [];
    const productName = typeof body.productName === "string" ? body.productName : "";
    const category = typeof body.category === "string" ? body.category : "";

    if (!imageBase64.startsWith("data:image")) {
      return json({ error: "Missing or invalid imageBase64" }, { status: 400 });
    }

    const key = (OPENROUTER_API_KEY || "").trim();
    if (!key) {
      return json(templateProductCopy(productName, category));
    }

    const visionModel = (env.OPENROUTER_VISION_MODEL || "").trim() || undefined;
    const result = await analyzeWithOpenRouter(
      key,
      imageBase64,
      categories,
      productName,
      category,
      visionModel
    );
    return json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analyze failed";
    return json({ error: message }, { status: 500 });
  }
};
