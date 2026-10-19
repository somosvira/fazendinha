/** Prévia por padrão. Uso:
 * pnpm import:pecuaria:v4 --arquivo=/carga.json --mapeamento=/mapa.json --relatorio=/previa.json
 * Execução somente local: acrescentar --executar --banco-confirmado=nome_do_banco.
 * Não usa seed, não recria animais V1 e nunca autoriza produção. */
import { readFileSync, writeFileSync } from "node:fs";
import { env } from "../src/env.js";
import { prisma } from "../src/db.js";
import { cargaSchema, mapeamentoSchema } from "./import-v4/contrato.js";
import { importarV4 } from "./import-v4/importador.js";
const argumentos = process.argv.slice(2);
const opcao = (nome: string) =>
  argumentos.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
async function main() {
  const arquivo = opcao("arquivo"),
    mapeamento = opcao("mapeamento"),
    relatorio = opcao("relatorio");
  if (!arquivo || !mapeamento || !relatorio)
    throw new Error(
      "Informe --arquivo, --mapeamento e --relatorio explicitamente.",
    );
  const executar = argumentos.includes("--executar");
  if (executar) {
    const url = new URL(env.DATABASE_URL);
    const banco = decodeURIComponent(url.pathname.slice(1));
    if (
      env.NODE_ENV === "production" ||
      env.STORAGE_NAMESPACE === "prod" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      throw new Error("Execução técnica bloqueada em produção/banco remoto.");
    if (opcao("banco-confirmado") !== banco)
      throw new Error(
        "Confirme o banco local com --banco-confirmado=nome_do_banco.",
      );
  }
  const carga = cargaSchema.parse(JSON.parse(readFileSync(arquivo, "utf8")));
  const mapa = mapeamentoSchema.parse(
    JSON.parse(readFileSync(mapeamento, "utf8")),
  );
  const resultado = await importarV4(prisma, carga, mapa, executar);
  writeFileSync(relatorio, JSON.stringify(resultado, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        modo: resultado.modo,
        planejados: resultado.planejados,
        importados: resultado.importados,
        existentes: resultado.existentes,
        conflitos: resultado.conflitos.length,
        lacunas: resultado.lacunas.length,
        relatorio,
      },
      null,
      2,
    ),
  );
  if (resultado.conflitos.length) process.exitCode = 1;
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
