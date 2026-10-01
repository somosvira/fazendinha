import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { artefatoRioNovoSchema, planejarImportacaoRioNovo } from "../services/financeiro/importacao-rio-novo.js";

interface Argumentos {
  artefato?: string;
  saidaPlano?: string;
  incluirAbertos: boolean;
  fonteMaisRecenteConfirmada: boolean;
  aplicar: boolean;
  propriedadeId?: number;
  propriedadeNome: string;
  confirmarPropriedade?: string;
  confirmarSha?: string;
  aceitarRevisao: boolean;
  permitirBancoRemoto: boolean;
  retomar: boolean;
}

function ajuda() {
  return `Uso:
  npm run import:financeiro -- --artefato /caminho/rio-novo.json [opções]

Por padrão apenas planeja (dry-run) e não abre conexão com o banco.

Opções:
  --saida-plano ARQUIVO                 grava o manifesto completo do dry-run
  --incluir-abertos                     inclui títulos abertos
  --confirmar-fonte-mais-recente        obrigatório junto com --incluir-abertos
  --aplicar                             persiste o lote planejado
  --propriedade-id ID                   seleciona a propriedade pelo ID
  --propriedade NOME                    nome da propriedade (padrão: Rio Novo)
  --confirmar-propriedade NOME          confirmação textual exigida em --aplicar
  --confirmar-sha SHA256                confirmação exata do arquivo exigida em --aplicar
  --aceitar-revisao                     permite aplicar deixando linhas ambíguas em revisão
  --permitir-banco-remoto               libera explicitamente um host não local
  --retomar                             retoma um lote PROCESSANDO/FALHOU existente
`;
}

function argumentos(argv: string[]): Argumentos {
  const resultado: Argumentos = {
    incluirAbertos: false,
    fonteMaisRecenteConfirmada: false,
    aplicar: false,
    propriedadeNome: "Rio Novo",
    aceitarRevisao: false,
    permitirBancoRemoto: false,
    retomar: false,
  };
  const valor = (indice: number, flag: string) => {
    const candidato = argv[indice + 1];
    if (!candidato || candidato.startsWith("--")) throw new Error(`${flag} exige um valor`);
    return candidato;
  };
  for (let indice = 0; indice < argv.length; indice += 1) {
    const atual = argv[indice]!;
    if (atual === "--help" || atual === "-h") { console.info(ajuda()); process.exit(0); }
    else if (atual === "--artefato") resultado.artefato = valor(indice++, atual);
    else if (atual === "--saida-plano") resultado.saidaPlano = valor(indice++, atual);
    else if (atual === "--incluir-abertos") resultado.incluirAbertos = true;
    else if (atual === "--confirmar-fonte-mais-recente") resultado.fonteMaisRecenteConfirmada = true;
    else if (atual === "--aplicar") resultado.aplicar = true;
    else if (atual === "--propriedade-id") resultado.propriedadeId = Number.parseInt(valor(indice++, atual), 10);
    else if (atual === "--propriedade") resultado.propriedadeNome = valor(indice++, atual);
    else if (atual === "--confirmar-propriedade") resultado.confirmarPropriedade = valor(indice++, atual);
    else if (atual === "--confirmar-sha") resultado.confirmarSha = valor(indice++, atual);
    else if (atual === "--aceitar-revisao") resultado.aceitarRevisao = true;
    else if (atual === "--permitir-banco-remoto") resultado.permitirBancoRemoto = true;
    else if (atual === "--retomar") resultado.retomar = true;
    else throw new Error(`Opção desconhecida: ${atual}`);
  }
  if (!resultado.artefato) throw new Error("Informe --artefato");
  if (resultado.propriedadeId !== undefined && (!Number.isInteger(resultado.propriedadeId) || resultado.propriedadeId <= 0)) throw new Error("--propriedade-id deve ser um inteiro positivo");
  return resultado;
}

function bancoEhLocal(databaseUrl: string) {
  const hostname = new URL(databaseUrl).hostname.toLocaleLowerCase("pt-BR");
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const caminho = resolve(args.artefato!);
  const artefato = artefatoRioNovoSchema.parse(JSON.parse(await readFile(caminho, "utf8")));
  const plano = planejarImportacaoRioNovo(artefato, {
    incluirAbertos: args.incluirAbertos,
    fonteMaisRecenteConfirmada: args.fonteMaisRecenteConfirmada,
  });

  console.info(JSON.stringify({
    modo: args.aplicar ? "APLICAR" : "DRY_RUN",
    arquivo: plano.arquivo,
    sha256: plano.sha256,
    matriz: plano.versaoMatriz,
    ...plano.resumo,
  }, null, 2));
  if (args.saidaPlano) {
    const saida = resolve(args.saidaPlano);
    await writeFile(saida, `${JSON.stringify(plano, null, 2)}\n`, "utf8");
    console.info(`Plano completo salvo em ${saida}`);
  }
  if (!args.aplicar) return;

  if (args.confirmarSha !== plano.sha256) throw new Error("--confirmar-sha não corresponde ao SHA-256 do artefato");
  if (args.confirmarPropriedade !== args.propriedadeNome) throw new Error("--confirmar-propriedade deve repetir exatamente o nome informado em --propriedade");
  if (plano.resumo.porStatus.REJEITADA > 0) throw new Error("A aplicação foi bloqueada porque há linhas rejeitadas; corrija a fonte ou o planejador");
  if (plano.resumo.porStatus.REVISAO > 0 && !args.aceitarRevisao) throw new Error("Há linhas em revisão. Revise o plano e use --aceitar-revisao para mantê-las fora da carga deliberadamente");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL não está definida");
  if (!bancoEhLocal(databaseUrl) && !args.permitirBancoRemoto) throw new Error("Banco remoto bloqueado; use --permitir-banco-remoto somente na janela aprovada de produção");

  const { prisma } = await import("../db.js");
  try {
    const propriedade = args.propriedadeId
      ? await prisma.propriedade.findUnique({ where: { id: args.propriedadeId } })
      : await prisma.propriedade.findUnique({ where: { nome: args.propriedadeNome } });
    if (!propriedade) throw new Error(`Propriedade não encontrada: ${args.propriedadeId ?? args.propriedadeNome}`);
    if (propriedade.nome !== args.confirmarPropriedade) throw new Error(`A propriedade resolvida é "${propriedade.nome}", diferente da confirmação`);
    const { aplicarImportacaoRioNovo } = await import("../services/financeiro/aplicar-importacao-rio-novo.js");
    const resultado = await aplicarImportacaoRioNovo(prisma, artefato, plano, { propriedadeId: propriedade.id, retomar: args.retomar });
    console.info(JSON.stringify({ resultado: "CONCLUIDO", propriedade: { id: propriedade.id, nome: propriedade.nome }, ...resultado }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
