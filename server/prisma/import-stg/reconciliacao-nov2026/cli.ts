import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { prepararArquivoRelatorio } from "../relatorio.js";
import { conferirDestino, manifestoSchema } from "./manifesto.js";

async function main() {
  const { values: args } = parseArgs({ options: {
    manifesto: { type: "string" }, recibo: { type: "string" },
    executar: { type: "boolean" }, verificar: { type: "boolean" }, "confirmar-sha256": { type: "string" }, "confirmar-destino": { type: "string" },
  } });
  if (!args.manifesto || !args.recibo) throw new Error("Informe os caminhos de --manifesto e --recibo.");
  if (args.executar && args.verificar) throw new Error("Escolha execução ou verificação.");
  const arquivo = resolve(args.manifesto);
  const bytes = readFileSync(arquivo);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const manifesto = manifestoSchema.parse(JSON.parse(bytes.toString("utf8")));
  const recibo = prepararArquivoRelatorio(arquivo, resolve(args.recibo));
  try {
    const { env } = await import("../../../src/env.js");
    const destino = conferirDestino(env.DATABASE_URL, env.STORAGE_NAMESPACE);
    if (args.executar && (destino.local || args["confirmar-sha256"] !== hash ||
      args["confirmar-destino"] !== `${destino.host}/${destino.banco}`))
      throw new Error("A execução exige staging e as confirmações exatas do manifesto e destino.");
    const { prisma } = await import("../../../src/db.js");
    try {
      const { reconciliar } = await import("./executor.js");
      const resultado = await reconciliar(prisma, manifesto, hash, args.executar ? "EXECUCAO" : args.verificar ? "VERIFICACAO" : "PREVIA");
      recibo.gravar(JSON.stringify({ hash, destino, ...resultado }, null, 2) + "\n");
      console.log(JSON.stringify({ estado: resultado.estado, hash, destino }));
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    recibo.cancelar();
  }
}

main().catch(erro => {
  console.error(erro instanceof Error ? erro.message.replace(/postgres(?:ql)?:\/\/[^\s"'\x60]+/g, "[conexão omitida]") : "Falha na reconciliação.");
  process.exitCode = 1;
});
