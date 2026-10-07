import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { hojeFazenda } from "../rebanho/regras.js";
import { criarTipoExame } from "../sanidade/exames.js";
import { concluirColeta, obterColeta, prepararColeta, salvarColeta } from "./coletas.js";
import { rascunhoColetaSchema, type RascunhoColeta } from "./schemas.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const propriedadeIds: number[] = [];
const loteIds: string[] = [];
const animalIds: string[] = [];
const coletaIds: string[] = [];
const tipoExameIds: string[] = [];

let propriedadeId = 0;
let outroSitioId = 0;

afterAll(async () => {
  if (!propriedadeIds.length) return;
  await prisma.coletaCampo.deleteMany({ where: { id: { in: coletaIds } } });
  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [
    { propriedadeId: { in: propriedadeIds } },
    { animalId: { in: animalIds } },
    { entidadeId: { in: coletaIds } },
    { entidadeId: { in: tipoExameIds } },
  ] } });
  await prisma.pesagem.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.exameAnimal.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.tipoExame.deleteMany({ where: { id: { in: tipoExameIds } } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.animal.deleteMany({ where: { id: { in: animalIds } } });
  await prisma.lote.deleteMany({ where: { id: { in: loteIds } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: propriedadeIds } } });
});

describeComBanco("coletas de campo com PostgreSQL isolado", () => {
  beforeAll(async () => {
    propriedadeId = (await prisma.propriedade.create({ data: { nome: "Integridade coletas " + run } })).id;
    outroSitioId = (await prisma.propriedade.create({ data: { nome: "Integridade coletas externo " + run } })).id;
    propriedadeIds.push(propriedadeId, outroSitioId);
  });

  async function novoLote(tag: string, sitioId = propriedadeId) {
    const lote = await prisma.lote.create({ data: { nome: "Coleta " + tag + " " + run, propriedadeId: sitioId } });
    loteIds.push(lote.id);
    return lote.id;
  }

  async function novoAnimal(tag: string, loteId: string, sitioId = propriedadeId) {
    const animal = await cadastrar(cadastrarAnimalSchema.parse({
      brinco: "CT-" + run + "-" + tag, sexo: "F", origem: "COMPRADO", aptidao: "LEITE",
      dataNascimento: "2024-01-01", dataEntrada: hojeFazenda(), propriedadeId: sitioId, loteId,
    }), null);
    animalIds.push(animal.id);
    return animal.id;
  }

  async function novaColeta(tipo: "PESAGEM" | "EXAME" | "APLICACAO", loteIdsEntrada: string[]) {
    const coleta = await prepararColeta({
      id: crypto.randomUUID(), propriedadeId, data: hojeFazenda(), tipo, titulo: "Ficha " + tipo + " " + run, loteIds: loteIdsEntrada,
    }, null);
    coletaIds.push(coleta.id);
    return coleta;
  }

  function rascunho(coleta: { rascunho: unknown }, alterar: (item: RascunhoColeta["itens"][number], indice: number) => RascunhoColeta["itens"][number]) {
    const base = rascunhoColetaSchema.parse(coleta.rascunho);
    return { ...base, itens: base.itens.map((item, indice) => alterar(item, indice)) };
  }

  it("congela animais e ordena por lote e brinco em ordem natural", async () => {
    const lote2 = await novoLote("2");
    const lote10 = await novoLote("10");
    const animal10 = await novoAnimal("ordem-10", lote2);
    const animal2 = await novoAnimal("ordem-2", lote2);
    const animalLote10 = await novoAnimal("lote10-1", lote10);
    const ficha = await novaColeta("PESAGEM", [lote10, lote2]);
    const snapshot = ficha.snapshot as { animais: Array<{ animalId: string; brinco: string; loteId: string }> };
    expect(snapshot.animais.map((a) => a.animalId)).toEqual([animal2, animal10, animalLote10]);
    expect(snapshot.animais.map((a) => a.loteId)).toEqual([lote2, lote2, lote10]);
    expect(snapshot.animais.map((a) => a.brinco)).toEqual(["CT-" + run + "-ordem-2", "CT-" + run + "-ordem-10", "CT-" + run + "-lote10-1"]);
  });

  it("não prepara nem revela ficha de outro sítio", async () => {
    const loteExterno = await novoLote("externo", outroSitioId);
    await novoAnimal("externo", loteExterno, outroSitioId);
    await expect(prepararColeta({
      id: crypto.randomUUID(), propriedadeId, data: hojeFazenda(), tipo: "PESAGEM", titulo: "Tentativa fora do escopo", loteIds: [loteExterno],
    }, null)).rejects.toMatchObject({ code: "VALIDACAO" });

    const loteLocal = await novoLote("escopo");
    await novoAnimal("escopo", loteLocal);
    const ficha = await novaColeta("PESAGEM", [loteLocal]);
    await expect(obterColeta(ficha.id, outroSitioId)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect((await obterColeta(ficha.id, propriedadeId)).id).toBe(ficha.id);
  });

  it("recusa edição de rascunho com versão desatualizada", async () => {
    const lote = await novoLote("versao");
    await novoAnimal("versao", lote);
    const ficha = await novaColeta("PESAGEM", [lote]);
    const base = rascunho(ficha, (item) => ({ ...item, observacao: "Rascunho de teste" }));
    const salva = await salvarColeta(ficha.id, propriedadeId, ficha.versao, base, null);
    expect(salva.versao).toBe(ficha.versao + 1);
    await expect(salvarColeta(ficha.id, propriedadeId, ficha.versao, base, null)).rejects.toMatchObject({ code: "CONFLITO" });
    expect((await obterColeta(ficha.id, propriedadeId)).versao).toBe(salva.versao);
  });

  it("valida peso por animal e desfaz toda a conclusão inválida", async () => {
    const lote = await novoLote("atomica");
    const primeiro = await novoAnimal("atomica-1", lote);
    const segundo = await novoAnimal("atomica-2", lote);
    const ficha = await novaColeta("PESAGEM", [lote]);
    const preenchida = rascunho(ficha, (item) => ({
      ...item, situacao: "REALIZADO", peso: item.animalId === primeiro ? "410,5" : "0",
    }));
    const salva = await salvarColeta(ficha.id, propriedadeId, ficha.versao, preenchida, null);
    await expect(concluirColeta(ficha.id, propriedadeId, salva.versao, null)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(await prisma.pesagem.count({ where: { animalId: { in: [primeiro, segundo] } } })).toBe(0);
    expect(await prisma.auditoriaPecuaria.count({ where: { entidade: "Pesagem", animalId: { in: [primeiro, segundo] } } })).toBe(0);
    expect(await obterColeta(ficha.id, propriedadeId)).toMatchObject({ status: "EM_PREENCHIMENTO", versao: salva.versao });
  });

  it("não conclui item pendente e exige motivo para não realizado", async () => {
    const lote = await novoLote("situacao");
    const animal = await novoAnimal("situacao", lote);
    const ficha = await novaColeta("PESAGEM", [lote]);

    const pendente = rascunho(ficha, (item) => ({ ...item, situacao: "PENDENTE" }));
    const salvaPendente = await salvarColeta(ficha.id, propriedadeId, ficha.versao, pendente, null);
    await expect(concluirColeta(ficha.id, propriedadeId, salvaPendente.versao, null)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(await prisma.pesagem.count({ where: { animalId: animal } })).toBe(0);

    const naoRealizadaCurta = rascunho(ficha, (item) => ({ ...item, situacao: "NAO_REALIZADO", motivo: "abc" }));
    const salvaCurta = await salvarColeta(ficha.id, propriedadeId, salvaPendente.versao, naoRealizadaCurta, null);
    await expect(concluirColeta(ficha.id, propriedadeId, salvaCurta.versao, null)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(await prisma.pesagem.count({ where: { animalId: animal } })).toBe(0);

    const naoRealizada = rascunho(ficha, (item) => ({ ...item, situacao: "NAO_REALIZADO", motivo: "Animal não localizado" }));
    const salvaFinal = await salvarColeta(ficha.id, propriedadeId, salvaCurta.versao, naoRealizada, null);
    const concluida = await concluirColeta(ficha.id, propriedadeId, salvaFinal.versao, null);
    expect(concluida).toMatchObject({ status: "CONCLUIDA" });
    expect(concluida.resultados).toEqual([]);
    expect(await prisma.pesagem.count({ where: { animalId: animal } })).toBe(0);
  });

  it("conclui duas pesagens e o reenvio da mesma versão não duplica fatos", async () => {
    const lote = await novoLote("retry");
    const ids = [await novoAnimal("retry-1", lote), await novoAnimal("retry-2", lote)];
    const ficha = await novaColeta("PESAGEM", [lote]);
    const preenchida = rascunho(ficha, (item, indice) => ({ ...item, situacao: "REALIZADO", peso: indice === 0 ? "421,25" : "390,5" }));
    const salva = await salvarColeta(ficha.id, propriedadeId, ficha.versao, preenchida, null);
    const primeira = await concluirColeta(ficha.id, propriedadeId, salva.versao, null);
    const retry = await concluirColeta(ficha.id, propriedadeId, salva.versao, null);
    expect(primeira.id).toBe(retry.id);
    expect(retry.versao).toBe(salva.versao + 1);
    expect(primeira.resultados).toEqual(retry.resultados);
    expect(await prisma.pesagem.count({ where: { animalId: { in: ids } } })).toBe(2);
  });

  it("conclui coleta de exame com tipo e referências aos animais", async () => {
    const lote = await novoLote("exame");
    const ids = [await novoAnimal("exame-1", lote), await novoAnimal("exame-2", lote)];
    const tipo = await criarTipoExame({ nome: "Coleta exame " + run, tipoResultado: "NUMERO", unidade: "mg/dL" }, null);
    tipoExameIds.push(tipo.id);
    const ficha = await novaColeta("EXAME", [lote]);
    const preenchida = rascunho(ficha, (item) => ({ ...item, situacao: "REALIZADO" }));
    const comTipo = { ...preenchida, tipoExameId: tipo.id, responsavel: "Equipe de coleta" };
    const salva = await salvarColeta(ficha.id, propriedadeId, ficha.versao, comTipo, null);
    const concluida = await concluirColeta(ficha.id, propriedadeId, salva.versao, null);
    expect(concluida.status).toBe("CONCLUIDA");
    const exames = await prisma.exameAnimal.findMany({ where: { animalId: { in: ids } }, orderBy: { criadoEm: "asc" } });
    expect(exames).toHaveLength(2);
    expect(exames.map((e) => e.animalId).sort()).toEqual([...ids].sort());
    expect(exames.every((e) => e.tipoExameId === tipo.id && e.propriedadeId === propriedadeId && e.resultadoNumero == null)).toBe(true);
    expect(exames.every((e) => e.formatoSnapshot && typeof e.formatoSnapshot === "object" && !Array.isArray(e.formatoSnapshot)
      && "tipoResultado" in e.formatoSnapshot && e.formatoSnapshot.tipoResultado === "NUMERO")).toBe(true);
    expect(concluida.resultados).toHaveLength(2);
  });
});
