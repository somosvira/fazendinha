import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { criarAplicacao, anularAplicacao, carenciaAnimal } from "./aplicacoes.js";
import { substituirEvidenciaAplicacaoTx, validarSubstitutoTx } from "../reproducao/regularizacao.js";
const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const animais: string[] = [], propriedades: number[] = [];
afterAll(async () => {
  if (!animais.length) return;
  const ids = { in: animais };
  await prisma.auditoriaPecuaria.deleteMany({ where: { animalId: ids } });
  await prisma.vinculoTarefaProtocolo.deleteMany({ where: { aplicacao: { animalId: ids } } }); await prisma.aplicacaoProduto.deleteMany({ where: { animalId: ids } });
  await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId: { in: propriedades } } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: ids } });
  await prisma.periodoReprodutivoAnimal.deleteMany({ where: { animalId: ids } }); await prisma.destinoAnimal.deleteMany({ where: { animalId: ids } });
  await prisma.animal.deleteMany({ where: { id: ids } });
  await prisma.propriedade.deleteMany({ where: { id: { in: propriedades } } });
});
suite("consumo anulado conserva evidência de administração sem presumir aplicação", () => {
  it.each([true, false, null])("administração %s mantém a carência correspondente e o consumo", async administracao => {
    const sitio = await prisma.propriedade.create({ data: { nome: `QA-consumo-${randomUUID()}` } });
    propriedades.push(sitio.id);
    const animal = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `QA-${randomUUID().slice(0,8)}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE", dataNascimento: "2024-01-01", dataEntrada: "2026-01-01", propriedadeId: sitio.id }), null);
    animais.push(animal.id);
    const input = { animalId: animal.id, propriedadeId: sitio.id, data: "2026-09-01", aplicadaEm: "2026-09-01T12:00:00Z", origemInsumo: "SEM_ORIGEM_JUSTIFICADA" as const, justificativaSemOrigem: "Registro documentado no cenário de teste", nomeProdutoAplicado: "Medicamento QA", dose: "2", unidadeDose: "ML" as const, estadoCarenciaLeite: "INFORMADO" as const, estadoCarenciaCarne: "INFORMADO" as const, carenciaLeiteHoras: 24, carenciaCarneHoras: 48 };
    const app = await criarAplicacao(input, null);
    const antes = await carenciaAnimal(animal.id, sitio.id);
    expect(antes.carne.estado).toBe("CONHECIDO");
    await anularAplicacao(app.id, sitio.id, "Revisão explícita do lançamento e do destino físico", null, "MANTER_CONSUMO", administracao);
    const depois = await carenciaAnimal(animal.id, sitio.id);
    expect((await prisma.aplicacaoProduto.findUniqueOrThrow({ where: { id: app.id } })).consumoMantido).toBe(true);
    if (administracao === true) expect(depois.carne).toEqual(antes.carne);
    else if (administracao === false) expect(depois.carne.estado).toBe("NENHUMA");
    else {
      expect(depois.carne.estado).toBe("NAO_INFORMADO");
      expect(depois.leite.estado).toBe("NAO_INFORMADO");
      const substituto = await criarAplicacao({ ...input, carenciaCarneHoras: 72 }, null);
      const regularizacao = { propriedadeId: sitio.id, chave: randomUUID(), motivo: "Substituto documentado confirma os dados efetivos", acao: "VINCULAR_SUBSTITUTO" as const, fatoId: substituto.id };
      await prisma.$transaction(async tx => {
        await validarSubstitutoTx(tx, "AplicacaoProduto", regularizacao, animal.id, new Date(input.data));
        await substituirEvidenciaAplicacaoTx(tx, app.id, regularizacao, null);
      });
      expect((await carenciaAnimal(animal.id, sitio.id)).carne.estado).toBe("CONHECIDO");
      expect(await prisma.movimentoEstoque.count({ where: { propriedadeId: sitio.id } })).toBe(0);
    }
  });
});
