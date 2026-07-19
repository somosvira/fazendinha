import { describe, expect, it } from "vitest";
import { agregarDashboard, type DashboardRebanhoInput, type PeriodoDashboard } from "./dashboard.agg.js";

const resumo = (statusReprodutivo: "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE", extra: Record<string, unknown> = {}) => ({
  statusReprodutivo, del: null, producaoMediaDia: null, producaoTendencia: null, ccs: null, ccsTendencia: null, iepProjetado: null,
  diasGestacao: null, previsaoSecagem: null, ultimoDgData: null, ...extra,
});

function base(periodo: PeriodoDashboard = "7d"): DashboardRebanhoInput {
  return {
    hoje: "2026-06-16", geradoEm: "2026-06-16T12:00:00.000Z", periodo,
    modoProducao: "ORDENHA", escopoPropriedadeId: 1, carencias: [], vacinasPendentes: [],
    animais: [
      { id: 1, numero: "1", nome: "A", setor: "Leite", categoria: "VACA", sexo: "F", grupoId: 10, grupoNome: "Alta", resumo: resumo("PRENHE", { del: 145, ccs: 512, iepProjetado: 396, diasGestacao: 260, previsaoSecagem: "2026-06-01" }) },
      { id: 2, numero: "2", nome: "B", setor: null, categoria: "VACA", sexo: "F", grupoId: 10, grupoNome: "Alta", resumo: resumo("VAZIA", { del: 80, ccs: 300 }) },
      { id: 3, numero: "3", nome: null, setor: null, categoria: "VACA", sexo: "F", grupoId: null, grupoNome: null, resumo: resumo("INSEMINADA") },
      { id: 4, numero: "4", nome: null, setor: null, categoria: "BEZERRA", sexo: "F", grupoId: null, grupoNome: null, resumo: null },
    ],
    lactacoes: [
      { animalId: 1, dtInicio: "2026-01-01", dtFim: null },
      { animalId: 2, dtInicio: "2026-06-01", dtFim: "2026-06-14" },
      { animalId: 3, dtInicio: "2026-06-15", dtFim: null },
    ],
    controles: [
      { id: 1, animalId: 1, data: "2026-06-15", pesoTotal: 20, atualizadoEm: "2026-06-15T10:00:00Z" },
      { id: 2, animalId: 1, data: "2026-06-15", pesoTotal: 24, atualizadoEm: "2026-06-15T12:00:00Z" },
      { id: 3, animalId: 3, data: "2026-06-15", pesoTotal: 16, atualizadoEm: "2026-06-15T10:00:00Z" },
      { id: 4, animalId: 1, data: "2026-06-16", pesoTotal: 30, atualizadoEm: "2026-06-16T10:00:00Z" },
    ],
    producoesLote: [], eventosConcepcao: [],
    parametros: { pevDias: 60, gestacaoDias: 283, secagemAntec: 60, ccsAlto: 400 },
  };
}

