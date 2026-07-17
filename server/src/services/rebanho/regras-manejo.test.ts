import { describe, expect, it } from "vitest";
import type { AnimalDashboardIn, EventoConcepcaoDashboardIn } from "./dashboard.types.js";
import { construirWorklists, ESPERA_DG_DIAS } from "./regras-manejo.js";

const parametros = { pevDias: 60, gestacaoDias: 283, secagemAntec: 60, ccsAlto: 400 };
const animal = (id: number, status: "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE", extra: Record<string, unknown> = {}): AnimalDashboardIn => ({
  id, numero: String(id), nome: `Animal ${id}`, categoria: "VACA", sexo: "F", grupoId: 1, grupoNome: "Alta", setor: "Leite",
  resumo: { statusReprodutivo: status, del: null, producaoMediaDia: null, ccs: null, ccsTendencia: null, iepProjetado: null, diasGestacao: null, previsaoSecagem: null, ultimoDgData: null, ...extra },
});
const evento = (animalId: number, tipo: string, data: string): EventoConcepcaoDashboardIn => ({ animalId, tipo, data, resultado: null });
const listas = (animais: AnimalDashboardIn[], eventos: EventoConcepcaoDashboardIn[] = []) => construirWorklists(animais, eventos, "2026-06-30", parametros);
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
    expect(worklists.map((x) => [x.chave, x.acao.tipo])).toEqual([
      ["secagem-atrasada", "SECAGEM"], ["vazia-pos-pev", "INSEMINACAO"], ["ccs-alta", "EXAME"], ["dg-pendente", "DIAGNOSTICO"], ["parto-proximo", "PARTO"],
    ]);
  });
});
