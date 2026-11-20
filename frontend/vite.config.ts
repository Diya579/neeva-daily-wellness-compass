import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env["VITE_API_BASE_URL"] || "http://localhost:8080",
        changeOrigin: true,
      },
      "/payment-demo": {
        target: process.env["VITE_API_BASE_URL"] || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
