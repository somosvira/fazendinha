import { describe, expect, it } from "vitest";
import { resumoIndices, type ReprodutorIndices } from "./reprodutor.calc.js";

const r = (id: number, ptaLeite: number | null, tpi: number | null = null, ptaGordura: number | null = null, ptaProteina: number | null = null): ReprodutorIndices =>
  ({ id, ptaLeite, ptaGordura, ptaProteina, tpi });

describe("resumoIndices", () => {
  it("vazio → total 0, médias null, melhores null", () => {
    const s = resumoIndices([]);
    expect(s.total).toBe(0);
    expect(s.mediaPtaLeite).toBeNull();
    expect(s.melhorLeiteId).toBeNull();
    expect(s.melhorTpiId).toBeNull();
  });

  it("médias ignoram nulos", () => {
    const s = resumoIndices([r(1, 800, 2500), r(2, 1000, null), r(3, null, 2700)]);
    expect(s.mediaPtaLeite).toBe(900); // (800+1000)/2
    expect(s.mediaTpi).toBe(2600); // (2500+2700)/2
  });

  it("melhor por leite e por TPI", () => {
    const s = resumoIndices([r(1, 800, 2500), r(2, 1200, 2400), r(3, 900, 2900)]);
    expect(s.melhorLeiteId).toBe(2); // maior ptaLeite
    expect(s.melhorTpiId).toBe(3); // maior tpi
  });

  it("conta o total", () => {
    expect(resumoIndices([r(1, 800), r(2, 900)]).total).toBe(2);
  });
});
