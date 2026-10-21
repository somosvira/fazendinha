import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), saldos: vi.fn(), compromissos: vi.fn() }));
vi.mock("../financeiro/dashboard.js", () => ({ obterDashboard: mocks.dashboard }));
vi.mock("../financeiro/contas.js", () => ({ resumoSaldos: mocks.saldos }));
vi.mock("../financeiro/operacoes.js", () => ({ listarCompromissos: mocks.compromissos }));
import { ferramentaFinanceiro, resolverPeriodo, hojeLocal } from "./financeiro.js";
import { executarFerramenta, ferramentasDisponiveis } from "./registro.js";
import { artigosDisponiveis, consultarAjuda } from "./ajuda.js";
import type { ContextoAssistente } from "./tipos.js";

const ctx: ContextoAssistente = { usuario: { id: 1, nome: "Fixture", email: "fixture@example.test", papel: "proprietario", status: "ATIVO", dono: true, flags: [], areas: [], abas: [] }, propriedadeId: 8, nomeEscopo: "Sítio teste", agora: new Date("2026-10-14T02:00:00Z") };
const consultar = (visao: string, inicio: string | null = "2026-09-01", fim: string | null = "2026-09-30", contexto = ctx) => ferramentaFinanceiro.executar({ visao, inicio, fim }, contexto);
beforeEach(() => { vi.clearAllMocks(); });

