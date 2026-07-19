import { describe, expect, it } from "vitest";
import type { AnimalDashboardIn, EventoConcepcaoDashboardIn, CarenciaWorklistIn, VacinaWorklistIn } from "./dashboard.types.js";
import { construirWorklists, ESPERA_DG_DIAS } from "./regras-manejo.js";

const parametros = { pevDias: 60, gestacaoDias: 283, secagemAntec: 60, ccsAlto: 400 };
const animal = (id: number, status: "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE", extra: Record<string, unknown> = {}): AnimalDashboardIn => ({
  id, numero: String(id), nome: `Animal ${id}`, categoria: "VACA", sexo: "F", grupoId: 1, grupoNome: "Alta", setor: "Leite",
  resumo: { statusReprodutivo: status, del: null, producaoMediaDia: null, producaoTendencia: null, ccs: null, ccsTendencia: null, iepProjetado: null, diasGestacao: null, previsaoSecagem: null, ultimoDgData: null, ...extra },
});
const evento = (animalId: number, tipo: string, data: string): EventoConcepcaoDashboardIn => ({ animalId, tipo, data, resultado: null });
const listas = (animais: AnimalDashboardIn[], eventos: EventoConcepcaoDashboardIn[] = [], carencias: CarenciaWorklistIn[] = []) => construirWorklists(animais, eventos, "2026-06-30", parametros, carencias);
const ids = (chave: string, animais: AnimalDashboardIn[], eventos: EventoConcepcaoDashboardIn[] = []) => listas(animais, eventos).find((x) => x.chave === chave)!.itens.map((x) => x.animalId);

describe("worklists canônicas de manejo", () => {
  it("aplica limites exatos de secagem, PEV, CCS e parto", () => {
    const animais = [
      animal(1, "PRENHE", { previsaoSecagem: "2026-06-29" }),
      animal(2, "PRENHE", { previsaoSecagem: "2026-06-30" }),
      animal(3, "VAZIA", { del: 60 }), animal(4, "VAZIA", { del: 61 }),
      animal(5, "VAZIA", { ccs: 399 }), animal(6, "VAZIA", { ccs: 400 }),
      animal(7, "PRENHE", { diasGestacao: 252 }), animal(8, "PRENHE", { diasGestacao: 253 }),
    ];
    expect(ids("secagem-atrasada", animais)).toEqual([1]);
    expect(ids("vazia-pos-pev", animais)).toEqual([4]);
    expect(ids("ccs-alta", animais)).toEqual([6]);
    expect(ids("parto-proximo", animais)).toEqual([8]);
  });

  it("usa a cobertura IA/TE mais recente, espera 28 dias e exige ausência de DG posterior", () => {
    expect(ESPERA_DG_DIAS).toBe(28);
    const animais = [animal(1, "INSEMINADA"), animal(2, "INSEMINADA"), animal(3, "INSEMINADA"), animal(4, "INSEMINADA")];
    const eventos = [
      evento(1, "INSEMINACAO", "2026-06-03"),
      evento(2, "INSEMINACAO", "2026-06-02"),
      evento(3, "INSEMINACAO", "2026-05-01"), evento(3, "DIAGNOSTICO", "2026-05-20"),
      evento(4, "INSEMINACAO", "2026-04-01"), evento(4, "DIAGNOSTICO", "2026-04-20"), evento(4, "TRANSFERENCIA_EMBRIAO", "2026-05-20"),
    ];
    expect(ids("dg-pendente", animais, eventos)).toEqual([4, 2]);
  });

  it("ordena deterministicamente por urgência e deriva quantidade dos itens", () => {
    const animais = [
      animal(10, "PRENHE", { previsaoSecagem: "2026-06-20", ccs: 500, diasGestacao: 260 }),
      animal(2, "PRENHE", { previsaoSecagem: "2026-06-10", ccs: 700, diasGestacao: 270 }),
      animal(1, "VAZIA", { del: 80 }), animal(3, "VAZIA", { del: 90 }),
    ];
    const worklists = listas(animais);
    expect(worklists.find((x) => x.chave === "secagem-atrasada")!.itens.map((x) => x.animalId)).toEqual([2, 10]);
    expect(worklists.find((x) => x.chave === "vazia-pos-pev")!.itens.map((x) => x.animalId)).toEqual([3, 1]);
    expect(worklists.find((x) => x.chave === "ccs-alta")!.itens.map((x) => x.animalId)).toEqual([2, 10]);
    expect(worklists.find((x) => x.chave === "parto-proximo")!.itens.map((x) => x.animalId)).toEqual([2, 10]);
    for (const worklist of worklists) expect(worklist.quantidade).toBe(worklist.itens.length);
    expect(worklists.map((x) => [x.chave, x.acao?.tipo ?? null])).toEqual([
      ["secagem-atrasada", "SECAGEM"], ["vazia-pos-pev", "INSEMINACAO"], ["ccs-alta", "EXAME"], ["dg-pendente", "DIAGNOSTICO"], ["parto-proximo", "PARTO"], ["carencia", null], ["producao-caindo", null], ["vacina-pendente", null],
    ]);
  });
});