const hero = (d: ReturnType<typeof agregarDashboard>, chave: string) => d.herois.find((x) => x.chave === chave)!;

 describe("agregarDashboard", () => {
  it.each([
    ["hoje", "2026-06-16", "2026-06-15"],
    ["7d", "2026-06-10", "2026-06-03"],
    ["30d", "2026-05-18", "2026-04-18"],
  ] as const)("define a janela %s e sua comparação anterior", (periodo, inicio, comparacaoInicio) => {
    const d = agregarDashboard(base(periodo));
    expect(d.meta).toMatchObject({ periodo, inicio, fim: "2026-06-16", comparacaoInicio });
    expect(hero(d, "producaoTotalDia").serie).toHaveLength(periodo === "hoje" ? 7 : periodo === "7d" ? 7 : 30);
  });

  it("deduplica animal/dia pelo registro mais recente e preserva dias sem observação", () => {
    const d = agregarDashboard(base());
    expect(hero(d, "producaoTotalDia").valor).toBe(35); // (24+16 + 30) / 2 dias
    expect(hero(d, "mediaVacaDia").valor).toBe(25); // (40/2 + 30/1) / 2 dias
    expect(hero(d, "producaoTotalDia").serie.filter((x) => x.valor == null)).toHaveLength(5);
    expect(d.meta.cobertura).toMatchObject({ diasEsperados: 7, diasComProducao: 2, percentual: 28.6 });
  });

  it("usa snapshots de lactação e denominador reprodutivo elegível", () => {
    const d = agregarDashboard(base());
    expect(hero(d, "vacasLactacao").valor).toBe(2); // snapshots variam no período
    expect(d.estadosReprodutivos.find((x) => x.estado === "PRENHE")).toMatchObject({ quantidade: 1, percentual: 33.3 });
    expect(d.indicadores.find((g) => g.grupo === "reproducao")?.itens.find((x) => x.chave === "prenhez")?.valor).toBe(33.3);
  });

  it("aplica parâmetros customizados nos alertas e ordena grupos por quantidade", () => {
    const input = base();
    input.parametros = { ...input.parametros, pevDias: 70, ccsAlto: 500 };
    const d = agregarDashboard(input);
    expect(d.alertas.find((x) => x.chave === "vazia-pos-pev")?.quantidade).toBe(1);
    expect(d.alertas.find((x) => x.chave === "ccs-alta")?.quantidade).toBe(1);
    expect(d.alertas.find((x) => x.chave === "parto-proximo")?.quantidade).toBe(1);
    expect(d.grupos.map((g) => [g.nome, g.quantidade])).toEqual([["Alta", 2], ["Sem grupo", 2]]);
    for (const alerta of d.alertas) expect(alerta.quantidade).toBe(alerta.itens.length);
    expect(d.alertas.find((x) => x.chave === "ccs-alta")?.acao?.tipo).toBe("EXAME");
  });

  it("no tanque consolidado prefere tanque global à soma dos grupos", () => {
    const input = base();
    input.modoProducao = "TANQUE_LOTE";
    input.escopoPropriedadeId = null;
    input.producoesLote = [
      { id: 1, grupoId: null, data: "2026-06-16", litros: 100, atualizadoEm: "2026-06-16T10:00:00Z" },
      { id: 2, grupoId: 10, data: "2026-06-16", litros: 60, atualizadoEm: "2026-06-16T10:00:00Z" },
    ];
    expect(hero(agregarDashboard(input), "producaoTotalDia").valor).toBe(100);
  });

  it("no escopo individual ignora tanque global e sinaliza cobertura parcial", () => {
    const input = base();
    input.modoProducao = "TANQUE_LOTE";
    input.producoesLote = [
      { id: 1, grupoId: null, data: "2026-06-16", litros: 100, atualizadoEm: "2026-06-16T10:00:00Z" },
      { id: 2, grupoId: 10, data: "2026-06-16", litros: 60, atualizadoEm: "2026-06-16T10:00:00Z" },
    ];
    const d = agregarDashboard(input);
    expect(hero(d, "producaoTotalDia").valor).toBe(60);
    expect(d.meta.cobertura.producaoParcial).toBe(true);
    expect(d.meta.cobertura.motivo).toContain("Tanque global");
  });

  it("retorna estrutura vazia sem inventar produção", () => {
    const input = base();
    input.animais = []; input.lactacoes = []; input.controles = [];
    const d = agregarDashboard(input);
    expect(d.totais).toEqual({ rebanhoAtivo: 0, vacasAtivas: 0 });
    expect(hero(d, "vacasLactacao").valor).toBeNull();
    expect(hero(d, "producaoTotalDia").valor).toBeNull();
    expect(hero(d, "mediaVacaDia").indisponivelMotivo).toBeTruthy();
    expect(d.grupos).toEqual([]);
  });
});
