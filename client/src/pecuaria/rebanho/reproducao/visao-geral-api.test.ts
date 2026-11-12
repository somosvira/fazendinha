import { beforeEach, expect, it, vi } from "vitest";
import {
  consultarAgendaVisaoGeral,
  consultarEtapasDoDia,
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

it("Hoje lê todas as páginas de etapas completas no sítio, incluindo etapa totalmente atendida", async () => {
  const itens = Array.from({ length: 11 }, (_, i) => ({
    contextoId: `grupo-${i}`,
    modo: "COLETIVO",
    nome: "Programação",
    modelo: "Modelo",
    etapaId: "etapa",
    etapa: "D0",
    totalAnimais: 6,
    atendidos: i === 10 ? 6 : 4,
    pendentes: i === 10 ? 0 : 2,
    encerrados: 0,
  }));
  m.protocolo.mockImplementation(async (path: string, sitio: number) => {
    expect(path).toContain("/etapas-do-dia?data=2026-11-07");
    expect(sitio).toBe(7);
    const pagina = Number(
      new URLSearchParams(path.split("?")[1]).get("pagina"),
    );
    return {
      itens: itens.slice((pagina - 1) * 10, pagina * 10),
      total: 11,
      pagina,
      porPagina: 10,
    };
  });
  const dados = await consultarEtapasDoDia(7, "2026-11-07");
  expect(dados).toHaveLength(11);
  expect(dados.at(-1)).toMatchObject({
    totalAnimais: 6,
    atendidos: 6,
    pendentes: 0,
  });
  expect(m.protocolo).toHaveBeenCalledTimes(2);
});

import { organizarHoje } from "./visao-geral-api";
it("Hoje une cobertura parcial e conserva revisão de tarefa fora da data planejada", () => {
 const etapa = {contextoId:"p",modo:"COLETIVO" as const,nome:"P",modelo:"M",etapaId:"e",etapa:"DG",totalAnimais:2,atendidos:1,pendentes:1,encerrados:0,tarefasIds:["atendida","original"],animaisIds:["animal-atendido","animal-original"],animaisPendentesIds:["animal-original"]};
 const grupo = g("p", "2026-11-07", {etapa:{id:"e",nome:"DG",ordem:1},totalAnimais:2,contexto:{programacaoId:"p",tarefasIds:["original","suspensa"],animaisPorTarefa:{original:"animal-original",suspensa:"animal-suspenso"}}});
 const r = organizarHoje([etapa], [grupo], "2026-11-07");
 expect(r.grupos).toEqual([]);
 expect(r.etapas).toEqual([expect.objectContaining({totalAnimais:3,atendidos:1,pendentes:2})]);
 expect(etapa.totalAnimais).toBe(2);
 const semEtapa = organizarHoje([], [grupo], "2026-11-07");
 expect(semEtapa.grupos).toEqual([grupo]);
});

it("Hoje conta uma vez o animal reintegrado, preservando sua pendência atual", () => {
 const etapa = {contextoId:"p",modo:"COLETIVO" as const,nome:"P",modelo:"M",etapaId:"e",etapa:"DG",totalAnimais:1,atendidos:0,pendentes:0,encerrados:1,tarefasIds:["cancelada"],animaisIds:["animal"],animaisPendentesIds:[]};
 const grupo = g("p", "2026-11-07", {etapa:{id:"e",nome:"DG",ordem:1},totalAnimais:1,contexto:{programacaoId:"p",tarefasIds:["reintegrada"],animaisPorTarefa:{reintegrada:"animal"}}});
 const r = organizarHoje([etapa],[grupo],"2026-11-07");
 expect(r.grupos).toEqual([]);
 expect(r.etapas[0]).toMatchObject({totalAnimais:1,pendentes:1,encerrados:1});
 const repetida = organizarHoje(r.etapas,[grupo],"2026-11-07");
 expect(repetida.etapas[0]).toMatchObject({totalAnimais:1,pendentes:1});
 expect(etapa.pendentes).toBe(0);
});
