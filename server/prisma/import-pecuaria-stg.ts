/** Ferramenta técnica revisável. Prévia é o padrão; execução exige manifesto e destino confirmados. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { prepararArquivoRelatorio } from "./import-stg/relatorio.js";

let desconectar: (() => Promise<void>) | undefined;
let reservaRelatorio: ReturnType<typeof prepararArquivoRelatorio> | undefined;
async function main() {
  const { values } = parseArgs({ options: {
    arquivo: { type: "string" }, relatorio: { type: "string" }, executar: { type: "boolean", default: false }, ajuda: { type: "boolean" },
    "banco-confirmado": { type: "string" }, "ambiente-confirmado": { type: "string" }, "destino-confirmado": { type: "string" }, "manifesto-confirmado": { type: "string" },
  }, strict: true, allowPositionals: false });
  if (values.ajuda) {
    console.log("Prévia: pnpm import:pecuaria:stg --arquivo=/carga.json --relatorio=/previa.json\nExecução: acrescente --executar --manifesto-confirmado=SHA256 e confirme o destino.\nLocal: --banco-confirmado=fazendinha_seedatev3\nSTG: STORAGE_NAMESPACE=staging, --ambiente-confirmado=staging --destino-confirmado=host/banco\nProdução é bloqueada. Não executa seed ou migrations.");
    return;
  }
  if (!values.arquivo || !values.relatorio) throw new Error("Informe --arquivo e --relatorio explicitamente.");
  const arquivo = resolve(values.arquivo), relatorio = resolve(values.relatorio);
  reservaRelatorio = prepararArquivoRelatorio(arquivo, relatorio);
  const carga: unknown = JSON.parse(readFileSync(arquivo, "utf8"));
  const [{ env }, { prisma }, { importarStg }] = await Promise.all([import("../src/env.js"), import("../src/db.js"), import("./import-stg/importador.js")]);
  desconectar = () => prisma.$disconnect();
  const resultado = await importarStg(carga, { executar: values.executar, manifestoConfirmado: values["manifesto-confirmado"],
    destino: { databaseUrl: env.DATABASE_URL, namespace: env.STORAGE_NAMESPACE, bancoConfirmado: values["banco-confirmado"], ambienteConfirmado: values["ambiente-confirmado"], destinoConfirmado: values["destino-confirmado"] } });
  reservaRelatorio.gravar(JSON.stringify(resultado, null, 2) + "\n");
  console.log(JSON.stringify({ modo: resultado.modo, destino: resultado.destino, autorId: resultado.autorId, manifesto: resultado.manifesto.hash,
    reenvioIntegral: resultado.reenvioIntegral, planejados: resultado.planejados, pesosSecagem: resultado.pesosSecagem, pendentes: resultado.pendentes, associacoesSecagem: { comprovadas: resultado.associacoesSecagem.filter(i => i.estado === "COMPROVADA").length, pendentes: resultado.associacoesSecagem.filter(i => i.estado === "PENDENTE").length, conflitos: resultado.associacoesSecagem.filter(i => i.estado === "CONFLITO").length }, criados: resultado.criados, reutilizados: resultado.reutilizados,
    vinculados: resultado.vinculados, corrigidos: resultado.corrigidos, conflitos: resultado.conflitos.length, relatorio }, null, 2));
  if (resultado.conflitos.length || resultado.recibo.some(i => i.estado === "FALHOU" || i.estado === "BLOQUEADO")) process.exitCode = 1;
  else if (resultado.pendentes) process.exitCode = 2;
}
main().catch(erro => { console.error(erro instanceof Error ? erro.message : String(erro)); process.exitCode = 1; }).finally(async () => { reservaRelatorio?.cancelar(); await desconectar?.(); });
