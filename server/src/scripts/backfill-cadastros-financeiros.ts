import { prisma } from "../db.js";
import { garantirCadastrosFinanceiros } from "../services/financeiro/fundacao.js";

// Rodar após db push; migrate deploy já executa o mesmo backfill no SQL.
garantirCadastrosFinanceiros()
  .then(() => { console.info("[financeiro] tipos de conta e papéis de parceiros normalizados."); })
  .catch((erro) => { console.error(erro instanceof Error ? erro.message : erro); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
