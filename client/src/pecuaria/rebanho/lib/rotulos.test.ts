import { describe, expect, it } from "vitest";
import { formatarDataBR, formatarIdade, motivoAceito, rotuloAptidao, rotuloClasseMotivo, rotuloOpcaoCategoria, rotuloPapelReprodutivo, rotuloSexo, rotuloSituacao, rotuloTipoBaixa } from "./rotulos";

describe("rotulos", () => {
  it("traduz aptidão, papel reprodutivo, situação e tipo de baixa", () => {
    expect(rotuloAptidao("LEITE")).toBe("Leite");
    expect(rotuloAptidao(null)).toBe("—");
    expect(rotuloPapelReprodutivo("RECEPTORA")).toBe("Receptora");
    expect(rotuloPapelReprodutivo("NENHUM")).toBe("—");
    expect(rotuloPapelReprodutivo(null)).toBe("—");
    expect(rotuloSituacao("ATIVO")).toBe("Ativo");
    expect(rotuloSituacao("BAIXADO")).toBe("Baixado");
    expect(rotuloTipoBaixa("VENDA")).toBe("Venda");
    expect(rotuloTipoBaixa("DESCONHECIDO")).toBe("DESCONHECIDO");
    expect(rotuloClasseMotivo("DESCARTE_VOLUNTARIO")).toBe("Descarte voluntário");
    expect(rotuloClasseMotivo("DESCARTE_INVOLUNTARIO")).toBe("Descarte involuntário");
    expect(rotuloClasseMotivo("MORTE")).toBe("Morte");
  });

  it("motivoAceito segue CLASSES_POR_TIPO: descarte para venda/abate/doação, morte só para morte, nenhum para extravio/cadastro indevido", () => {
    expect(motivoAceito("VENDA", "DESCARTE_VOLUNTARIO")).toBe(true);
    expect(motivoAceito("VENDA", "DESCARTE_INVOLUNTARIO")).toBe(true);
    expect(motivoAceito("VENDA", "MORTE")).toBe(false);
    expect(motivoAceito("ABATE", "DESCARTE_VOLUNTARIO")).toBe(true);
    expect(motivoAceito("DOACAO", "DESCARTE_INVOLUNTARIO")).toBe(true);
    expect(motivoAceito("MORTE", "MORTE")).toBe(true);
    expect(motivoAceito("MORTE", "DESCARTE_VOLUNTARIO")).toBe(false);
    expect(motivoAceito("EXTRAVIO", "DESCARTE_VOLUNTARIO")).toBe(false);
    expect(motivoAceito("CADASTRO_INDEVIDO", "MORTE")).toBe(false);
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
