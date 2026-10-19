import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { transacaoValidada } from "../../../lib/transacao-validada.js";
import { painelReproducao } from "./registros.js";

const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const sitios: number[] = [], animais: string[] = [];
const dia = (s: string) => new Date(`${s}T00:00:00Z`);

suite("painel reprodutivo — identidade histórica com fixtures próprias", () => {
  afterEach(async () => {
    if (!sitios.length && !animais.length) return;
    await transacaoValidada(async tx => {
      await tx.gestacaoAnimal.deleteMany({ where: { animalId: { in: animais } } });
      await tx.localizacaoAnimal.deleteMany({ where: { animalId: { in: animais } } });
      await tx.animal.deleteMany({ where: { id: { in: animais } } });
      await tx.propriedade.deleteMany({ where: { id: { in: sitios } } });
    });
    sitios.length = 0; animais.length = 0;
  });

  it("identifica perda no sítio do fato após transferência, sem incluir matriz na população atual", async () => {
    exigirBancoIntegracaoPecuaria();
    for (const nome of ["Origem", "Destino"]) {
      const s = await prisma.propriedade.create({ data: { nome: `QA painel ${nome} ${randomUUID()}` } });
      sitios.push(s.id);
    }
    const animal = await prisma.animal.create({ data: { brinco: `QA-${randomUUID()}`, nome: "Matriz transferida", sexo: "F", origem: "COMPRADO", dataNascimento: dia("2020-01-01"), dataEntrada: dia("2025-01-01") } });
    animais.push(animal.id);
    await transacaoValidada(async tx => {
      await tx.localizacaoAnimal.createMany({ data: [
        { animalId: animal.id, propriedadeId: sitios[0], desde: dia("2025-01-01"), ate: dia("2026-02-01") },
        { animalId: animal.id, propriedadeId: sitios[1], desde: dia("2026-02-01") },
      ] });
      await tx.gestacaoAnimal.create({ data: { animalId: animal.id, propriedadeId: sitios[0], confirmadaEm: dia("2026-01-01"), encerradaEm: dia("2026-01-20"), tipoEncerramento: "PERDA", motivoEncerramento: "Observação demonstrativa; causa não identificada", causaClinica: { estado: "DESCONHECIDA", evidencias: ["Referência demonstrativa 42"] } } });
    });
    const origem = await painelReproducao(sitios[0]);
    expect(origem.animais).toEqual([]);
    expect(origem.gestacoes).toHaveLength(1);
    expect(origem.gestacoes[0]).toMatchObject({ animalId: animal.id, animal: { id: animal.id, brinco: animal.brinco, nome: animal.nome }, causaClinica: { evidencias: ["Referência demonstrativa 42"] } });
    const individual = await painelReproducao(sitios[0], animal.id);
    expect(individual.gestacoes).toEqual(origem.gestacoes);
    const destino = await painelReproducao(sitios[1]);
    expect(destino.animais.map(a => a.animalId)).toEqual([animal.id]);
    expect(destino.gestacoes).toEqual([]);
  });
  it("consulta ficha histórica sem fatos sem incluir matriz na população atual e sem ampliar sítio", async () => {
    exigirBancoIntegracaoPecuaria();
    for (const nome of ["Histórico", "Sem vínculo"]) {
      const sitio = await prisma.propriedade.create({ data: { nome: `QA painel ${nome} ${randomUUID()}` } });
      sitios.push(sitio.id);
    }
    const animal = await prisma.animal.create({ data: { brinco: `QA-${randomUUID()}`, sexo: "F", origem: "COMPRADO", dataNascimento: dia("2020-01-01"), dataEntrada: dia("2025-01-01") } });
    animais.push(animal.id);
    await prisma.localizacaoAnimal.create({ data: { animalId: animal.id, propriedadeId: sitios[0], desde: dia("2025-01-01"), ate: dia("2025-02-01") } });
    const painel = await painelReproducao(sitios[0], animal.id);
    expect(painel.animais).toEqual([]);
    expect(painel.tentativas).toEqual([]);
    expect(painel.avaliacoes).toEqual([]);
    expect(painel.partos).toEqual([]);
    await expect(painelReproducao(sitios[1], animal.id)).rejects.toThrow("Animal não encontrado neste sítio");
    expect((await painelReproducao(sitios[0])).animais).toEqual([]);
  });

});
