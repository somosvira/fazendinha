import { describe, it, expect } from "vitest";
import {
  criarSafraCultivoSchema,
  editarSafraCultivoSchema,
  listSafraCultivoFiltrosSchema,
  criarAreaCultivoSchema,
  criarLancamentoCustoSchema,
  listLancamentoCustoFiltrosSchema,
  criarProducaoCultivoSchema,
  criarSiloSchema,
  criarMovimentoSiloSchema,
  classeFiltro,
} from "./schemas.js";

describe("criarSafraCultivoSchema", () => {
  it("aceita payload mínimo válido", () => {
    const r = criarSafraCultivoSchema.safeParse({ cultura: "MILHO", nome: "Safra 2026", ano: 2026, dataInicio: "2026-09-01" });
    expect(r.success).toBe(true);
  });

  it("rejeita cultura fora do enum", () => {
    const r = criarSafraCultivoSchema.safeParse({ cultura: "SOJA", nome: "x", ano: 2026, dataInicio: "2026-09-01" });
    expect(r.success).toBe(false);
  });

  it("rejeita data fora do formato YYYY-MM-DD", () => {
    const r = criarSafraCultivoSchema.safeParse({ cultura: "MILHO", nome: "x", ano: 2026, dataInicio: "01/09/2026" });
    expect(r.success).toBe(false);
  });

  it("rejeita nome vazio", () => {
    const r = criarSafraCultivoSchema.safeParse({ cultura: "MILHO", nome: "", ano: 2026, dataInicio: "2026-09-01" });
    expect(r.success).toBe(false);
  });
});

