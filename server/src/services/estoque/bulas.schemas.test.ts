import { expect, it } from "vitest";
import { orientacaoBulaSchema } from "./bulas.schemas.js";

const ref = { url: "https://calbos.com.br/produto/pirosan/", secao: "Modo de usar" };
const orientacao = {
  versao: 2, fonte: ref.url, titulo: "Referência oficial", tipoFonte: "FICHA_OFICIAL", consultadaEm: "2026-11-17",
  documentoSha256: "a".repeat(64), especie: "Bovinos", concentracao: "Concentração da fonte", dosagem: "Dose da fonte",
  proporcoes: [{ quantidade: "1", unidade: "ML", pesoKg: "50", condicao: "Bovinos" }], via: "Subcutânea",
  carencias: { leite: { estado: "PROIBIDO", horas: null, condicao: "Fêmeas em lactação" }, carne: { estado: "PRAZO", horas: 840, condicao: "Após a última aplicação" } },
  cuidados: "Consultar as condições da fonte",
  camposFonte: { concentracao: ref, dosagem: ref, proporcoes: ref, via: ref, carenciasLeite: ref, carenciasCarne: ref, cuidados: ref },
};

it("exige fonte por campo e conserva proporção, condição e proibição", () => {
  expect(orientacaoBulaSchema.parse(orientacao).carencias.leite.horas).toBeNull();
  expect(orientacaoBulaSchema.safeParse({ ...orientacao, camposFonte: { dosagem: ref } }).success).toBe(false);
});
it("não converte proibição nem ausência em carência zero", () => {
  const carencias = { ...orientacao.carencias, leite: { estado: "PROIBIDO", horas: 0, condicao: "Lactação" } };
  expect(orientacaoBulaSchema.safeParse({ ...orientacao, carencias }).success).toBe(false);
  expect(orientacaoBulaSchema.safeParse({ ...orientacao, carencias: { ...carencias, leite: { estado: "NAO_INFORMADO", horas: 0, condicao: "Ausente na fonte" } } }).success).toBe(false);
});

it("preserva a identificação dos documentos que complementam a fonte principal", () => {
  const documento = { ...ref, documentoSha256: "b".repeat(64), pagina: 4 };
  const resultado = orientacaoBulaSchema.parse({ ...orientacao, documentosComplementares: [documento] });
  expect(resultado.documentosComplementares).toEqual([documento]);
  expect(orientacaoBulaSchema.safeParse({ ...orientacao, documentosComplementares: [{ ...documento, documentoSha256: "ausente" }] }).success).toBe(false);
});

it("valida todas as referências publicadas no catálogo", async () => {
  const { readFile } = await import("node:fs/promises");
  const fontes = (await Promise.all(["referencias-conferidas.json", "referencias-complementares.json", "referencias-prioridade-estoque.json", "referencias-lote-ampliado.json", "referencias-parciais.json", "referencias-continuacao-msd.json", "referencias-lote-multifabricantes.json", "referencias-revisao-catalogo.json"].map(async arquivo => JSON.parse(await readFile(new URL("../../../../scripts/catalogo-produtos/bulas/" + arquivo, import.meta.url), "utf8"))))).flat();
  const ids = new Set<string>();
  for (const entrada of fontes) {
    expect(orientacaoBulaSchema.safeParse(entrada.orientacao).success, entrada.nomeCatalogo).toBe(true);
    for (const item of entrada.itens) {
      expect(ids.has(item.id), item.id).toBe(false);
      ids.add(item.id);
    }
  }
});


it("aceita campos confirmados com composição pendente e exige motivo e fonte", async () => {
  const { readFile } = await import("node:fs/promises");
  const [mastijet] = JSON.parse(await readFile(new URL("../../../../scripts/catalogo-produtos/bulas/referencias-parciais.json", import.meta.url), "utf8"));
  expect(orientacaoBulaSchema.parse(mastijet.orientacao).concentracao).toBeNull();
  expect(orientacaoBulaSchema.safeParse({ ...mastijet.orientacao, pendencias: [] }).success).toBe(false);
  expect(orientacaoBulaSchema.safeParse({ ...mastijet.orientacao, camposFonte: {} }).success).toBe(false);
});

it("preserva proibição, prazo incomum e condições não representáveis como horas após aplicação no lote MSD", async () => {
  const { readFile } = await import("node:fs/promises");
  const entradas = JSON.parse(await readFile(new URL("../../../../scripts/catalogo-produtos/bulas/referencias-continuacao-msd.json", import.meta.url), "utf8"));
  const obter = (nome: string) => orientacaoBulaSchema.parse(entradas.find((e: { nomeCatalogo: string }) => e.nomeCatalogo === nome).orientacao);
  expect(obter("Imizol Injetável").carencias.leite.estado).toBe("PROIBIDO");
  expect(obter("Imizol Injetável").carencias.carne.horas).toBe(241 * 24);
  expect(obter("Cobactan Vl").carencias.leite.horas).toBeNull();
  expect(obter("Cepravin Anti-Mastitico P/ Vaca Sec.").carencias.leite.horas).toBeNull();
  expect(obter("Cepravin Anti-Mastitico P/ Vaca Sec.").carencias.leite.condicao).toContain("54 dias");
  expect(obter("Cobactan").proporcoes).toHaveLength(2);
  expect(obter("Chorulon 5000 Ui").proporcoes).toEqual([]);
});

