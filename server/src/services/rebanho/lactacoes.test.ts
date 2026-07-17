import { describe, it, expect } from "vitest";
import { toTimelineLactacaoInicio, toTimelineLactacaoSecagem } from "./producao.mappers.js";

const base = { id: 7, animalId: 42, numero: 2, dtInicio: new Date("2023-08-29T00:00:00Z"), dtFim: new Date("2024-12-13T00:00:00Z"), motivoSecagem: "Rotina" };

describe("mappers de lactação → timeline", () => {
  it("início de lactação vira evento de produção", () => {
    const e = toTimelineLactacaoInicio(base as any);
    expect(e.dominio).toBe("producao");
    expect(e.data).toBe("2023-08-29");
    expect(e.titulo).toContain("Início da 2ª lactação");
  });
  it("secagem só quando há dtFim, com o motivo", () => {
    const e = toTimelineLactacaoSecagem(base as any);
    expect(e).not.toBeNull();
    expect(e!.data).toBe("2024-12-13");
    expect(e!.titulo).toBe("Secagem");
    expect(e!.detalhe).toBe("Rotina");
  });
  it("secagem é null para lactação aberta", () => {
    expect(toTimelineLactacaoSecagem({ ...base, dtFim: null } as any)).toBeNull();
  });
});
