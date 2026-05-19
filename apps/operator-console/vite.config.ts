import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Operator console runs on its own port and proxies API calls
// independently from the customer dashboard.
//
// Build configuration:
//  - `sourcemap: true` is kept on so production stack traces map back to
//    real source. Vercel (`vercel.json`) is configured to disallow
//    indexing/crawling and to serve strict security headers.
//  - `manualChunks` splits the heavy vendor libraries out of the entry
//    bundle so route-level `React.lazy` chunks stay small and the first
//    paint after login is fast.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (id.includes("react-router")) return "vendor-router";
            if (id.includes("@tanstack/react-query")) return "vendor-query";
            if (id.includes("axios")) return "vendor-axios";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("react-hot-toast")) return "vendor-toast";
            if (id.includes("react-dom") || id.includes("/react/")) {
              return "vendor-react";
            }
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
});