describe("consulta financeira por serviços operacionais", () => {
  it("reutiliza dashboard com sítio e limites inclusivos e separa caixa de pendências", async () => {
    mocks.dashboard.mockResolvedValue({ realizado: { entradas: new Prisma.Decimal("1234.56"), saidas: new Prisma.Decimal("234.56"), resultado: new Prisma.Decimal("1000") }, compromissos: { aPagar: new Prisma.Decimal("0.01"), aReceber: new Prisma.Decimal("10") } });
    const r = await consultar("resumo");
    expect(mocks.dashboard).toHaveBeenCalledWith(8, new Date("2026-09-01T00:00:00Z"), new Date("2026-09-30T23:59:59.999Z"));
    expect(r.resposta).toContain("Entradas: R$ 1.234,56");
    expect(r.resposta).toContain("Resultado realizado: R$ 1.000,00");
    expect(r.resposta).toContain("A pagar: R$ 0,01");
    expect(r.fontes[0].url).toBe("/financeiro?inicio=2026-09-01&fim=2026-09-30");
  });
  it("paga só saldo pendente e não inclui liquidados/cancelados ou outro tipo", async () => {
    mocks.compromissos.mockResolvedValue([
      { tipo: "PAGAR", status: "PARCIAL", seq: 2, saldoPendente: new Prisma.Decimal("20.10"), valorOriginal: new Prisma.Decimal("999"), dataVencimento: new Date("2026-09-02"), parceiro: { nome: "Parceiro" } },
      { tipo: "PAGAR", status: "PENDENTE", seq: 3, saldoPendente: new Prisma.Decimal("0.20"), dataVencimento: new Date("2026-09-03"), parceiro: null },
      ...["LIQUIDADO", "CANCELADO"].map(status => ({ tipo: "PAGAR", status, saldoPendente: new Prisma.Decimal("800") })),
      { tipo: "RECEBER", status: "PENDENTE", saldoPendente: new Prisma.Decimal("700") },
    ]);
    const r = await consultar("pagar");
    expect(r.resposta).toContain("R$ 20,30 em 2 compromisso(s)");
    expect(r.resposta).not.toContain("999");
    expect(r.fontes[0].url).toContain("situacao=pagar");
  });
  it("não transforma falha de consulta em zero", async () => {
    mocks.dashboard.mockRejectedValue(new Error("DB unavailable"));
    await expect(consultar("resumo")).rejects.toThrow("DB unavailable");
  });
  it("rotula saldo atual e rejeita saldo histórico antes de buscar dados", async () => {
    await expect(consultar("saldo")).rejects.toThrow("saldo é atual");
    expect(mocks.saldos).not.toHaveBeenCalled();
    mocks.saldos.mockResolvedValue({ saldoGeral: new Prisma.Decimal("10"), contas: [{ nome: "Conta", saldoAtual: new Prisma.Decimal("10"), incluirNoSaldoGeral: true, numeroConta: "NAO-EXIBIR" }] });
    const r = await consultar("saldo", null, null);
    expect(r.resposta).toContain("Saldo atual em 13/10/2026: R$ 10,00");
    expect(r.resposta).not.toContain("NAO-EXIBIR");
  });
  it("repete exatamente despesas calculadas pela tela, inclusive estorno negativo", async () => {
    mocks.dashboard.mockResolvedValue({ despesasPorCategoria: [{ categoria: "Ração", valor: new Prisma.Decimal("-1500.50") }] });
    const r = await consultar("despesas_categoria");
    expect(r.resposta).toContain("Ração: R$ -1.500,50");
  });
  it("mantém ausência de registros distinta de falha e total completo na lista truncada", async () => {
    mocks.compromissos.mockResolvedValue([]);
    expect((await consultar("receber")).resposta).toContain("Nenhum compromisso pendente");
    mocks.compromissos.mockResolvedValue(Array.from({ length: 11 }, (_, i) => ({ tipo: "RECEBER", status: "PENDENTE", seq: i, saldoPendente: new Prisma.Decimal("0.10"), dataVencimento: new Date("2026-09-03"), parceiro: null })));
    const r = await consultar("receber");
    expect(r.resposta).toContain("R$ 1,10 em 11 compromisso(s)");
    expect(r.resposta).toContain("primeiros 10");
    expect(r.fontes[0].url).toContain("situacao=receber");
  });
});
describe("autorização e extensibilidade", () => {
  it.each(["verValores", "verInvestimento", "verSalarios"])("não consulta valores sem %s, mesmo com aba e área", async flag => {
    const restrito = { ...ctx, usuario: { ...ctx.usuario, dono: false, areas: ["financeiro"], abas: ["dashboard", "gastos", "caixinha"], flags: ["verValores", "verInvestimento", "verSalarios"].filter(f => f !== flag) } };
    expect((await consultar("resumo", null, null, restrito)).modo).toBe("acesso_negado");
    expect(mocks.dashboard).not.toHaveBeenCalled();
    expect(ferramentasDisponiveis(restrito).some(f => f.name === "consultar_financeiro")).toBe(false);
  });
  it("área e aba são conferidas novamente na execução, não só nos specs", async () => {
    const usuario = { ...ctx.usuario, dono: false, areas: ["financeiro"], abas: ["caixinha"], flags: ["verValores", "verInvestimento", "verSalarios"] };
    expect((await executarFerramenta("consultar_financeiro", { visao: "resumo", inicio: null, fim: null }, { ...ctx, usuario })).modo).toBe("acesso_negado");
    expect(mocks.dashboard).not.toHaveBeenCalled();
    expect((await consultar("resumo", null, null, { ...ctx, usuario: { ...usuario, areas: ["pecuaria"] } })).modo).toBe("acesso_negado");
  });
  it("ajuda só oferece artigos de áreas/abas autorizadas e desconhecidos não vazam", () => {
    const restrito = { ...ctx, usuario: { ...ctx.usuario, dono: false, areas: ["pecuaria"], abas: [], flags: [] } };
    const ids = artigosDisponiveis(restrito).map(a => a.id);
    expect(ids).toContain("rebanho-navegacao"); expect(ids).toContain("estoque-saldos");
    expect(ids).not.toContain("financeiro-relatorios");
    expect(consultarAjuda("financeiro-relatorios", restrito).modo).toBe("acesso_negado");
  });
  it("não dá acesso a ferramentas legadas, desconhecidas ou parâmetros de identidade", async () => {
    await expect(executarFerramenta("estoque", {}, ctx)).rejects.toThrow("não está disponível");
    await expect(ferramentaFinanceiro.executar({ visao: "resumo", inicio: null, fim: null, propriedadeId: 2 }, ctx)).rejects.toThrow();
    expect((await executarFerramenta("fora_do_contexto", {}, ctx)).modo).toBe("fora_escopo");
    expect(mocks.dashboard).not.toHaveBeenCalled();
  });
});
describe("datas e recortes", () => {
  it("usa o dia local de São Paulo e o mês de fevereiro bissexto", () => {
    expect(hojeLocal(ctx.agora)).toBe("2026-10-13");
    expect(resolverPeriodo(null, null, new Date("2024-02-15T12:00:00Z"))).toMatchObject({ inicio: "2024-02-01", fim: "2024-02-29" });
    expect(resolverPeriodo("2026-10-14", "2026-10-14", ctx.agora).dataFim.toISOString()).toBe("2026-10-14T23:59:59.999Z");
  });
  it("recusa períodos incompletos, invertidos, inválidos ou além do limite", async () => {
    await expect(consultar("resumo", "2026-09-01", null)).rejects.toThrow();
    await expect(consultar("resumo", "2026-09-02", "2026-09-01")).rejects.toThrow();
    await expect(consultar("resumo", "2026-02-30", "2026-03-01")).rejects.toThrow();
    await expect(consultar("resumo", "2025-01-01", "2026-10-14")).rejects.toThrow();
    expect(mocks.dashboard).not.toHaveBeenCalled();
  });
});
