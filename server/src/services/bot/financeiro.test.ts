import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ movimentos: vi.fn(), compromissos: vi.fn(), contas: vi.fn(), contar: vi.fn(), contarCompromissos: vi.fn(), contarTransacoes: vi.fn(), categorias: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: {
  movimentoConta: { findMany: m.movimentos, count: m.contar },
  compromissoFinanceiro: { findMany: m.compromissos, count: m.contarCompromissos },
  contaFinanceira: { findMany: m.contas }, categoria: { findMany: m.categorias },
  propriedade: { findUnique: vi.fn(async () => ({ nome: "Sítio A" })) },
  operacao: { groupBy: vi.fn(async () => []), count: vi.fn(async () => 0) },
  transacaoFinanceira: { findMany: vi.fn(async () => []), count: m.contarTransacoes },
} }));
import { responderConsulta, compararValores, moeda } from "./financeiro.js";
import { normalizarConsulta } from "./consulta.schema.js";
const D = (s: string) => new Prisma.Decimal(s);
const base = { assunto: "resumo", inicio: "2026-09-01", fim: "2026-09-30", compararInicio: null, compararFim: null, categoria: null };
const mov = (id: number, tipo: string, direcao: string, valor: string, reversao?: string) => ({
  id: String(id), seq: id, contaId: "conta", valor: D(valor), direcao,
  transacao: { id: `t${id}`, seq: id, tipo, status: "CONFIRMADA", data: new Date("2026-09-10"), operacaoId: null, operacao: null, reversaoDe: reversao ? { tipo: reversao } : null },
});
beforeEach(() => {
  vi.clearAllMocks(); m.movimentos.mockResolvedValue([]); m.compromissos.mockResolvedValue([]); m.contas.mockResolvedValue([]); m.contar.mockResolvedValue(0); m.contarCompromissos.mockResolvedValue(0); m.contarTransacoes.mockResolvedValue(0); m.categorias.mockResolvedValue([]);
});
it("concilia caixa com o dashboard real: exclui transferência e abate estorno", async () => {
  m.movimentos.mockResolvedValue([mov(1, "RECEBIMENTO", "ENTRADA", "2000"), mov(2, "PAGAMENTO", "SAIDA", "400"), mov(3, "REVERSAO", "ENTRADA", "100", "PAGAMENTO"), mov(4, "TRANSFERENCIA", "SAIDA", "500"), mov(5, "TRANSFERENCIA", "ENTRADA", "500")]);
  const resposta = await responderConsulta(normalizarConsulta(base), 7);
  expect(resposta.resposta).toContain("Entradas de caixa: R$ 2.000,00");
  expect(resposta.resposta).toContain("Saídas de caixa: R$ 300,00");
  expect(resposta.resposta).toContain("Resultado de caixa: R$ 1.700,00");
  expect(resposta.resposta).toContain("não é lucro");
  expect(resposta.resposta).toContain("Sítio A");
  expect(m.movimentos).toHaveBeenCalledWith(expect.objectContaining({ where: { transacao: { propriedadeId: 7, data: { gte: new Date("2026-09-01T00:00:00Z"), lte: new Date("2026-09-30T23:59:59.999Z") } } } }));
  expect(resposta.fontes[0].url).toBe("/financeiro?inicio=2026-09-01&fim=2026-09-30");
});
it("pendência usa saldo restante e ignora liquidação revertida e compromisso cancelado", async () => {
  m.compromissos.mockResolvedValue([
    { tipo: "PAGAR", status: "PARCIAL", valorOriginal: D("1000"), dataVencimento: new Date("2026-09-15"), parceiro: { nome: "Fornecedor" }, liquidacoes: [{ valor: D("400"), transacao: { status: "CONFIRMADA" } }, { valor: D("100"), transacao: { status: "REVERTIDA" } }] },
    { tipo: "PAGAR", status: "CANCELADO", valorOriginal: D("800"), dataVencimento: new Date("2026-09-15"), liquidacoes: [] },
  ]);
  const resposta = await responderConsulta(normalizarConsulta({ ...base, assunto: "pagar" }), 7);
  expect(resposta.resposta).toContain("Falta pagar: R$ 600,00");
  expect(resposta.resposta).not.toContain("800,00");
});
it("saldo atual usa a abertura e movimentos e respeita contas fora do total", async () => {
  m.contas.mockResolvedValue([
    { nome: "Banco", saldoAbertura: D("1000"), incluirNoSaldoGeral: true, movimentos: [{ valor: D("400"), direcao: "SAIDA" }] },
    { nome: "Reserva", saldoAbertura: D("250"), incluirNoSaldoGeral: false, movimentos: [] },
  ]);
  const resposta = await responderConsulta(normalizarConsulta({ ...base, assunto: "saldos", inicio: null, fim: null }), 7);
  expect(resposta.resposta).toContain("Saldo disponível nas contas: R$ 600,00");
  expect(resposta.resposta).toContain("Reserva (fora do saldo geral): R$ 250,00");
});
it("categoria inexistente/ambígua nunca vira total geral", async () => {
  const c = normalizarConsulta({ ...base, assunto: "saidas", categoria: "Ração" });
  await expect(responderConsulta(c, 7)).rejects.toThrow("Não encontrei");
  m.categorias.mockResolvedValue([{ id: "a", nome: "Ração vacas" }, { id: "b", nome: "Ração bezerras" }]);
  await expect(responderConsulta(c, 7)).rejects.toThrow("mais de uma categoria");
  expect(m.movimentos).not.toHaveBeenCalled();
});
it("consulta Sem categoria depois do ranking, sem incluir pagamentos classificados", async () => {
  const classificado = mov(2, "PAGAMENTO", "SAIDA", "250");
  const movimentos = [mov(1, "PAGAMENTO", "SAIDA", "100"), {
    ...classificado,
    transacao: { ...classificado.transacao, operacao: {
      categoriaId: "categoria-racao", categoriaNome: "Ração", valorTotal: D("250"), itens: [],
      transacoes: [{ id: "t2", seq: 2, tipo: "PAGAMENTO", status: "CONFIRMADA", valorTotal: D("250"), reversaoDeId: null }],
    } },
  }, mov(3, "REVERSAO", "ENTRADA", "20", "PAGAMENTO")];
  m.movimentos.mockResolvedValue(movimentos);
  const ranking = await responderConsulta(normalizarConsulta({ ...base, assunto: "categorias" }), 7);
  expect(ranking.resposta).toContain("Sem categoria: R$ 80,00");
  expect(ranking.resposta).toContain("Ração: R$ 250,00");

  const resposta = await responderConsulta(normalizarConsulta({ ...base, assunto: "saidas", categoria: "  SEM CATEGORIA  " }), 7);
  expect(resposta.resposta).toContain("Saídas de caixa · Sem categoria: R$ 80,00");
  expect(resposta.resposta).not.toContain("250,00");
  expect(resposta.resposta).toContain("Sítio A");
  expect(resposta.contexto?.consulta.categoria).toBe("SEM CATEGORIA");

  m.categorias.mockResolvedValue([{ id: "categoria-racao", nome: "Ração" }]);
  const classificada = await responderConsulta(normalizarConsulta({ ...base, assunto: "saidas", categoria: "ração" }), 7);
  expect(classificada.resposta).toContain("Saídas de caixa · Ração: R$ 250,00");
});
it("compara em Decimal e não inventa percentual com base zero", () => {
  expect(compararValores([{ rotulo: "Saídas", valor: "0.30" }], [{ rotulo: "Saídas", valor: "0.10" }])[0]).toContain("R$ 0,20 (200,00%)");
  expect(compararValores([{ rotulo: "Saídas", valor: "1" }], [{ rotulo: "Saídas", valor: "0" }])[0]).toContain("sem percentual");
  expect(moeda("123456789012.34")).toBe("R$ 123.456.789.012,34");
});
it("recusa resultado parcial por limite de volume", async () => {
  m.contar.mockResolvedValue(20_001);
  await expect(responderConsulta(normalizarConsulta(base), null)).rejects.toThrow("muitos registros");
  expect(m.movimentos).not.toHaveBeenCalled();
});
it.each(["resumo", "entradas", "saidas", "categorias"])("recusa %s antes de carregar compromissos acima do limite", async assunto => {
  m.contarCompromissos.mockResolvedValue(20_001);
  await expect(responderConsulta(normalizarConsulta({ ...base, assunto }), 7)).rejects.toThrow("muitos registros");
  expect(m.compromissos).not.toHaveBeenCalled();
  expect(m.movimentos).not.toHaveBeenCalled();
  expect(m.contas).not.toHaveBeenCalled();
});
it.each(["resumo", "saldos"])("recusa %s com histórico excessivo das contas ativas mesmo sem movimentos no período", async assunto => {
  m.contar.mockImplementation(async ({ where }) => where.conta ? 20_001 : 0);
  const consulta = normalizarConsulta({ ...base, assunto, ...(assunto === "saldos" ? { inicio: null, fim: null } : {}) });
  await expect(responderConsulta(consulta, 7)).rejects.toThrow("muitos registros");
  expect(m.contas).not.toHaveBeenCalled();
  expect(m.movimentos).not.toHaveBeenCalled();
});
it("recusa transações acima do limite mesmo quando faltam movimentos de conta", async () => {
  m.contarTransacoes.mockResolvedValue(20_001);
  await expect(responderConsulta(normalizarConsulta({ ...base, assunto: "entradas" }), null)).rejects.toThrow("muitos registros");
  expect(m.movimentos).not.toHaveBeenCalled();
  expect(m.contas).not.toHaveBeenCalled();
});
it.each([7, null])("aceita o limite exato e confere as fontes no mesmo escopo: %s", async propriedadeId => {
  m.contar.mockResolvedValue(20_000);
  m.contarCompromissos.mockResolvedValue(20_000);
  m.contarTransacoes.mockResolvedValue(20_000);
  m.movimentos.mockResolvedValue([mov(1, "RECEBIMENTO", "ENTRADA", "2000"), mov(2, "PAGAMENTO", "SAIDA", "400")]);
  const resposta = await responderConsulta(normalizarConsulta(base), propriedadeId);
  expect(resposta.resposta).toContain("Resultado de caixa: R$ 1.600,00");
  const escopo = propriedadeId === null ? {} : { propriedadeId };
  const data = { gte: new Date("2026-09-01T00:00:00Z"), lte: new Date("2026-09-30T23:59:59.999Z") };
  expect(m.contar).toHaveBeenCalledWith({ where: { conta: { ...escopo, ativo: true } } });
  expect(m.contarCompromissos).toHaveBeenCalledWith({ where: { operacao: escopo, dataVencimento: data } });
  expect(m.contarTransacoes).toHaveBeenCalledWith({ where: { ...escopo, data } });
});
it("consulta uma categoria sem carregar o histórico das contas nem compromissos do dashboard", async () => {
  m.contar.mockImplementation(async ({ where }) => where.conta ? 20_001 : 0);
  m.contarCompromissos.mockResolvedValue(20_001);
  m.contarTransacoes.mockResolvedValue(20_001);
  m.movimentos.mockResolvedValue([mov(1, "PAGAMENTO", "SAIDA", "100")]);
  const resposta = await responderConsulta(normalizarConsulta({ ...base, assunto: "saidas", categoria: "Sem categoria" }), 7);
  expect(resposta.resposta).toContain("Sem categoria: R$ 100,00");
  expect(m.contas).not.toHaveBeenCalled();
  expect(m.compromissos).not.toHaveBeenCalled();
});
