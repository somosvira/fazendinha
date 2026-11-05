import { describe, expect, it } from "vitest";
import { situacaoDoLote } from "./situacaoFechamento";
import type { ResumoNutricional } from "./api";
import type { ConfiguracaoMensal } from "./mensal-api";

const resumo = { lote: { id: "crias", propriedadeId: 1 }, vigente: { desde: "2026-10-01", dieta: { id: "leite" } } } as unknown as ResumoNutricional;
const configs = [{ id: "c", propriedadeId: 1, loteId: null, modelo: "PROVISORIO", diaConferencia: 5, autorizaValidade: true, desde: "2026-10-29" }] as ConfiguracaoMensal[];

describe("situação de fechamento do lote", () => {
  it("depois da adoção, só fecha por período até a véspera e conta os dias a processar", () => {
    const s = situacaoDoLote(resumo, "2026-10-25", configs, "2026-11-05", "2026-11-01");
    expect(s).toMatchObject({ inicio: "2026-10-26", fim: "2026-10-28", dias: 3, adocao: "2026-10-29" });
    expect(s.diarios).toEqual({ processadoAte: "2026-11-01", inicio: "2026-11-02", fim: "2026-11-04", dias: 3 });
  });
  it("com leite produzido na fazenda, ignora o tipo diário ou mensal e fecha tudo por período", () => {
    const s = situacaoDoLote(resumo, "2026-10-25", configs, "2026-11-05", null, true);
    expect(s).toMatchObject({ inicio: "2026-10-26", fim: "2026-11-04", dias: 10 });
    expect(s.adocao).toBeUndefined();
    expect(s.diarios).toBeUndefined();
  });
});
