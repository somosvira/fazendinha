import { PrismaClient, Natureza, Situacao } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Plano de contas gerencial e centros de custo da fazenda Rio Novo,
// extraídos do relatório original (pecuária leiteira + plantio de café).
// ---------------------------------------------------------------------------

const CENTROS = [
  { nome: "Atividade Leiteira", ehInvestimento: false, ordem: 1 },
  { nome: "Atividade Leiteira - Investimento", ehInvestimento: true, ordem: 2 },
  { nome: "Plantio Café", ehInvestimento: false, ordem: 3 },
  { nome: "Plantio Café - Investimento", ehInvestimento: true, ordem: 4 },
];

// grupo -> categorias
const PLANO: Record<string, string[]> = {
  "Venda de Produção": ["Venda de Leite", "Venda de Café"],
  "Criação Animal": ["Curral", "Energia Eletrica", "Medicamento Animal", "Ração", "Reprodução"],
  "Despesas Administrativas": ["Admin - BPO Financeiro", "Contabilidade", "Internet", "Tarifas"],
  Impostos: ["DARF"],
  "Máquinas e Equipamentos": ["Combustível", "Manutenção", "Maq e Equip Investimento"],
  "Produção Rural": ["Pessoal - Salário", "Pessoal - FGTS", "Pessoal - Férias", "Pessoal - Plano de Saúde"],
  "Obra Civil": ["Empreitada", "Material de Construção"],
  Plantio: ["Galpão", "Investimento Plantio", "Medicamento Plantio"],
  Investimento: ["Investimento Criação Animal"],
};

const CONTAS = [
  { nome: "BB MAGC", banco: "Banco do Brasil" },
  { nome: "Caixa da Empresa", banco: null as string | null },
];

const FORNECEDORES = [
  "Laticínio Comprador de Leite",
  "Cooperativa Agropecuária",
  "NTG Data Serviços Administrativos Ltda",
  "Secretaria da Receita Federal",
  "Funcionários (Folha)",
];

// ---------------------------------------------------------------------------
// Lançamentos: matriz mês × (natureza, grupo, categoria, ccusto, valor).
// Valores aproximados dos meses reais do relatório (em R$, positivos).
// ---------------------------------------------------------------------------

type Linha = {
  natureza: Natureza;
  grupo: string;
  categoria: string;
  ccusto: string;
  valores: Record<string, number>; // "YYYY-MM" -> valor positivo
  fornecedor?: string;
};

