import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { localPesapalRedirect } from "./scripts/local-pesapal.mjs";
import { saveProductReport } from "./scripts/save-product-report.mjs";

function localPesapalPlugin() {
  return {
    name: "local-pesapal",
    configureServer(server) {
      server.middlewares.use("/api/local-pesapal", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            const redirectUrl = await localPesapalRedirect(body);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ redirectUrl }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ message: error?.message || "Pesapal failed" }));
          }
        });
      });
      server.middlewares.use("/api/product-report", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            await saveProductReport(body);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ message: error?.message || "Could not send." }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [svelte(), localPesapalPlugin()],
  server: { host: true },
  appType: "spa"
});
