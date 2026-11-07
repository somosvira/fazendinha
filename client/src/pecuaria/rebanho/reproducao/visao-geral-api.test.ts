import { beforeEach, expect, it, vi } from "vitest";
import {
  consultarAgendaVisaoGeral,
  consultarExecucoesVisaoGeral,
  demandaDoGrupo,
  diaDoGrupo,
  organizarVisaoGeral,
} from "./visao-geral-api";
import {
  grupoVisaoGeral as g,
  execucaoVisaoGeral as p,
} from "./visao-geral.fixture";
const m = vi.hoisted(() => ({ req: vi.fn(), protocolo: vi.fn() }));
vi.mock("./api", () => ({ reqV4: m.req }));
vi.mock("../protocolos/api", () => ({ reqProtocolo: m.protocolo }));
beforeEach(() => vi.resetAllMocks());
it("consulta todas as páginas reais antes de filtrar Reprodução e conserva o sítio", async () => {
  const grupos = Array.from({ length: 11 }, (_, i) =>
    g(String(i), "2026-11-07", i === 0 ? { secao: "SANIDADE" } : {}),
  );
  m.req.mockImplementation(async (path: string) => {
    const pagina = Number(
      new URLSearchParams(path.split("?")[1]).get("pagina"),
    );
    return {
      grupos: grupos.slice((pagina - 1) * 10, pagina * 10),
      totalGrupos: 11,
      pagina,
      tamanhoPagina: 10,
    };
  });
  const dados = await consultarAgendaVisaoGeral(7, "2026-11-07");
  expect(dados).toHaveLength(10);
  expect(dados.at(-1)?.grupo).toEqual({
    origem: "PROTOCOLO",
    identidade: "10",
  });
  expect(m.req).toHaveBeenCalledTimes(2);
  expect(
    m.req.mock.calls.every(
      ([path, _body, method, sitio]) =>
        path.includes("tamanhoPagina=10") && method === "GET" && sitio === 7,
    ),
  ).toBe(true);
});
it("página que mudou ou repetiu identidade não é apresentada como consulta completa", async () => {
  m.req.mockImplementation(async (path: string) => {
    const pagina = Number(
      new URLSearchParams(path.split("?")[1]).get("pagina"),
    );
    return {
      grupos:
        pagina === 1
          ? Array.from({ length: 10 }, (_, i) => g(String(i), null))
          : [g("0", null)],
      totalGrupos: 11,
      pagina,
      tamanhoPagina: 10,
    };
  });
  await expect(consultarAgendaVisaoGeral(7, "2026-11-07")).rejects.toThrow(
    /mudaram entre páginas/,
  );
});
it("organiza Hoje e intervalo futuro sem transformar ausência de prazo em atraso ou duplicar execução", () => {
  const hoje = g("a", "2026-11-07"),
    proxima = g("b", "2026-11-08"),
    fora = g("c", "2026-12-01"),
    semPrazo = g("d", null);
  const organizados = organizarVisaoGeral(
    [hoje, proxima, fora, semPrazo],
    [p("a"), p("b"), p("c"), p("d"), p("a", "INDIVIDUAL")],
    "2026-11-07",
    "2026-11-08",
    "2026-11-14",
  );
  expect(organizados.hoje).toEqual([hoje]);
  expect(organizados.proximos).toEqual([proxima]);
  expect(organizados.emAndamento.map((p) => `${p.modo}:${p.id}`)).toEqual([
    "COLETIVO:c",
    "COLETIVO:d",
    "INDIVIDUAL:a",
  ]);
  expect(organizados.semPrazo).toEqual([semPrazo]);
});
it("horário é agrupado pelo dia civil do sítio e data sem hora permanece literal", () => {
  expect(
    diaDoGrupo(g("a", "2026-11-08T01:00:00Z", { precisaoTemporal: "HORA" })),
  ).toBe("2026-11-07");
  expect(diaDoGrupo(g("b", "2026-11-08", { precisaoTemporal: "DIA" }))).toBe(
    "2026-11-08",
  );
  expect(diaDoGrupo(g("c", null))).toBeNull();
});
it("execuções coletivas e individuais são lidas sem incluir participação cancelada", async () => {
  m.protocolo.mockImplementation(async (path: string) => ({
    itens: path.startsWith("/programacoes")
      ? [p("grupo")]
      : [
          p("individual", "INDIVIDUAL"),
          { ...p("cancelada", "INDIVIDUAL"), status: "CANCELADA" },
        ],
    total: path.startsWith("/programacoes") ? 1 : 2,
    pagina: 1,
    porPagina: 10,
  }));
  expect((await consultarExecucoesVisaoGeral(7)).map((p) => p.id)).toEqual([
    "grupo",
    "individual",
  ]);
  expect(
    m.protocolo.mock.calls.every(
      ([path, sitio]) => path.includes("tipo=REPRODUTIVO") && sitio === 7,
    ),
  ).toBe(true);
});
it("cuidado só é identificado pela identidade explícita, sem coincidência de data", () => {
  const grupo = g("a", "2026-11-07", {
    contexto: { demandasPorAnimal: { animal: "demanda" } },
  });
  expect(demandaDoGrupo(grupo, "animal")).toBe("demanda");
  expect(demandaDoGrupo(grupo, "outro")).toBeNull();
});
