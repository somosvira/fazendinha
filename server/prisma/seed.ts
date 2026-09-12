import { PrismaClient } from "@prisma/client";
import { criarOperacao, transferir } from "../src/services/financeiro/operacoes.js";

const prisma = new PrismaClient();
const hoje = new Date();
const data = (dias: number) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + dias));

async function main() {
  const propriedade = await prisma.propriedade.create({
    data: { nome: "Fazenda Demonstração", apelido: "Sede", cidade: "Varginha", uf: "MG", principal: true },
  });

  const grupoReceitas = await prisma.grupoCategoria.create({ data: { nome: "Receitas operacionais", ordem: 1 } });
  const grupoInsumos = await prisma.grupoCategoria.create({ data: { nome: "Insumos e produção", ordem: 2 } });
  const grupoServicos = await prisma.grupoCategoria.create({ data: { nome: "Serviços e administração", ordem: 3 } });
  const vendaLeite = await prisma.categoria.create({ data: { nome: "Venda de leite", grupoCategoriaId: grupoReceitas.id, classificacao: "CUSTEIO" } });
  const racao = await prisma.categoria.create({ data: { nome: "Alimentação animal", grupoCategoriaId: grupoInsumos.id, classificacao: "CUSTEIO" } });
  const manutencao = await prisma.categoria.create({ data: { nome: "Manutenção e serviços", grupoCategoriaId: grupoServicos.id, classificacao: "CUSTEIO" } });
  const centroLeite = await prisma.centroCusto.create({ data: { nome: "Produção leiteira", ordem: 1 } });
  const centroAdministrativo = await prisma.centroCusto.create({ data: { nome: "Administração", ordem: 2 } });

  const banco = await prisma.contaFinanceira.create({ data: {
    nome: "Banco principal", tipo: "BANCO", instituicao: "Banco local", identificacao: "Agência 0001 · Conta 12345-6",
    tipoBancario: "CORRENTE", agencia: "0001", numeroConta: "12345", digito: "6", titular: "Fazenda Demonstração", ordem: 1,
    saldoAbertura: 125_000, dataSaldoAbertura: data(-30), incluirNoSaldoGeral: true, propriedadeId: propriedade.id,
  } });
  const caixa = await prisma.contaFinanceira.create({ data: {
    nome: "Caixa pequeno", tipo: "CAIXA", identificacao: "Responsável: Administrativo",
    local: "Escritório", responsavel: "Administrativo", ordem: 2,
    saldoAbertura: 2_500, dataSaldoAbertura: data(-30), incluirNoSaldoGeral: true, propriedadeId: propriedade.id,
  } });

  const cooperativa = await prisma.parceiro.create({ data: { nome: "Cooperativa Agropecuária", documento: "00000000000101", tipo: "FORNECEDOR", papeis: { create: [{ papel: "FORNECEDOR" }] }, formaPagamentoPreferida: "BOLETO", condicaoPagamentoPreferida: "A_PRAZO", prazosPagamento: [30, 60] } });
  const laticinio = await prisma.parceiro.create({ data: { nome: "Laticínio Regional", documento: "00000000000102", tipo: "CLIENTE", papeis: { create: [{ papel: "CLIENTE" }] } } });
  const oficina = await prisma.parceiro.create({ data: { nome: "Oficina Rural", documento: "00000000000103", tipo: "FORNECEDOR", papeis: { create: [{ papel: "PRESTADOR_SERVICO" }, { papel: "FORNECEDOR" }] }, pessoaContato: "Equipe da oficina", formaPagamentoPreferida: "PIX" } });
  const produtoRacao = await prisma.produto.create({ data: {
    nome: "Ração para lactação", tipo: "RACAO", unidade: "kg", estocavel: true, setor: "LEITE",
    custoUnitario: 12, minimoEstoque: 300, categoriaId: racao.id, centroCustoId: centroLeite.id,
  } });

  // Compra à vista: operação + saída da conta + entrada física, sem compromisso.
  await criarOperacao({
    tipo: "COMPRA_ESTOQUE", data: data(0), descricao: "Compra à vista de ração", parceiroId: cooperativa.id,
    categoriaId: racao.id, centroCustoId: centroLeite.id, propriedadeId: propriedade.id,
    itens: [{ produtoId: produtoRacao.id, descricao: "Ração para lactação", quantidade: 1_000, unidade: "kg", valorUnitario: 12, estocavel: true }],
    financeiro: { condicao: "A_VISTA", contaId: banco.id, formaPagamento: "PIX" },
  });

  // Compra a prazo: estoque entra agora; apenas o compromisso futuro é criado.
  await criarOperacao({
    tipo: "COMPRA_ESTOQUE", data: data(0), descricao: "Compra de ração faturada", parceiroId: cooperativa.id,
    categoriaId: racao.id, centroCustoId: centroLeite.id, propriedadeId: propriedade.id,
    itens: [{ produtoId: produtoRacao.id, descricao: "Ração para lactação", quantidade: 500, unidade: "kg", valorUnitario: 12, estocavel: true }],
    financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 6_000, dataVencimento: data(25) }] },
  });

  // Venda recebida: altera o banco, sem compromisso pendente.
  await criarOperacao({
    tipo: "VENDA", data: data(0), descricao: "Venda mensal de leite", parceiroId: laticinio.id,
    categoriaId: vendaLeite.id, centroCustoId: centroLeite.id, propriedadeId: propriedade.id,
    itens: [{ descricao: "Leite entregue", quantidade: 10_000, unidade: "L", valorUnitario: 2.5, estocavel: false }],
    financeiro: { condicao: "A_VISTA", contaId: banco.id, formaPagamento: "TRANSFERENCIA_BANCARIA" },
  });

  // Serviço contratado a prazo: existe na agenda, mas ainda não altera saldo.
  await criarOperacao({
    tipo: "SERVICO", data: data(0), descricao: "Manutenção preventiva do trator", parceiroId: oficina.id,
    categoriaId: manutencao.id, centroCustoId: centroAdministrativo.id, propriedadeId: propriedade.id,
    itens: [{ descricao: "Mão de obra e revisão", quantidade: 1, unidade: "serviço", valorUnitario: 1_800, estocavel: false }],
    financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 1_800, dataVencimento: data(12) }] },
  });

  // Duas pernas iguais: muda a distribuição, nunca o saldo geral.
  await transferir({ contaOrigemId: banco.id, contaDestinoId: caixa.id, valor: 1_000, data: data(0), descricao: "Reforço do caixa pequeno", propriedadeId: propriedade.id });

  console.log("Seed financeiro criado: 2 contas, 3 parceiros, 4 operações e 1 transferência.");
}

main().finally(() => prisma.$disconnect());
