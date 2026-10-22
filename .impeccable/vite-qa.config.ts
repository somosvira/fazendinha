import { mergeConfig } from "../client/node_modules/vite";
import base from "../client/vite.config";
export default mergeConfig(base, { root: new URL("../client/", import.meta.url).pathname, server: { host: "0.0.0.0", port: 41885, strictPort: true, proxy: { "/api": "http://localhost:41883" } } });
