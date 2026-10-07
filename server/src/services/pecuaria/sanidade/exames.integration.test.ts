import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { corrigirExame, criarTipoExame, editarTipoExame, listarExames, listarTiposExame, obterHistoricoExame, registrarExame } from "./exames.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const animalIds: string[] = [];
const tipoIds: string[] = [];
let propriedadeId: number;

afterAll(async () => {
  if (!propriedadeId) return;
  await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId } });
  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [{ animalId: { in: animalIds } }, { entidadeId: { in: tipoIds } }] } });
  await prisma.exameAnimal.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.tipoExame.deleteMany({ where: { id: { in: tipoIds } } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.animal.deleteMany({ where: { id: { in: animalIds } } });
  await prisma.propriedade.delete({ where: { id: propriedadeId } });
});

describeComBanco("integridade dos exames com PostgreSQL", () => {
  beforeAll(async () => {
    propriedadeId = (await prisma.propriedade.create({ data: { nome: `Integridade exames ${run}` } })).id;
    for (let n = 0; n < 2; n++) {
      const animal = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `EI${n}${run}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE",
        dataNascimento: "2024-01-01", dataEntrada: "2026-08-01", propriedadeId }), null);
      animalIds.push(animal.id);
    }
  });

  async function novoTipo(sufixo: string) {
    const tipo = await criarTipoExame({ nome: `Exame ${sufixo} ${run}`, tipoResultado: "NUMERO", unidade: "mg" }, null);
    tipoIds.push(tipo.id);
    return tipo;
  }
  const input = (tipoExameId: string, animalId = animalIds[0]) => ({ animalId, propriedadeId, tipoExameId, data: "2026-09-01" });

  it("primeira coleta pendente trava formato; renomeação e anulação conservam snapshot", async () => {
    const tipo = await novoTipo("pendente");
    await editarTipoExame(tipo.id, { unidade: "g" }, null);
    const exame = await registrarExame(input(tipo.id), null);
    expect(exame.resultadoNumero).toBeNull();
    await expect(editarTipoExame(tipo.id, { tipoResultado: "TEXTO" }, null)).rejects.toMatchObject({ code: "CONFLITO" });
    await expect(editarTipoExame(tipo.id, { unidade: "kg" }, null)).rejects.toMatchObject({ code: "CONFLITO" });
    await editarTipoExame(tipo.id, { nome: `${tipo.nome} renomeado`, ativo: false }, null);
    expect((await listarExames(animalIds[0], propriedadeId)).find((v) => v.id === exame.id)).toMatchObject({ tipoExame: { nome: tipo.nome }, formatoSnapshot: { nome: tipo.nome, unidade: "g", tipoResultado: "NUMERO" } });
    await corrigirExame(exame.id, propriedadeId, { anular: true, motivo: "Amostra descartada antes da análise" }, null);
    await expect(editarTipoExame(tipo.id, { unidade: "mg" }, null)).rejects.toMatchObject({ code: "CONFLITO" });
    expect((await listarTiposExame(true)).find((v) => v.id === tipo.id)).toMatchObject({ formatoBloqueado: true, ativo: false });
  });

  it("opções ficam bloqueadas após uso e correção mantém formato original", async () => {
    const tipo = await criarTipoExame({ nome: `Opções ${run}`, tipoResultado: "OPCAO", opcoes: ["POSITIVO", "NEGATIVO"] }, null);
    tipoIds.push(tipo.id);
    const exame = await registrarExame(input(tipo.id), null);
    await expect(editarTipoExame(tipo.id, { opcoes: ["POSITIVO", "NEGATIVO", "INCONCLUSIVO"] }, null)).rejects.toMatchObject({ code: "CONFLITO" });
    await editarTipoExame(tipo.id, { nome: `${tipo.nome} atual` }, null);
    await expect(corrigirExame(exame.id, propriedadeId, { resultadoOpcao: "INCONCLUSIVO", motivo: "Nova avaliação do laboratório" }, null)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(await corrigirExame(exame.id, propriedadeId, { resultadoOpcao: "NEGATIVO", motivo: "Laudo original recebido" }, null)).toMatchObject({ resultadoOpcao: "NEGATIVO" });
  });

  it("histórico pagina coleta, resultado zero, correção e anulação com motivos reais", async () => {
    const tipo = await novoTipo("histórico");
    const exame = await registrarExame(input(tipo.id), null);
    await corrigirExame(exame.id, propriedadeId, { resultadoNumero: 0, motivo: "Laudo recebido do laboratório" }, null);
    await corrigirExame(exame.id, propriedadeId, { resultadoNumero: 2.5, motivo: "Laboratório corrigiu o laudo" }, null);
    await corrigirExame(exame.id, propriedadeId, { anular: true, motivo: "Laudo pertence a outra amostra" }, null);
    const primeira = await obterHistoricoExame(exame.id, [propriedadeId], 1, 2);
    const segunda = await obterHistoricoExame(exame.id, [propriedadeId], 2, 2);
    expect(primeira.total).toBe(4);
    expect(primeira.itens).toHaveLength(2);
    expect(segunda.itens).toHaveLength(2);
    expect(new Set([...primeira.itens, ...segunda.itens].map((v) => v.id)).size).toBe(4);
    expect(primeira.itens[0]).toMatchObject({ acao: "ANULACAO", autor: null, motivo: "Laudo pertence a outra amostra" });
    expect(segunda.itens.find((v) => v.acao === "RESULTADO_CORRIGIDO")).toMatchObject({ antes: { resultadoNumero: null }, depois: { resultadoNumero: "0" } });
    expect(segunda.itens.find((v) => v.acao === "REGISTRO")?.motivo).toBeNull();
    await expect(obterHistoricoExame(exame.id, [propriedadeId + 10000])).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
  });

  it("edição e primeira coleta concorrentes deixam somente formato compatível", async () => {
    for (let n = 0; n < 5; n++) {
      const tipo = await novoTipo(`corrida-${n}`);
      const resultados = await Promise.allSettled([
        registrarExame({ ...input(tipo.id, animalIds[n % 2]), resultadoNumero: 0 }, null),
        editarTipoExame(tipo.id, { tipoResultado: "TEXTO", unidade: null }, null),
      ]);
      expect(resultados.filter((v) => v.status === "fulfilled")).toHaveLength(1);
      const salvo = await prisma.tipoExame.findUniqueOrThrow({ where: { id: tipo.id } });
      const exames = await prisma.exameAnimal.findMany({ where: { tipoExameId: tipo.id } });
      if (resultados[0].status === "fulfilled") {
        expect(salvo.tipoResultado).toBe("NUMERO");
        expect(exames).toHaveLength(1);
        expect(exames[0].resultadoNumero?.toString()).toBe("0");
        expect(exames[0].formatoSnapshot).toMatchObject({ tipoResultado: "NUMERO", unidade: "mg" });
      } else {
        expect(salvo.tipoResultado).toBe("TEXTO");
        expect(exames).toHaveLength(0);
      }
    }
  });

  it("correção e anulação concorrentes nunca reativam exame", async () => {
    const tipo = await novoTipo("anulação concorrente");
    const exame = await registrarExame({ ...input(tipo.id), resultadoNumero: 1 }, null);
    const resultados = await Promise.allSettled([
      corrigirExame(exame.id, propriedadeId, { anular: true, motivo: "Amostra inválida após conferência" }, null),
      corrigirExame(exame.id, propriedadeId, { resultadoNumero: 0, motivo: "Revisão do resultado pelo laboratório" }, null),
    ]);
    expect(resultados[0].status).toBe("fulfilled");
    const final = await prisma.exameAnimal.findUniqueOrThrow({ where: { id: exame.id } });
    expect(final.status).toBe("ANULADO");
    const historico = await obterHistoricoExame(exame.id, [propriedadeId]);
    expect(historico.itens[0].acao).toBe("ANULACAO");
  });
});
