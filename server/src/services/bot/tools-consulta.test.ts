import { describe, it, expect } from "vitest";
import { toolsConsulta } from "./tools-consulta.js";
import { formatarAnimalAlerta } from "./tools.js";

describe("toolsConsulta", () => {
  const porNome = new Map(toolsConsulta.map((t) => [t.spec.function.name, t]));

  it("gera uma tool por domínio instrumentado", () => {
    expect([...porNome.keys()].sort()).toEqual(["consulta_financeiro", "consulta_rebanho"]);
  });

  it("a description documenta o mapa entidade→campos e a proibição de calcular", () => {
    const fin = porNome.get("consulta_financeiro")!;
    expect(fin.spec.function.description).toContain("ENTIDADE 'transacao'");
    expect(fin.spec.function.description).toContain("NUNCA calcule");
    expect(fin.spec.function.description).toContain("ENTIDADE 'compromisso'");
  });

  it("o JSON Schema tem os enums do registro", () => {
    const reb = porNome.get("consulta_rebanho")!;
    const props = (reb.spec.function.parameters as { properties: Record<string, { enum?: string[] }> })
      .properties;
    expect(props.entidade.enum!.sort()).toEqual(["animal", "producao_lote"]);
    expect(props.razao).toBeUndefined();
  });

  it("alertas identificam o animal pelo número antes do nome", () => {
    expect(formatarAnimalAlerta({ numero: "0042", nome: "Jurema" })).toBe("#0042 Jurema");
    expect(formatarAnimalAlerta({ numero: "0042", nome: null })).toBe("#0042");
  });
});
