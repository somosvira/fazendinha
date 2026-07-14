import { describe, it, expect } from "vitest";
import { toolsConsulta } from "./tools-consulta.js";

describe("toolsConsulta", () => {
  const porNome = new Map(toolsConsulta.map((t) => [t.spec.function.name, t]));

  it("gera uma tool por domínio instrumentado", () => {
    expect([...porNome.keys()].sort()).toEqual(["consulta_financeiro", "consulta_rebanho"]);
  });

  it("a description documenta o mapa entidade→campos e a proibição de calcular", () => {
    const fin = porNome.get("consulta_financeiro")!;
    expect(fin.spec.function.description).toContain("ENTIDADE 'lancamento'");
    expect(fin.spec.function.description).toContain("NUNCA calcule");
    expect(fin.spec.function.description).toContain("RAZÃO 'custoPorLitro'");
  });

  it("o JSON Schema tem os enums do registro", () => {
    const reb = porNome.get("consulta_rebanho")!;
    const props = (reb.spec.function.parameters as { properties: Record<string, { enum?: string[] }> })
      .properties;
    expect(props.entidade.enum!.sort()).toEqual(["animal", "producao_lote"]);
    expect(props.razao).toBeUndefined();
  });
});
