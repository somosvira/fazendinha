/** Prévia por padrão. Uso:
 * pnpm import:pecuaria:v4 --arquivo=/carga.json --mapeamento=/mapa.json --relatorio=/previa.json
 * Execução somente local: acrescentar --executar --banco-confirmado=fazendinha_seedatev3 --manifesto-confirmado=hash_da_previa.
 * STG remoto exige namespace staging, --ambiente-confirmado=staging e --destino-confirmado=host/banco.
 * Não usa seed, não recria animais V1 e nunca autoriza produção. */
import { readFileSync } from "node:fs";
import { prepararArquivoRelatorio } from "./import-stg/relatorio.js";
let desconectar: (() => Promise<void>) | undefined;
let reservaRelatorio: ReturnType<typeof prepararArquivoRelatorio> | undefined;
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
  reservaRelatorio = prepararArquivoRelatorio([arquivo, mapeamento], relatorio);
  const dadosCarga: unknown = JSON.parse(readFileSync(arquivo, "utf8"));
  const dadosMapa: unknown = JSON.parse(readFileSync(mapeamento, "utf8"));
  const [{ env }, { prisma }, { cargaSchema, mapeamentoSchema }, { importarV4 }, { identificarDestinoImportacao, validarDestinoImportacao }] = await Promise.all([
    import("../src/env.js"), import("../src/db.js"), import("./import-v4/contrato.js"), import("./import-v4/importador.js"), import("../src/services/pecuaria/importacao/destino.js"),
  ]);
  desconectar = () => prisma.$disconnect();
  const executar = argumentos.includes("--executar");
  if (executar) validarDestinoImportacao({
    databaseUrl: env.DATABASE_URL, namespace: env.STORAGE_NAMESPACE,
    bancoConfirmado: opcao("banco-confirmado"), ambienteConfirmado: opcao("ambiente-confirmado"),
    destinoConfirmado: opcao("destino-confirmado"), manifestoConfirmado: opcao("manifesto-confirmado"),
  });
  const carga = cargaSchema.parse(dadosCarga);
  const mapa = mapeamentoSchema.parse(dadosMapa);
  const destino = identificarDestinoImportacao(env.DATABASE_URL, env.STORAGE_NAMESPACE);
  const resultado = await importarV4(prisma, carga, mapa, executar, executar ? opcao("manifesto-confirmado") : undefined, destino);
  reservaRelatorio.gravar(JSON.stringify({ destino, ...resultado }, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        modo: resultado.modo,
        destino,
        manifesto: resultado.manifesto.hash,
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
  .finally(async () => { reservaRelatorio?.cancelar(); await desconectar?.(); });
