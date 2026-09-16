import { prisma } from "../src/db.js";
import { criarOperacao, transferir } from "../src/services/financeiro/operacoes.js";

/* Massa local, aditiva e idempotente para exercitar relatórios financeiros.
 * Não apaga dados e fica inteiramente separada na propriedade QA abaixo. */
const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
const database = decodeURIComponent(databaseUrl.pathname.slice(1));
if (database !== "fazendinha_local" || !["127.0.0.1", "localhost", "[::1]"].includes(databaseUrl.hostname) || process.env.NODE_ENV === "production") {
  throw new Error("A seed de relatórios exige DATABASE_URL local apontando para fazendinha_local");
}

const NOME_PROPRIEDADE = "QA Relatórios Financeiros";
const hoje = new Date();
const data = (dias: number) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + dias));

async function main() {
  const existente = await prisma.propriedade.findUnique({
    where: { nome: NOME_PROPRIEDADE },
    include: { operacoesFinanceiras: true, transacoesFinanceiras: true },
  });
  if (existente) {
    console.log(`Seed de relatórios já existe: ${existente.operacoesFinanceiras.length} operações e ${existente.transacoesFinanceiras.length} transações em “${NOME_PROPRIEDADE}”.`);
    return;
  }

  const propriedade = await prisma.propriedade.create({
    data: { nome: NOME_PROPRIEDADE, apelido: "QA Relatórios", cidade: "Varginha", uf: "MG", ordem: 9_999 },
  });

  const [alimentacao, sanidade, manutencao, receitas, investimento] = await Promise.all([
    prisma.categoria.create({ data: { nome: "QA Relatórios · Alimentação", classificacao: "CUSTEIO" } }),
    prisma.categoria.create({ data: { nome: "QA Relatórios · Sanidade", classificacao: "CUSTEIO" } }),
    prisma.categoria.create({ data: { nome: "QA Relatórios · Manutenção", classificacao: "CUSTEIO" } }),
    prisma.categoria.create({ data: { nome: "QA Relatórios · Receitas", classificacao: "CUSTEIO" } }),
    prisma.categoria.create({ data: { nome: "QA Relatórios · Equipamentos", classificacao: "INVESTIMENTO" } }),
  ]);
  const [pecuaria, agricultura, gestao] = await Promise.all([
    prisma.centroCusto.create({ data: { nome: "QA Relatórios · Pecuária", ordem: 9_999 } }),
    prisma.centroCusto.create({ data: { nome: "QA Relatórios · Agricultura", ordem: 9_999 } }),
    prisma.centroCusto.create({ data: { nome: "QA Relatórios · Gestão", ordem: 9_999 } }),
  ]);
  const [banco, caixa, reserva] = await Promise.all([
    prisma.contaFinanceira.create({ data: { nome: "QA Relatórios · Banco", tipo: "BANCO", instituicao: "Banco de Testes", tipoBancario: "CORRENTE", agencia: "0001", numeroConta: "99999", digito: "1", titular: NOME_PROPRIEDADE, saldoAbertura: 80_000, dataSaldoAbertura: data(-100), propriedadeId: propriedade.id, ordem: 1 } }),
    prisma.contaFinanceira.create({ data: { nome: "QA Relatórios · Caixa", tipo: "CAIXA", local: "Escritório QA", responsavel: "Equipe QA", saldoAbertura: 5_000, dataSaldoAbertura: data(-100), propriedadeId: propriedade.id, ordem: 2 } }),
    prisma.contaFinanceira.create({ data: { nome: "QA Relatórios · Reserva", tipo: "APLICACAO", instituicao: "Banco de Testes", identificacao: "Reserva de curto prazo", saldoAbertura: 20_000, dataSaldoAbertura: data(-100), propriedadeId: propriedade.id, ordem: 3 } }),
  ]);
  const [fornecedor, veterinaria, laticinio, comprador] = await Promise.all([
    prisma.parceiro.create({ data: { nome: "QA Relatórios · Agroinsumos", documento: "99000000000001", tipo: "FORNECEDOR", papeis: { create: { papel: "FORNECEDOR" } } } }),
    prisma.parceiro.create({ data: { nome: "QA Relatórios · Clínica Veterinária", documento: "99000000000002", tipo: "FORNECEDOR", papeis: { create: { papel: "PRESTADOR_SERVICO" } } } }),
    prisma.parceiro.create({ data: { nome: "QA Relatórios · Laticínio", documento: "99000000000003", tipo: "CLIENTE", papeis: { create: { papel: "CLIENTE" } } } }),
    prisma.parceiro.create({ data: { nome: "QA Relatórios · Comprador de gado", documento: "99000000000004", tipo: "CLIENTE", papeis: { create: { papel: "CLIENTE" } } } }),
  ]);
  const [racao, medicamento] = await Promise.all([
    prisma.produto.create({ data: { nome: "QA Relatórios · Ração lactação", tipo: "RACAO", setor: "LEITE", unidade: "kg", estocavel: true, custoUnitario: 2.8, categoriaId: alimentacao.id, centroCustoId: pecuaria.id } }),
    prisma.produto.create({ data: { nome: "QA Relatórios · Vacina rebanho", tipo: "MEDICAMENTO", setor: "LEITE", unidade: "dose", estocavel: true, custoUnitario: 18, categoriaId: sanidade.id, centroCustoId: pecuaria.id } }),
  ]);

  const compras = [
    [-88, "Compra de ração para lactação", racao, 1_200, 2.8, fornecedor, alimentacao, pecuaria, banco],
    [-74, "Compra de suplemento mineral", racao, 600, 3.1, fornecedor, alimentacao, pecuaria, banco],
    [-61, "Compra de vacina do rebanho", medicamento, 180, 18, fornecedor, sanidade, pecuaria, caixa],
    [-47, "Reposição de ração no estoque", racao, 900, 2.95, fornecedor, alimentacao, pecuaria, banco],
    [-33, "Compra de medicamentos preventivos", medicamento, 120, 19.5, fornecedor, sanidade, pecuaria, banco],
    [-18, "Compra de ração de transição", racao, 750, 3.05, fornecedor, alimentacao, pecuaria, banco],
  ] as const;
  for (const [dias, descricao, produto, quantidade, valorUnitario, parceiro, categoria, centro, conta] of compras) {
    await criarOperacao({
      tipo: "COMPRA_ESTOQUE", data: data(dias), descricao, propriedadeId: propriedade.id, parceiroId: parceiro.id,
      categoriaId: categoria.id, centroCustoId: centro.id,
      itens: [{ produtoId: produto.id, descricao: produto.nome, quantidade, unidade: produto.unidade, valorUnitario, estocavel: true }],
      financeiro: { condicao: "A_VISTA", contaId: conta.id, formaPagamento: "PIX" },
    });
  }

  const despesas = [
    [-82, "Reparo do sistema de ordenha", 1_850, manutencao, pecuaria, veterinaria, banco],
    [-69, "Manutenção do trator", 2_400, manutencao, agricultura, veterinaria, banco],
    [-55, "Consultoria veterinária mensal", 1_200, sanidade, pecuaria, veterinaria, caixa],
    [-39, "Manutenção elétrica do galpão", 980, manutencao, gestao, veterinaria, banco],
    [-24, "Revisão de equipamentos de irrigação", 1_460, manutencao, agricultura, veterinaria, banco],
    [-11, "Atendimento sanitário emergencial", 760, sanidade, pecuaria, veterinaria, caixa],
  ] as const;
  for (const [dias, descricao, valorTotal, categoria, centro, parceiro, conta] of despesas) {
    await criarOperacao({
      tipo: "SERVICO", data: data(dias), descricao, valorTotal, propriedadeId: propriedade.id, parceiroId: parceiro.id,
      categoriaId: categoria.id, centroCustoId: centro.id, itens: [],
      financeiro: { condicao: "A_VISTA", contaId: conta.id, formaPagamento: "TRANSFERENCIA_BANCARIA" },
    });
  }

  const vendas = [
    [-79, "Venda quinzenal de leite", 10_800, 4_800, laticinio, receitas, pecuaria],
    [-64, "Venda quinzenal de leite", 11_250, 5_000, laticinio, receitas, pecuaria],
    [-50, "Venda de bezerros", 8_400, 6, comprador, receitas, pecuaria],
    [-35, "Venda quinzenal de leite", 11_700, 5_200, laticinio, receitas, pecuaria],
    [-20, "Venda de novilhas", 13_500, 5, comprador, receitas, pecuaria],
    [-6, "Venda quinzenal de leite", 12_150, 5_400, laticinio, receitas, pecuaria],
  ] as const;
  for (const [dias, descricao, valorTotal, quantidade, parceiro, categoria, centro] of vendas) {
    await criarOperacao({
      tipo: "VENDA", data: data(dias), descricao, propriedadeId: propriedade.id, parceiroId: parceiro.id,
      categoriaId: categoria.id, centroCustoId: centro.id,
      itens: [{ descricao: descricao.includes("leite") ? "Leite entregue" : "Animais comercializados", quantidade, unidade: descricao.includes("leite") ? "L" : "cabeça", valorUnitario: valorTotal / quantidade, estocavel: false }],
      financeiro: { condicao: "A_VISTA", contaId: banco.id, formaPagamento: "TRANSFERENCIA_BANCARIA" },
    });
  }

  await criarOperacao({
    tipo: "COMPRA_CONSUMO_DIRETO", data: data(-42), descricao: "Compra de material para cerca", propriedadeId: propriedade.id, parceiroId: fornecedor.id,
    categoriaId: investimento.id, centroCustoId: pecuaria.id,
    itens: [{ descricao: "Material de manutenção", quantidade: 1, unidade: "lote", valorUnitario: 3_200, estocavel: false }],
    financeiro: { condicao: "A_VISTA", contaId: banco.id, formaPagamento: "BOLETO" },
  });
  await criarOperacao({
    tipo: "APORTE", data: data(-30), descricao: "Aporte para capital de giro", valorTotal: 15_000, propriedadeId: propriedade.id,
    categoriaId: investimento.id, centroCustoId: gestao.id, itens: [],
    financeiro: { condicao: "A_VISTA", contaId: banco.id, formaPagamento: "TRANSFERENCIA_BANCARIA" },
  });

  const transferencias = [
    [-84, banco.id, caixa.id, 2_000, "Reforço do caixa administrativo"],
    [-58, banco.id, reserva.id, 7_500, "Aplicação de excedente temporário"],
    [-44, caixa.id, banco.id, 850, "Depósito de valores do caixa"],
    [-27, reserva.id, banco.id, 4_000, "Resgate para despesas operacionais"],
    [-9, banco.id, caixa.id, 1_500, "Reforço de caixa para pagamentos"],
  ] as const;
  for (const [dias, contaOrigemId, contaDestinoId, valor, descricao] of transferencias) {
    await transferir({ contaOrigemId, contaDestinoId, valor, data: data(dias), descricao, propriedadeId: propriedade.id });
  }

  const [operacoes, transacoes] = await Promise.all([
    prisma.operacao.count({ where: { propriedadeId: propriedade.id } }),
    prisma.transacaoFinanceira.count({ where: { propriedadeId: propriedade.id } }),
  ]);
  console.log(`Seed de relatórios criado em “${NOME_PROPRIEDADE}”: ${operacoes} operações confirmadas e ${transacoes} transações financeiras.`);
  console.log("Abra Financeiro → Relatórios, selecione a propriedade QA Relatórios e use um período dos últimos 3 meses.");
}

main()
  .catch((erro) => { console.error(erro); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
