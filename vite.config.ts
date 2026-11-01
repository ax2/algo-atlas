import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react({ jsxImportSource: "@atlas-i18n" })],
  resolve: {
    alias: {
      "@atlas-i18n": fileURLToPath(new URL("./src/i18n", import.meta.url)),
    },
  },
  base: "./",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
          if (id.includes("/content/implementations/"))
            return "implementations";
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
});
