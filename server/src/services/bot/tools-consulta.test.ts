import { describe, it, expect } from "vitest";
import { toolsConsulta } from "./tools-consulta.js";
import { DOMINIOS } from "../consulta/registro/index.js";

describe("toolsConsulta", () => {
  const porNome = new Map(toolsConsulta.map((t) => [t.spec.function.name, t]));

  it("gera uma tool por domínio instrumentado", () => {
    expect([...porNome.keys()].sort()).toEqual(["consulta_financeiro"]);
  });

  it("a description documenta o mapa entidade→campos e a proibição de calcular", () => {
    const fin = porNome.get("consulta_financeiro")!;
    expect(fin.spec.function.description).toContain("ENTIDADE 'transacao'");
    expect(fin.spec.function.description).toContain("NUNCA calcule");
    expect(fin.spec.function.description).toContain("ENTIDADE 'compromisso'");
  });

  it("o JSON Schema tem os enums do registro", () => {
    const fin = porNome.get("consulta_financeiro")!;
    const props = (fin.spec.function.parameters as { properties: Record<string, { enum?: string[] }> }).properties;
    expect(props.entidade.enum!.sort()).toEqual(Object.keys(DOMINIOS.financeiro.entidades).sort());
    expect(props.entidade.enum).toEqual(expect.arrayContaining(["compromisso", "transacao"]));
  });
});
