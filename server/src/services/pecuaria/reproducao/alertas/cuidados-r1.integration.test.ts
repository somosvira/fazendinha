import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../../lib/banco-pecuaria-integration.fixture.js";
import {
  criarDemandasDoFatoTx,
  reconciliarDemandasAnimalTx,
  garantirDemandaProtocoloTx,
  carregarAcompanhamentosNaDataTx,
  vincularExameDemandaTx,
  listarAcompanhamentosPaginadosTx,
  previaRevisaoPrazosTx,
  revisarPrazosTx,
} from "../acompanhamento.js";
import { reconciliarAlertasReprodutivosAnimalTx } from "./produtor.js";
import { decidirAtencaoReprodutivaTx } from "./decisoes.js";
import { detalheAlertaReprodutivoTx } from "./detalhe.js";
import { compararExecucaoIatf, snapshotIatf } from "../iatf.calc.js";
import { etapaIatfSchema } from "../schemas.js";
import { serializarDataIatf } from "../horarios.calc.js";
import { prepararExecucaoClinicaTx } from "../../protocolos/execucao.clinica.js";
import { criarAvaliacaoTx } from "../registros.js";
import { avaliacaoSchema } from "../schemas.js";
import { necessidadeAtualTx } from "./identidade.js";
const banco =
  process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const rollback = new Error("ROLLBACK_FIXTURES_R1_CUIDADOS");
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
  const marca = `R1-${randomUUID()}`;
  const sitio = await tx.propriedade.create({ data: { nome: marca } });
  const usuario = await tx.usuario.create({
    data: {
      nome: marca,
      email: `${marca}@example.test`,
      papel: "DONO",
      dono: true,
      abas: [],
      areas: ["pecuaria"],
      flags: [],
    },
  });
  const animal = await tx.animal.create({
    data: {
      brinco: marca,
      sexo: "F",
      origem: "COMPRADO",
      dataNascimento: dia("2023-01-01"),
      dataEntrada: dia("2025-01-01"),
      localizacoes: {
        create: { propriedadeId: sitio.id, desde: dia("2025-01-01") },
      },
    },
  });
  const tipo = await tx.tipoExame.create({
    data: {
      nome: marca,
      tipoResultado: "MULTIPLO",
      contexto: "REPRODUTIVO",
      campos: [
        {
          codigo: "CONCLUSAO_GESTACIONAL",
          tipo: "OPCAO",
          opcoes: ["POSITIVO", "NEGATIVO", "INCONCLUSIVO"],
        },
      ],
    },
  });
  return { sitio, usuario, animal, tipo };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function demandaIA(tx: Prisma.TransactionClient, f: Fixture) {
  await tx.politicaAcompanhamentoReprodutivo.create({
    data: {
      propriedadeId: f.sitio.id,
      versao: 1,
      vigenteDesde: dia("2026-01-01"),
      parametros: {
        versao: 1,
        efeito: "ALERTA",
        diagnostico: { diasAposTentativa: 10 },
        reconfirmacoes: [],
      },
    },
  });
  const tentativa = await tx.tentativaReprodutiva.create({
    data: {
      animalId: f.animal.id,
      propriedadeId: f.sitio.id,
      data: dia("2026-01-01"),
      tipo: "IA",
      ciclo: 1,
      ordem: 1,
      origemMaterial: "DOCUMENTADA",
      geneticaSnapshot: {},
    },
  });
  await criarDemandasDoFatoTx(
    tx,
    {
      animalId: f.animal.id,
      propriedadeId: f.sitio.id,
      tentativaId: tentativa.id,
      tipoTentativa: "IA",
      data: tentativa.data,
    },
    f.usuario.id,
  );
  await reconciliarDemandasAnimalTx(tx, f.animal.id, f.usuario.id);
  const demanda = await tx.demandaAcompanhamentoReprodutivo.findFirstOrThrow({
    where: { tentativaId: tentativa.id },
  });
  return { tentativa, demanda };
}
async function tarefaDG(tx: Prisma.TransactionClient, f: Fixture) {
  const protocolo = await tx.protocolo.create({
    data: {
      nome: `DG-${randomUUID()}`,
      tipo: "REPRODUTIVO",
      finalidade: "IATF",
      modalidadeTentativa: "EXTERNA",
      modalidadeDiagnostico: "PROTOCOLO",
    },
  });
  const configuracao = {
    tipo: "AVALIACAO",
    planoAvaliacao: { tipo: "DIAGNOSTICO", tipoExameId: f.tipo.id },
  };
  const etapa = await tx.etapaProtocolo.create({
    data: {
      protocoloId: protocolo.id,
      nome: "DG solicitado",
      ordem: 1,
      diaRelativo: 0,
      tipo: "EXAME",
      configuracao,
    },
  });
  const participacao = await tx.participacaoProtocolo.create({
    data: {
      protocoloId: protocolo.id,
      animalId: f.animal.id,
      propriedadeId: f.sitio.id,
      inicio: dia("2026-01-01"),
    },
  });
  const tarefa = await tx.tarefaProtocolo.create({
    data: {
      execucaoId: participacao.id,
      etapaId: etapa.id,
      previstaPara: dia("2026-01-11"),
    },
  });
  return { protocolo, participacao, tarefa };
}
async function decidir(
  tx: Prisma.TransactionClient,
  f: Fixture,
  demandaId: string,
  tipo: "REAGENDAR" | "DISPENSAR",
  alertaAntigo?: string,
) {
  const n = await tx.necessidadeReprodutiva.findUniqueOrThrow({
    where: { demandaId },
  });
  return decidirAtencaoReprodutivaTx(
    tx,
    alertaAntigo ?? n.alertaId!,
    {
      chave: randomUUID(),
      propriedadeId: f.sitio.id,
      revisao: n.revisao,
      tipo,
      motivo: "Decisão explícita da fixture própria",
      ...(tipo === "REAGENDAR"
        ? { data: "2099-01-01", destino: "Avaliação presencial" }
        : {}),
    },
    f.usuario.id,
  );
}
banco("R1 cuidados — somente fixtures próprias em TX revertida", () => {
  it.each([false, true])(
    "vínculo IA externa com DG interno reúne identidades, ambas existentes=%s",
    (ambas) =>
      isolado(async (tx) => {
        const f = await fixture(tx);
        const { tentativa, demanda } = await demandaIA(tx, f);
        const inicial = await tx.necessidadeReprodutiva.findUniqueOrThrow({
          where: { demandaId: demanda.id },
        });
        const eventosIniciais = await tx.eventoAlerta.findMany({
          where: { alertaId: inicial.alertaId! },
        });
        const { participacao, tarefa } = await tarefaDG(tx, f);
        // A segunda projeção pode já ter sido publicada antes de associar o serviço avulso.
        if (ambas)
          await reconciliarAlertasReprodutivosAnimalTx(
            tx,
            f.animal.id,
            f.usuario.id,
          );
        const antiga = await tx.necessidadeReprodutiva.findUnique({
          where: { tarefaId: tarefa.id },
        });
        const eventosAntigos = antiga?.alertaId
          ? await tx.eventoAlerta.findMany({
              where: { alertaId: antiga.alertaId },
            })
          : [];
        await tx.vinculoTentativaParticipacao.create({
          data: {
            participacaoId: participacao.id,
            tentativaId: tentativa.id,
            propriedadeId: f.sitio.id,
            motivo: "Serviço externo conferido na fixture",
            snapshot: { tentativaId: tentativa.id },
            criadoPorId: f.usuario.id,
          },
        });
        await reconciliarDemandasAnimalTx(tx, f.animal.id, f.usuario.id);
        const atual = await tx.necessidadeReprodutiva.findUniqueOrThrow({
          where: { demandaId: demanda.id },
        });
        expect(atual).toMatchObject({
          id: inicial.id,
          chave: inicial.chave,
          alertaId: inicial.alertaId,
          tarefaId: tarefa.id,
        });
        expect(
          await tx.necessidadeReprodutiva.count({
            where: { tarefaId: tarefa.id },
          }),
        ).toBe(1);
        expect(
          await tx.eventoAlerta.count({
            where: { id: { in: eventosIniciais.map((e) => e.id) } },
          }),
        ).toBe(eventosIniciais.length);
        if (antiga) {
          const alias = await tx.necessidadeReprodutiva.findUniqueOrThrow({
            where: { id: antiga.id },
          });
          expect(alias).toMatchObject({
            convergidaParaId: atual.id,
            situacao: "ENCERRADO",
            tarefaId: null,
            demandaId: null,
            alertaId: antiga.alertaId,
          });
          expect((await necessidadeAtualTx(tx, alias)).id).toBe(atual.id);
          const usuario = {
            ...f.usuario,
            abas: [],
            areas: ["pecuaria"],
            flags: [],
            dono: true,
          };
          const detalhe = await detalheAlertaReprodutivoTx(
            tx,
            await tx.alerta.findUniqueOrThrow({
              where: { id: antiga.alertaId! },
            }),
            usuario,
          );
          expect(detalhe.alertaId).toBe(atual.alertaId);
          expect(
            "eventos" in detalhe &&
              detalhe.eventos?.some((e) =>
                eventosAntigos.some((anterior) => anterior.id === e.id),
              ),
          ).toBe(true);
          const agendada = await decidir(
            tx,
            f,
            demanda.id,
            "REAGENDAR",
            antiga.alertaId!,
          );
          expect(agendada.id).toBe(atual.id);
          await tx.$executeRaw`SAVEPOINT alias_imutavel`;
          await expect(
            tx.necessidadeReprodutiva.update({
              where: { id: alias.id },
              data: { motivo: "Tentativa de reescrever histórico" },
            }),
          ).rejects.toThrow();
          await tx.$executeRaw`ROLLBACK TO SAVEPOINT alias_imutavel`;
        }
      }),
  );
  it("reagenda demanda sem tarefa sem alterar regra e mantém SQL congelado", () =>
    isolado(async (tx) => {
      const f = await fixture(tx);
      const { demanda } = await demandaIA(tx, f);
      await decidir(tx, f, demanda.id, "REAGENDAR");
      const atual = await tx.demandaAcompanhamentoReprodutivo.findUniqueOrThrow(
        { where: { id: demanda.id }, include: { decisaoOperacional: true } },
      );
      expect(atual).toMatchObject({
        previstaPara: demanda.previstaPara,
        dataReferencia: demanda.dataReferencia,
        regraSnapshot: demanda.regraSnapshot,
        decisaoOperacional: { tipo: "REAGENDAR", data: dia("2099-01-01") },
      });
      expect(
        (
          await carregarAcompanhamentosNaDataTx(tx, [f.animal.id], new Date())
        ).find((d) => d.id === demanda.id),
      ).toMatchObject({
        previstaPara: dia("2099-01-01"),
        previstaPelaRegra: demanda.previstaPara,
      });
      await tx.$executeRaw`SAVEPOINT prazo_congelado`;
      await expect(
        tx.demandaAcompanhamentoReprodutivo.update({
          where: { id: demanda.id },
          data: { previstaPara: dia("2099-01-02"), versao: { increment: 1 } },
        }),
      ).rejects.toThrow();
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT prazo_congelado`;
      await tx.$executeRaw`SAVEPOINT ledger_imutavel`;
      await expect(
        tx.decisaoOperacionalAcompanhamento.delete({
          where: { id: atual.decisaoOperacionalId! },
        }),
      ).rejects.toThrow();
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT ledger_imutavel`;
      const cuidado = await tx.necessidadeReprodutiva.findUniqueOrThrow({
        where: { demandaId: demanda.id },
      });
      await decidirAtencaoReprodutivaTx(
        tx,
        cuidado.alertaId!,
        {
          chave: randomUUID(),
          propriedadeId: f.sitio.id,
          revisao: cuidado.revisao,
          tipo: "SUSPENDER",
          data: "2099-02-01",
          destino: "Revisão presencial",
          motivo: "Nova decisão preserva a primeira",
        },
        f.usuario.id,
      );
      expect(
        await tx.decisaoOperacionalAcompanhamento.count({
          where: { demandaId: demanda.id },
        }),
      ).toBe(2);
      expect(
        await tx.decisaoOperacionalAcompanhamento.findUniqueOrThrow({
          where: { id: atual.decisaoOperacionalId! },
        }),
      ).toMatchObject({ tipo: "REAGENDAR", data: dia("2099-01-01") });
      const antesDaRevisao =
        await tx.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({
          where: { id: demanda.id },
        });
      const novaPolitica = await tx.politicaAcompanhamentoReprodutivo.create({
        data: {
          propriedadeId: f.sitio.id,
          versao: 2,
          vigenteDesde: dia("2026-01-02"),
          parametros: {
            versao: 1,
            efeito: "ALERTA",
            diagnostico: { diasAposTentativa: 20 },
            reconfirmacoes: [],
          },
        },
      });
      const selecao = {
        propriedadeId: f.sitio.id,
        politicaId: novaPolitica.id,
        demandaIds: [demanda.id],
      };
      const previa = await previaRevisaoPrazosTx(tx, selecao);
      expect(previa.propostas[0].impedimento).toBeNull();
      await revisarPrazosTx(
        tx,
        {
          ...selecao,
          chave: randomUUID(),
          motivo: "Revisão explícita preserva agendamento",
          revisao: previa.revisao,
        },
        f.usuario.id,
      );
      expect(
        await tx.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({
          where: { id: demanda.id },
        }),
      ).toMatchObject({
        previstaPara: dia("2026-01-21"),
        decisaoOperacionalId: antesDaRevisao.decisaoOperacionalId,
      });
      expect(
        await tx.decisaoOperacionalAcompanhamento.count({
          where: { demandaId: demanda.id },
        }),
      ).toBe(2);
    }));
  it("DG pendente recebe adiamento factual da agenda sem reescrever regra da demanda", () =>
    isolado(async (tx) => {
      const f = await fixture(tx);
      const { demanda, tentativa } = await demandaIA(tx, f);
      const { tarefa, participacao } = await tarefaDG(tx, f);
      await tx.vinculoTentativaParticipacao.create({
        data: {
          participacaoId: participacao.id,
          tentativaId: tentativa.id,
          propriedadeId: f.sitio.id,
          motivo: "Correspondência documental conferida",
          snapshot: {},
        },
      });
      await reconciliarDemandasAnimalTx(tx, f.animal.id, f.usuario.id);
      await decidir(tx, f, demanda.id, "REAGENDAR");
      expect(
        await tx.tarefaProtocolo.findUniqueOrThrow({
          where: { id: tarefa.id },
        }),
      ).toMatchObject({
        previstaPara: dia("2099-01-01"),
        previsaoOriginal: tarefa.previstaPara,
        realizadaEm: null,
        dispensadaEm: null,
      });
      const atualTarefa = await tx.tarefaProtocolo.findUniqueOrThrow({
        where: { id: tarefa.id },
      });
      const planoOriginal = snapshotIatf(
        etapaIatfSchema.parse({
          nome: "DG solicitado",
          tipo: "AVALIACAO",
          intervalo: 10,
          unidade: "DIAS",
          planoAvaliacao: { tipo: "DIAGNOSTICO", tipoExameId: f.tipo.id },
        }),
        {},
        tarefa.previstaPara,
        tarefa.previstaPara,
        dia("2026-01-01"),
        "DIA",
      );
      const planoExecucao = {
        ...planoOriginal,
        previstaEm: serializarDataIatf(
          atualTarefa.previstaPara,
          atualTarefa.precisaoTemporal,
        ),
        precisaoTemporal: atualTarefa.precisaoTemporal,
      };
      expect(
        compararExecucaoIatf(planoExecucao, "2099-01-01", {
          finalidade: "DIAGNOSTICO",
          tipoExameId: f.tipo.id,
        }),
      ).toMatchObject({ aferido: true, diferencas: [] });
      const consulta = await listarAcompanhamentosPaginadosTx(tx, f.sitio.id, {
        animalId: f.animal.id,
        estado: "PENDENTE",
        data: "2026-11-07",
      });
      expect(consulta.itens).toHaveLength(1);
      expect(consulta.itens[0]).toMatchObject({
        previstaPara: dia("2099-01-01"),
        previstaPelaRegra: demanda.previstaPara,
      });
      expect(
        await tx.eventoTarefaProtocolo.count({
          where: { tarefaId: tarefa.id, tipo: "ADIAMENTO" },
        }),
      ).toBe(1);
      expect(
        await tx.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({
          where: { id: demanda.id },
        }),
      ).toMatchObject({
        previstaPara: demanda.previstaPara,
        regraSnapshot: demanda.regraSnapshot,
      });
    }));
  it.each(["REAGENDAR", "DISPENSAR"] as const)(
    "%s residual preserva exame/tarefa realizados e dispositivo físico",
    (tipo) =>
      isolado(async (tx) => {
        const f = await fixture(tx);
        const { tarefa } = await tarefaDG(tx, f);
        const exame = await tx.exameAnimal.create({
          data: {
            animalId: f.animal.id,
            propriedadeId: f.sitio.id,
            tipoExameId: f.tipo.id,
            tarefaId: tarefa.id,
            data: dia("2026-01-11"),
            finalidades: ["AVALIACAO_REPRODUTIVA"],
            finalidadePrincipal: "AVALIACAO_REPRODUTIVA",
            formatoSnapshot: { versao: 1 },
            avaliacaoContextualSnapshot: {
              itens: [{ codigo: "DG", estado: "NAO_AVALIADO" }],
            },
            interpretacao: { create: {} },
          },
        });
        await tx.tarefaProtocolo.update({
          where: { id: tarefa.id },
          data: { realizadaEm: dia("2026-01-11") },
        });
        const demanda = await garantirDemandaProtocoloTx(
          tx,
          tarefa.id,
          exame.id,
          f.usuario.id,
        );
        if (!demanda) throw new Error("Fixture exige demanda residual real");
        const tipoAplicacao = await tx.tipoAplicacaoSanitaria.create({
          data: { nome: randomUUID() },
        });
        const insercao = await tx.aplicacaoProduto.create({
          data: {
            animalId: f.animal.id,
            propriedadeId: f.sitio.id,
            data: dia("2026-01-01"),
            nomeProdutoAplicado: "Dispositivo documentado",
            precisaoTemporal: "DIA",
            tipoAplicacaoId: tipoAplicacao.id,
            tipoAplicacaoNomeSnapshot: tipoAplicacao.nome,
            dose: 1,
            unidadeDose: "UN",
            origemInsumo: "SEM_ORIGEM_JUSTIFICADA",
            justificativaSemOrigem: "Fixture documental própria sem estoque",
            insercaoDispositivoSnapshot: {
              versao: 1,
              motivo: "Inserção documentada na fixture própria",
              evidencia: "Inserção física real para a simulação isolada",
              usuarioId: f.usuario.id,
              registradoEm: dia("2026-01-01").toISOString(),
            },
          },
        });
        await reconciliarDemandasAnimalTx(tx, f.animal.id, f.usuario.id);
        const resposta = await decidir(tx, f, demanda.id, tipo);
        expect(resposta.situacao).toBe(
          tipo === "DISPENSAR" ? "DISPENSADO" : "ADIADO",
        );
        await reconciliarDemandasAnimalTx(tx, f.animal.id, f.usuario.id);
        expect(
          await tx.tarefaProtocolo.findUniqueOrThrow({
            where: { id: tarefa.id },
          }),
        ).toMatchObject({
          realizadaEm: dia("2026-01-11"),
          dispensadaEm: null,
          previstaPara: tarefa.previstaPara,
        });
        expect(
          await tx.eventoTarefaProtocolo.count({
            where: { tarefaId: tarefa.id },
          }),
        ).toBe(0);
        expect(
          await tx.exameAnimal.findUniqueOrThrow({ where: { id: exame.id } }),
        ).toMatchObject({ status: "VALIDO", realizacao: "REALIZADO" });
        expect(
          await tx.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({
            where: { id: demanda.id },
          }),
        ).toMatchObject({
          previstaPara: null,
          regraSnapshot: demanda.regraSnapshot,
          estado: "PENDENTE",
        });
        expect(
          await tx.necessidadeReprodutiva.findUniqueOrThrow({
            where: { chave: `DISPOSITIVO:${insercao.id}` },
          }),
        ).toMatchObject({ situacao: "PLANEJAMENTO_PENDENTE" });
        if (tipo === "DISPENSAR") {
          await expect(
            prepararExecucaoClinicaTx(
              tx,
              {
                tipo: "AVALIACAO",
                reavaliacao: true,
                tarefaId: tarefa.id,
                animalId: f.animal.id,
                propriedadeId: f.sitio.id,
                demandaAcompanhamentoId: demanda.id,
                data: "2026-01-12",
                tipoExameId: f.tipo.id,
                finalidade: "DIAGNOSTICO",
                resultado: "INCONCLUSIVO",
              },
              f.usuario.id,
            ),
          ).rejects.toMatchObject({
            code: "CONFLITO",
            campo: "demandaAcompanhamentoId",
          });
          const livre = await criarAvaliacaoTx(
            tx,
            avaliacaoSchema.parse({
              chave: randomUUID(),
              animalId: f.animal.id,
              propriedadeId: f.sitio.id,
              data: "2026-01-12",
              tipoExameId: f.tipo.id,
              finalidade: "DIAGNOSTICO",
              resultado: "INCONCLUSIVO",
            }),
            f.usuario.id,
          );
          expect(
            await tx.exameAnimal.findUniqueOrThrow({ where: { id: livre.id } }),
          ).toMatchObject({
            status: "VALIDO",
            tarefaId: null,
            demandaAcompanhamentoId: null,
          });
          const politica = await tx.politicaAcompanhamentoReprodutivo.create({
            data: {
              propriedadeId: f.sitio.id,
              versao: 1,
              vigenteDesde: dia("2026-01-01"),
              parametros: {
                versao: 1,
                efeito: "ALERTA",
                diagnostico: { diasAposTentativa: 20 },
                reconfirmacoes: [],
              },
            },
          });
          expect(
            (
              await previaRevisaoPrazosTx(tx, {
                propriedadeId: f.sitio.id,
                politicaId: politica.id,
                demandaIds: [demanda.id],
              })
            ).propostas[0].impedimento,
          ).toBe("DEMANDA_NAO_PENDENTE");

          const pendentes = await listarAcompanhamentosPaginadosTx(
            tx,
            f.sitio.id,
            { animalId: f.animal.id, estado: "PENDENTE", data: "2026-11-07" },
          );
          expect(pendentes.total).toBe(0);
          await tx.$executeRaw`SAVEPOINT dispensa_nao_reabre`;
          const atual =
            await tx.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({
              where: { id: demanda.id },
            });
          await expect(
            tx.decisaoOperacionalAcompanhamento.create({
              data: {
                demandaId: demanda.id,
                necessidadeId: resposta.id,
                chave: randomUUID(),
                versaoAnterior: atual.versao,
                tipo: "REAGENDAR",
                data: dia("2099-01-01"),
                destino: "Tentativa de reabertura",
                motivo: "Não pode desaparecer a dispensa",
                usuarioId: f.usuario.id,
              },
            }),
          ).rejects.toThrow();
          await tx.$executeRaw`ROLLBACK TO SAVEPOINT dispensa_nao_reabre`;

          expect(
            (
              await carregarAcompanhamentosNaDataTx(
                tx,
                [f.animal.id],
                new Date(),
              )
            ).find((d) => d.id === demanda.id),
          ).toMatchObject({
            estado: "ENCERRADA",
            motivoEncerramento: "DISPENSA_ADMINISTRATIVA",
          });
          await expect(
            vincularExameDemandaTx(tx, demanda.id, exame.id),
          ).rejects.toMatchObject({ code: "VALIDACAO" });
          expect(
            await tx.necessidadeReprodutiva.findUniqueOrThrow({
              where: { demandaId: demanda.id },
            }),
          ).toMatchObject({ situacao: "DISPENSADO" });
        }
      }),
  );
});
