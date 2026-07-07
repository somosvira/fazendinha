import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient, Natureza, Situacao } from "@prisma/client";
import { garantirFundacaoPropriedade, propriedadePrincipalId } from "../src/services/propriedade.js";

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));

interface LancJson {
  natureza: Natureza;
  valor: number;
  dataCompetencia: string;
  dataVencimento: string;
  dataLiquidacao: string | null;
  situacao: Situacao;
  estornado: boolean;
  centro: string;
  ehInvestimento: boolean;
  grupo: string;
  categoria: string;
  fornecedor: string | null;
  conta: string | null;
  numeroDocumento: string | null;
  numeroParcela: number | null;
  descricao: string | null;
}

const d = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

async function main() {
  const path = join(__dirname, "rio_novo.json");
  const lancs: LancJson[] = JSON.parse(readFileSync(path, "utf-8"));
  console.log(`Lendo ${lancs.length} lançamentos de ${path}`);

  console.log("Limpando banco...");
  await prisma.lancamento.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.grupoCategoria.deleteMany();
  await prisma.centroCusto.deleteMany();
  await prisma.contaBancaria.deleteMany();
  await prisma.clienteFornecedor.deleteMany();

  // --- Cadastros distintos -------------------------------------------------
  const centrosNomes = new Map<string, boolean>(); // nome -> ehInvestimento
  const grupos = new Set<string>();
  const categorias = new Map<string, string>(); // "grupo|cat" -> grupo
  const contas = new Set<string>();
  const fornecedores = new Set<string>();

  for (const l of lancs) {
    centrosNomes.set(l.centro, l.ehInvestimento);
    grupos.add(l.grupo);
    categorias.set(`${l.grupo}|${l.categoria}`, l.grupo);
    if (l.conta) contas.add(l.conta);
    if (l.fornecedor) fornecedores.add(l.fornecedor);
  }

  console.log("Criando cadastros...");
  const centroId = new Map<string, number>();
  let ordem = 1;
  for (const [nome, ehInv] of centrosNomes) {
    const r = await prisma.centroCusto.create({ data: { nome, ehInvestimento: ehInv, ordem: ordem++ } });
    centroId.set(nome, r.id);
  }

  const grupoId = new Map<string, number>();
  let gOrdem = 1;
  for (const nome of grupos) {
    const r = await prisma.grupoCategoria.create({ data: { nome, ordem: gOrdem++ } });
    grupoId.set(nome, r.id);
  }

  const categoriaId = new Map<string, number>(); // "grupo|cat" -> id
  for (const key of categorias.keys()) {
    const [grupo, nome] = key.split("|");
    const r = await prisma.categoria.create({ data: { nome, grupoCategoriaId: grupoId.get(grupo)! } });
    categoriaId.set(key, r.id);
  }

  const contaId = new Map<string, number>();
  for (const nome of contas) {
    const r = await prisma.contaBancaria.create({ data: { nome } });
    contaId.set(nome, r.id);
  }

  const fornecedorId = new Map<string, number>();
  for (const nome of fornecedores) {
    const r = await prisma.clienteFornecedor.create({ data: { nome } });
    fornecedorId.set(nome, r.id);
  }

  console.log(
    `Cadastros: ${centroId.size} centros, ${grupoId.size} grupos, ${categoriaId.size} categorias, ${contaId.size} contas, ${fornecedorId.size} fornecedores`
  );

  // Multi-propriedade: carimba os históricos na principal direto (dispensa o
  // backfill de boot). Idempotente — cria a Propriedade se não existir.
  await garantirFundacaoPropriedade();
  const propriedadeId = await propriedadePrincipalId();

  // --- Lançamentos em lote -------------------------------------------------
  console.log("Inserindo lançamentos...");
  const rows = lancs.map((l) => ({
    natureza: l.natureza,
    valor: l.valor,
    dataCompetencia: d(l.dataCompetencia)!,
    dataVencimento: d(l.dataVencimento)!,
    dataLiquidacao: d(l.dataLiquidacao),
    situacao: l.situacao,
    estornado: l.estornado,
    numeroDocumento: l.numeroDocumento,
    numeroParcela: l.numeroParcela,
    descricao: l.descricao,
    categoriaId: categoriaId.get(`${l.grupo}|${l.categoria}`)!,
    centroCustoId: centroId.get(l.centro)!,
    contaBancariaId: l.conta ? contaId.get(l.conta)! : null,
    clienteFornecedorId: l.fornecedor ? fornecedorId.get(l.fornecedor)! : null,
    propriedadeId,
  }));

  const CHUNK = 1000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const r = await prisma.lancamento.createMany({ data: rows.slice(i, i + CHUNK) });
    inserted += r.count;
    process.stdout.write(`\r  ${inserted}/${rows.length}`);
  }
  console.log(`\nImportação concluída: ${inserted} lançamentos.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
