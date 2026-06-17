import { describe, it, expect } from "vitest";
import { reconstruirLactacoes, recomputarResumoReproducao } from "./reproducao.recompute.js";

const HOJE = "2026-06-16";
const ev = (tipo: any, data: string, extra: any = {}) => ({ tipo, data, ...extra });

describe("reconstruirLactacoes", () => {
  it("parto abre, secagem fecha, numero parte de numPartosEntrada", () => {
    const ls = reconstruirLactacoes([ev("PARTO", "2026-01-22"), ev("SECAGEM", "2025-12-18")], 2);
    // só o parto de 2026-01-22 abre lactação; a secagem é anterior e não fecha nada (lact da 2ª não está nos eventos)
    expect(ls).toHaveLength(1);
    expect(ls[0]).toMatchObject({ numero: 3, dtInicio: "2026-01-22", dtFim: null });
  });
  it("parto seguido de secagem fecha a lactação", () => {
    const ls = reconstruirLactacoes([ev("PARTO", "2024-01-10"), ev("SECAGEM", "2024-11-10"), ev("PARTO", "2025-02-01")], 0);
    expect(ls.map((l) => [l.numero, l.dtFim])).toEqual([[1, "2024-11-10"], [2, null]]);
  });
});

describe("recomputarResumoReproducao", () => {
  it("prenhe: status, DEL, ordem, gestação, prev. secagem, IEP", () => {
    const eventos = [ev("PARTO", "2026-01-22"), ev("INSEMINACAO", "2026-04-28", { reprodutor: "Lance 884" }), ev("DIAGNOSTICO", "2026-05-28", { resultado: "positivo", dtPartoPrevista: "2027-02-22" })];
    const lacts = reconstruirLactacoes(eventos, 2);
    const r = recomputarResumoReproducao(eventos, lacts, 2, HOJE);
    expect(r.statusReprodutivo).toBe("PRENHE");
    expect(r.ordemLactacao).toBe(3);
    expect(r.del).toBe(145);                          // 2026-01-22 → 2026-06-16
    expect(r.ultimoDgResultado).toBe("positivo");
    expect(r.diasGestacao).toBe(49);                  // IA 2026-04-28 → hoje
    expect(r.previsaoSecagem).toBe("2026-12-24");     // 2027-02-22 − 60d
    expect(r.iepProjetado).toBe(396);                 // 2026-01-22 → 2027-02-22
  });
  it("vazia pós-PEV: DG negativo deixa VAZIA", () => {
    const eventos = [ev("PARTO", "2026-02-01"), ev("INSEMINACAO", "2026-04-20"), ev("DIAGNOSTICO", "2026-05-14", { resultado: "negativo" })];
    const r = recomputarResumoReproducao(eventos, reconstruirLactacoes(eventos, 2), 2, HOJE);
    expect(r.statusReprodutivo).toBe("VAZIA");
    expect(r.del).toBe(135);
    expect(r.diasGestacao).toBeNull();
  });
  it("recém-parida dentro do PEV", () => {
    const eventos = [ev("PARTO", "2026-05-20")];
    const r = recomputarResumoReproducao(eventos, reconstruirLactacoes(eventos, 1), 1, HOJE);
    expect(r.statusReprodutivo).toBe("PEV");          // DEL 27 < 60
  });
  it("inseminada aguardando DG", () => {
    const eventos = [ev("PARTO", "2026-01-10"), ev("INSEMINACAO", "2026-06-01")];
    const r = recomputarResumoReproducao(eventos, reconstruirLactacoes(eventos, 1), 1, HOJE);
    expect(r.statusReprodutivo).toBe("INSEMINADA");
    expect(r.ultimaInseminacao).toBe("2026-06-01");
  });
  it("novilha sem eventos: VAZIA, DEL null", () => {
    const r = recomputarResumoReproducao([], [], 0, HOJE);
    expect(r.statusReprodutivo).toBe("VAZIA");
    expect(r.del).toBeNull();
    expect(r.ordemLactacao).toBeNull();
  });
});
