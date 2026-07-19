import { describe, expect, it } from "vitest";
import type { AnimalDashboardIn, EventoConcepcaoDashboardIn, CarenciaWorklistIn } from "./dashboard.types.js";
import { construirWorklists, ESPERA_DG_DIAS } from "./regras-manejo.js";

const parametros = { pevDias: 60, gestacaoDias: 283, secagemAntec: 60, ccsAlto: 400 };
const animal = (id: number, status: "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE", extra: Record<string, unknown> = {}): AnimalDashboardIn => ({
  id, numero: String(id), nome: `Animal ${id}`, categoria: "VACA", sexo: "F", grupoId: 1, grupoNome: "Alta", setor: "Leite",
  resumo: { statusReprodutivo: status, del: null, producaoMediaDia: null, ccs: null, ccsTendencia: null, iepProjetado: null, diasGestacao: null, previsaoSecagem: null, ultimoDgData: null, ...extra },
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
      ["secagem-atrasada", "SECAGEM"], ["vazia-pos-pev", "INSEMINACAO"], ["ccs-alta", "EXAME"], ["dg-pendente", "DIAGNOSTICO"], ["parto-proximo", "PARTO"], ["carencia", null],
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
