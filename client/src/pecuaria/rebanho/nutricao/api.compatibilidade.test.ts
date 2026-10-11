// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { consultarVisaoNutricional, consultarResumoNutricional, listarDietas, listarFechamentos, obterVigencia } from "./api";
const lote = { id: "l1", nome: "Matrizes", ativo: true, propriedadeId: 1, propriedade: { id: 1, nome: "Principal" }, animaisAtivos: 3 };
const dieta = { id: "d1", nome: "Matrizes", versao: 1 };
const vigente = { id: "v1", desde: "2026-01-01", ate: null, dieta };
const fechamento = (id: string, custo: string | null, status = "CONFIRMADO", completo = true, verValores = true) => ({ id, lote: { id: "l1", nome: "Matrizes" }, propriedadeId: 1, status, animalDias: 2, custoConhecido: custo, coberturaCustoCompleta: completo, verValores });
let fechamentos: ReturnType<typeof fechamento>[];
let chamadas: string[];
beforeEach(() => {
  localStorage.clear(); chamadas = [];
  fechamentos = [fechamento("f1", "1.11"), fechamento("f2", "2.22"), fechamento("f3", "500.00", "ESTORNADO")];
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    chamadas.push(path);
    const u = new URL(path, "http://localhost");
    let data: unknown;
    if (u.pathname.endsWith("/consumo/fechamentos")) {
      const pagina = Number(u.searchParams.get("pagina") ?? 1);
      data = { itens: fechamentos.slice((pagina - 1) * 2, pagina * 2), total: fechamentos.length, pagina, limite: 2 };
    } else if (u.pathname.endsWith("/vigencias")) {
      const pagina = Number(u.searchParams.get("pagina") ?? 1);
      data = { itens: pagina === 1 ? [vigente] : [{ ...vigente, id: "v2" }], total: 2, pagina, limite: 1, vigente, programada: null };
    } else if (u.pathname.endsWith("/dietas")) data = [{ ...dieta, publicadaEm: "2026-01-01", itens: [] }];
    else if (u.pathname.endsWith("/lotes")) data = [lote];
    else if (u.pathname.endsWith("/lotes/l1")) data = lote;
    else throw new Error("Endpoint inesperado: " + path);
    return { ok: true, json: async () => data };
  }));
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
describe("consultas da Nutrição na API V3 existente", () => {
  it("soma todo o histórico paginado em centavos e exclui estornos", async () => {
    const resultado = await consultarVisaoNutricional();
    expect(resultado.lotes[0].custos).toMatchObject({ custoConhecido: "3.33", animalDias: 4, fechamentos: 2, coberturaCustoCompleta: true });
    expect(chamadas.every((p) => !p.includes("/visao-geral") && !p.includes("/resumo"))).toBe(true);
  });
  it("não trata custos desconhecidos como zero e sinaliza cobertura parcial", async () => {
    fechamentos = [fechamento("f1", "1.11"), fechamento("f2", null, "CONFIRMADO", false)];
    const r = await consultarResumoNutricional("l1");
    expect(r.custos).toMatchObject({ custoConhecido: "1.11", coberturaCustoCompleta: false });
    fechamentos = [fechamento("f1", null, "CONFIRMADO", false)];
    expect((await consultarResumoNutricional("l1")).custos.custoConhecido).toBeNull();
  });
  it("respeita o mascaramento de valores entregue pela API", async () => {
    fechamentos = [fechamento("f1", null, "CONFIRMADO", true, false)];
    const r = await consultarVisaoNutricional();
    expect(r.verValores).toBe(false);
    expect(r.lotes[0].custos.custoConhecido).toBeNull();
  });
  it("filtra a situação antes de contar e paginar, incluindo páginas posteriores", async () => {
    const pagina = await listarFechamentos(undefined, 1, "ESTORNADO");
    expect(pagina.total).toBe(1);
    expect(pagina.itens.map((f) => f.id)).toEqual(["f3"]);
    expect(pagina.itens[0].propriedade.nome).toBe("Principal");
  });
  it("resolve o uso vigente de receitas pelo sítio dos lotes", async () => {
    expect((await listarDietas())[0].lotesEmUso).toEqual([{ id: "l1", nome: "Matrizes", propriedade: lote.propriedade }]);
  });
  it("encontra uma vigência de uma página posterior sem um endpoint inexistente", async () => {
    expect((await obterVigencia("v2", "l1")).id).toBe("v2");
    await expect(obterVigencia("inexistente", "l1")).rejects.toThrow("Vigência não encontrada");
  });
});
