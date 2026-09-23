import { describe, expect, it } from "vitest";
import { formatarDataBR, formatarIdade, rotuloAptidao, rotuloCategoria, rotuloPapelReprodutivo, rotuloSituacao, rotuloTipoSaida } from "./rotulos";

describe("rotulos", () => {
  it("traduz categoria, aptidão, papel reprodutivo, situação e tipo de saída", () => {
    expect(rotuloCategoria("VACA")).toBe("Vaca");
    expect(rotuloCategoria("BEZERRO")).toBe("Bezerro");
    expect(rotuloAptidao("LEITE")).toBe("Leite");
    expect(rotuloAptidao(null)).toBe("—");
    expect(rotuloPapelReprodutivo("RECEPTORA")).toBe("Receptora");
    expect(rotuloPapelReprodutivo("NENHUM")).toBe("—");
    expect(rotuloPapelReprodutivo(null)).toBe("—");
    expect(rotuloSituacao("ATIVO")).toBe("Ativo");
    expect(rotuloTipoSaida("VENDA")).toBe("Venda");
    expect(rotuloTipoSaida("DESCONHECIDO")).toBe("DESCONHECIDO");
  });

  it("formata idade em anos e meses", () => {
    expect(formatarIdade(0)).toBe("0m");
    expect(formatarIdade(3)).toBe("3m");
    expect(formatarIdade(12)).toBe("1a");
    expect(formatarIdade(27)).toBe("2a 3m");
    expect(formatarIdade(-5)).toBe("0m");
  });

  it("formata data ISO em dd/mm/aaaa", () => {
    expect(formatarDataBR("2026-09-22")).toBe("22/09/2026");
    expect(formatarDataBR(null)).toBe("—");
    expect(formatarDataBR(undefined)).toBe("—");
  });
});
