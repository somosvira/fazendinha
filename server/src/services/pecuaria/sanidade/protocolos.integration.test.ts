import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { hojeFazenda } from "../rebanho/regras.js";
import { criarTipoExame, registrarExame } from "./exames.js";
import { criarProtocolo, iniciarExecucao, listarTarefas, publicarProtocolo } from "./protocolos.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const propriedadeIds: number[] = [];
const animalIds: string[] = [];
const protocoloIds: string[] = [];
const tipoIds: string[] = [];
const execucaoIds: string[] = [];

afterAll(async () => {
  if (!propriedadeIds.length) return;
  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [
    { animalId: { in: animalIds } }, { entidadeId: { in: [...protocoloIds, ...tipoIds, ...execucaoIds] } },
  ] } });
  await prisma.exameAnimal.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.tarefaSanitaria.deleteMany({ where: { execucaoId: { in: execucaoIds } } });
  await prisma.execucaoProtocoloSanitario.deleteMany({ where: { id: { in: execucaoIds } } });
  await prisma.etapaProtocoloSanitario.deleteMany({ where: { protocoloId: { in: protocoloIds } } });
  await prisma.protocoloSanitario.deleteMany({ where: { id: { in: protocoloIds } } });
  await prisma.tipoExame.deleteMany({ where: { id: { in: tipoIds } } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.animal.deleteMany({ where: { id: { in: animalIds } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: propriedadeIds } } });
});

describeComBanco("protocolo e exame com PostgreSQL", () => {
  it("agendar uma etapa não consome estoque; o exame realizado resolve a tarefa", async () => {
    const propriedade = await prisma.propriedade.create({ data: { nome: `Pec V3 protocolo ${run}` } });
    propriedadeIds.push(propriedade.id);
    const animal = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `PR${run}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE",
      dataNascimento: "2024-01-01", dataEntrada: "2026-08-01", propriedadeId: propriedade.id }), null);
    animalIds.push(animal.id);
    const tipo = await criarTipoExame({ nome: `Exame V3 ${run}`, tipoResultado: "OPCAO", opcoes: ["NEGATIVO", "POSITIVO"] }, null);
    tipoIds.push(tipo.id);
    const protocolo = await criarProtocolo({ nome: `Protocolo V3 ${run}`, etapas: [{ tipo: "EXAME", diaRelativo: 0, tipoExameId: tipo.id }] }, null);
    protocoloIds.push(protocolo.id);
    await publicarProtocolo(protocolo.id, null);
    const antes = await prisma.movimentoEstoque.count();
    const data = hojeFazenda();
    const execucao = await iniciarExecucao({ protocoloId: protocolo.id, animalId: animal.id, propriedadeId: propriedade.id, inicio: data }, null);
    execucaoIds.push(execucao.id);
    expect(execucao.tarefas).toHaveLength(1);
    expect((await listarTarefas(propriedade.id, animal.id))[0].situacao).toBe("PENDENTE");
    expect(await prisma.movimentoEstoque.count()).toBe(antes);
    await registrarExame({ animalId: animal.id, propriedadeId: propriedade.id, tipoExameId: tipo.id, data,
      resultadoOpcao: "NEGATIVO", tarefaId: execucao.tarefas[0].id }, null);
    expect((await listarTarefas(propriedade.id, animal.id))[0].situacao).toBe("REALIZADA");
    expect(await prisma.movimentoEstoque.count()).toBe(antes);
  });
});
