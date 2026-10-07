import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { hojeFazenda } from "../rebanho/regras.js";
import { anularManejo, listarManejos, registrarManejo, registrarPesagensColetivas } from "./manejo.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const propriedades: number[] = [];
const animais: string[] = [];
const chaves: string[] = [];

afterAll(async () => {
  if (!propriedades.length) return;
  await prisma.auditoriaPecuaria.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.manejoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.pesagem.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.requisicaoPecuaria.deleteMany({ where: { chave: { in: chaves } } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.animal.deleteMany({ where: { id: { in: animais } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: propriedades } } });
});

describeComBanco("manejo e pesagem coletiva com PostgreSQL", () => {
  it("salva o coletivo atomicamente e reenvio com a mesma chave não duplica pesos", async () => {
    const propriedade = await prisma.propriedade.create({ data: { nome: `Pec V3 manejo ${run}` } });
    propriedades.push(propriedade.id);
    for (const sexo of ["F", "M"] as const) {
      const a = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `M${sexo}${run}`, sexo, origem: "COMPRADO", aptidao: "LEITE",
        dataNascimento: "2024-01-01", dataEntrada: "2026-08-01", propriedadeId: propriedade.id }), null);
      animais.push(a.id);
    }
    const chave = crypto.randomUUID(); chaves.push(chave);
    const entrada = { chave, propriedadeId: propriedade.id, data: hojeFazenda(), tipo: "ROTINA" as const, origem: "BALANCA" as const,
      itens: [{ animalId: animais[0], pesoKg: 420.5 }, { animalId: animais[1], pesoKg: 390.25 }] };
    const primeira = await registrarPesagensColetivas(entrada, null);
    const segunda = await registrarPesagensColetivas(entrada, null);
    expect(primeira.pesagens).toEqual(segunda.pesagens);
    expect(await prisma.pesagem.count({ where: { requisicaoId: chave } })).toBe(2);
    await expect(registrarManejo({ animalId: animais[0], propriedadeId: propriedade.id, data: hojeFazenda(), tipo: "CASTRACAO" }, null)).rejects.toThrow(/macho/);
    const chaveManejo = crypto.randomUUID(); chaves.push(chaveManejo);
    const inputManejo = { chave: chaveManejo, animalId: animais[1], propriedadeId: propriedade.id, data: hojeFazenda(), tipo: "CASTRACAO" as const, pesoKg: 390.25 };
    const registrado = await registrarManejo(inputManejo, null);
    expect((await registrarManejo(inputManejo, null)).id).toBe(registrado.id);
    expect((await listarManejos(animais[1], propriedade.id))[0].tipo).toBe("CASTRACAO");
    const anulado = await anularManejo(registrado.id, propriedade.id, "Manejo lançado por engano", null);
    expect(anulado.pesagemId).toBeNull();
    expect(await prisma.pesagem.findUnique({ where: { id: registrado.pesagemId! } })).toBeTruthy();
    expect((await registrarManejo(inputManejo, null)).id).toBe(registrado.id);
  });
});
