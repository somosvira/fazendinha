// Gera docs/NAVEGACAO.md a partir do catálogo de navegação (fonte única:
// server/src/services/bot/navegacao.ts). Espelha o pipeline dos outros extractors
// (script → artefato commitado). A IA consome o MESMO catálogo em runtime via
// navegacaoResumo() no system prompt — este doc é a versão humana/legível.
//
// Uso:
//   pnpm gen:nav-doc
//   (ou) pnpm --filter rionovo-server exec tsx ../scripts/gen-nav-doc.ts

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gerarDocMarkdown } from "../server/src/services/bot/navegacao.js";

const geradoEm = new Date().toISOString().slice(0, 10);
const doc = gerarDocMarkdown(geradoEm);
const out = fileURLToPath(new URL("../docs/NAVEGACAO.md", import.meta.url));
writeFileSync(out, doc, "utf-8");
console.log(`docs/NAVEGACAO.md gerado (${doc.length} bytes, geradoEm ${geradoEm}).`);