const REALIZADO: Linha[] = [
  // Receita
  {
    natureza: "CREDITO", grupo: "Venda de Produção", categoria: "Venda de Leite", ccusto: "Atividade Leiteira",
    fornecedor: "Laticínio Comprador de Leite",
    valores: { "2025-01": 199832.4, "2025-02": 210450.1, "2025-03": 205110.0, "2025-04": 218740.5, "2025-05": 224300.0 },
  },
  // Criação Animal
  { natureza: "DEBITO", grupo: "Criação Animal", categoria: "Curral", ccusto: "Atividade Leiteira",
    valores: { "2025-01": 44564.93, "2025-02": 38120.0, "2025-03": 41230.5, "2025-04": 39870.2, "2025-05": 38429.41 } },
  { natureza: "DEBITO", grupo: "Criação Animal", categoria: "Energia Eletrica", ccusto: "Atividade Leiteira",
    valores: { "2025-01": 50.23, "2025-02": 51.8, "2025-03": 49.9, "2025-04": 52.3, "2025-05": 50.0 } },
  { natureza: "DEBITO", grupo: "Criação Animal", categoria: "Medicamento Animal", ccusto: "Atividade Leiteira",
    valores: { "2025-01": 3800.9, "2025-02": 4325.8, "2025-03": 2110.0, "2025-04": 1980.5, "2025-05": 1211.39 } },
  { natureza: "DEBITO", grupo: "Criação Animal", categoria: "Ração", ccusto: "Atividade Leiteira",
    fornecedor: "Cooperativa Agropecuária",
    valores: { "2025-01": 29512.5, "2025-02": 38460.0, "2025-03": 41200.0, "2025-04": 35900.0, "2025-05": 38460.0 } },
  { natureza: "DEBITO", grupo: "Criação Animal", categoria: "Reprodução", ccusto: "Atividade Leiteira",
    valores: { "2025-01": 1366.67, "2025-03": 1366.67 } },
  // Despesas Administrativas
  { natureza: "DEBITO", grupo: "Despesas Administrativas", categoria: "Admin - BPO Financeiro", ccusto: "Atividade Leiteira",
    fornecedor: "NTG Data Serviços Administrativos Ltda",
    valores: { "2025-01": 2880, "2025-02": 2880, "2025-03": 2880, "2025-04": 2880, "2025-05": 2880 } },
  { natureza: "DEBITO", grupo: "Despesas Administrativas", categoria: "Contabilidade", ccusto: "Atividade Leiteira",
    valores: { "2025-01": 3030.9, "2025-02": 3030.5, "2025-03": 3030.5, "2025-04": 3161.2, "2025-05": 3161.2 } },
  { natureza: "DEBITO", grupo: "Despesas Administrativas", categoria: "Internet", ccusto: "Atividade Leiteira",
    valores: { "2025-01": 140.01, "2025-02": 140, "2025-03": 140, "2025-04": 160, "2025-05": 160 } },
  { natureza: "DEBITO", grupo: "Despesas Administrativas", categoria: "Tarifas", ccusto: "Atividade Leiteira",
    valores: { "2025-01": 198.9, "2025-02": 249.8, "2025-03": 210.5, "2025-04": 220.3, "2025-05": 205.0 } },
  // Impostos
  { natureza: "DEBITO", grupo: "Impostos", categoria: "DARF", ccusto: "Atividade Leiteira",
    fornecedor: "Secretaria da Receita Federal",
    valores: { "2025-01": 2630.4, "2025-02": 8582.9, "2025-03": 5000, "2025-04": 5000, "2025-05": 5000 } },
  // Máquinas e Equipamentos
  { natureza: "DEBITO", grupo: "Máquinas e Equipamentos", categoria: "Combustível", ccusto: "Atividade Leiteira",
    valores: { "2025-01": 2840.19, "2025-02": 2924.6, "2025-03": 3100.0, "2025-04": 2750.5, "2025-05": 2900.0 } },
  { natureza: "DEBITO", grupo: "Máquinas e Equipamentos", categoria: "Manutenção", ccusto: "Atividade Leiteira",
    valores: { "2025-01": 946, "2025-02": 1937.8, "2025-04": 1200.0 } },
  // Produção Rural (folha)
  { natureza: "DEBITO", grupo: "Produção Rural", categoria: "Pessoal - Salário", ccusto: "Atividade Leiteira",
    fornecedor: "Funcionários (Folha)",
    valores: { "2025-01": 40386.02, "2025-02": 50431.6, "2025-03": 42000.0, "2025-04": 41500.0, "2025-05": 20797.68 } },
  { natureza: "DEBITO", grupo: "Produção Rural", categoria: "Pessoal - FGTS", ccusto: "Atividade Leiteira",
    valores: { "2025-01": 3540.55, "2025-02": 6995.1, "2025-03": 3600, "2025-04": 3500, "2025-05": 3540 } },
  { natureza: "DEBITO", grupo: "Produção Rural", categoria: "Pessoal - Férias", ccusto: "Atividade Leiteira",
    valores: { "2025-01": 3619.6, "2025-03": 3560.6 } },
  // Plantio Café
  { natureza: "DEBITO", grupo: "Plantio", categoria: "Galpão", ccusto: "Plantio Café",
    valores: { "2025-01": 102.83, "2025-02": 108, "2025-03": 100.8, "2025-04": 99.4, "2025-05": 106.93 } },
  // Investimentos
  { natureza: "DEBITO", grupo: "Investimento", categoria: "Investimento Criação Animal", ccusto: "Atividade Leiteira - Investimento",
    valores: { "2025-01": 4236, "2025-02": 11466, "2025-04": 4866 } },
  { natureza: "DEBITO", grupo: "Plantio", categoria: "Investimento Plantio", ccusto: "Plantio Café - Investimento",
    valores: { "2025-01": 6793.34, "2025-02": 1293.3, "2025-03": 6393.3, "2025-04": 20143 } },
];