describe("worklist de carência de leite", () => {
  const emLact = (id: number) => animal(id, "VAZIA", { del: 100 });

  it("gera um item por vaca com carência ativa, sem ação (só visualização)", () => {
    const animais = [emLact(1), emLact(2)];
    const carencias: CarenciaWorklistIn[] = [
      { animalId: 1, produto: "Oxitetraciclina", fim: "2026-07-01T12:00:00.000Z", horasRestantes: 12, diasRestantes: 1 },
    ];
    const wl = listas(animais, [], carencias).find((x) => x.chave === "carencia")!;
    expect(wl.tab).toBe("sanidade");
    expect(wl.acao).toBeUndefined();
    expect(wl.quantidade).toBe(1);
    expect(wl.itens.map((i) => i.animalId)).toEqual([1]);
    const item = wl.itens[0];
    expect(item.dataReferencia).toBe("2026-07-01T12:00:00.000Z");
    expect(item.valor).toBe(12); // < 24h → mostra horas
    expect(item.unidade).toBe("h restantes");
    expect(item.motivo).toContain("Oxitetraciclina");
  });

  it("ordena da carência que termina mais tarde para a mais cedo (mais restritiva primeiro)", () => {
    const animais = [emLact(1), emLact(2), emLact(3)];
    const carencias: CarenciaWorklistIn[] = [
      { animalId: 1, produto: "A", fim: "2026-07-02T00:00:00.000Z", horasRestantes: 24, diasRestantes: 1 },
      { animalId: 2, produto: "B", fim: "2026-07-05T00:00:00.000Z", horasRestantes: 96, diasRestantes: 4 },
      { animalId: 3, produto: "C", fim: "2026-07-03T00:00:00.000Z", horasRestantes: 48, diasRestantes: 2 },
    ];
    expect(ids("carencia", animais, []).length).toBe(0); // sem carências → vazio
    const wl = listas(animais, [], carencias).find((x) => x.chave === "carencia")!;
    expect(wl.itens.map((i) => i.animalId)).toEqual([2, 3, 1]);
  });

  it("mostra dias quando faltam ≥24h", () => {
    const animais = [emLact(1)];
    const carencias: CarenciaWorklistIn[] = [{ animalId: 1, produto: null, fim: "2026-07-04T00:00:00.000Z", horasRestantes: 72, diasRestantes: 3 }];
    const wl = listas(animais, [], carencias).find((x) => x.chave === "carencia")!;
    expect(wl.itens[0].valor).toBe(3);
    expect(wl.itens[0].unidade).toBe("dias restantes");
    expect(wl.itens[0].motivo).toContain("medicamento"); // sem produto → texto genérico
  });

  it("ignora carência de animal fora da lista de animais do dashboard", () => {
    const carencias: CarenciaWorklistIn[] = [{ animalId: 99, produto: "X", fim: "2026-07-02T00:00:00.000Z", horasRestantes: 10, diasRestantes: 1 }];
    const wl = listas([emLact(1)], [], carencias).find((x) => x.chave === "carencia")!;
    expect(wl.quantidade).toBe(0);
  });
});