describe("editarSafraCultivoSchema", () => {
  it("todos os campos são opcionais (partial)", () => {
    const r = editarSafraCultivoSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});

describe("listSafraCultivoFiltrosSchema", () => {
  it("coage fechada e ano de query string", () => {
    const r = listSafraCultivoFiltrosSchema.safeParse({ fechada: "true", ano: "2026" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.fechada).toBe(true);
      expect(r.data.ano).toBe(2026);
    }
  });

  it("aceita ausência de filtros", () => {
    const r = listSafraCultivoFiltrosSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});

describe("criarAreaCultivoSchema", () => {
  it("aceita payload válido", () => {
    const r = criarAreaCultivoSchema.safeParse({ safraCultivoId: 1, codigo: "A1", areaHa: 12.5 });
    expect(r.success).toBe(true);
  });

  it("rejeita areaHa negativa", () => {
    const r = criarAreaCultivoSchema.safeParse({ safraCultivoId: 1, codigo: "A1", areaHa: -1 });
    expect(r.success).toBe(false);
  });

  it("rejeita código vazio", () => {
    const r = criarAreaCultivoSchema.safeParse({ safraCultivoId: 1, codigo: "", areaHa: 1 });
    expect(r.success).toBe(false);
  });
});

describe("criarLancamentoCustoSchema", () => {
  it("aceita payload mínimo e aplica default classe=CUSTEIO", () => {
    const r = criarLancamentoCustoSchema.safeParse({
      safraCultivoId: 1, tipo: "ADUBACAO", data: "2026-09-10", descricao: "Adubo NPK", valor: 1500,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.classe).toBe("CUSTEIO");
  });

  it("aceita classe explícita INVESTIMENTO", () => {
    const r = criarLancamentoCustoSchema.safeParse({
      safraCultivoId: 1, tipo: "MAQUINA", classe: "INVESTIMENTO", data: "2026-09-10", descricao: "Trator novo", valor: 200000,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita valor negativo", () => {
    const r = criarLancamentoCustoSchema.safeParse({
      safraCultivoId: 1, tipo: "OUTRO", data: "2026-09-10", descricao: "x", valor: -10,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita tipo fora do enum", () => {
    const r = criarLancamentoCustoSchema.safeParse({
      safraCultivoId: 1, tipo: "IRRIGACAO", data: "2026-09-10", descricao: "x", valor: 10,
    });
    expect(r.success).toBe(false);
  });
});

describe("listLancamentoCustoFiltrosSchema", () => {
  it("classe default é custeio quando informado sem valor não é aplicado (campo opcional)", () => {
    const r = listLancamentoCustoFiltrosSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.classe).toBeUndefined();
  });

  it("aceita classe=tudo", () => {
    const r = listLancamentoCustoFiltrosSchema.safeParse({ classe: "tudo" });
    expect(r.success).toBe(true);
  });

  it("rejeita classe inválida", () => {
    const r = listLancamentoCustoFiltrosSchema.safeParse({ classe: "ambos" });
    expect(r.success).toBe(false);
  });
});

describe("criarProducaoCultivoSchema", () => {
  it("aceita produção de grão com destino VENDA", () => {
    const r = criarProducaoCultivoSchema.safeParse({
      safraCultivoId: 1, data: "2026-12-01", tipo: "GRAO", quantidade: 500, unidade: "SC", destino: "VENDA",
    });
    expect(r.success).toBe(true);
  });

  it("aceita produção de silagem com destino SILO + siloId", () => {
    const r = criarProducaoCultivoSchema.safeParse({
      safraCultivoId: 1, data: "2026-12-01", tipo: "SILAGEM", quantidade: 200, unidade: "TON", destino: "SILO", siloId: 3,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita quantidade zero ou negativa", () => {
    const r = criarProducaoCultivoSchema.safeParse({
      safraCultivoId: 1, data: "2026-12-01", tipo: "GRAO", quantidade: 0, unidade: "SC",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita unidade fora do enum", () => {
    const r = criarProducaoCultivoSchema.safeParse({
      safraCultivoId: 1, data: "2026-12-01", tipo: "GRAO", quantidade: 10, unidade: "KG",
    });
    expect(r.success).toBe(false);
  });
});

describe("criarSiloSchema", () => {
  it("aceita payload válido e default ativo=true", () => {
    const r = criarSiloSchema.safeParse({ nome: "Silo 1", tipo: "GRAO", unidade: "SC" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ativo).toBe(true);
  });

  it("rejeita unidade vazia", () => {
    const r = criarSiloSchema.safeParse({ nome: "Silo 1", tipo: "GRAO", unidade: "" });
    expect(r.success).toBe(false);
  });
});

describe("criarMovimentoSiloSchema", () => {
  it("aceita SAIDA/NUTRICAO", () => {
    const r = criarMovimentoSiloSchema.safeParse({ data: "2026-12-05", tipo: "SAIDA", quantidade: 5, origem: "NUTRICAO" });
    expect(r.success).toBe(true);
  });

  it("aceita SAIDA/VENDA e SAIDA/AJUSTE", () => {
    expect(criarMovimentoSiloSchema.safeParse({ data: "2026-12-05", tipo: "SAIDA", quantidade: 5, origem: "VENDA" }).success).toBe(true);
    expect(criarMovimentoSiloSchema.safeParse({ data: "2026-12-05", tipo: "SAIDA", quantidade: 5, origem: "AJUSTE" }).success).toBe(true);
  });

  it("rejeita quantidade não positiva", () => {
    const r = criarMovimentoSiloSchema.safeParse({ data: "2026-12-05", tipo: "SAIDA", quantidade: 0, origem: "AJUSTE" });
    expect(r.success).toBe(false);
  });
});

describe("classeFiltro", () => {
  it("default é custeio quando undefined", () => {
    expect(classeFiltro.parse(undefined)).toBe("custeio");
  });

  it("aceita custeio, investimento, tudo", () => {
    expect(classeFiltro.parse("custeio")).toBe("custeio");
    expect(classeFiltro.parse("investimento")).toBe("investimento");
    expect(classeFiltro.parse("tudo")).toBe("tudo");
  });

  it("rejeita valor fora do enum", () => {
    expect(() => classeFiltro.parse("outro")).toThrow();
  });
});
