import { describe, expect, it } from "vitest";
import { formatarDataBR, formatarIdade, rotuloAptidao, rotuloOpcaoCategoria, rotuloPapelReprodutivo, rotuloSexo, rotuloSituacao, rotuloTipoSaida } from "./rotulos";

describe("rotulos", () => {
  it("traduz aptidão, papel reprodutivo, situação e tipo de saída", () => {
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

  it("traduz sexo", () => {
    expect(rotuloSexo("F")).toBe("Fêmea");
    expect(rotuloSexo("M")).toBe("Macho");
  });

  it("rotuloOpcaoCategoria desambigua nomes repetidos entre sexos", () => {
    const categorias = [
      { nome: "Em crescimento", sexo: "F" as const },
      { nome: "Em crescimento", sexo: "M" as const },
      { nome: "Vaca", sexo: "F" as const },
    ];
    expect(rotuloOpcaoCategoria(categorias, categorias[0])).toBe("Em crescimento (F)");
    expect(rotuloOpcaoCategoria(categorias, categorias[1])).toBe("Em crescimento (M)");
    expect(rotuloOpcaoCategoria(categorias, categorias[2])).toBe("Vaca");
  });
});
