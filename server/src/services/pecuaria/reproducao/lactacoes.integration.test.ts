import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { registrarLactacaoHistorica } from "./lactacoes.js";

const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
suite("lactação histórica sem fabricar parto", () => {
  let sitio: number;
  let animalId: string;
  beforeAll(async () => {
    exigirBancoIntegracaoPecuaria();
    const propriedade = await prisma.propriedade.create({ data: { nome: `Histórico lactação ${randomUUID()}` } });
    sitio = propriedade.id;
    const animal = await prisma.animal.create({ data: {
      brinco: `LH-${randomUUID()}`, sexo: "F", origem: "COMPRADO",
      dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2024-01-01"),
      localizacoes: { create: { propriedadeId: sitio, desde: new Date("2024-01-01") } },
      destinos: { create: { aptidao: "LEITE", desde: new Date("2024-01-01") } },
    } });
    animalId = animal.id;
  });
  afterAll(async () => {
    if (!sitio) return;
    await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId: sitio } });
    await prisma.auditoriaPecuaria.deleteMany({ where: { propriedadeId: sitio } });
    if (animalId) {
      await prisma.lactacaoAnimal.deleteMany({ where: { animalId } });
      await prisma.destinoAnimal.deleteMany({ where: { animalId } });
      await prisma.localizacaoAnimal.deleteMany({ where: { animalId } });
      await prisma.animal.delete({ where: { id: animalId } });
    }
    await prisma.propriedade.delete({ where: { id: sitio } });
  });
  it("registra intervalo conhecido e recupera reenvio sem novo parto ou lactação", async () => {
    const input = { chave: randomUUID(), animalId, propriedadeId: sitio,
      inicio: "2025-01-01", encerradaEm: "2025-06-01", motivo: "Histórico confirmado na ficha da matriz" };
    const primeira = await registrarLactacaoHistorica(input, null);
    expect((await registrarLactacaoHistorica(input, null)).id).toBe(primeira.id);
    expect(primeira).toMatchObject({ partoId: null, origem: "HISTORICO_INFORMADO" });
    expect(await prisma.lactacaoAnimal.count({ where: { animalId } })).toBe(1);
    expect(await prisma.partoAnimal.count({ where: { animalId } })).toBe(0);
    expect(await prisma.auditoriaPecuaria.count({ where: { entidadeId: primeira.id, acao: "HISTORICO_INFORMADO" } })).toBe(1);
    await expect(registrarLactacaoHistorica({ ...input, motivo: "Conteúdo diferente para a mesma chave" }, null))
      .rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("recusa sobreposição sem alterar o intervalo conhecido", async () => {
    await expect(registrarLactacaoHistorica({ chave: randomUUID(), animalId, propriedadeId: sitio,
      inicio: "2025-03-01", encerradaEm: "2025-07-01", motivo: "Tentativa de período sobreposto" }, null))
      .rejects.toMatchObject({ code: "VALIDACAO" });
    expect(await prisma.lactacaoAnimal.count({ where: { animalId } })).toBe(1);
  });
  it("recusa local na data incompatível e encerramento anterior ao início", async () => {
    for (const intervalo of [
      { inicio: "2023-10-01", encerradaEm: "2023-12-01" },
      { inicio: "2025-10-01", encerradaEm: "2025-09-01" },
    ]) await expect(registrarLactacaoHistorica({ chave: randomUUID(), animalId, propriedadeId: sitio,
      ...intervalo, motivo: "Preenchimento de histórico recebido" }, null)).rejects.toThrow();
    expect(await prisma.lactacaoAnimal.count({ where: { animalId } })).toBe(1);
  });
});