it("conserva limites clínicos e campos pendentes do lote multifabricantes", async () => {
  const { readFile } = await import("node:fs/promises");
  const entradas = JSON.parse(await readFile(new URL("../../../../scripts/catalogo-produtos/bulas/referencias-lote-multifabricantes.json", import.meta.url), "utf8"));
  const obter = (nome: string) => orientacaoBulaSchema.parse(entradas.find((e: { nomeCatalogo: string }) => e.nomeCatalogo === nome).orientacao);
  expect(entradas.flatMap((e: { itens: unknown[] }) => e.itens)).toHaveLength(18);
  expect(obter("Glicose 50%").dosagem).toBeNull();
  expect(obter("Glicose 50%").proporcoes).toEqual([]);
  expect(obter("Rilexine 500").carencias.leite.horas).toBeNull();
  expect(obter("Dornil").carencias.leite.horas).toBeNull();
  expect(obter("Dornil").cuidados).toContain("lactantes");
  expect(obter("Covexin 9 - Vacina X Clostridioses").carencias.leite.estado).toBe("NAO_INFORMADO");
  expect(obter("Nuflor").carencias.leite.estado).toBe("PROIBIDO");
  expect(obter("Nuflor").proporcoes.map(p => p.condicao)).toEqual([expect.stringContaining("subcutânea"), expect.stringContaining("intramuscular")]);
  expect(obter("Calminex").carencias.carne.condicao).toContain("Equinos");
  expect(obter("Pangram 10%").carencias.carne.horas).toBeNull();
  expect(obter("Pangram 10%").proporcoes[0].condicao).toContain("não é dose bovina");
  expect(obter("Quinolon 10%").concentracao).toContain("10 g");
  expect(obter("Quinolon 10%").dosagem).toBeNull();
});

it("mantém apresentações não comprovadas sem referência e com motivo específico", async () => {
  const { readFile } = await import("node:fs/promises");
  const { conferenciaBulaSchema } = await import("./bulas.schemas.js");
  const pendentes = JSON.parse(await readFile(new URL("../../../../scripts/catalogo-produtos/bulas/pendencias-lote-multifabricantes.json", import.meta.url), "utf8"));
  const conferidos = JSON.parse(await readFile(new URL("../../../../scripts/catalogo-produtos/bulas/referencias-lote-multifabricantes.json", import.meta.url), "utf8"));
  const idsConferidos = new Set(conferidos.flatMap((e: { itens: { id: string }[] }) => e.itens.map(i => i.id)));
  expect(pendentes).toHaveLength(20);
  for (const p of pendentes) {
    const resultado = conferenciaBulaSchema.parse(p.conferencia);
    expect(resultado.fontesParaConferencia.length).toBeGreaterThan(0);
    expect(resultado.pendencias[0].motivo).not.toContain("Pesquisa de fonte oficial");
    for (const item of p.itens) expect(idsConferidos.has(item.id)).toBe(false);
  }
});

it("conserva cobertura integral da rodada sem promover tentativas de busca a dados clínicos", async () => {
  const { readFile } = await import("node:fs/promises");
  const { conferenciaBulaSchema } = await import("./bulas.schemas.js");
  const pasta = new URL("../../../../scripts/catalogo-produtos/bulas/", import.meta.url);
  const pesquisa = JSON.parse(await readFile(new URL("pesquisa-catalogo.json", pasta), "utf8"));
  const referencias = JSON.parse(await readFile(new URL("referencias-revisao-catalogo.json", pasta), "utf8"));
  const publicados = new Set(referencias.flatMap((e: { itens: { id: string }[] }) => e.itens.map(i => i.id)));
  expect(new Set(pesquisa.itens.map((e: { id: string }) => e.id)).size).toBe(pesquisa.itens.length);
  const consultas = new Set(pesquisa.consultas.map((e: { id: string }) => e.id));
  for (const item of pesquisa.itens) {
    expect(item.pesquisa.metodo).toBeTruthy();
    expect(item.pesquisa.resultado).toBeTruthy();
    expect(item.pesquisa.consultas.length || item.pesquisa.urlsConsultadas.length).toBeGreaterThan(0);
    for (const consulta of item.pesquisa.consultas) expect(consultas.has(consulta)).toBe(true);
    if (publicados.has(item.id)) expect(item.conferencia).toBeNull();
    else expect(conferenciaBulaSchema.safeParse(item.conferencia).success, item.nome).toBe(true);
  }
  expect(pesquisa.itens.filter((e: { conferencia: unknown }) => e.conferencia === null)).toHaveLength(publicados.size);
});

it("mantém divergências, condições após parto e proveniência dos novos campos", async () => {
  const { readFile } = await import("node:fs/promises");
  const entradas = JSON.parse(await readFile(new URL("../../../../scripts/catalogo-produtos/bulas/referencias-revisao-catalogo.json", import.meta.url), "utf8"));
  const obter = (nome: string) => orientacaoBulaSchema.parse(entradas.find((e: { nomeCatalogo: string }) => e.nomeCatalogo === nome).orientacao);
  for (const nome of ["Neomastic", "Mastizone V.S. ( Vaca Seca )", "Flunixina Injetável U.C.B"]) expect(obter(nome).carencias.leite.horas).toBeNull();
  expect(obter("Ivergen 1% - Ivermectina 1%").carencias.carne.horas).toBeNull();
  expect(obter("Enro Flec 10% Injetável").dosagem).toBeNull();
  expect(obter("Enro Flec 10% Injetável").proporcoes).toEqual([]);
  for (const entrada of entradas) {
    const fontes = new Set([entrada.orientacao.fonte, ...(entrada.orientacao.documentosComplementares ?? []).map((d: { url: string }) => d.url)]);
    for (const fonte of Object.values(entrada.orientacao.camposFonte) as { url: string }[]) expect(fontes.has(fonte.url), entrada.nomeCatalogo).toBe(true);
  }
});
