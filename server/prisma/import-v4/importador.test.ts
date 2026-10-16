import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/db.js";
import { cargaSchema, mapeamentoSchema } from "./contrato.js";
import { importarV4 } from "./importador.js";
const habilitado = process.env.PECUARIA_DB_INTEGRATION === "1";
const token = randomUUID();
const ideias = 600000000 + Math.floor(Math.random() * 100000000);
function carga(animalIdeagriId: number) {
  return cargaSchema.parse({
    versao: 4,
    origem: "IDEAGRI",
    sha256: "a".repeat(64),
    animais: [{ id: String(animalIdeagriId), partosAntesEntrada: "0" }],
    fatos: [
      {
        origem: "IDEAGRI",
        chaveExterna: "REPRODUCAO:1",
        tipo: "IA",
        animalIdeagriId,
        data: "2024-02-01",
        hora: null,
        tentativaChave: null,
        resultado: null,
        desfecho: null,
        desfechoOriginal: null,
        contaParidade: false,
        anteriorEntrada: false,
        quantidade: null,
        criasComReferencia: [],
        snapshot: {
          id: "1",
          animal: String(animalIdeagriId),
          reprodutor: null,
        },
      },
      {
        origem: "IDEAGRI",
        chaveExterna: "REPRODUCAO:2",
        tipo: "DIAGNOSTICO",
        animalIdeagriId,
        data: "2024-03-01",
        hora: null,
        tentativaChave: "REPRODUCAO:1",
        resultado: "POSITIVO",
        desfecho: null,
        desfechoOriginal: null,
        contaParidade: false,
        anteriorEntrada: false,
        quantidade: null,
        criasComReferencia: [],
        snapshot: {
          id: "2",
          animal: String(animalIdeagriId),
          diagnostico: "P",
        },
      },
      {
        origem: "IDEAGRI",
        chaveExterna: "REPRODUCAO:3",
        tipo: "PARTO",
        animalIdeagriId,
        data: "2024-11-01",
        hora: null,
        tentativaChave: null,
        resultado: null,
        desfecho: "ABORTO",
        desfechoOriginal: "Aborto",
        contaParidade: true,
        anteriorEntrada: false,
        quantidade: null,
        criasComReferencia: [],
        snapshot: { id: "3", animal: String(animalIdeagriId) },
      },
    ],
    lactacoes: [],
    periodos: [],
    programacoes: [],
    participacoes: [],
    protocolos: [],
    etapas: [],
    catalogos: { tiposParto: [], motivosSecagem: [] },
    relatorio: {
      totais: { REPRODUCAO: 3 },
      porTipo: { IA: 1, DIAGNOSTICO: 1, PARTO: 1 },
      pendencias: [],
    },
  });
}
describe.runIf(habilitado)("carga técnica V4 em banco descartável", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });
  it("prévia não escreve; carga/repetição preservam fatos, origem, ausência de local/estoque e vínculo diagnóstico", async () => {
    const autor = await prisma.usuario.create({
      data: {
        nome: `Importação ${token}`,
        email: `import-${token}@example.test`,
        papel: "DONO",
        status: "ATIVO",
      },
    });
    const animal = await prisma.animal.create({
      data: {
        ideagriId: ideias,
        brinco: `IV4-${token}`,
        sexo: "F",
        dataNascimento: new Date("2020-01-01"),
        dataEntrada: new Date("2024-01-01"),
        origem: "COMPRADO",
      },
    });
    const dados = carga(ideias),
      mapa = mapeamentoSchema.parse({
        bancoOrigem: `TESTE-${token}`,
        autorId: autor.id,
      });
    const estoqueAntes = await prisma.movimentoEstoque.count();
    const previa = await importarV4(prisma, dados, mapa);
    expect(previa.planejados).toBe(3);
    expect(previa.importados).toBe(0);
    expect(
      await prisma.tentativaReprodutiva.count({
        where: { animalId: animal.id },
      }),
    ).toBe(0);
    const primeira = await importarV4(prisma, dados, mapa, true);
    expect(primeira.conflitos).toEqual([]);
    expect(primeira.importados).toBe(3);
    const segunda = await importarV4(prisma, dados, mapa, true);
    expect(segunda.importados).toBe(0);
    expect(segunda.existentes).toBe(3);
    const tentativa = await prisma.tentativaReprodutiva.findFirstOrThrow({
      where: { animalId: animal.id },
    });
    expect(tentativa.propriedadeId).toBeNull();
    expect(tentativa.quantidade).toBeNull();
    expect(tentativa.origemMaterial).toBe("HISTORICO");
    expect(tentativa.movimentoEstoqueId).toBeNull();
    const avaliacao = await prisma.avaliacaoReprodutiva.findFirstOrThrow({
      where: { animalId: animal.id },
    });
    expect(avaliacao.tentativaId).toBe(tentativa.id);
    expect(avaliacao.gestacaoId).toBeNull();
    expect(
      await prisma.gestacaoAnimal.count({ where: { animalId: animal.id } }),
    ).toBe(0);
    expect(await prisma.movimentoEstoque.count()).toBe(estoqueAntes);
    dados.fatos[0].quantidade = "2";
    const conflito = await importarV4(prisma, dados, mapa, true);
    expect(conflito.conflitos.some((c) => c.motivo.includes("diverge"))).toBe(
      true,
    );
    expect(
      (
        await prisma.tentativaReprodutiva.findUniqueOrThrow({
          where: { id: tentativa.id },
        })
      ).quantidade,
    ).toBeNull();
  }, 30000);
  it("bloqueia parto anterior sem decisão de saldo; decisão explícita não altera saldo do animal", async () => {
    const autor = await prisma.usuario.findFirstOrThrow({
      where: { email: `import-${token}@example.test` },
    });
    const animal = await prisma.animal.create({
      data: {
        ideagriId: ideias + 1,
        brinco: `IV4-saldo-${token}`,
        sexo: "F",
        dataNascimento: new Date("2020-01-01"),
        dataEntrada: new Date("2025-01-01"),
        origem: "COMPRADO",
        partosAntesDaEntrada: 2,
      },
    });
    const dados = carga(ideias + 1);
    dados.fatos = dados.fatos.filter((f) => f.tipo === "PARTO");
    dados.fatos[0].anteriorEntrada = true;
    dados.animais[0].partosAntesEntrada = "2";
    const mapa = mapeamentoSchema.parse({
      bancoOrigem: `SALDO-${token}`,
      autorId: autor.id,
    });
    expect(
      (await importarV4(prisma, dados, mapa, true)).conflitos[0].motivo,
    ).toContain("saldo");
    expect(
      await prisma.partoAnimal.count({ where: { animalId: animal.id } }),
    ).toBe(0);
    mapa.saldoAnteriorPorParto["REPRODUCAO:3"] = true;
    expect((await importarV4(prisma, dados, mapa, true)).conflitos).toEqual([]);
    expect(
      (
        await prisma.partoAnimal.findFirstOrThrow({
          where: { animalId: animal.id },
        })
      ).incluidoSaldoAnterior,
    ).toBe(true);
    expect(
      (await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } }))
        .partosAntesDaEntrada,
    ).toBe(2);
  }, 30000);
});
it("contrato exige fonte, autoria e quantidades com ausência explícita", () => {
  expect(() => mapeamentoSchema.parse({ bancoOrigem: "IDEAGRI" })).toThrow();
  expect(carga(1).fatos[0].quantidade).toBeNull();
});
