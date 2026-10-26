import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { obterElegibilidadesNaDataTx } from "./elegibilidade.js";
import { vincularPoliticaCicloTx } from "./elegibilidade.js";
import { criarEmissaoReprodutivaSchema, criarEmissaoReprodutivaTx } from "./emissoes-relatorios.js";
import { consultarIndicadoresReprodutivosTx } from "./indicadores.js";

const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const dia = (valor: string) => new Date(`${valor}T00:00:00.000Z`);
const rollback = new Error("ROLLBACK_FIXTURES_ELEGIBILIDADE_RELATORIOS");

async function emRollback(executar: (tx: Prisma.TransactionClient) => Promise<void>) {
  const bancoEsperado = exigirBancoIntegracaoPecuaria();
  try {
    await prisma.$transaction(async tx => {
      const banco = await tx.$queryRaw<Array<{ db: string }>>`SELECT current_database()::text AS db`;
      if (banco[0]?.db !== bancoEsperado) throw new Error("Conexão não está no banco permitido");
      await executar(tx);
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      throw rollback;
    }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (erro) {
    if (erro !== rollback) throw erro;
  }
}

const parametros = {
  versao: 1 as const,
  metodologia: "IDEAGRI_IILB_BASE_V1" as const,
  pevPrimiparasDias: 0,
  pevMultiparasDias: 0,
  aborto: "PEV_CONFIGURADO" as const,
  pevAposAbortoDias: 0,
  descarte: "EXCLUIR" as const,
  restricoes: "EXCLUIR" as const,
  perdaGestacional: "EXIGE_LIBERACAO" as const,
  papeisIncluidos: ["NENHUM"] as const,
};

async function animalFixture(tx: Prisma.TransactionClient) {
  const propriedade = await tx.propriedade.create({ data: { nome: `Integração A9 ${randomUUID()}` } });
  const animal = await tx.animal.create({ data: {
    brinco: `A9-${randomUUID()}`, sexo: "F", origem: "COMPRADO", dataNascimento: dia("2020-01-01"), dataEntrada: dia("2024-01-01"),
    localizacoes: { create: { propriedadeId: propriedade.id, desde: dia("2024-01-01") } },
    papeisReprodutivos: { create: { tipo: "NENHUM", inicio: dia("2024-01-01"), origem: "MANUAL" } },
  } });
  return { propriedade, animal };
}

suite("integração local — elegibilidade e emissões com rollback", () => {
  it("congela a política do ciclo, mantém gestante inelegível e usa liberação explícita após perda", async () => {
    await emRollback(async tx => {
      const { propriedade, animal } = await animalFixture(tx);
      const inicial = await tx.situacaoInicialReprodutiva.create({ data: {
        animalId: animal.id, propriedadeId: propriedade.id, data: dia("2025-01-01"), situacao: "APTA", aptaDesde: dia("2025-01-01"),
      } });
      const politicaInicial = await tx.politicaElegibilidadeReprodutiva.create({ data: {
        propriedadeId: propriedade.id, versao: 1, vigenteDesde: dia("2025-01-01"), parametros,
      } });
      const ciclo = await vincularPoliticaCicloTx(tx, {
        animalId: animal.id, propriedadeId: propriedade.id, situacaoInicialId: inicial.id,
      }, null);
      expect(ciclo.politicaId).toBe(politicaInicial.id);

      const politicaPosterior = await tx.politicaElegibilidadeReprodutiva.create({ data: {
        propriedadeId: propriedade.id, versao: 2, vigenteDesde: dia("2025-02-01"), parametros: { ...parametros, pevPrimiparasDias: 50 },
      } });
      expect(politicaPosterior.id).not.toBe(politicaInicial.id);
      expect((await vincularPoliticaCicloTx(tx, {
        animalId: animal.id, propriedadeId: propriedade.id, situacaoInicialId: inicial.id,
      }, null)).politicaId).toBe(politicaInicial.id);

      await tx.gestacaoAnimal.create({ data: {
        animalId: animal.id, propriedadeId: propriedade.id, confirmadaEm: dia("2025-01-15"),
        encerradaEm: dia("2025-02-10"),tipoEncerramento:"PERDA", motivoEncerramento: "PERDA_GESTACIONAL",
      } });
      const duranteGestacao = await obterElegibilidadesNaDataTx(tx, [animal.id], propriedade.id, dia("2025-02-01"));
      expect(duranteGestacao.get(animal.id)).toMatchObject({ estado: "NAO_ELEGIVEL", politicaId: politicaInicial.id });
      expect(duranteGestacao.get(animal.id)?.motivos).toContain("GESTACAO_CONFIRMADA");

      const decisao = await tx.decisaoElegibilidadeCiclo.create({ data: {
        vinculoCicloId: ciclo.id, data: dia("2025-02-11"), tipo: "LIBERAR", aptaDesde: dia("2025-02-11"), motivo: "Perda confirmada e liberação revisada",
      } });
      const aposLiberacao = await obterElegibilidadesNaDataTx(tx, [animal.id], propriedade.id, dia("2025-02-11"));
      expect(aposLiberacao.get(animal.id)).toMatchObject({
        estado: "ELEGIVEL", politicaId: politicaInicial.id, politicaVersao: 1, decisaoId: decisao.id, aptaDesde: "2025-02-11",
      });
    });
  });

  it("exclui gestante sem política da pendência e calcula liberação intraperíodo proporcional", async () => {
    await emRollback(async tx => {
      const { propriedade, animal: gestante } = await animalFixture(tx);
      await tx.gestacaoAnimal.create({ data: {
        animalId: gestante.id, propriedadeId: propriedade.id, confirmadaEm: dia("2026-01-01"),
      } });

      const liberada = await tx.animal.create({ data: {
        brinco: `PEV-${randomUUID()}`, sexo: "F", origem: "COMPRADO", dataNascimento: dia("2020-01-01"), dataEntrada: dia("2024-01-01"),
        localizacoes: { create: { propriedadeId: propriedade.id, desde: dia("2024-01-01") } },
        papeisReprodutivos: { create: { tipo: "NENHUM", inicio: dia("2024-01-01"), origem: "MANUAL" } },
      } });
      const parto = await tx.partoAnimal.create({ data: {
        animalId: liberada.id, propriedadeId: propriedade.id, data: dia("2026-01-01"), tipo: "NASCIMENTO", desfecho: "NASCIMENTO",
      } });
      const politica = await tx.politicaElegibilidadeReprodutiva.create({ data: {
        propriedadeId: propriedade.id, versao: 1, vigenteDesde: dia("2025-01-01"), parametros: { ...parametros, pevPrimiparasDias: 19 },
      } });
      const vinculo = await vincularPoliticaCicloTx(tx, { animalId: liberada.id, propriedadeId: propriedade.id, partoId: parto.id }, null);
      expect(vinculo.politicaId).toBe(politica.id);
      await tx.decisaoElegibilidadeCiclo.create({ data: {
        vinculoCicloId: vinculo.id, data: dia("2026-01-10"), tipo: "LIBERAR", aptaDesde: dia("2026-01-10"), motivo: "Liberação individual revisada",
      } });

      const snapshot = await consultarIndicadoresReprodutivosTx(tx, {
        propriedadeId: propriedade.id, inicio: "2026-01-01", fim: "2026-01-21", corte: "2026-02-01", deslocamentoTeDias: 7,
      });
      const periodo = snapshot.periodos[0];
      const detalheGestante = periodo.detalhamento.find(d => d.animalId === gestante.id)!;
      expect(detalheGestante).toMatchObject({ origemElegibilidade: "EXCLUIDA", contribuicaoElegiveis: 0 });
      expect(detalheGestante.motivos).toContain("GESTACAO_CONFIRMADA_NO_INICIO");
      expect(detalheGestante.motivos).not.toContain("POLITICA_CICLO_NAO_CONGELADA");
      expect(periodo.contagens.animaisComPendenciaElegibilidade).toBe(0);

      const detalheLiberacao = periodo.detalhamento.find(d => d.animalId === liberada.id)!;
      expect(detalheLiberacao.origemElegibilidade).toBe("SAIDA_PEV");
      expect(detalheLiberacao.contribuicaoElegiveis).toBeCloseTo(12 / 21, 10);
      expect(periodo.contagens.contribuicaoPev).toBeCloseTo(12 / 21, 10);
      expect(snapshot.metodologia).toMatchObject({ rotulo: "Base IDEAGRI/IILB — metodologia Fazendinha v2 (base válida)" });
    });
  });

  it("emite PARTOS e INDICADORES de forma idempotente e preserva o snapshot após mudar a origem", async () => {
    await emRollback(async tx => {
      const { propriedade, animal } = await animalFixture(tx);
      const parto = await tx.partoAnimal.create({ data: {
        animalId: animal.id, propriedadeId: propriedade.id, data: dia("2026-01-10"), tipo: "NASCIMENTO", desfecho: "NASCIMENTO",
        retencaoPlacenta: true, responsavel: "Equipe de campo", observacao: "Registro original", criadoPorId: null,
      } });
      const chavePartos = randomUUID();
      const entradaPartos = criarEmissaoReprodutivaSchema.parse({
        chave: chavePartos, propriedadeId: propriedade.id, tipo: "PARTOS", filtros: { inicio: "2026-01-01", fim: "2026-01-31" },
      });
      const emissaoPartos = await criarEmissaoReprodutivaTx(tx, entradaPartos, null);
      expect(emissaoPartos.snapshot).toMatchObject({ totalPartos: 1, partos: [expect.objectContaining({ id: parto.id, retencaoPlacenta: true, observacao: "Registro original" })] });

      await tx.partoAnimal.update({ where: { id: parto.id }, data: { retencaoPlacenta: false, observacao: "Correção posterior", versao: { increment: 1 } } });
      const reenvioPartos = await criarEmissaoReprodutivaTx(tx, entradaPartos, null);
      expect(reenvioPartos.id).toBe(emissaoPartos.id);
      expect(reenvioPartos.snapshot).toEqual(emissaoPartos.snapshot);
      expect(await tx.snapshotRelatorioReprodutivo.findUniqueOrThrow({ where: { id: emissaoPartos.id } })).toMatchObject({
        snapshot: expect.objectContaining({ partos: [expect.objectContaining({ retencaoPlacenta: true, observacao: "Registro original" })] }),
      });
      const novaEmissaoPartos = await criarEmissaoReprodutivaTx(tx, { ...entradaPartos, chave: randomUUID() }, null);
      expect(novaEmissaoPartos.snapshot).toMatchObject({ partos: [expect.objectContaining({ retencaoPlacenta: false, observacao: "Correção posterior" })] });

      const entradaIndicadores = criarEmissaoReprodutivaSchema.parse({
        chave: randomUUID(), propriedadeId: propriedade.id, tipo: "INDICADORES",
        filtros: { inicio: "2026-01-01", fim: "2026-01-21", corte: "2026-03-01" },
      });
      const emissaoIndicadores = await criarEmissaoReprodutivaTx(tx, entradaIndicadores, null);
      const reconfirmada = await criarEmissaoReprodutivaTx(tx, entradaIndicadores, null);
      expect(reconfirmada.id).toBe(emissaoIndicadores.id);
      expect(reconfirmada.snapshot).toEqual(emissaoIndicadores.snapshot);
      expect(emissaoIndicadores.snapshot).toMatchObject({ versaoMetodologia: "FAZENDINHA_IDEAGRI_IILB_V2_BASE_VALIDA" });
    });
  });
});
