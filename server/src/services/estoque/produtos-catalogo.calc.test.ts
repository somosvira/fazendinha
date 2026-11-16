import { describe, expect, it } from "vitest";
import { camposEfetivos, efeitoNomePatch, nomeCompletoCatalogo, sugerirCategoriaId, unidadePorRotulo } from "./produtos-catalogo.calc.js";

const usos = (s = false, n = false, g = false) => ({ usoSanitario: s, usoNutricional: n, usoGenetico: g });

describe("nomeCompletoCatalogo", () => {
  it("acrescenta a apresentação entre parênteses quando houver", () => {
    expect(nomeCompletoCatalogo({ nome: "Biomox 20% PS", apresentacao: "Sachê 100 g" })).toBe("Biomox 20% PS (Sachê 100 g)");
  });
  it.each([null, undefined, "", "   "])("sem apresentação (%s) usa só o nome, aparado", (apresentacao) => {
    expect(nomeCompletoCatalogo({ nome: "  Sal mineral ", apresentacao })).toBe("Sal mineral");
  });
});

describe("sugerirCategoriaId", () => {
  const sanitaria = { id: "san", ...usos(true) };
  const nutricional = { id: "nut", ...usos(false, true) };
  const mista = { id: "mista", ...usos(true, true) };

  it("exatamente uma categoria com a flag do item → sugerida", () => {
    expect(sugerirCategoriaId(usos(true), [sanitaria, nutricional])).toBe("san");
  });
  it("várias categorias compatíveis → nenhuma sugestão", () => {
    expect(sugerirCategoriaId(usos(true), [sanitaria, mista, nutricional])).toBeNull();
  });
  it("nenhuma compatível → nenhuma sugestão", () => {
    expect(sugerirCategoriaId(usos(false, false, true), [sanitaria, nutricional])).toBeNull();
  });
  it("item com mais de um uso: interseção das flags", () => {
    expect(sugerirCategoriaId(usos(true, true), [sanitaria, nutricional, mista])).toBe("mista");
  });
  it("item sem uso não recebe sugestão, mesmo com uma categoria só", () => {
    expect(sugerirCategoriaId(usos(), [sanitaria])).toBeNull();
  });
  it("categoria inativa não conta", () => {
    expect(sugerirCategoriaId(usos(true), [sanitaria, { ...mista, ativo: false }])).toBe("san");
  });
});

describe("camposEfetivos", () => {
  const fab = (id: string) => ({ id, nome: `Fabricante ${id}`, ativo: true });
  const cla = (id: string) => ({ id, nome: `Classe ${id}`, ativo: true });
  const vazio = { apresentacao: null, fabricanteId: null, fabricante: null, classificacaoTecnicaId: null, classificacaoTecnica: null };
  const catalogo = { apresentacao: "Frasco 50 mL", fabricanteId: "fc", fabricante: fab("fc"), classificacaoTecnicaId: "cc", classificacaoTecnica: cla("cc") };

  it("produto adotado sem valores próprios herda tudo do catálogo", () => {
    expect(camposEfetivos({ ...vazio, nomeAlterado: false }, catalogo)).toEqual({
      ...catalogo,
      origemCampos: { nome: "catalogo", apresentacao: "catalogo", fabricante: "catalogo", classificacaoTecnica: "catalogo" },
    });
  });
  it("valor próprio prevalece e é marcado como da fazenda; o resto continua herdado", () => {
    const r = camposEfetivos({ ...vazio, apresentacao: "Caixa", fabricanteId: "fp", fabricante: fab("fp"), nomeAlterado: true }, catalogo);
    expect(r).toMatchObject({ apresentacao: "Caixa", fabricanteId: "fp", fabricante: fab("fp"), classificacaoTecnicaId: "cc" });
    expect(r.origemCampos).toEqual({ nome: "fazenda", apresentacao: "fazenda", fabricante: "fazenda", classificacaoTecnica: "catalogo" });
  });
  it("produto manual não herda: tudo é da fazenda, inclusive nulos", () => {
    const r = camposEfetivos({ ...vazio, nomeAlterado: false }, null);
    expect(r).toMatchObject({ apresentacao: null, fabricanteId: null, classificacaoTecnicaId: null });
    expect(r.origemCampos).toEqual({ nome: "fazenda", apresentacao: "fazenda", fabricante: "fazenda", classificacaoTecnica: "fazenda" });
  });
});

describe("unidadePorRotulo", () => {
  it.each([["kg", "KG"], ["KG", "KG"], ["mL", "ML"], ["ml", "ML"], [" L ", "L"], ["dose", "DOSE"]] as const)("%s → %s", (rotulo, unidade) => {
    expect(unidadePorRotulo(rotulo)).toBe(unidade);
  });
  it.each(["", "  ", "frasco", null, undefined])("rótulo desconhecido (%s) → sem unidade (vale a sugerida)", (rotulo) => {
    expect(unidadePorRotulo(rotulo)).toBeUndefined();
  });
});

describe("efeitoNomePatch", () => {
  const adotado = { nome: "Biomox (Sachê)", produtoCatalogoId: "c1" };
  const manual = { nome: "Ração", produtoCatalogoId: null };

  it("renomear produto adotado marca nomeAlterado", () => {
    expect(efeitoNomePatch(adotado, { nome: "Biomox da casa" }, "Biomox (Sachê)")).toEqual({ nome: "Biomox da casa", nomeAlterado: true });
  });
  it("reenviar o mesmo nome não marca alteração", () => {
    expect(efeitoNomePatch(adotado, { nome: "Biomox (Sachê)" }, "Biomox (Sachê)")).toEqual({ nome: "Biomox (Sachê)" });
  });
  it("restaurar volta ao nome do catálogo e desmarca nomeAlterado", () => {
    expect(efeitoNomePatch({ ...adotado, nome: "Outro" }, { restaurarNome: true }, "Biomox (Sachê 50 g)")).toEqual({ nome: "Biomox (Sachê 50 g)", nomeAlterado: false });
  });
  it("sem nome no patch, nada muda", () => {
    expect(efeitoNomePatch(adotado, {}, "Biomox (Sachê)")).toEqual({});
  });
  it("produto manual segue como hoje: só o nome, sem nomeAlterado", () => {
    expect(efeitoNomePatch(manual, { nome: "Ração nova" }, null)).toEqual({ nome: "Ração nova" });
  });
});
