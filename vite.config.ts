import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [
    react({ jsxImportSource: "@atlas-i18n" }),
    {
      name: "atlas-local-jsx-runtime",
      configResolved(config) {
        // plugin-react explicitly includes its JSX runtime for prebundling.
        // Our runtime is application code, so remove that forced include too.
        config.optimizeDeps.include = config.optimizeDeps.include?.filter(
          (id) => !id.startsWith("@atlas-i18n/"),
        );
      },
    },
  ],
  // Keep the app-owned runtime on the same locale module as App during dev.
  // Prebundling it would create a second isolated copy of the locale store.
  optimizeDeps: {
    exclude: ["@atlas-i18n/jsx-runtime", "@atlas-i18n/jsx-dev-runtime"],
    include: ["react/jsx-runtime", "react/jsx-dev-runtime"],
  },
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
