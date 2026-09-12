import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

// Origem separada: não compartilha localStorage/IndexedDB com o dev habitual.
export default mergeConfig(base, defineConfig({ server: {
  host: "localhost", port: 42975, strictPort: true,
  proxy: { "/api": "http://localhost:42973" },
} }));
