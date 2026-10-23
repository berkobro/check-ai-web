import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths + hash routing work at https://<user>.github.io/<repo>/ without a rewrite server.
  base: "./",
  plugins: [react(), tailwindcss()],
  // "@/..." is the shared UI, prompts and validation in src/shared (copied from the Check AI app).
  resolve: { alias: { "@": fileURLToPath(new URL("./src/shared", import.meta.url)) } },
  build: { outDir: "dist", emptyOutDir: true },
});
