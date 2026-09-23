import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

// Seed aditiva no banco local habitual. Nunca apaga ou reseta dados existentes.
const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
const database = decodeURIComponent(url.pathname.slice(1));
if (database !== "fazendinha_local" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || process.env.NODE_ENV === "production") {
  throw new Error("A seed QA249 exige DATABASE_URL local apontando para fazendinha_local");
}
const directory = resolve(".qa249", "local");
mkdirSync(directory, { recursive: true });
const { prisma } = await import("../src/db.js");
const { hashSenha } = await import("../src/services/auth/hash.js");
const { aplicarPreset } = await import("../src/services/auth/papeis.js");
const { confirmarRascunhoOperacao } = await import("../src/services/financeiro/operacoes.js");
const { listarSaldos } = await import("../src/services/estoque/estoque.js");
const { listarContas } = await import("../src/services/financeiro/contas.js");
const { autenticar } = await import("../src/services/auth/contas.js");

const senha = "QA249-local-2026!"; // Exclusiva da massa local fictícia.
const hoje = new Date();
const date = (offset = 0) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + offset));
const scenarios = [
  ["U01", "Rascunho e compra à vista", 0], ["U02", "Compra a prazo", 0],
  ["U03", "Pagamento parcial", 0], ["U04", "Consumo direto", 0],
  ["U05", "Serviço", null], ["U06", "Venda", 10],
  ["U07", "Inventário", 0], ["U08", "Bonificação", 0],
  ["U09", "Produção", 0], ["U10", "Ajuste", 10],
  ["U11", "Devolução ao fornecedor", 10], ["U12", "Cancelar à vista", 0],
  ["U13", "Cancelar a prazo", 0], ["U14", "Cancelar parcial", 0],
  ["U15", "Liquidar e cancelar", 0], ["U16", "Múltiplos itens", 0],
  ["U17", "Validações", 0], ["U18", "Transferência financeira", null],
] as const;
try {
  const dbName = await prisma.$queryRaw<{ nome: string }[]>`SELECT current_database()::text AS nome`;
  assert.equal(dbName[0].nome, database);
  const manifestPath = resolve(directory, "manifesto.json");
  if (await prisma.propriedade.findUnique({ where: { nome: "QA249 Principal" } })) {
    if (!existsSync(manifestPath)) throw new Error("Massa QA249 já existe sem manifesto local; não será duplicada ou resetada");
    console.log("Seed já aplicada. Cadastros, saldos e testes manuais preservados.");
  } else {
    const manifest = await prisma.$transaction(async tx => {
      const principal = await tx.propriedade.create({ data: { nome: "QA249 Principal", apelido: "QA Principal", principal: (await tx.propriedade.count()) === 0, ordem: 1 } });
      const secundaria = await tx.propriedade.create({ data: { nome: "QA249 Secundária", apelido: "QA Secundária", ordem: 2 } });
      const usuarios = [];
      for (const [email, papel, dono] of [["qa249@example.test", "proprietario", true], ["qa249-consulta@example.test", "consulta", false]] as const) {
        const u = await tx.usuario.create({ data: { nome: `QA249 ${papel}`, email, papel, dono, status: "ATIVO", senhaHash: hashSenha(senha), ...aplicarPreset(papel) } });
        usuarios.push({ id: u.id, email, papel });
      }
      const categorias = [];
      for (const nome of ["QA249 Insumos", "QA249 Serviços", "QA249 Vendas", "QA249 Silagem", "QA249 Vacinas"]) categorias.push(await tx.categoria.create({ data: { nome, classificacao: "CUSTEIO" } }));
      const investimento = await tx.categoria.create({ data: { nome: "QA249 Equipamentos", classificacao: "INVESTIMENTO" } });
      categorias.push(investimento);
      categorias.push(await tx.categoria.create({ data: { nome: "QA249 Categoria inativa", ativo: false } }));
      const centros = [];
      for (const [ordem, nome] of ["Pecuária", "Agronomia", "Equipe", "Gestão"].entries()) centros.push(await tx.centroCusto.create({ data: { nome, ordem } }));
      const centro = centros[0];
      const produtosClassificacao = [];
      // Sem preço no cadastro: custo médio nasce das compras/inventários.
      for (const [nome, categoriaId, centroCustoId, unidade] of [
        ["QA249 Silagem de milho", categorias[3].id, centro.id, "kg"],
        ["QA249 Vacina contra brucelose", categorias[4].id, centro.id, "un"],
        ["QA249 Adubo", categorias[0].id, centros[1].id, "kg"],
        ["QA249 Equipamento", investimento.id, centro.id, "un"],
      ] as const) produtosClassificacao.push(await tx.produto.create({ data: { nome, categoriaId, unidade, estocavel: true, centrosCusto: { create: [{ centroCustoId }] } } }));
      const parceiros = [];
      for (const [nome, papeis, ativo] of [
        ["QA249 Fornecedor", ["FORNECEDOR"], true], ["QA249 Cliente", ["CLIENTE"], true],
        ["QA249 Prestador", ["PRESTADOR_SERVICO"], true], ["QA249 Múltiplos papéis", ["CLIENTE", "FORNECEDOR"], true],
        ["QA249 Fornecedor inativo", ["FORNECEDOR"], false], ["QA249 Papel incompatível", ["OUTRO"], true],
      ] as const) {
        const p = await tx.parceiro.create({ data: { nome, ativo, tipo: nome === "QA249 Cliente" ? "CLIENTE" : nome === "QA249 Papel incompatível" ? "OUTRO" : "FORNECEDOR", papeis: { create: papeis.map(papel => ({ papel })) }, ...(nome === "QA249 Fornecedor" ? { formaPagamentoPreferida: "BOLETO", condicaoPagamentoPreferida: "A_PRAZO", prazosPagamento: [30, 60] } : {}) } });
        parceiros.push({ id: p.id, nome, papeis, ativo });
      }
      // Conjunto pequeno e realista que cobre todos os formatos de conta sem
      // criar uma conta artificial por cenário. Os testes comparam deltas no
      // saldo registrado antes/depois, então podem reutilizar essas contas.
      const bancoOperacional = await tx.contaFinanceira.create({ data: { nome: "QA249 Banco Operacional", tipo: "BANCO", instituicao: "Sicoob", tipoBancario: "CORRENTE", agencia: "0001", numeroConta: "24901", digito: "9", titular: "Fazenda QA249", propriedadeId: principal.id, saldoAbertura: 10000, dataSaldoAbertura: date(-1), ordem: 0 } });
      const poupancaReserva = await tx.contaFinanceira.create({ data: { nome: "QA249 Poupança Reserva", tipo: "BANCO", instituicao: "Sicredi", tipoBancario: "POUPANCA", agencia: "0712", numeroConta: "24902", digito: "4", titular: "Fazenda QA249", propriedadeId: principal.id, saldoAbertura: 3000, dataSaldoAbertura: date(-1), ordem: 1 } });
      const contaPagamento = await tx.contaFinanceira.create({ data: { nome: "QA249 Conta Pagamento", tipo: "BANCO", instituicao: "Mercado Pago", tipoBancario: "PAGAMENTO", agencia: "0001", numeroConta: "24903", digito: "1", titular: "Fazenda QA249", propriedadeId: principal.id, saldoAbertura: 1000, dataSaldoAbertura: date(-1), ordem: 2 } });
      const caixa = await tx.contaFinanceira.create({ data: { nome: "QA249 Caixa Escritório", tipo: "CAIXA", local: "Escritório", responsavel: "Operador QA", propriedadeId: principal.id, saldoAbertura: 1200, dataSaldoAbertura: date(-1), ordem: 3 } });
      const aplicacao = await tx.contaFinanceira.create({ data: { nome: "QA249 Aplicação CDB", tipo: "APLICACAO", instituicao: "Sicoob", identificacao: "CDB QA 2026", propriedadeId: principal.id, saldoAbertura: 3000, dataSaldoAbertura: date(-1), ordem: 4 } });
      const foraSaldo = await tx.contaFinanceira.create({ data: { nome: "QA249 Conta fora do saldo geral", tipo: "BANCO", instituicao: "Banco Cooperativo", tipoBancario: "CORRENTE", agencia: "0002", numeroConta: "24904", digito: "7", titular: "Fazenda QA249", propriedadeId: principal.id, saldoAbertura: 500, dataSaldoAbertura: date(-1), incluirNoSaldoGeral: false, ordem: 5 } });
      const inativa = await tx.contaFinanceira.create({ data: { nome: "QA249 Conta inativa", tipo: "BANCO", instituicao: "Banco legado", tipoBancario: "CORRENTE", agencia: "0003", numeroConta: "24905", digito: "2", titular: "Fazenda QA249", ativo: false, propriedadeId: principal.id, saldoAbertura: 250, dataSaldoAbertura: date(-1), ordem: 6 } });
      const secundariaBanco = await tx.contaFinanceira.create({ data: { nome: "QA249 Secundária Banco", tipo: "BANCO", instituicao: "Sicredi", tipoBancario: "CORRENTE", agencia: "0712", numeroConta: "24906", digito: "8", titular: "Fazenda QA249 Secundária", propriedadeId: secundaria.id, saldoAbertura: 500, dataSaldoAbertura: date(-1) } });
      const contasPrincipais = [bancoOperacional, poupancaReserva, contaPagamento, caixa, aplicacao, foraSaldo, inativa];
      const contaPorFluxo: Record<string, typeof bancoOperacional> = {
        U01: bancoOperacional, U02: poupancaReserva, U03: contaPagamento, U04: caixa,
        U05: bancoOperacional, U06: contaPagamento, U07: bancoOperacional,
        U08: bancoOperacional, U09: bancoOperacional, U10: bancoOperacional,
        U11: contaPagamento, U12: bancoOperacional, U13: poupancaReserva,
        U14: contaPagamento, U15: aplicacao, U16: poupancaReserva,
        U17: bancoOperacional, U18: bancoOperacional,
      };
      const casos: { codigo: string; fluxo: string; conta: { id: number; nome: string; saldoInicial: number }; produto: { id: number; nome: string; estoqueInicial: number } | null; inventarioId: number | null }[] = [];
      for (const [codigo, fluxo, estoqueInicial] of scenarios) {
        const conta = contaPorFluxo[codigo];
        const produto = estoqueInicial === null ? null : await tx.produto.create({ data: { nome: `QA249 ${codigo} Produto`, unidade: "kg", tipo: "INSUMO", estocavel: true, categoriaId: categorias[0].id, centrosCusto: { create: [{ centroCustoId: centro.id }] } } });
        let inventarioId: number | null = null;
        if (produto && estoqueInicial) {
          const op = await confirmarRascunhoOperacao(tx, { tipo: "INVENTARIO_INICIAL", data: date(), descricao: `SEED QA249 ${codigo} estoque inicial`, propriedadeId: principal.id, usuarioId: usuarios[0].id, categoriaId: categorias[0].id, centroCustoId: centro.id, itens: [{ produtoId: produto.id, descricao: produto.nome, quantidade: estoqueInicial, unidade: "kg", valorUnitario: 10, estocavel: true }], financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" } });
          inventarioId = op.id;
        }
        casos.push({ codigo, fluxo, conta: { id: conta.id, nome: conta.nome, saldoInicial: Number(conta.saldoAbertura) }, produto: produto ? { id: produto.id, nome: produto.nome, estoqueInicial: estoqueInicial ?? 0 } : null, inventarioId });
      }
      const extra = await tx.produto.create({ data: { nome: "QA249 U16 Produto adicional", unidade: "un", estocavel: true } });
      const inativo = await tx.produto.create({ data: { nome: "QA249 Produto inativo", unidade: "kg", ativo: false } });
      const fechado = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 15));
      await tx.periodoFinanceiro.create({ data: { propriedadeId: principal.id, ano: fechado.getUTCFullYear(), mes: fechado.getUTCMonth() + 1, status: "FECHADO", fechadoPorId: usuarios[0].id, fechadoEm: new Date() } });
      return { database, criadoEm: new Date().toISOString(), dataOperacao: date().toISOString().slice(0, 10), vencimento30: date(30).toISOString().slice(0, 10), vencimento60: date(60).toISOString().slice(0, 10), dataPeriodoFechado: fechado.toISOString().slice(0, 10), propriedades: [principal, secundaria], usuarios, parceiros, categorias, centro, centros, produtosClassificacao, casos, contas: [...contasPrincipais, secundariaBanco], produtosExtras: [extra, inativo], saldoPrincipalInicial: 18200, saldoSecundariaInicial: 500 };
    }, { timeout: 30000 });
    // Verificação da seed usa as consultas reais que alimentam a interface.
    const contas = await listarContas(manifest.propriedades[0].id, true);
    assert.equal(contas.filter(c => c.ativo && c.incluirNoSaldoGeral).reduce((sum, c) => sum + Number(c.saldoAtual), 0), 18200);
    const saldos = await listarSaldos({ propriedadeId: manifest.propriedades[0].id });
    for (const conta of manifest.contas.filter(c => c.propriedadeId === manifest.propriedades[0].id)) assert.equal(Number(contas.find(c => c.id === conta.id)?.saldoAtual), Number(conta.saldoAbertura));
    for (const caso of manifest.casos) if (caso.produto) assert.equal(saldos.find(p => p.produtoId === caso.produto!.id)?.saldo, caso.produto.estoqueInicial);
    assert.equal(await prisma.operacao.count({ where: { propriedadeId: manifest.propriedades[0].id } }), 3);
    assert.equal(await prisma.compromissoFinanceiro.count({ where: { operacao: { propriedadeId: manifest.propriedades[0].id } } }), 0);
    assert.equal(await prisma.transacaoFinanceira.count({ where: { propriedadeId: manifest.propriedades[0].id } }), 0);
    assert.equal(await prisma.rascunhoOperacao.count({ where: { propriedadeId: manifest.propriedades[0].id } }), 0);
    for (const u of manifest.usuarios) assert.ok(await autenticar(u.email, senha));
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    writeFileSync(resolve(directory, "comprovante-qa249.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<comprovanteQA><aviso>DOCUMENTO FICTICIO SEM VALOR FISCAL</aviso><numero>QA249-001</numero><valor>100.00</valor></comprovanteQA>\n');
    console.log("Seed verificada: 2 propriedades, 2 acessos, 8 contas realistas, 6 parceiros, 22 produtos, 7 categorias (1 inativa), 4 centros padrão; 3 inventários e nenhum compromisso/pagamento.");
  }
  console.log(`Login: qa249@example.test / ${senha}\nConsulta: qa249-consulta@example.test / ${senha}`);
} finally { await prisma.$disconnect(); }