// Projeção (contas em aberto, a vencer) — meses futuros.
const PROJECAO: Linha[] = [
  { natureza: "DEBITO", grupo: "Criação Animal", categoria: "Ração", ccusto: "Atividade Leiteira",
    fornecedor: "Cooperativa Agropecuária",
    valores: { "2026-06": 192903.5, "2026-07": 154153.5 } },
  { natureza: "DEBITO", grupo: "Criação Animal", categoria: "Curral", ccusto: "Atividade Leiteira",
    valores: { "2026-06": 61414.3, "2026-07": 46603.4 } },
  { natureza: "DEBITO", grupo: "Produção Rural", categoria: "Pessoal - Salário", ccusto: "Atividade Leiteira",
    fornecedor: "Funcionários (Folha)",
    valores: { "2026-06": 60900, "2026-07": 60900 } },
  { natureza: "DEBITO", grupo: "Impostos", categoria: "DARF", ccusto: "Atividade Leiteira",
    fornecedor: "Secretaria da Receita Federal",
    valores: { "2026-06": 5000, "2026-07": 5000 } },
];

function endOfMonth(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)); // dia 0 do mês seguinte = último dia do mês
}
function dayOfMonth(ym: string, day: number): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

async function main() {
  console.log("Limpando dados...");
  await prisma.lancamento.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.grupoCategoria.deleteMany();
  await prisma.centroCusto.deleteMany();
  await prisma.contaBancaria.deleteMany();
  await prisma.clienteFornecedor.deleteMany();

  console.log("Criando cadastros...");
  const centros = new Map<string, number>();
  for (const c of CENTROS) {
    const r = await prisma.centroCusto.create({ data: c });
    centros.set(c.nome, r.id);
  }

  const categorias = new Map<string, number>(); // "grupo|categoria" -> id
  let gOrdem = 1;
  for (const [grupo, cats] of Object.entries(PLANO)) {
    const g = await prisma.grupoCategoria.create({ data: { nome: grupo, ordem: gOrdem++ } });
    for (const nome of cats) {
      const cat = await prisma.categoria.create({ data: { nome, grupoCategoriaId: g.id } });
      categorias.set(`${grupo}|${nome}`, cat.id);
    }
  }

  const contas = new Map<string, number>();
  for (const c of CONTAS) {
    const r = await prisma.contaBancaria.create({ data: { nome: c.nome, banco: c.banco } });
    contas.set(c.nome, r.id);
  }

  const fornecedores = new Map<string, number>();
  for (const nome of FORNECEDORES) {
    const r = await prisma.clienteFornecedor.create({ data: { nome } });
    fornecedores.set(nome, r.id);
  }

  console.log("Criando lançamentos...");
  const contaPadrao = contas.get("BB MAGC")!;
  let count = 0;

  async function inserir(linhas: Linha[], situacao: Situacao) {
    for (const l of linhas) {
      const categoriaId = categorias.get(`${l.grupo}|${l.categoria}`);
      const centroCustoId = centros.get(l.ccusto);
      if (!categoriaId || !centroCustoId) {
        throw new Error(`Cadastro ausente: ${l.grupo}|${l.categoria} / ${l.ccusto}`);
      }
      for (const [ym, valor] of Object.entries(l.valores)) {
        const liquidado = situacao === "LIQUIDADO";
        const venc = liquidado ? dayOfMonth(ym, 20) : endOfMonth(ym);
        await prisma.lancamento.create({
          data: {
            natureza: l.natureza,
            valor,
            dataCompetencia: endOfMonth(ym),
            dataVencimento: venc,
            dataLiquidacao: liquidado ? venc : null,
            situacao,
            categoriaId,
            centroCustoId,
            contaBancariaId: contaPadrao,
            clienteFornecedorId: l.fornecedor ? fornecedores.get(l.fornecedor) ?? null : null,
            descricao: `${l.categoria} - ${ym}`,
          },
        });
        count++;
      }
    }
  }

  await inserir(REALIZADO, "LIQUIDADO");
  await inserir(PROJECAO, "ABERTO");

  console.log(`OK: ${count} lançamentos criados.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
