import { describe, expect, it } from "vitest";
import { criteriosParaQuery, type FiltroSalvo } from "./filtro.calc.js";

const base: FiltroSalvo = { status: "ATIVO", grupoId: null, setor: null, categoria: null, busca: null };

describe("criteriosParaQuery", () => {
  it("só status quando o resto é vazio", () => {
    expect(criteriosParaQuery(base)).toEqual({ status: "ATIVO" });
  });
  it("inclui os campos preenchidos", () => {
    expect(criteriosParaQuery({ status: "TODOS", grupoId: 3, setor: "Curral A", categoria: "VACA", busca: "12" }))
      .toEqual({ status: "TODOS", grupoId: 3, setor: "Curral A", categoria: "VACA", q: "12" });
  });
  it("ignora strings vazias/whitespace", () => {
    expect(criteriosParaQuery({ ...base, setor: "  ", busca: "" })).toEqual({ status: "ATIVO" });
  });
  it("status inválido cai para ATIVO", () => {
    expect(criteriosParaQuery({ ...base, status: "XPTO" }).status).toBe("ATIVO");
  });
  it("faz trim dos textos", () => {
    expect(criteriosParaQuery({ ...base, setor: " Curral B ", busca: " 45 " })).toEqual({ status: "ATIVO", setor: "Curral B", q: "45" });
  });
});
