import { z } from "zod";
import {
  Prisma,
  type TanqueLeite,
  type MedicaoGeralLeite,
} from "@prisma/client";
import { prisma } from "../../../db.js";
import {
  auditar,
  hojeFazendaDate,
  RebanhoError,
  travarAnimais,
} from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import {
  conferirSitioLeiteTx,
  garantirConfiguracaoLeiteTx,
  travarRotinaLeiteTx,
} from "./configuracoes.js";
import { conferirAnimaisOrigemGeralTx, consultarFolha, consultarOrigensAutomaticasGeraisTx } from "./producao.js";
import { conferirConversaoTanque } from "./tanques.calc.js";
import {
  pontoConversaoSchema,
  tanqueLeiteSchema,
  medicaoGeralLeiteSchema,
  type TanqueLeiteInput,
  type MedicaoGeralLeiteInput,
} from "./tanques.schemas.js";
const dia = (data: string) => new Date(`${data}T00:00:00Z`);
export function tanqueDTO(t: TanqueLeite) {
  return {
    id: t.id,
    propriedadeId: t.propriedadeId,
    identidadeId: t.identidadeId,
    versao: t.versao,
    nome: t.nome,
    fabricante: t.fabricante,
    modelo: t.modelo,
    numeroSerie: t.numeroSerie,
    capacidadeLitros: t.capacidadeLitros.toNumber(),
    vigenteDesde: t.vigenteDesde.toISOString().slice(0, 10),
    ativo: t.ativo,
    tabelaConversao: pontoConversaoSchema.array().parse(t.tabelaConversao),
    referenciaTabela: t.referenciaTabela,
  };
}
export function medicaoGeralDTO(
  m: MedicaoGeralLeite & {
    tanque: TanqueLeite;
    entradasEstoque: { id: string; status: string }[];
  },
) {
  return {
    id: m.id,
    sessaoId: m.sessaoId,
    tanque: tanqueDTO(m.tanque),
    litros: m.litros.toNumber(),
    reguaMm: m.reguaMm?.toNumber() ?? null,
    origemLitros: m.origemLitros,
    natureza: m.natureza,
    animaisOrigem: m.animaisOrigem,
    responsavel: m.responsavel,
    observacao: m.observacao,
    versao: m.versao,
    entradaId:
      m.entradasEstoque.find((e) => e.status === "CONFIRMADA")?.id ?? null,
  };
}
export async function listarTanquesTx(
  tx: Prisma.TransactionClient,
  propriedadeId: number,
  data: Date,
) {
  const versoes = await tx.tanqueLeite.findMany({
    where: { propriedadeId, vigenteDesde: { lte: data } },
    orderBy: [{ identidadeId: "asc" }, { versao: "desc" }],
  });
  return [
    ...new Map(
      versoes
        .map((t) => t.identidadeId)
        .map((id) => [id, versoes.find((t) => t.identidadeId === id)!]),
    ).values(),
  ];
}
export async function registrarTanque(
  input: TanqueLeiteInput,
  usuarioId: number | null,
) {
  const dados = tanqueLeiteSchema.parse(input);
  return transacaoPecuaria((tx) =>
    operacaoIdempotenteTx(
      tx,
      dados,
      usuarioId,
      "VERSAO_TANQUE_LEITE",
      async () => {
        await conferirSitioLeiteTx(tx, dados.propriedadeId, true);
        await travarRotinaLeiteTx(tx, dados.propriedadeId);
        const ultima = await tx.tanqueLeite.findFirst({
          where: {
            propriedadeId: dados.propriedadeId,
            identidadeId: dados.identidadeId,
          },
          orderBy: { versao: "desc" },
        });
        if ((ultima?.versao ?? 0) !== dados.versaoEsperada)
          throw new RebanhoError(
            "CONFLITO",
            "O tanque mudou; recarregue a configuração",
          );
        if (ultima && dia(dados.vigenteDesde) <= ultima.vigenteDesde)
          throw new RebanhoError(
            "CONFLITO",
            "A nova versão deve ter vigência posterior à anterior",
          );
        if (
          await tx.medicaoGeralLeite.count({
            where: {
              tanque: {
                propriedadeId: dados.propriedadeId,
                identidadeId: dados.identidadeId,
              },
              sessao: {
                dia: { dataOperacional: { gte: dia(dados.vigenteDesde) } },
              },
            },
          })
        )
          throw new RebanhoError(
            "CONFLITO",
            "A vigência alcança aferições existentes; escolha uma data posterior",
          );
        const { chave: _chave, versaoEsperada: _versao, ...campos } = dados;
        const tanque = await tx.tanqueLeite.create({
          data: {
            ...campos,
            vigenteDesde: dia(dados.vigenteDesde),
            versao: dados.versaoEsperada + 1,
            tabelaConversao: [...dados.tabelaConversao].sort(
              (a, b) => a.mm - b.mm,
            ),
            criadoPorId: usuarioId,
          },
        });
        await auditar(tx, {
          entidade: "TanqueLeite",
          entidadeId: tanque.id,
          propriedadeId: dados.propriedadeId,
          usuarioId,
          acao: "NOVA_VERSAO",
          depois: tanque,
        });
        return tanqueDTO(tanque);
      },
    ),
  );
}
export async function consultarOrdenhasGerais(
  propriedadeId: number,
  dataOperacional: string,
) {
  const folha = await consultarFolha(propriedadeId, dataOperacional);
  const dados = await prisma.$transaction(
    async (tx) => {
      const tanques = await listarTanquesTx(
        tx,
        propriedadeId,
        dia(dataOperacional),
      );
      const medicoes = await tx.medicaoGeralLeite.findMany({
        where: {
          sessao: {
            dia: { propriedadeId, dataOperacional: dia(dataOperacional) },
          },
        },
        include: {
          tanque: true,
          entradasEstoque: { select: { id: true, status: true } },
        },
        orderBy: [{ sessaoId: "asc" }, { tanqueId: "asc" }],
      });
      return {
        tanques: tanques.map(tanqueDTO),
        medicoes: medicoes.map(medicaoGeralDTO),
        origensAutomaticas: await consultarOrigensAutomaticasGeraisTx(tx, propriedadeId, dia(dataOperacional)),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  return {
    ...dados,
    configuracao: folha.configuracao,
    sessoes: folha.sessoes.map((s) => ({
      id: s.id,
      posicaoId: s.posicaoId,
      nome: s.nome,
      ordem: s.ordem,
    })),
    animais: folha.animais.map((a) => ({
      animalId: a.animalId,
      brinco: a.brinco,
      nome: a.nome,
    })),
  };
}
export async function salvarMedicaoGeral(
  input: MedicaoGeralLeiteInput,
  usuarioId: number | null,
) {
  const dados = medicaoGeralLeiteSchema.parse(input);
  return transacaoPecuaria((tx) =>
    operacaoIdempotenteTx(
      tx,
      dados,
      usuarioId,
      "MEDICAO_GERAL_LEITE",
      async () => {
        const data = dia(dados.dataOperacional);
        if (data > hojeFazendaDate())
          throw new RebanhoError(
            "VALIDACAO",
            "A ordenha deve ter data até hoje",
          );
        // A leitura é apenas uma referência para travar todas as origens antes da sessão.
        // Após a trava, a versão e a lista são conferidas novamente antes da escrita.
        const referencia = await tx.medicaoGeralLeite.findFirst({ where: {
          tanqueId: dados.tanqueId, sessao: { posicaoId: dados.posicaoId, dia: { propriedadeId: dados.propriedadeId, dataOperacional: data } },
        }, select: { id: true, animaisOrigem: true } });
        const anteriores = referencia ? z.array(z.string()).parse(referencia.animaisOrigem) : [];
        await travarAnimais(tx, [...new Set([...anteriores, ...dados.animaisOrigem])]);
        await travarRotinaLeiteTx(tx, dados.propriedadeId);
        await conferirSitioLeiteTx(tx, dados.propriedadeId, true);
        await conferirAnimaisOrigemGeralTx(
          tx,
          dados.propriedadeId,
          data,
          dados.animaisOrigem,
        );
        const identidade = {
          propriedadeId: dados.propriedadeId,
          dataOperacional: data,
        };
        let registroDia = await tx.diaProducaoLeite.findUnique({
          where: { propriedadeId_dataOperacional: identidade },
          include: { configuracao: true },
        });
        const configuracao =
          registroDia?.configuracao ??
          (await garantirConfiguracaoLeiteTx(
            tx,
            dados.propriedadeId,
            data,
            usuarioId,
          ));
        if (configuracao.fonteProducao !== "GERAL")
          throw new RebanhoError(
            "CONFLITO",
            "A configuração desta data usa produção individual. Publique a vigência da aferição geral antes de registrar.",
          );
        const tanque = (
          await listarTanquesTx(tx, dados.propriedadeId, data)
        ).find((t) => t.id === dados.tanqueId && t.ativo);
        if (!tanque)
          throw new RebanhoError(
            "VALIDACAO",
            "Tanque indisponível nesta data e sítio",
          );
        const origemLitros = conferirConversaoTanque(dados, {
          capacidadeLitros: tanque.capacidadeLitros,
          tabelaConversao: pontoConversaoSchema
            .array()
            .parse(tanque.tabelaConversao),
        });
        if (!registroDia) {
          const completa = await garantirConfiguracaoLeiteTx(
            tx,
            dados.propriedadeId,
            data,
            usuarioId,
          );
          registroDia = await tx.diaProducaoLeite.create({
            data: {
              ...identidade,
              configuracaoId: completa.id,
              criadoPorId: usuarioId,
              sessoes: {
                create: completa.ordenhas.map((o) => ({
                  posicaoId: o.posicaoId,
                  nome: o.nome,
                  ordem: o.ordem,
                  horario: o.horario,
                })),
              },
            },
            include: { configuracao: true },
          });
        }
        const sessao = await tx.sessaoOrdenha.findUnique({
          where: {
            diaId_posicaoId: {
              diaId: registroDia.id,
              posicaoId: dados.posicaoId,
            },
          },
        });
        if (!sessao)
          throw new RebanhoError(
            "VALIDACAO",
            "Ordenha não pertence à rotina desta data",
          );
        await tx.$queryRaw`SELECT id FROM pecuaria."SessaoOrdenha" WHERE id=${sessao.id} FOR NO KEY UPDATE`;
        const anterior = await tx.medicaoGeralLeite.findUnique({
          where: {
            sessaoId_tanqueId: { sessaoId: sessao.id, tanqueId: tanque.id },
          },
          include: { entradasEstoque: { where: { status: "CONFIRMADA" } } },
        });
        if (referencia && (anterior?.id !== referencia.id || JSON.stringify(anterior.animaisOrigem) !== JSON.stringify(referencia.animaisOrigem)))
          throw new RebanhoError("CONFLITO", "Os animais de origem mudaram; recarregue antes de salvar");
        if ((anterior?.versao ?? 0) !== dados.versaoEsperada)
          throw new RebanhoError(
            "CONFLITO",
            "A aferição mudou; recarregue antes de salvar",
          );
        if (anterior?.entradasEstoque.length)
          throw new RebanhoError(
            "CONFLITO",
            "Regularize a entrada de estoque antes de corrigir a aferição",
          );
        if (anterior && !dados.motivoCorrecao)
          throw new RebanhoError("VALIDACAO", "Informe o motivo da correção");
        const valores = {
          litros: new Prisma.Decimal(dados.litros),
          reguaMm:
            dados.reguaMm == null ? null : new Prisma.Decimal(dados.reguaMm),
          origemLitros,
          natureza: dados.natureza,
          animaisOrigem: dados.animaisOrigem,
          responsavel: dados.responsavel,
          observacao: dados.observacao ?? null,
        };
        const include = {
          tanque: true,
          entradasEstoque: { select: { id: true, status: true } },
        };
        const salva = anterior
          ? await tx.medicaoGeralLeite.update({
              where: { id: anterior.id, versao: dados.versaoEsperada },
              data: { ...valores, versao: { increment: 1 } },
              include,
            })
          : await tx.medicaoGeralLeite.create({
              data: {
                ...valores,
                sessaoId: sessao.id,
                tanqueId: tanque.id,
                criadoPorId: usuarioId,
              },
              include,
            });
        await auditar(tx, {
          entidade: "MedicaoGeralLeite",
          entidadeId: salva.id,
          propriedadeId: dados.propriedadeId,
          usuarioId,
          acao: anterior ? "CORRECAO" : "MEDICAO",
          antes: anterior,
          depois: { ...salva, motivoCorrecao: dados.motivoCorrecao },
        });
        return medicaoGeralDTO(salva);
      },
    ),
  );
}
