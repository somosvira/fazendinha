import { registrarRetiradaDispositivoTx } from "../retirada-dispositivo.js";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../../lib/banco-pecuaria-integration.fixture.js";
import { reconciliarAlertasReprodutivosAnimalTx } from "./produtor.js";
import {
  conferirImpactosTx,
  aplicarImpactosTx,
  previaImpactosTx,
} from "../impactos.js";
import { criarOcorrenciaTx } from "../../sanidade/ocorrencias.js";
import { executarAutomacaoTx } from "../../protocolos/automacao.js";
const banco =
  process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const rollback = new Error("ROLLBACK_APENAS_FIXTURES_P4");
async function isolado(
  executar: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  exigirBancoIntegracaoPecuaria();
  await expect(
    prisma.$transaction(
      async (tx) => {
        await executar(tx);
        await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
        throw rollback;
      },
      { timeout: 30000 },
    ),
  ).rejects.toBe(rollback);
}
async function fixture(tx: Prisma.TransactionClient) {
  const marca = `qa-p4-${randomUUID()}`;
  const sitio = await tx.propriedade.create({ data: { nome: marca } });
  const usuario = await tx.usuario.create({
    data: {
      nome: marca,
      email: `${marca}@example.test`,
      papel: "proprietario",
      dono: true,
      status: "ATIVO",
      abas: [],
      flags: [],
    },
  });
  const animal = await tx.animal.create({
    data: {
      brinco: marca,
      sexo: "F",
      origem: "COMPRADO",
      dataNascimento: dia("2023-01-01"),
      dataEntrada: dia("2024-01-01"),
      localizacoes: {
        create: { propriedadeId: sitio.id, desde: dia("2024-01-01") },
      },
    },
  });
  const outro = await tx.animal.create({
    data: {
      brinco: `${marca}-outro`,
      sexo: "F",
      origem: "COMPRADO",
      dataNascimento: dia("2023-01-01"),
      dataEntrada: dia("2024-01-01"),
    },
  });
  const doenca = await tx.doenca.create({ data: { nome: marca } });
  const protocolo = await tx.protocolo.create({
    data: {
      nome: marca,
      tipo: "REPRODUTIVO",
      finalidade: "IATF",
      modalidadeTentativa: "EXTERNA",
      modalidadeDiagnostico: "EXTERNO",
    },
  });
  const momento = await tx.momentoProtocolo.create({
    data: { protocoloId: protocolo.id, nome: "D0", ordem: 1 },
  });
  const etapa = await tx.etapaProtocolo.create({
    data: {
      protocoloId: protocolo.id,
      momentoId: momento.id,
      nome: "Retirada",
      ordem: 1,
      diaRelativo: 0,
      tipo: "RETIRADA",
      configuracao: { tipo: "RETIRADA" },
    },
  });
  const participacao = await tx.participacaoProtocolo.create({
    data: {
      protocoloId: protocolo.id,
      animalId: animal.id,
      propriedadeId: sitio.id,
      inicio: dia("2026-11-01"),
    },
  });
  const tarefa = await tx.tarefaProtocolo.create({
    data: {
      execucaoId: participacao.id,
      etapaId: etapa.id,
      previstaPara: dia("2026-11-01"),
      momentoSnapshot: { id: momento.id },
    },
  });
  const job = await tx.automacaoProtocolo.create({
    data: {
      participacaoId: participacao.id,
      momentoId: momento.id,
      propriedadeId: sitio.id,
      usuarioId: usuario.id,
      programadaPara: dia("2026-11-01"),
      configuracao: {},
    },
  });
  return {
    sitio,
    usuario,
    animal,
    outro,
    doenca,
    protocolo,
    momento,
    etapa,
    participacao,
    tarefa,
    job,
  };
}
banco(
  "P4 — integridade SQL e atomicidade, fixtures próprias revertidas",
  () => {
    it("decisão exige motivo/autoria/data/destino e tarefa do mesmo animal", () =>
      isolado(async (tx) => {
        const f = await fixture(tx);
        const dados = {
          chave: `TAREFA:${f.tarefa.id}`,
          tipo: "ETAPA_VENCIDA",
          origemId: f.tarefa.id,
          animalId: f.animal.id,
          propriedadeId: f.sitio.id,
          tarefaId: f.tarefa.id,
          participacaoId: f.participacao.id,
          dataReferencia: dia("2026-11-01"),
          previstaPara: dia("2026-11-01"),
          regraSnapshot: {},
          situacao: "PENDENTE",
          motivo: "Sem atendimento registrado",
        };
        await tx.$executeRaw`SAVEPOINT decisao_invalida`;
        await expect(
          tx.necessidadeReprodutiva.create({
            data: {
              ...dados,
              decisao: "SUSPENDER",
              decisaoPorId: f.usuario.id,
              decisaoMotivo: "Revisão com responsável",
            },
          }),
        ).rejects.toThrow();
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT decisao_invalida`;
        await tx.$executeRaw`SAVEPOINT animal_invalido`;
        await expect(
          tx.necessidadeReprodutiva.create({
            data: { ...dados, animalId: f.outro.id },
          }),
        ).rejects.toThrow();
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT animal_invalido`;
        await tx.$executeRaw`SAVEPOINT motivo_nulo`;
        await expect(
          tx.necessidadeReprodutiva.create({
            data: {
              ...dados,
              decisao: "DISPENSAR",
              decisaoPorId: f.usuario.id,
            },
          }),
        ).rejects.toThrow();
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT motivo_nulo`;
        const n = await tx.necessidadeReprodutiva.create({
          data: {
            ...dados,
            decisao: "SUSPENDER",
            decisaoPorId: f.usuario.id,
            decisaoMotivo: "Revisão com responsável",
            decisaoDestino: "Visita",
            revisaoEm: dia("2026-12-01"),
          },
        });
        expect(n.decisao).toBe("SUSPENDER");
      }));
    it("ocorrência confirmada cancela job antes de executar, sem retirar dispositivo físico", () =>
      isolado(async (tx) => {
        const f = await fixture(tx);
        const tipo = await tx.tipoAplicacaoSanitaria.create({
          data: { nome: `Dispositivo ${randomUUID()}` },
        });
        const insercao = await tx.aplicacaoProduto.create({
          data: {
            animalId: f.animal.id,
            propriedadeId: f.sitio.id,
            data: dia("2026-11-01"),
            nomeProdutoAplicado: "Dispositivo documentado",
            precisaoTemporal: "DIA",
            tipoAplicacaoId: tipo.id,
            tipoAplicacaoNomeSnapshot: tipo.nome,
            dose: 1,
            unidadeDose: "UN",
            origemInsumo: "SEM_ORIGEM_JUSTIFICADA",
            justificativaSemOrigem: "Registro da fixture sem consumo real",
            insercaoDispositivoSnapshot: {
              versao: 1,
              motivo: "Reconhecimento explícito da inserção na fixture própria",
              evidencia: "Inserção sintética documentada para validar o cuidado físico",
              usuarioId: f.usuario.id,
              registradoEm: dia("2026-11-01").toISOString(),
            },
          },
        });
        await tx.regraSanitariaReprodutiva.create({
          data: {
            propriedadeId: f.sitio.id,
            doencaId: f.doenca.id,
            acao: "IATF",
            efeito: "ALERTAR",
            motivo: "Retirada explícita da participação",
            impactoProtocolar: {
              versao: 1,
              gatilho: "OCORRENCIA",
              efeito: "RETIRAR",
            },
          },
        });
        const input = {
          origem: "OCORRENCIA" as const,
          animalId: f.animal.id,
          propriedadeId: f.sitio.id,
          doencaId: f.doenca.id,
          data: "2026-11-01",
        };
        const previa = await previaImpactosTx(tx, input);
        const confirmacao = {
          revisao: previa.revisao,
          motivo: "Efeitos conferidos pelo responsável",
        };
        const atual = await conferirImpactosTx(tx, input, confirmacao);
        const ocorrencia = await criarOcorrenciaTx(
          tx,
          {
            animalId: f.animal.id,
            propriedadeId: f.sitio.id,
            doencaId: f.doenca.id,
            inicio: "2026-11-01",
          },
          f.usuario.id,
        );
        await aplicarImpactosTx(
          tx,
          atual,
          { tipo: "OcorrenciaSanitaria", id: ocorrencia.id },
          confirmacao,
          f.usuario.id,
        );
        expect(
          await executarAutomacaoTx(tx, f.job.id, new Date()),
        ).toMatchObject({ estado: "CANCELADA" });
        expect(
          await tx.manejoAnimal.count({
            where: { insercaoAplicacaoId: insercao.id },
          }),
        ).toBe(0);
        expect(
          await tx.necessidadeReprodutiva.findUniqueOrThrow({
            where: { chave: `DISPOSITIVO:${insercao.id}` },
          }),
        ).toMatchObject({
          situacao: "PLANEJAMENTO_PENDENTE",
          participacaoId: null,
        });
        await reconciliarAlertasReprodutivosAnimalTx(
          tx,
          f.animal.id,
          f.usuario.id,
        );
        expect(
          await tx.necessidadeReprodutiva.count({
            where: { chave: `DISPOSITIVO:${insercao.id}` },
          }),
        ).toBe(1);
        const retirada = await registrarRetiradaDispositivoTx(
          tx,
          insercao.id,
          {
            chave: randomUUID(),
            propriedadeId: f.sitio.id,
            realizadaEm: "2026-11-02",
            confirmarRetiradaFisica: true,
            observacao: "Retirada física observada após cancelar participação",
          },
          f.usuario.id,
        );
        expect(
          await tx.necessidadeReprodutiva.findUniqueOrThrow({
            where: { chave: `DISPOSITIVO:${insercao.id}` },
          }),
        ).toMatchObject({ situacao: "RESOLVIDO" });
        await tx.$executeRaw`SAVEPOINT duplicar_retirada`;
        await expect(
          tx.manejoAnimal.create({
            data: {
              animalId: f.animal.id,
              propriedadeId: f.sitio.id,
              tipo: "RETIRADA_DISPOSITIVO",
              data: dia("2026-11-02"),
              precisaoTemporal: "DIA",
              insercaoAplicacaoId: insercao.id,
              criadoPorId: f.usuario.id,
            },
          }),
        ).rejects.toThrow();
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT duplicar_retirada`;
        await tx.manejoAnimal.update({
          where: { id: retirada.id },
          data: {
            status: "ANULADO",
            anuladoEm: new Date(),
            motivoAnulacao: "Retirada cadastrada para a inserção errada",
            realizacaoMantida: false,
          },
        });
        await reconciliarAlertasReprodutivosAnimalTx(
          tx,
          f.animal.id,
          f.usuario.id,
        );
        expect(
          await tx.necessidadeReprodutiva.findUniqueOrThrow({
            where: { chave: `DISPOSITIVO:${insercao.id}` },
          }),
        ).toMatchObject({ situacao: "PLANEJAMENTO_PENDENTE" });
      }));
    it("automação que muda antes da confirmação invalida hash sem criar ocorrência/retirada", () =>
      isolado(async (tx) => {
        const f = await fixture(tx);
        await tx.regraSanitariaReprodutiva.create({
          data: {
            propriedadeId: f.sitio.id,
            doencaId: f.doenca.id,
            acao: "IATF",
            efeito: "ALERTAR",
            motivo: "Bloqueio explícito a conferir",
            impactoProtocolar: {
              versao: 1,
              gatilho: "OCORRENCIA",
              efeito: "BLOQUEAR",
            },
          },
        });
        const input = {
          origem: "OCORRENCIA" as const,
          animalId: f.animal.id,
          propriedadeId: f.sitio.id,
          doencaId: f.doenca.id,
          data: "2026-11-01",
        };
        const previa = await previaImpactosTx(tx, input);
        await tx.automacaoProtocolo.update({
          where: { id: f.job.id },
          data: {
            estado: "FALHOU",
            erro: "Falha técnica da fixture",
            revisao: { increment: 1 },
          },
        });
        await expect(
          conferirImpactosTx(tx, input, {
            revisao: previa.revisao,
            motivo: "Conferência antes da falha",
          }),
        ).rejects.toMatchObject({ code: "CONFLITO" });
        expect(
          await tx.ocorrenciaSanitaria.count({
            where: { animalId: f.animal.id },
          }),
        ).toBe(0);
        expect(
          (
            await tx.participacaoProtocolo.findUniqueOrThrow({
              where: { id: f.participacao.id },
            })
          ).canceladaEm,
        ).toBeNull();
        expect(
          (
            await tx.participacaoProtocolo.findUniqueOrThrow({
              where: { id: f.participacao.id },
            })
          ).bloqueadaEm,
        ).toBeNull();
      }));
    it("regra de procedimento dispensa doença e preserva público/versão no SQL", () =>
      isolado(async (tx) => {
        const f = await fixture(tx);
        const tipo = await tx.tipoAplicacaoSanitaria.create({
          data: { nome: `Procedimento ${randomUUID()}` },
        });
        const dados = {
          propriedadeId: f.sitio.id,
          tipoAplicacaoId: tipo.id,
          finalidade: "IATF",
          efeito: "BLOQUEAR",
          motivo: "Procedimento exige revisão operacional",
          criadoPorId: f.usuario.id,
          atualizadoPorId: f.usuario.id,
        };
        const regra = await tx.regraImpactoProcedimentoReprodutivo.create({
          data: dados,
        });
        const input = {
          origem: "PROCEDIMENTO" as const,
          animalId: f.animal.id,
          propriedadeId: f.sitio.id,
          tipoAplicacaoId: tipo.id,
          data: "2026-11-01",
        };
        expect((await previaImpactosTx(tx, input)).itens[0]).toMatchObject({
          efeito: "BLOQUEAR",
          regras: [{ id: regra.id, origem: "PROCEDIMENTO", versao: 1 }],
        });
        await tx.$executeRaw`SAVEPOINT procedimento_duplicado`;
        await expect(
          tx.regraImpactoProcedimentoReprodutivo.create({ data: dados }),
        ).rejects.toThrow();
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT procedimento_duplicado`;
        await tx.$executeRaw`SAVEPOINT procedimento_versao`;
        await expect(
          tx.regraImpactoProcedimentoReprodutivo.update({
            where: { id: regra.id },
            data: { versao: 3 },
          }),
        ).rejects.toThrow();
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT procedimento_versao`;
        await tx.regraImpactoProcedimentoReprodutivo.update({
          where: { id: regra.id },
          data: { ativo: false, versao: { increment: 1 } },
        });
        expect((await previaImpactosTx(tx, input)).itens).toEqual([]);
        await tx.$executeRaw`SAVEPOINT procedimento_historico`;
        await expect(
          tx.regraImpactoProcedimentoReprodutivo.delete({
            where: { id: regra.id },
          }),
        ).rejects.toThrow();
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT procedimento_historico`;
      }));
  },
);
