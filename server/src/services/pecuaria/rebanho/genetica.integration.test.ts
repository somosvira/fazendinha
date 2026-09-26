// Testes de banco da pecuária v2 (Genética): filiação, genitores externos e composição
// calculada, contra o Postgres real. Só rodam com PECUARIA_DB_INTEGRATION=1 — mesmo gate e
// convenções de `rebanho.integration.test.ts` (nomes/brincos únicos por execução, cleanup no afterAll).

import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar, definirFiliacao, editar, listarFilhos, substituirComposicao } from "./animais.js";
import { criarGenitor, editarGenitor } from "./genitores.js";
import { RebanhoError, hojeFazenda } from "./regras.js";
import { cadastrarAnimalSchema } from "./schemas.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;

const RUN = crypto.randomUUID().slice(0, 8);
const DIA_MS = 86_400_000;

const propriedadesCriadas: number[] = [];
const animaisCriados: string[] = [];
const genitoresCriados: string[] = [];
const racasCriadas: string[] = [];
let seq = 0;

function diasAntes(dias: number, base = hojeFazenda()): string {
  return new Date(Date.parse(base) - dias * DIA_MS).toISOString().slice(0, 10);
}

function brincoUnico(): string {
  seq += 1;
  return `GEN${RUN}-${seq}`;
}

async function sitio(): Promise<number> {
  const p = await prisma.propriedade.create({ data: { nome: `Pec Gen ${RUN}-${crypto.randomUUID().slice(0, 8)}` } });
  propriedadesCriadas.push(p.id);
  return p.id;
}

async function raca(sigla: string): Promise<string> {
  const r = await prisma.raca.create({ data: { nome: `${sigla} ${RUN}`, sigla: `${sigla}${seq++}`.slice(0, 3), base: true } });
  racasCriadas.push(r.id);
  return r.id;
}

async function novoAnimal(propriedadeId: number, extra: Record<string, unknown> = {}) {
  const input = cadastrarAnimalSchema.parse({
    brinco: brincoUnico(),
    sexo: "F",
    origem: "COMPRADO",
    dataNascimento: diasAntes(800),
    dataEntrada: diasAntes(30),
    propriedadeId,
    aptidao: "LEITE",
    ...extra,
  });
  const animal = await cadastrar(input, null);
  animaisCriados.push(animal.id);
  return animal;
}

afterAll(async () => {
  if (!propriedadesCriadas.length && !genitoresCriados.length && !racasCriadas.length) return;
  const propriedadeId = { in: propriedadesCriadas };
  const porSitio = await prisma.animal.findMany({ where: { localizacoes: { some: { propriedadeId } } }, select: { id: true } });
  const ids = [...new Set([...animaisCriados, ...porSitio.map((a) => a.id)])];
  const animalId = { in: ids };
  const entidades = [...genitoresCriados, ...racasCriadas, ...ids];

  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [{ animalId }, { entidadeId: { in: entidades } }] } });
  await prisma.composicaoRacial.deleteMany({ where: { animalId } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId } });
  await prisma.localizacaoAnimal.deleteMany({ where: { OR: [{ animalId }, { propriedadeId }] } });
  // desfaz a filiação antes de apagar os animais (FK Restrict entre eles)
  await prisma.animal.updateMany({ where: { id: animalId }, data: { maeId: null, paiId: null, maeExternaId: null, paiExternoId: null } });
  await prisma.animal.deleteMany({ where: { id: animalId } });
  await prisma.composicaoGenitorExterno.deleteMany({ where: { genitorId: { in: genitoresCriados } } });
  await prisma.genitorExterno.deleteMany({ where: { id: { in: genitoresCriados } } });
  await prisma.raca.deleteMany({ where: { id: { in: racasCriadas } } });
  await prisma.propriedade.deleteMany({ where: { id: propriedadeId } });
});

