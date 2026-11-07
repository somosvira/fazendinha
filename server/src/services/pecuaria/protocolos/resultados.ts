import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { RebanhoError, hojeFazendaDate } from "../rebanho/regras.js";
import { obterContextosAnimaisNaDataTx } from "../reproducao/contexto-animal.js";
import { obterContextoOperacaoTx } from "./operacao.js";
import { tarefaNoEscopoOperacao } from "./operacao.escopo.js";
import type { ContextoOperacao } from "./operacao.schemas.js";
import { situacaoOperacionalTarefa } from "./situacao.js";
import {
  faseEtapaReprodutiva,
  resumirDiagnostico,
  resumirPreparo,
  taxaResultado,
  condutasContextuaisResultado,
} from "./resultados.calc.js";
export const consultaResultadosSchema = z
  .object({
    pagina: z.coerce.number().int().min(1).default(1),
    porPagina: z.coerce.number().int().min(1).max(10).default(10),
    busca: z.string().trim().max(160).optional(),
  })
  .strict();
export type ConsultaResultados = z.infer<typeof consultaResultadosSchema>;
const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const dia = (d: Date) => d.toISOString().slice(0, 10);
const tentativaSelect = {
  id: true,
  animalId: true,
  propriedadeId: true,
  tipo: true,
  data: true,
  ordem: true,
  status: true,
  tarefaId: true,
} satisfies Prisma.TentativaReprodutivaSelect;
export async function consultarResultadosProtocolo(
  contexto: ContextoOperacao,
  propriedadeId: number | null,
  f: ConsultaResultados,
) {
  return prisma.$transaction(
    async (tx) => {
      const c = await obterContextoOperacaoTx(tx, contexto, propriedadeId);
      if (c.protocolo.tipo !== "REPRODUTIVO")
        throw new RebanhoError(
          "VALIDACAO",
          "Resultados disponíveis para protocolos reprodutivos",
        );
      const participantes = await tx.participacaoProtocolo.findMany({
        where: c.where,
        include: {
          animal: { select: { id: true, brinco: true, nome: true } },
          protocolo: {
            select: {
              finalidade: true,
              modalidadeTentativa: true,
              modalidadeDiagnostico: true,
            },
          },
          tentativasExternas: {
            where: {
              revogadoEm: null,
              ...(propriedadeId != null ? { propriedadeId } : {}),
            },
            select: {
              id: true,
              snapshot: true,
              tentativa: { select: tentativaSelect },
            },
          },
          tarefas: {
            where: tarefaNoEscopoOperacao(propriedadeId),
            include: {
              etapa: true,
              execucao: { select: { canceladaEm: true } },
              aplicacoes: { select: { status: true } },
              exames: { select: { status: true, realizacao: true } },
              manejos: { select: { status: true } },
              tentativas: { select: tentativaSelect },
              eventos: true,
              vinculos: {
                where: { estado: "ATUAL" },
                include: {
                  aplicacao: { select: { status: true } },
                  exame: { select: { status: true, realizacao: true } },
                  manejo: { select: { status: true } },
                  tentativa: { select: tentativaSelect },
                },
              },
            },
          },
        },
        orderBy: [{ animal: { brinco: "asc" } }, { id: "asc" }],
      });
      const porParticipante = participantes.map((p) => {
        const internas = p.tarefas
          .flatMap((t) => [
            ...t.tentativas,
            ...t.vinculos.flatMap((v) => (v.tentativa ? [v.tentativa] : [])),
          ])
          .filter(
            (t) => propriedadeId == null || t.propriedadeId === propriedadeId,
          );
        const externa = p.tentativasExternas.find(
          (v) =>
            propriedadeId == null ||
            v.tentativa.propriedadeId === propriedadeId,
        );
        const snapshot = objeto(externa?.snapshot);
        const externaValida =
          !!externa &&
          snapshot.data === dia(externa.tentativa.data) &&
          snapshot.tipo === externa.tentativa.tipo &&
          snapshot.animalId === p.animalId &&
          externa.tentativa.status === "VALIDO" &&
          !externa.tentativa.tarefaId;
        const fatos = [
          ...new Map(
            [
              ...internas,
              ...(externa && externaValida ? [externa.tentativa] : []),
            ]
              .filter((t) => t.status === "VALIDO")
              .map((t) => [t.id, t]),
          ).values(),
        ].sort(
          (a, b) =>
            a.data.getTime() - b.data.getTime() ||
            a.ordem - b.ordem ||
            a.id.localeCompare(b.id),
        );
        return {
          p,
          fatos,
          externa,
          externaInvalida: !!externa && !externaValida,
        };
      });
      const ids = [
        ...new Set(porParticipante.flatMap((p) => p.fatos.map((t) => t.id))),
      ];
      const gestacoes = await tx.gestacaoAnimal.findMany({
        where: {
          tentativaId: { in: ids },
          ...(propriedadeId != null ? { propriedadeId } : {}),
        },
        select: {
          id: true,
          tentativaId: true,
          status: true,
          encerradaEm: true,
          tipoEncerramento: true,
        },
      });
      const gestacaoIds = gestacoes.map((g) => g.id);
      const exames = await tx.exameAnimal.findMany({
        where: {
          status: "VALIDO",
          realizacao: "REALIZADO",
          ...(propriedadeId != null ? { propriedadeId } : {}),
          interpretacao: {
            OR: [
              { tentativaId: { in: ids } },
              { gestacaoId: { in: gestacaoIds } },
            ],
          },
        },
        select: {
          id: true,
          data: true,
          finalidades: true,
          resultados: {
            where: { vigente: true, campo: "CONCLUSAO_GESTACIONAL" },
            select: { valor: true },
          },
          interpretacao: {
            select: {
              tentativaId: true,
              gestacaoId: true,
              conduta: true,
              retornoEm: true,
              condutasContextuais: true,
            },
          },
        },
        orderBy: [{ data: "asc" }, { criadoEm: "asc" }, { id: "asc" }],
      });
      const demandas = await tx.demandaAcompanhamentoReprodutivo.findMany({
        where: {
          estado: "PENDENTE",
          OR: [
            { tentativaId: { in: ids } },
            { gestacaoId: { in: gestacaoIds } },
          ],
          ...(propriedadeId != null
            ? { propriedadeOrigemId: propriedadeId }
            : {}),
        },
        include: { tarefa: { select: { etapaId: true } } },
        orderBy: [
          { previstaPara: { sort: "asc", nulls: "last" } },
          { id: "asc" },
        ],
      });
      const hoje = hojeFazendaDate();
      const locais = await tx.localizacaoAnimal.findMany({
        where: {
          animalId: { in: participantes.map((p) => p.animalId) },
          desde: { lte: hoje },
          OR: [{ ate: null }, { ate: { gt: hoje } }],
          ...(propriedadeId != null ? { propriedadeId } : {}),
        },
        select: { animalId: true },
      });
      const contextos = await obterContextosAnimaisNaDataTx(
        tx,
        locais.map((l) => l.animalId),
        hoje,
      );
      const linhas = porParticipante.map(
        ({ p, fatos, externa, externaInvalida }) => {
          const execucao = p.tarefas.filter(
            (t) => faseEtapaReprodutiva(t.etapa.configuracao) === "EXECUCAO",
          );
          const preparo = resumirPreparo(
            execucao.map((t) => ({
              situacao: situacaoOperacionalTarefa(t),
              tipo: String(objeto(t.etapa.configuracao).tipo ?? t.etapa.tipo),
              motivoDispensa: t.motivoDispensa,
            })),
            !!p.canceladaEm,
          );
          const tentativas = fatos.map((t) => {
            const gestacao = gestacoes.find(
              (g) => g.tentativaId === t.id && g.status === "VALIDO",
            );
            const correspondentes = exames
              .filter(
                (e) =>
                  e.interpretacao?.tentativaId === t.id ||
                  (gestacao && e.interpretacao?.gestacaoId === gestacao.id),
              )
              .map((e) => ({
                id: e.id,
                data: dia(e.data),
                finalidades: e.finalidades,
                resultado:
                  typeof e.resultados[0]?.valor === "string"
                    ? e.resultados[0].valor
                    : null,
                conduta: e.interpretacao?.conduta ?? null,
                condutasContextuais: condutasContextuaisResultado(
                  e.interpretacao?.condutasContextuais,
                ),
                retornoEm: e.interpretacao?.retornoEm
                  ? dia(e.interpretacao.retornoEm)
                  : null,
              }));
            const diagnostico = resumirDiagnostico(
              correspondentes,
              gestacao?.tipoEncerramento === "PERDA" &&
                !!gestacao.encerradaEm &&
                gestacao.encerradaEm <= hoje,
            );
            return {
              id: t.id,
              tipo: t.tipo,
              data: dia(t.data),
              origem: externa?.tentativa.id === t.id ? "EXTERNA" : "ETAPA",
              ...diagnostico,
              posteriores: diagnostico.posteriores.slice(0, 10),
              posterioresTotal: diagnostico.posteriores.length,
            };
          });
          const atual = tentativas.at(-1);
          const ultimoExame = exames
            .filter((e) =>
              fatos.some(
                (t) =>
                  e.interpretacao?.tentativaId === t.id ||
                  gestacoes.some(
                    (g) =>
                      g.tentativaId === t.id &&
                      e.interpretacao?.gestacaoId === g.id,
                  ),
              ),
            )
            .at(-1);
          const demanda = demandas.find(
            (d) =>
              d.tentativaId === atual?.id && d.finalidade === "DIAGNOSTICO",
          );
          const contextoAtual = contextos.get(p.animalId);
          const situacaoAtual =
            contextoAtual &&
            (propriedadeId == null ||
              contextoAtual.localizacaoNaData?.propriedadeId === propriedadeId)
              ? contextoAtual.situacaoReprodutiva
              : null;
          return {
            participacaoId: p.id,
            animal: p.animal,
            preparo,
            execucaoEncerrada:
              preparo.execucaoEncerrada &&
              (propriedadeId == null || p.propriedadeId === propriedadeId),
            tentativaPrevista:
              p.protocolo.finalidade === "IATF"
                ? "IA"
                : p.protocolo.finalidade === "TETF"
                  ? "TE"
                  : null,
            modalidadeTentativa: p.protocolo.modalidadeTentativa,
            modalidadeDiagnostico: p.protocolo.modalidadeDiagnostico,
            tentativas,
            tentativasTotal: tentativas.length,
            demandaDiagnostico: demanda
              ? {
                  id: demanda.id,
                  tentativaId: demanda.tentativaId,
                  gestacaoId: demanda.gestacaoId,
                  etapaId: demanda.tarefa?.etapaId ?? null,
                  tipoExameId:
                    typeof objeto(demanda.regraSnapshot).tipoExameId ===
                    "string"
                      ? String(objeto(demanda.regraSnapshot).tipoExameId)
                      : null,
                }
              : null,
            primeiroDg: atual?.primeiroDg ?? null,
            conclusao: atual?.conclusao ?? "TENTATIVA_PENDENTE",
            perdaPosterior: atual?.perdaPosterior ?? false,
            situacaoAtual,
            encaminhamento: ultimoExame?.interpretacao?.conduta ?? null,
            condutasContextuais: condutasContextuaisResultado(
              ultimoExame?.interpretacao?.condutasContextuais,
            ),
            retornoEm: ultimoExame?.interpretacao?.retornoEm
              ? dia(ultimoExame.interpretacao.retornoEm)
              : null,
            vinculoExterno: externa
              ? {
                  id: externa.id,
                  tentativaId: externa.tentativa.id,
                  valido: !externaInvalida,
                }
              : null,
            pendencia: externaInvalida
              ? "Vínculo factual requer revisão após alteração ou anulação da tentativa"
              : null,
          };
        },
      );
      const tentativas = porParticipante
        .flatMap(({ fatos }) => fatos)
        .filter((t, i, arr) => arr.findIndex((o) => o.id === t.id) === i);
      const resultados = [
        ...new Map(
          linhas.flatMap((l) => l.tentativas).map((t) => [t.id, t]),
        ).values(),
      ];
      const incluidos = new Set(linhas.map((l) => l.animal.id)).size;
      const positivos = resultados.filter(
        (t) => t.conclusao === "POSITIVO",
      ).length;
      const examinados = resultados.filter((t) => t.primeiroDg).length;
      const resumo = {
        participacoes: linhas.length,
        incluidos,
        preparoConcluido: linhas.filter(
          (l) => l.preparo.situacao === "CONCLUIDO",
        ).length,
        tentativasRealizadas: tentativas.length,
        animaisComTentativa: new Set(
          porParticipante
            .filter((p) => p.fatos.length)
            .map((p) => p.p.animalId),
        ).size,
        examinados,
        aguardandoDiagnostico: resultados.filter((t) => !t.primeiroDg).length,
        positivos,
        negativos: resultados.filter((t) => t.conclusao === "NEGATIVO").length,
        inconclusivos: resultados.filter((t) => t.conclusao === "INCONCLUSIVO")
          .length,
        perdasPosteriores: resultados.filter((t) => t.perdaPosterior).length,
        taxas: {
          porTentativa: taxaResultado(positivos, tentativas.length),
          porExaminada: taxaResultado(positivos, examinados),
          porAnimalIncluido: taxaResultado(
            new Set(
              linhas
                .filter((l) =>
                  l.tentativas.some((t) => t.conclusao === "POSITIVO"),
                )
                .map((l) => l.animal.id),
            ).size,
            incluidos,
          ),
        },
      };
      const filtradas = linhas.filter(
        (l) =>
          !f.busca ||
          `${l.animal.brinco} ${l.animal.nome ?? ""}`
            .toLocaleLowerCase("pt-BR")
            .includes(f.busca.toLocaleLowerCase("pt-BR")),
      );
      const pagina = Math.min(
        f.pagina,
        Math.max(1, Math.ceil(filtradas.length / f.porPagina)),
      );
      return {
        etapasAcompanhamento: [
          ...new Set(
            participantes.flatMap((p) =>
              p.tarefas
                .filter(
                  (t) =>
                    faseEtapaReprodutiva(t.etapa.configuracao) === "RESULTADOS",
                )
                .map((t) => t.etapaId),
            ),
          ),
        ],
        liberado: linhas.length > 0 && linhas.every((l) => l.execucaoEncerrada),
        resumo,
        itens: filtradas
          .slice((pagina - 1) * f.porPagina, pagina * f.porPagina)
          .map((l) => ({ ...l, tentativas: l.tentativas.slice(-10) })),
        total: filtradas.length,
        pagina,
        porPagina: f.porPagina,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