describe("worklist producao-caindo", () => {
  // Só vacas em lactação (del != null) com tendência de produção "descendo" (materialidade já
  // aplicada no recompute). Worklist de visualização — sem ação de registrar evento.
  const emLact = (id: number, del: number, tendencia: string | null, media: number | null = 20) =>
    animal(id, "PEV", { del, producaoTendencia: tendencia, producaoMediaDia: media });
  const wl = (animais: AnimalDashboardIn[]) => listas(animais).find((x) => x.chave === "producao-caindo")!;

  it("lista só as vacas em lactação com tendência 'descendo'", () => {
    const animais = [
      emLact(1, 120, "descendo", 18),
      emLact(2, 80, "subindo", 30),
      emLact(3, 200, "estavel", 22),
      emLact(4, 150, "descendo", 15),
    ];
    expect(wl(animais).itens.map((i) => i.animalId).sort()).toEqual([1, 4]);
  });

  it("ignora animal sem lactação (del null) mesmo marcado 'descendo'", () => {
    const seca = animal(9, "PEV", { del: null, producaoTendencia: "descendo", producaoMediaDia: 0 });
    expect(wl([seca]).quantidade).toBe(0);
  });

  it("é worklist de visualização (sem ação) e aponta para a aba de produção", () => {
    const w = wl([emLact(1, 120, "descendo")]);
    expect(w.acao).toBeUndefined();
    expect(w.tab).toBe("producao");
    expect(w.itens[0].valor).toBe(20); // leva a produção média do dia como valor
    expect(w.itens[0].unidade).toBe("L/dia");
  });

  it("ordena da maior para a menor produção (quem ainda produz mais, mais urgente investigar)", () => {
    const animais = [emLact(1, 120, "descendo", 12), emLact(2, 120, "descendo", 28), emLact(3, 120, "descendo", 20)];
    expect(wl(animais).itens.map((i) => i.animalId)).toEqual([2, 3, 1]);
  });
});

describe("worklist vacina-pendente", () => {
  const listasV = (animais: AnimalDashboardIn[], vacinas: VacinaWorklistIn[]) =>
    construirWorklists(animais, [], "2026-06-30", parametros, [], vacinas);
  const wl = (animais: AnimalDashboardIn[], vacinas: VacinaWorklistIn[]) => listasV(animais, vacinas).find((x) => x.chave === "vacina-pendente")!;
  const vac = (animalId: number, vacinaId: number, status: "vencida" | "proxima", dataPrevista: string, diasParaData: number): VacinaWorklistIn =>
    ({ animalId, vacinaId, vacina: "Aftosa", status, dataPrevista, diasParaData });

  it("lista as vacinas pendentes (vencidas antes de próximas)", () => {
    const animais = [animal(1, "PEV"), animal(2, "PEV")];
    const vacinas = [
      vac(1, 10, "proxima", "2026-07-05", 5),
      vac(2, 20, "vencida", "2026-06-20", -10),
    ];
    const w = wl(animais, vacinas);
    expect(w.quantidade).toBe(2);
    expect(w.itens.map((i) => i.animalId)).toEqual([2, 1]); // vencida (animal 2) antes de próxima (animal 1)
  });

  it("dentro do mesmo status, ordena pela data prevista (mais antiga primeiro)", () => {
    const animais = [animal(1, "PEV"), animal(2, "PEV")];
    const vacinas = [vac(1, 10, "vencida", "2026-06-25", -5), vac(2, 20, "vencida", "2026-06-10", -20)];
    expect(wl(animais, vacinas).itens.map((i) => i.animalId)).toEqual([2, 1]);
  });

  it("ignora vacina de animal fora do dashboard", () => {
    const vacinas = [vac(99, 10, "vencida", "2026-06-20", -10)];
    expect(wl([animal(1, "PEV")], vacinas).quantidade).toBe(0);
  });

  it("é worklist de visualização (sem ação de registrar evento), aba sanidade", () => {
    const w = wl([animal(1, "PEV")], [vac(1, 10, "vencida", "2026-06-20", -10)]);
    expect(w.acao).toBeUndefined();
    expect(w.tab).toBe("sanidade");
    expect(w.itens[0].motivo).toContain("vencida");
  });

  it("sem vacinas pendentes → worklist vazia", () => {
    expect(wl([animal(1, "PEV")], []).quantidade).toBe(0);
  });
});