describeComBanco("pecuária v2 (genética) com PostgreSQL", () => {
  it("cria genitor externo com composição", async () => {
    const racaId = await raca("HO");
    const genitor = await criarGenitor({ sexo: "M", nome: `Zeus ${RUN}`, codigo: null, fornecedor: null, observacao: null, composicao: [{ racaId, fracao64: 64 }] }, null);
    genitoresCriados.push(genitor.id);
    expect(genitor.composicao).toEqual([{ racaId, sigla: expect.any(String), nome: expect.any(String), fracao64: 64 }]);
    expect(genitor.filhos).toBe(0);
  });

  it("recusa pai fêmea", async () => {
    const propriedadeId = await sitio();
    const filho = await novoAnimal(propriedadeId, { sexo: "M", dataNascimento: diasAntes(30) });
    const maeFemea = await novoAnimal(propriedadeId, { dataNascimento: diasAntes(800) });
    await expect(definirFiliacao(filho.id, { paiId: maeFemea.id }, null)).rejects.toThrow(RebanhoError);
  });

  it("recusa o próprio animal como seu pai (ciclo trivial)", async () => {
    const propriedadeId = await sitio();
    const animal = await novoAnimal(propriedadeId, { sexo: "M" });
    await expect(definirFiliacao(animal.id, { paiId: animal.id }, null)).rejects.toThrow(RebanhoError);
  });

  it("recusa ciclo: o filho como avô do próprio filho", async () => {
    const propriedadeId = await sitio();
    const avo = await novoAnimal(propriedadeId, { dataNascimento: diasAntes(1000) });
    const pai = await novoAnimal(propriedadeId, { sexo: "M", dataNascimento: diasAntes(700) });
    await definirFiliacao(pai.id, { maeId: avo.id }, null);
    const neto = await novoAnimal(propriedadeId, { sexo: "M", dataNascimento: diasAntes(400) });
    await definirFiliacao(neto.id, { paiId: pai.id }, null);
    // avo tentando ser filho do próprio neto (ciclo de 3 gerações)
    await expect(definirFiliacao(avo.id, { paiId: neto.id }, null)).rejects.toThrow(RebanhoError);
  });

  it("IA: mãe ¾HO¼GO + pai externo HO puro sugere composição ⅞HO⅛GO e grava CALCULADA", async () => {
    const racaHO = await raca("HO");
    const racaGO = await raca("GO");
    const propriedadeId = await sitio();
    const mae = await novoAnimal(propriedadeId);
    await substituirComposicao(mae.id, { itens: [{ racaId: racaHO, fracao64: 48 }, { racaId: racaGO, fracao64: 16 }] }, null);
    const touro = await criarGenitor({ sexo: "M", nome: `Touro IA ${RUN}`, codigo: null, fornecedor: null, observacao: null, composicao: [{ racaId: racaHO, fracao64: 64 }] }, null);
    genitoresCriados.push(touro.id);

    const filho = await novoAnimal(propriedadeId, { sexo: "M", dataNascimento: diasAntes(10), dataEntrada: diasAntes(10) });
    const resultado = await definirFiliacao(filho.id, { maeId: mae.id, paiExternoId: touro.id }, null);

    expect(resultado.composicaoSugerida).toBeNull(); // aplicada automaticamente (composição vazia antes)
    const composicaoFinal = await prisma.composicaoRacial.findMany({ where: { animalId: filho.id } });
    expect(composicaoFinal.every((c) => c.origem === "CALCULADA")).toBe(true);
    const total = composicaoFinal.find((c) => c.racaId === racaHO)?.fracao64;
    expect(total).toBe(56);
  });

  it("composição INFORMADA não é sobrescrita; a sugestão volta na resposta", async () => {
    const racaHO = await raca("HO");
    const propriedadeId = await sitio();
    const mae = await novoAnimal(propriedadeId);
    await substituirComposicao(mae.id, { itens: [{ racaId: racaHO, fracao64: 64 }] }, null);
    const filho = await novoAnimal(propriedadeId, { sexo: "M", dataNascimento: diasAntes(10), dataEntrada: diasAntes(10), composicao: [{ racaId: racaHO, fracao64: 32 }] });

    const resultado = await definirFiliacao(filho.id, { maeId: mae.id }, null);
    expect(resultado.composicaoSugerida).not.toBeNull();
    const composicaoFinal = await prisma.composicaoRacial.findMany({ where: { animalId: filho.id } });
    expect(composicaoFinal[0].origem).toBe("INFORMADA");
    expect(composicaoFinal[0].fracao64).toBe(32);
  });

  it("listarFilhos retorna os filhos pela filiação registrada", async () => {
    const propriedadeId = await sitio();
    const mae = await novoAnimal(propriedadeId);
    const filho1 = await novoAnimal(propriedadeId, { sexo: "M", dataNascimento: diasAntes(10), dataEntrada: diasAntes(10) });
    const filho2 = await novoAnimal(propriedadeId, { dataNascimento: diasAntes(5), dataEntrada: diasAntes(5) });
    await definirFiliacao(filho1.id, { maeId: mae.id }, null);
    await definirFiliacao(filho2.id, { maeId: mae.id }, null);

    const filhos = await listarFilhos(mae.id, null);
    expect(filhos.map((f) => f.id).sort()).toEqual([filho1.id, filho2.id].sort());
  });

  it("o CHECK do banco recusa mãe animal e mãe externa ao mesmo tempo (bypass direto do Prisma)", async () => {
    const propriedadeId = await sitio();
    const mae = await novoAnimal(propriedadeId);
    const genitor = await criarGenitor({ sexo: "F", nome: `Doadora chk ${RUN}`, codigo: null, fornecedor: null, observacao: null, composicao: [] }, null);
    genitoresCriados.push(genitor.id);
    const filho = await novoAnimal(propriedadeId, { dataNascimento: diasAntes(5), dataEntrada: diasAntes(5) });

    await expect(
      prisma.animal.update({ where: { id: filho.id }, data: { maeId: mae.id, maeExternaId: genitor.id } }),
    ).rejects.toThrow();
  });

  it("editarGenitor recusa trocar o sexo quando o genitor já tem filhos", async () => {
    const propriedadeId = await sitio();
    const genitor = await criarGenitor({ sexo: "M", nome: `Touro sexo ${RUN}`, codigo: null, fornecedor: null, observacao: null, composicao: [] }, null);
    genitoresCriados.push(genitor.id);
    const filho = await novoAnimal(propriedadeId, { sexo: "M", dataNascimento: diasAntes(5), dataEntrada: diasAntes(5) });
    await definirFiliacao(filho.id, { paiExternoId: genitor.id }, null);

    await expect(editarGenitor(genitor.id, { sexo: "F" }, null)).rejects.toThrow(RebanhoError);
  });

  it("editar recusa trocar o sexo de quem já é mãe", async () => {
    const propriedadeId = await sitio();
    const mae = await novoAnimal(propriedadeId);
    const filho = await novoAnimal(propriedadeId, { dataNascimento: diasAntes(5), dataEntrada: diasAntes(5) });
    await definirFiliacao(filho.id, { maeId: mae.id }, null);
    await expect(editar(mae.id, { sexo: "M" }, null)).rejects.toMatchObject({ code: "CONFLITO", campo: "sexo" });
  });

  it("editar recusa nascimento que quebra a ordem com genitores e filhos", async () => {
    const propriedadeId = await sitio();
    const mae = await novoAnimal(propriedadeId, { dataNascimento: diasAntes(800) });
    const filho = await novoAnimal(propriedadeId, { dataNascimento: diasAntes(400), dataEntrada: diasAntes(30) });
    await definirFiliacao(filho.id, { maeId: mae.id }, null);
    await expect(editar(mae.id, { dataNascimento: diasAntes(300) }, null)).rejects.toMatchObject({ code: "VALIDACAO", campo: "dataNascimento" });
    await expect(editar(filho.id, { dataNascimento: diasAntes(900) }, null)).rejects.toMatchObject({ code: "VALIDACAO", campo: "dataNascimento" });
  });

  it("filiação removida limpa a composição CALCULADA e audita", async () => {
    const racaHO = await raca("HO");
    const propriedadeId = await sitio();
    const mae = await novoAnimal(propriedadeId);
    await substituirComposicao(mae.id, { itens: [{ racaId: racaHO, fracao64: 64 }] }, null);
    const filho = await novoAnimal(propriedadeId, { dataNascimento: diasAntes(5), dataEntrada: diasAntes(5) });
    await definirFiliacao(filho.id, { maeId: mae.id }, null);
    expect(await prisma.composicaoRacial.count({ where: { animalId: filho.id } })).toBeGreaterThan(0);

    await definirFiliacao(filho.id, {}, null);
    expect(await prisma.composicaoRacial.count({ where: { animalId: filho.id } })).toBe(0);
    const auditorias = await prisma.auditoriaPecuaria.count({ where: { animalId: filho.id, entidade: "ComposicaoRacial" } });
    expect(auditorias).toBe(2);
  });

  it("genitor externo inativo: recusa escolha nova (campo do lado), aceita manter o atual", async () => {
    const propriedadeId = await sitio();
    const touro = await criarGenitor({ sexo: "M", nome: `Touro inativo ${RUN}`, codigo: null, fornecedor: null, observacao: null, composicao: [] }, null);
    genitoresCriados.push(touro.id);
    const filho = await novoAnimal(propriedadeId, { dataNascimento: diasAntes(5), dataEntrada: diasAntes(5) });
    await definirFiliacao(filho.id, { paiExternoId: touro.id }, null);
    await editarGenitor(touro.id, { ativo: false }, null);

    await expect(definirFiliacao(filho.id, { paiExternoId: touro.id }, null)).resolves.toBeTruthy();
    const outro = await novoAnimal(propriedadeId, { dataNascimento: diasAntes(5), dataEntrada: diasAntes(5) });
    await expect(definirFiliacao(outro.id, { paiExternoId: touro.id }, null)).rejects.toMatchObject({ campo: "paiExternoId" });
  });
});
