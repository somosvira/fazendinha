import { vincularPoliticaCicloTx } from "./elegibilidade.js";
import { aplicarEscorePartoTx } from "./escore-parto.js";
import { obterContextosAnimaisNaDataTx } from "./contexto-animal.js";
import { normalizarDetalhesParto, aplicarRetencaoPartoTx, aplicarPesoPartoTx, corrigirPesosCriasTx, lerPartoTx } from "./partos.js";
import type { CorrecaoPartoAmpliadaInput } from "./partos.schemas.js";
import { registrarEvidenciaAvaliacaoTx } from "../exames/evidencia-reprodutiva.js";
import { papelReprodutivoNaDataTx } from "../rebanho/papeis.js";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import {
  auditar,
  hojeFazendaDate,
  RebanhoError,
  travarAnimais,
  travarBrincos,
  travarLoteAtivo,
} from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { confirmarFato } from "../idempotencia.js";
import { transacaoPecuaria } from "../transacao.js";
import { consumirEstoqueTx } from "../consumo.js";
import { dinheiro, exigirPeriodoAberto } from "../../financeiro/regras.js";
import { estornarMovimentoTx } from "../../estoque/estoque.js";
import { calcularComposicaoFilho } from "../rebanho/composicao.calc.js";
import { operacaoIdempotenteTx } from "./operacoes.js";
import { totalAtribuidoServicoTx } from "./atribuicoes-servico.js";
import { contadoresCiclo, situacaoReprodutiva, intervalosSobrepostos } from "./regras.calc.js";
import type { AvaliacaoInput, PartoInput, TentativaInput } from "./schemas.js";
import type { z } from "zod";
import {
  restricaoSchema,
  situacaoInicialSchema,
  perdaSchema,
  exposicaoSchema,
  regraSanitariaSchema,
} from "./schemas.js";
export function erro(message: string, campo?: string): never {
  throw new RebanhoError("VALIDACAO", message, campo);
}
export const dia = (d: string) => new Date(`${d}T00:00:00Z`);
const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
/** Chamador deve travar o animal antes de conferir e escrever o intervalo. */
export async function conferirIntervaloGestacaoTx(
  tx: Prisma.TransactionClient, animalId: string, inicio: Date, fim: Date | null, ignorarId?: string,
) {
  const gestacoes = await tx.gestacaoAnimal.findMany({ where: { animalId, status: "VALIDO", ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
  if (gestacoes.some((g) => intervalosSobrepostos({ inicio, fim }, { inicio: g.inicio ?? g.confirmadaEm, fim: g.encerradaEm })))
    erro("Gestação proposta se sobrepõe a uma gestação conhecida; revise o vínculo e a cronologia", "gestacaoId");
}

export async function conferirIntervaloLactacaoTx(tx: Prisma.TransactionClient, animalId: string, inicio: Date, fim: Date | null, ignorarId?: string) {
  const lactacoes = await tx.lactacaoAnimal.findMany({ where: { animalId, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
  if (lactacoes.some((l) => intervalosSobrepostos({ inicio, fim }, { inicio: l.inicio, fim: l.encerradaEm })))
    erro("A lactação proposta se sobrepõe ao histórico; revise os intervalos antes", "iniciarLactacao");
}

export async function conferirMatrizTx(
  tx: Prisma.TransactionClient,
  animalId: string,
  propriedadeId: number,
  data: Date,
) {
  const animal = await conferirAnimalNoFato(tx, animalId, propriedadeId, data);
  if (animal.sexo !== "F") erro("Reprodução exige uma fêmea", "animalId");
  return animal;
}
export async function conferirDisponibilidadeTx(
  tx: Prisma.TransactionClient,
  animalId: string,
  propriedadeId: number,
  data: Date,
  acao: string,
  cienciaSanitaria = false,
) {
  const animal = await conferirMatrizTx(tx, animalId, propriedadeId, data);
  const restricoes = await tx.restricaoReprodutiva.findMany({
    where: {
      animalId,
      status: "VALIDO",
      data: { lte: data },
      OR: [{ ate: null }, { ate: { gt: data } }],
      acoes: { has: acao },
    },
  });
  if (restricoes.length)
    erro(
      `Intervenção bloqueada: ${restricoes.map((r) => r.motivo).join("; ")}`,
      "animalId",
    );
  const gestacao = await tx.gestacaoAnimal.findFirst({
    where: {
      animalId,
      status: "VALIDO",
      confirmadaEm: { lte: data },
      OR: [{ encerradaEm: null }, { encerradaEm: { gte: data } }],
    },
  });
  if (gestacao)
    erro(
      "Há gestação confirmada nesta data; revise o vínculo antes de nova intervenção",
      "animalId",
    );
  const [avaliacoes, ultimoParto, inicial, gestacaoAnterior] =
    await Promise.all([
      tx.avaliacaoReprodutiva.findMany({
        where: { animalId, status: "VALIDO", data: { lte: data } },
      }),
      tx.partoAnimal.findFirst({
        where: { animalId, status: "VALIDO", data: { lte: data } },
        orderBy: { data: "desc" },
      }),
      tx.situacaoInicialReprodutiva.findFirst({
        where: { animalId, status: "VALIDO", data: { lte: data } },
        orderBy: { data: "desc" },
      }),
      tx.gestacaoAnimal.findFirst({
        where: { animalId, status: "VALIDO", confirmadaEm: { lte: data } },
        orderBy: { confirmadaEm: "desc" },
      }),
    ]);
  if (
    situacaoReprodutiva({
      avaliacoes,
      ultimoParto,
      inicial,
      gestacao: gestacaoAnterior,
    }) === "GESTANTE"
  )
    erro(
      "Há evidência de gestação nesta data; reconcilie o diagnóstico/perda antes de intervir",
      "animalId",
    );
  const aplicaveis = await consultaAlertasSanitariosTx(tx, animalId, propriedadeId, data, acao);
  if (aplicaveis.some((r) => r.efeito === "BLOQUEAR"))
    erro(
      `Regra sanitária impede esta ação: ${aplicaveis
        .filter((r) => r.efeito === "BLOQUEAR")
        .map((r) => r.motivo)
        .join("; ")}`,
      "animalId",
    );
  if (aplicaveis.length && !cienciaSanitaria)
    erro(
      "Confirme ciência dos alertas sanitários configurados para esta ação",
      "cienciaSanitaria",
    );
  return animal;
}
/** Projeção clínica acompanha o animal; o chamador autoriza sua localização na data consultada. */
export async function obterEstadosReprodutivosTx(tx: Prisma.TransactionClient, animalIds: string[], data: Date) {
  const base = { animalId: { in: animalIds }, status: "VALIDO" as const, data: { lte: data } };
  const [animais, tentativas, avaliacoes, partos, restricoes, gestacoes, iniciais] = await Promise.all([
    tx.animal.findMany({ where: { id: { in: animalIds } }, select: { id: true, partosAntesDaEntrada: true } }),
    tx.tentativaReprodutiva.findMany({ where: base, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], select: { id: true, animalId: true, data: true, tipo: true, status: true, ordem: true, ciclo: true, touroId: true, touroExternoId: true, geneticaSnapshot: true } }),
    tx.avaliacaoReprodutiva.findMany({ where: base, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], select: { animalId: true, data: true, resultado: true, sexoFetal: true, gestacaoId: true } }),
    tx.partoAnimal.findMany({ where: base, orderBy: { data: "desc" }, select: { id: true, animalId: true, data: true, tipo: true, status: true, incluidoSaldoAnterior: true, retencaoPlacenta: true } }),
    tx.restricaoReprodutiva.findMany({ where: { ...base, OR: [{ ate: null }, { ate: { gt: data } }] }, select: { id: true, animalId: true, tipo: true, data: true, ate: true, motivo: true, acoes: true, status: true } }),
    tx.gestacaoAnimal.findMany({ where: { animalId: { in: animalIds }, status: "VALIDO", confirmadaEm: { lte: data } }, orderBy: { confirmadaEm: "desc" }, select: { id: true, animalId: true, confirmadaEm: true, encerradaEm: true, previsaoParto: true, sexoFetal: true, status: true } }),
    tx.situacaoInicialReprodutiva.findMany({ where: base, orderBy: { data: "desc" }, select: { animalId: true, data: true, situacao: true } }),
  ]);
  return new Map(animais.map((a) => {
    const gestacaoConhecida = gestacoes.find((g) => g.animalId === a.id) ?? null;
    const avaliacoesAnimal = avaliacoes.filter((v) => v.animalId === a.id);
    const tentativasAnimal = tentativas.filter((t) => t.animalId === a.id);
    const partosAnimal = partos.filter((p) => p.animalId === a.id);
    const gestacao = gestacaoConhecida && (!gestacaoConhecida.encerradaEm || gestacaoConhecida.encerradaEm > data)
      ? { ...gestacaoConhecida, encerradaEm: null, sexoFetal: avaliacoesAnimal.find((v) => v.gestacaoId === gestacaoConhecida.id && v.sexoFetal)?.sexoFetal ?? null }
      : null;
    const ultimaTentativa = tentativasAnimal[0] ?? null;
    const ultimoParto = partosAnimal[0] ?? null;
    return [a.id, {
      situacao: situacaoReprodutiva({ referencia: data, gestacao: gestacaoConhecida, avaliacoes: avaliacoesAnimal, ultimaTentativa, ultimoParto, inicial: iniciais.find((i) => i.animalId === a.id) }),
      ...contadoresCiclo(a.partosAntesDaEntrada, partosAnimal, tentativasAnimal, data),
      gestacao, ultimaTentativa, ultimoParto, avaliacoes: avaliacoesAnimal,
      restricoes: restricoes.filter((r) => r.animalId === a.id),
    }] as const;
  }));
}
export async function obterEstadoReprodutivoTx(tx: Prisma.TransactionClient, animalId: string, data: Date) {
  const estado = (await obterEstadosReprodutivosTx(tx, [animalId], data)).get(animalId);
  if (!estado) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
  return estado;
}
export async function consultaAlertasSanitariosTx(tx: Prisma.TransactionClient, animalId: string, propriedadeId: number, data: Date, acao: string) {
  const regras = await tx.regraSanitariaReprodutiva.findMany({ where: { propriedadeId, acao, ativo: true } });
  const ocorrencias = await tx.ocorrenciaSanitaria.findMany({ where: { animalId, status: "VALIDO", inicio: { lte: data }, OR: [{ fim: null }, { fim: { gte: data } }], doencaId: { in: regras.map((r) => r.doencaId) } } });
  return regras.filter((r) => ocorrencias.some((o) => o.doencaId === r.doencaId)).map((r) => ({ motivo: r.motivo, efeito: r.efeito, doencaId: r.doencaId }));
}
async function genitorTx(
  tx: Prisma.TransactionClient,
  id: string | null | undefined,
  externo: string | null | undefined,
  sexo: "F" | "M",
) {
  if (id && externo) erro("Selecione apenas um genitor por lado");
  if (!id && !externo) return null;
  const g = id
    ? await tx.animal.findUnique({
        where: { id },
        include: { composicao: { include: { raca: true } } },
      })
    : await tx.genitorExterno.findUnique({
        where: { id: externo! },
        include: { composicao: { include: { raca: true } } },
      });
  if (!g || g.sexo !== sexo)
    erro("Genitor não encontrado ou sexo incompatível");
  return {
    id: g.id,
    externo: !!externo,
    nome: g.nome,
    composicao: g.composicao.map((c) => ({
      racaId: c.racaId,
      sigla: c.raca.sigla,
      fracao64: c.fracao64,
    })),
  };
}
export async function criarTentativaTx(
  tx: Prisma.TransactionClient,
  input: TentativaInput,
  usuarioId: number | null,
) {
  await travarAnimais(tx, [input.animalId]);
  const data = dia(input.data);
  const matriz = await conferirDisponibilidadeTx(
    tx,
    input.animalId,
    input.propriedadeId,
    data,
    input.tipo,
    input.cienciaSanitaria,
  );
  const material = input.materialId
    ? await tx.materialGenetico.findUnique({
        where: { id: input.materialId },
        include: { produto: true },
      })
    : null;
  if (
    input.tipo !== "COBERTURA" &&
    (!material || material.tipo !== (input.tipo === "IA" ? "SEMEN" : "EMBRIAO"))
  )
    erro(
      "Selecione material genético compatível com a tentativa",
      "materialId",
    );
  if (input.tipo === "COBERTURA" && material)
    erro("Cobertura não consome material genético", "materialId");
  const pai = await genitorTx(
    tx,
    material?.touroId ?? input.touroId,
    material?.touroExternoId ?? input.touroExternoId,
    "M",
  );
  if (!pai && input.tipo === "COBERTURA")
    erro("Informe o reprodutor", "touroId");
  const mae =
    input.tipo === "TE"
      ? await genitorTx(
          tx,
          material?.doadoraId,
          material?.doadoraExternaId,
          "F",
        )
      : await genitorTx(tx, matriz.id, null, "F");

  const ultimoParto = await tx.partoAnimal.findFirst({
    where: { animalId: input.animalId, status: "VALIDO", data: { lte: data } },
    orderBy: { data: "desc" },
  });
  const ciclo =
    matriz.partosAntesDaEntrada +
    (await tx.partoAnimal.count({
      where: {
        animalId: matriz.id,
        status: "VALIDO",
        incluidoSaldoAnterior: false,
        data: { lte: data },
      },
    }));
  const posteriores = await tx.tentativaReprodutiva.count({
    where: { animalId: matriz.id, status: "VALIDO", data: { gt: data } },
  });
  if (posteriores)
    erro(
      "Tentativa anterior a outra já registrada: revise a cronologia antes de incluir",
      "data",
    );
  const existentes = await tx.tentativaReprodutiva.findMany({
    where: { animalId: matriz.id, ciclo },
    select: { ordem: true },
  });
  const ordem = Math.max(0, ...existentes.map((e) => e.ordem)) + 1;
  let movimentoEstoqueId: string | null = null,
    valorProdutoAtribuido: Prisma.Decimal | null = null;
  let partidaSnapshot: {
    id: string;
    codigo: string;
    validade: Date | null;
  } | null = null;
  let quantidade: Prisma.Decimal | null =
    input.quantidade == null ? null : new Prisma.Decimal(input.quantidade);
  if (input.tipo === "COBERTURA") {
    if (input.origem === "ESTOQUE" || quantidade || input.partidaId)
      erro("Cobertura não possui baixa de insumo", "origem");
  } else if (input.origem === "ESTOQUE") {
    if (!quantidade || quantidade.decimalPlaces() > 3)
      erro(
        "Informe quantidade positiva com até três casas decimais",
        "quantidade",
      );
    const produto = material!.produto;
    if (!produto.ativo || !produto.usoGenetico)
      erro("Produto não está ativo para uso genético", "materialId");
    const consumo = await consumirEstoqueTx(tx, { produto, propriedadeId: input.propriedadeId, quantidade, campoQuantidade: "quantidade",
      data, partidaId: input.partidaId, cienciaValidadeDesconhecida: input.cienciaValidadeDesconhecida,
      documentacaoExcepcional: input.documentacaoExcepcional, motivoDocumentacaoExcepcional: input.motivoDocumentacaoExcepcional,
      origem: "REPRODUCAO", observacao: `Tentativa ${input.tipo} ${input.animalId}`, usuarioId });
    movimentoEstoqueId = consumo.movimentoEstoqueId;
    valorProdutoAtribuido = consumo.valorProdutoAtribuido;
    partidaSnapshot = consumo.partida ? { id: consumo.partida.id, codigo: consumo.partida.codigo, validade: consumo.partida.validade } : null;
  } else if (input.origem === "SERVICO" && !input.operacaoServicoId)
    erro("Vincule um Serviço confirmado", "operacaoServicoId");
  else if (input.origem === "DOCUMENTADA" && !input.justificativaSemOrigem)
    erro("Justifique a origem documentada", "justificativaSemOrigem");
  if (input.operacaoServicoId) {
    await tx.$queryRaw`SELECT id FROM "public"."Operacao" WHERE id = ${input.operacaoServicoId} FOR UPDATE`;
    const servico = await tx.operacao.findFirst({
      where: {
        id: input.operacaoServicoId,
        propriedadeId: input.propriedadeId,
        tipo: "SERVICO",
        status: "CONFIRMADA",
        data: { lte: data },
      },
    });
    if (!servico)
      erro(
        "Serviço confirmado incompatível com sítio/data",
        "operacaoServicoId",
      );
    if (input.valorServicoAtribuido != null) {
      const total = dinheiro(input.valorServicoAtribuido).plus(
        await totalAtribuidoServicoTx(tx, input.operacaoServicoId, input.propriedadeId),
      );
      if (total.gt(servico.valorTotal))
        erro(
          "Atribuição supera o valor confirmado do Serviço",
          "valorServicoAtribuido",
        );
    }
    await exigirPeriodoAberto(tx, input.propriedadeId, data);
  } else if (input.valorServicoAtribuido != null)
    erro("Valor exige vínculo a Serviço", "valorServicoAtribuido");
  const criada = await tx.tentativaReprodutiva.create({
    data: {
      animalId: input.animalId,
      propriedadeId: input.propriedadeId,
      data,
      tipo: input.tipo,
      ciclo,
      ordem,
      materialId: material?.id,
      touroId: pai && !pai.externo ? pai.id : null,
      touroExternoId: pai?.externo ? pai.id : null,
      origemMaterial: input.origem,
      quantidade,
      partidaId: input.partidaId,
      operacaoServicoId: input.operacaoServicoId,
      movimentoEstoqueId,
      valorProdutoAtribuido,
      valorServicoAtribuido:
        input.valorServicoAtribuido == null
          ? null
          : dinheiro(input.valorServicoAtribuido),
      geneticaSnapshot: json({
        mae,
        pai,
        material: material
          ? {
              id: material.id,
              tipo: material.tipo,
              produtoId: material.produtoId,
              nomeProduto: material.produto.nome,
              unidadeProduto: material.produto.unidade,
              partida: partidaSnapshot,
              tipoSemen: material.tipoSemen,
            }
          : null,
        receptoraId: input.tipo === "TE" ? matriz.id : null,
        ultimoPartoId: ultimoParto?.id,
      }),
      responsavel: input.responsavel,
      observacao: input.observacao,
      criadoPorId: usuarioId,
    },
  });
  await auditar(tx, {
    entidade: "TentativaReprodutiva",
    entidadeId: criada.id,
    animalId: matriz.id,
    propriedadeId: input.propriedadeId,
    acao: "REGISTRO",
    usuarioId,
    depois: {
      ...criada,
      cienciaSanitaria: input.cienciaSanitaria === true,
      cienciaValidadeDesconhecida: input.cienciaValidadeDesconhecida === true,
      documentacaoExcepcional: input.documentacaoExcepcional === true,
      motivoDocumentacaoExcepcional:
        input.motivoDocumentacaoExcepcional ?? null,
      justificativaSemOrigem: input.justificativaSemOrigem ?? null,
    },
  });
  return criada;
}
export const criarTentativa = (
  input: TentativaInput,
  usuarioId: number | null,
) =>
  confirmarFato(
    input,
    usuarioId,
    "TENTATIVA_REPRODUTIVA",
    criarTentativaTx,
    (tx, id) => tx.tentativaReprodutiva.findUniqueOrThrow({ where: { id } }),
  );
export async function criarAvaliacaoTx(
  tx: Prisma.TransactionClient,
  input: AvaliacaoInput,
  usuarioId: number | null,
) {
  await travarAnimais(tx, [input.animalId]);
  const data = dia(input.data);
  if (input.sexoFetal && ["NAO_AVALIADO", "NEGATIVO"].includes(input.resultado)) erro("Sexo fetal exige exame realizado com evidência de gestação", "sexoFetal");
  if ((input.resultado === "SEXAGEM" && input.finalidade && input.finalidade !== "SEXAGEM") || (input.finalidade === "SEXAGEM" && input.resultado !== "SEXAGEM" && input.resultado !== "NAO_AVALIADO") || (input.resultado === "RECONFIRMACAO" && input.finalidade && input.finalidade !== "RECONFIRMACAO")) erro("Finalidade e conclusão incompatíveis", "finalidade");
  if (input.resultado !== "NAO_AVALIADO" && ["RECONFIRMACAO", "SEXAGEM"].includes(input.finalidade ?? "") && !input.gestacaoId)
    erro("Vincule a gestação conhecida para esta finalidade", "gestacaoId");
  await conferirMatrizTx(tx, input.animalId, input.propriedadeId, data);
  const tentativa = input.tentativaId
    ? await tx.tentativaReprodutiva.findFirst({
        where: {
          id: input.tentativaId,
          animalId: input.animalId,
          status: "VALIDO",
          data: { lte: data },
        },
      })
    : null;
  if (input.tentativaId && !tentativa)
    erro("Tentativa não pertence ao animal/data", "tentativaId");
  let gestacao = input.gestacaoId
    ? await tx.gestacaoAnimal.findFirst({
        where: {
          id: input.gestacaoId,
          animalId: input.animalId,
          status: "VALIDO",
          confirmadaEm: { lte: data },
          OR: [{ encerradaEm: null }, { encerradaEm: { gte: data } }],
        },
      })
    : null;
  if (input.gestacaoId && !gestacao)
    erro("Gestação não pertence ao animal/data", "gestacaoId");
  if (gestacao && tentativa && gestacao.tentativaId !== tentativa.id)
    erro("Gestação e tentativa divergem", "tentativaId");
  let gestacaoCriada = false,
    restricaoId: string | null = null;
  if (input.resultado === "POSITIVO") {
    if (!gestacao) {
      if (!tentativa && !input.motivoVinculoDesconhecido)
        erro(
          "Vincule a tentativa comprovada ou explique por que o vínculo é desconhecido",
          "motivoVinculoDesconhecido",
        );
      await conferirIntervaloGestacaoTx(tx, input.animalId, tentativa?.data ?? data, null);
      if (await tx.partoAnimal.count({ where: { animalId: input.animalId, status: "VALIDO", data: { gte: tentativa?.data ?? data } } }))
        erro("O diagnóstico aberto conflita com parto já registrado; reconcilie a cronologia antes", "data");
      gestacaoCriada = true;
      gestacao = await tx.gestacaoAnimal.create({
        data: {
          animalId: input.animalId,
          propriedadeId: input.propriedadeId,
          tentativaId: tentativa?.id,
          inicio: tentativa?.data,
          origem: tentativa ? "MANUAL" : "DOCUMENTADA",
          confirmadaEm: data,
          previsaoParto: input.previsaoParto ? dia(input.previsaoParto) : null,
          criadoPorId: usuarioId,
        },
      });
    }
  }
  if (["RECONFIRMACAO", "SEXAGEM"].includes(input.resultado) && !gestacao)
    erro("Esta avaliação exige gestação conhecida", "gestacaoId");
  if (input.resultado === "NEGATIVO") {
    const conhecida = await tx.gestacaoAnimal.findFirst({
      where: {
        animalId: input.animalId,
        status: "VALIDO",
        confirmadaEm: { lte: data },
        OR: [{ encerradaEm: null }, { encerradaEm: { gt: data } }],
      },
    });
    if (conhecida)
      erro(
        "Há gestação nesta data; registre a perda ou corrija o diagnóstico antes",
        "resultado",
      );
  }
  if (input.resultado === "SEXAGEM" && !input.sexoFetal)
    erro("Informe o sexo fetal observado", "sexoFetal");
  if (input.sexoFetal && !gestacao)
    erro("Sexo fetal exige vínculo a gestação", "sexoFetal");
  if (input.sexoFetal && gestacao) {
    const posterior = await tx.avaliacaoReprodutiva.count({
      where: {
        gestacaoId: gestacao.id,
        status: "VALIDO",
        sexoFetal: { not: null },
        data: { gt: data },
      },
    });
    if (!posterior)
      gestacao = await tx.gestacaoAnimal.update({
        where: { id: gestacao.id },
        data: { sexoFetal: input.sexoFetal },
      });
  }
  if (input.conduta === "IATF") {
    if (input.resultado !== "NEGATIVO") erro("Indicação IATF exige avaliação vazia explícita", "resultado");
    const restricoes = await tx.restricaoReprodutiva.findMany({ where: { animalId: input.animalId, status: "VALIDO", data: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }], acoes: { has: "IATF" } } });
    if (restricoes.length) erro(`Indicação IATF bloqueada: ${restricoes.map((r) => r.motivo).join("; ")}`, "conduta");
    const alertas = await consultaAlertasSanitariosTx(tx, input.animalId, input.propriedadeId, data, "IATF");
    if (alertas.some((a) => a.efeito === "BLOQUEAR")) erro("Regra sanitária impede indicação IATF", "conduta");
    if (alertas.length && !input.cienciaSanitaria) erro("Confirme ciência dos alertas sanitários para indicar IATF", "cienciaSanitaria");
  }
  if (input.conduta === "DESCARTE") {
    if (!input.motivo) erro("Descarte exige motivo", "motivo");
    restricaoId = (
      await tx.restricaoReprodutiva.create({
        data: {
          animalId: input.animalId,
          propriedadeId: input.propriedadeId,
          data,
          tipo: "DESCARTE",
          motivo: input.motivo!,
          acoes: ["IA", "TE", "COBERTURA", "IATF"],
          criadoPorId: usuarioId,
        },
      })
    ).id;
  }
  if (input.retornoEm && dia(input.retornoEm) < data)
    erro("Retorno não pode anteceder a avaliação", "retornoEm");
  if (input.previsaoParto && dia(input.previsaoParto) < data)
    erro("Previsão de parto não pode anteceder o diagnóstico", "previsaoParto");
  const criada = await registrarEvidenciaAvaliacaoTx(tx, {
      tipoExameId: input.tipoExameId, formatoExameHash: input.formatoExameHash, responsavel: input.responsavel, finalidade: input.finalidade, resultados: input.resultados,
      animalId: input.animalId,
      propriedadeId: input.propriedadeId,
      data,
      gestacaoCriada,
      restricaoId,
      resultado: input.resultado,
      tentativaId: tentativa?.id,
      gestacaoId: gestacao?.id,
      sexoFetal: input.sexoFetal,
      conduta: input.conduta,
      motivo: input.motivo ?? input.motivoVinculoDesconhecido,
      anotacaoOriginal: input.anotacaoOriginal,
      retornoEm: input.retornoEm ? dia(input.retornoEm) : null,
      observacao: input.observacao,
      criadoPorId: usuarioId,
  });
  await auditar(tx, {
    entidade: "AvaliacaoReprodutiva",
    entidadeId: criada.id,
    animalId: input.animalId,
    propriedadeId: input.propriedadeId,
    acao: "REGISTRO",
    usuarioId,
    depois: { ...criada, cienciaSanitaria: input.cienciaSanitaria === true },
  });
  return criada;
}
export const criarAvaliacao = (
  input: AvaliacaoInput,
  usuarioId: number | null,
) =>
  confirmarFato(
    input,
    usuarioId,
    "AVALIACAO_REPRODUTIVA",
    criarAvaliacaoTx,
    (tx, id) => tx.avaliacaoReprodutiva.findUniqueOrThrow({ where: { id } }),
  );
export async function criarPartoTx(
  tx: Prisma.TransactionClient,
  input: PartoInput,
  usuarioId: number | null,
) {
  const detalhes = normalizarDetalhesParto(input, input.data);
  const data = dia(input.data),
    idsCrias = input.crias.map(() => crypto.randomUUID());
  await travarAnimais(tx, [input.animalId, ...idsCrias]);
  await conferirMatrizTx(tx, input.animalId, input.propriedadeId, data);
  if (
    ["NATIMORTO", "ABORTO"].includes(detalhes.tipo) &&
    input.crias.some((c) => c.viva)
  )
    erro(
      "Aborto/natimorto não pode possuir cria viva; revise o tipo do parto",
      "crias",
    );
  if (["NORMAL", "DISTOCICO", "NASCIMENTO"].includes(detalhes.tipo) && !input.crias.length)
    erro("Informe as crias deste parto", "crias");
  if (
    await tx.partoAnimal.count({
      where: { animalId: input.animalId, data, status: "VALIDO" },
    })
  )
    erro("Já existe parto válido nesta data", "data");
  if (
    await tx.tentativaReprodutiva.count({
      where: { animalId: input.animalId, status: "VALIDO", data: { gt: data } },
    })
  )
    erro(
      "Parto anterior a tentativa já registrada: revise os ciclos antes",
      "data",
    );
  const gestacao = input.gestacaoId
    ? await tx.gestacaoAnimal.findFirst({
        where: {
          id: input.gestacaoId,
          animalId: input.animalId,
          status: "VALIDO",
          encerradaEm: null,
          confirmadaEm: { lte: data },
        },
      })
    : null;
  if (input.gestacaoId && !gestacao)
    erro("Gestação incompatível com o parto", "gestacaoId");
  if (
    !gestacao &&
    (await tx.gestacaoAnimal.count({
      where: { animalId: input.animalId, status: "VALIDO", encerradaEm: null },
    }))
  )
    erro("Vincule a gestação em aberto ao parto", "gestacaoId");
  if (gestacao && await tx.avaliacaoReprodutiva.count({ where: { gestacaoId: gestacao.id, status: "VALIDO", data: { gt: data } } }))
    erro("O parto antecede avaliações da gestação; revise a cronologia antes", "data");
  const tentativa = gestacao?.tentativaId
    ? await tx.tentativaReprodutiva.findUniqueOrThrow({
        where: { id: gestacao.tentativaId },
      })
    : null;
  type Gen = {
    id: string;
    externo: boolean;
    composicao: { racaId: string; sigla: string; fracao64: number }[];
  };
  const genetica = tentativa?.geneticaSnapshot as
    | { mae?: Gen | null; pai?: Gen | null }
    | undefined;
  const papelNoParto = await papelReprodutivoNaDataTx(tx, input.animalId, data);
  if (!tentativa && papelNoParto.estado === "CONFLITO") erro("Papel reprodutivo conflitante na data do parto; concilie o histórico antes de definir a filiação", "gestacaoId");
  // Sem tentativa comprovada e sem papel conhecido, a mãe genética permanece desconhecida.
  const receptoraSemVinculo = !tentativa && (papelNoParto.papel === "RECEPTORA" || papelNoParto.estado === "DESCONHECIDO");
  const mae =
      tentativa?.tipo === "TE" || receptoraSemVinculo
        ? (genetica?.mae ?? null)
        : (genetica?.mae ?? (await genitorTx(tx, input.animalId, null, "F"))),
    pai = genetica?.pai ?? null;

  const brincos = input.crias.map(
    (c, i) => c.brinco || `PROV-${idsCrias[i].replace(/-/g, "").slice(0, 30)}`,
  );
  if (
    new Set(brincos.map((b) => b.toLocaleLowerCase("pt-BR"))).size !==
    brincos.length
  )
    erro("As crias precisam de identificações diferentes", "crias");
  for (const lote of [
    ...new Set(
      input.crias.flatMap((c) => (c.viva && c.loteId ? [c.loteId] : [])),
    ),
  ].sort())
    await travarLoteAtivo(tx, lote, input.propriedadeId);
  await travarBrincos(
    tx,
    brincos.map((brinco) => ({
      propriedadeId: input.propriedadeId,
      brincoNormalizado: brinco.toLocaleLowerCase("pt-BR"),
    })),
  );
  for (const brinco of brincos)
    if (
      await tx.animal.count({
        where: {
          brinco: { equals: brinco, mode: "insensitive" },
          localizacoes: {
            some: { propriedadeId: input.propriedadeId, ate: null },
          },
        },
      })
    )
      erro("Brinco de cria já está em uso neste sítio", "crias");
  const parto = await tx.partoAnimal.create({
    data: {
      animalId: input.animalId,
      propriedadeId: input.propriedadeId,
      data,
      gestacaoId: gestacao?.id,
      ...detalhes,
      responsavel: input.responsavel,
      observacao: input.observacao,
      criadoPorId: usuarioId,
    },
  });
  if (await tx.politicaElegibilidadeReprodutiva.count({ where: { propriedadeId: input.propriedadeId } }))
    await vincularPoliticaCicloTx(tx, { animalId: input.animalId, propriedadeId: input.propriedadeId, partoId: parto.id }, usuarioId);
  const crias = [];
  for (const [i, cria] of input.crias.entries()) {
    const filiacao = {
      maeId: mae && !mae.externo ? mae.id : null,
      maeExternaId: mae?.externo ? mae.id : null,
      paiId: pai && !pai.externo ? pai.id : null,
      paiExternoId: pai?.externo ? pai.id : null,
    };
    if (cria.viva) {
      const animal = await tx.animal.create({
        data: {
          id: idsCrias[i],
          brinco: brincos[i],
          identificacaoProvisoria: !cria.brinco,
          codigoProvisorio: cria.brinco ? null : brincos[i],
          nome: cria.nome,
          sexo: cria.sexo,
          dataNascimento: data,
          dataEntrada: data,
          origem: "NASCIDO",
          ...filiacao,
          criadoPorId: usuarioId,
          localizacoes: {
            create: {
              propriedadeId: input.propriedadeId,
              loteId: cria.loteId,
              desde: data,
              criadoPorId: usuarioId,
            },
          },
          papeisReprodutivos: { create: { tipo: "NENHUM", inicio: data, origem: "MANUAL", criadoPorId: usuarioId } },
          destinos: {
            create: {
              aptidao: cria.aptidao,
              desde: data,
              criadoPorId: usuarioId,
            },
          },
        },
      });
      const racas = new Map(
        [...(mae?.composicao ?? []), ...(pai?.composicao ?? [])].map((r) => [
          r.sigla,
          r.racaId,
        ]),
      );
      const composicao = calcularComposicaoFilho(
        mae?.composicao ?? [],
        pai?.composicao ?? [],
      );
      if (composicao.length)
        await tx.composicaoRacial.createMany({
          data: composicao.map((c) => ({
            animalId: animal.id,
            racaId: racas.get(c.sigla)!,
            fracao64: c.fracao64,
            fracaoCalculada64: c.fracao64,
            origem: "CALCULADA",
            criadoPorId: usuarioId,
          })),
        });
      await auditar(tx, {
        entidade: "Animal",
        entidadeId: animal.id,
        animalId: animal.id,
        propriedadeId: input.propriedadeId,
        acao: "NASCIMENTO_POR_PARTO",
        usuarioId,
        depois: { partoId: parto.id, ...animal },
      });
    }
    const criaSalva = await tx.criaParto.create({
        data: {
          partoId: parto.id,
          animalId: cria.viva ? idsCrias[i] : null,
          viva: cria.viva,
          sexo: cria.sexo,
          aptidao: cria.aptidao,
          ordem: i + 1,
          filiacaoSnapshot: json({
            ...filiacao,
            receptoraId:
              tentativa?.tipo === "TE" || receptoraSemVinculo
                ? input.animalId
                : null,
            brincoInformado: cria.brinco ?? null,
            nomeInformado: cria.nome ?? null,
            pesoKg: cria.pesoKg ?? null,
          }),
        },
      });
    crias.push(criaSalva);
    if (cria.viva && cria.pesoKg != null) await aplicarPesoPartoTx(tx, parto, { acao: "REGISTRAR", data: input.data, pesoKg: cria.pesoKg }, usuarioId, criaSalva);
  }
  if (gestacao)
    await tx.gestacaoAnimal.update({
      where: { id: gestacao.id },
      data: { encerradaEm: data, motivoEncerramento: `PARTO_${detalhes.tipo}` },
    });
  if (input.iniciarLactacao) {
    await conferirIntervaloLactacaoTx(tx, input.animalId, data, null);
    const destino = await tx.destinoAnimal.findFirst({
      where: {
        animalId: input.animalId,
        desde: { lte: data },
        OR: [{ ate: null }, { ate: { gt: data } }],
      },
    });
    if (destino?.aptidao !== "LEITE")
      erro(
        "Início de lactação exige aptidão leiteira na data do parto",
        "iniciarLactacao",
      );
    await tx.lactacaoAnimal.create({
      data: {
        animalId: input.animalId,
        propriedadeId: input.propriedadeId,
        partoId: parto.id,
        inicio: data,
        criadoPorId: usuarioId,
      },
    });
  }
  await aplicarRetencaoPartoTx(tx, parto, input, usuarioId);
  await aplicarPesoPartoTx(tx, parto, input.pesoMatriz, usuarioId);
  await aplicarEscorePartoTx(tx, parto, input.escoreMatriz, usuarioId);
  await auditar(tx, {
    entidade: "PartoAnimal",
    entidadeId: parto.id,
    animalId: input.animalId,
    propriedadeId: input.propriedadeId,
    acao: "REGISTRO",
    usuarioId,
    depois: { parto, crias },
  });
  return lerPartoTx(tx, parto.id);
}
export const criarParto = (input: PartoInput, usuarioId: number | null) =>
  confirmarFato(input, usuarioId, "PARTO", criarPartoTx, lerPartoTx);
export async function criarSituacaoInicial(
  input: z.infer<typeof situacaoInicialSchema>,
  usuarioId: number | null,
) {
  return confirmarFato(
    input,
    usuarioId,
    "SITUACAO_INICIAL",
    async (tx) => {
      await conferirMatrizTx(
        tx,
        input.animalId,
        input.propriedadeId,
        dia(input.data),
      );
      const { chave: _chave, data, aptaDesde, ...resto } = input;
      const fato = await tx.situacaoInicialReprodutiva.create({
        data: {
          ...resto,
          data: dia(data),
          aptaDesde: aptaDesde ? dia(aptaDesde) : null,
          criadoPorId: usuarioId,
        },
      });
      await auditar(tx, {
        entidade: "SituacaoInicialReprodutiva",
        entidadeId: fato.id,
        animalId: input.animalId,
        propriedadeId: input.propriedadeId,
        acao: "REGISTRO",
        usuarioId,
        depois: fato,
      });
      return fato;
    },
    (tx, id) =>
      tx.situacaoInicialReprodutiva.findUniqueOrThrow({ where: { id } }),
  );
}
export async function criarRestricao(
  input: z.infer<typeof restricaoSchema>,
  usuarioId: number | null,
) {
  return confirmarFato(
    input,
    usuarioId,
    "RESTRICAO_REPRODUTIVA",
    async (tx) => {
      await conferirMatrizTx(
        tx,
        input.animalId,
        input.propriedadeId,
        dia(input.data),
      );
      if (input.ate && dia(input.ate) < dia(input.data))
        erro("Fim antecede início da restrição", "ate");
      const { chave: _chave, data, ate, ...resto } = input;
      const fato = await tx.restricaoReprodutiva.create({
        data: {
          ...resto,
          data: dia(data),
          ate: ate ? dia(ate) : null,
          criadoPorId: usuarioId,
        },
      });
      await auditar(tx, {
        entidade: "RestricaoReprodutiva",
        entidadeId: fato.id,
        animalId: input.animalId,
        propriedadeId: input.propriedadeId,
        acao: "REGISTRO",
        usuarioId,
        depois: fato,
      });
      return fato;
    },
    (tx, id) => tx.restricaoReprodutiva.findUniqueOrThrow({ where: { id } }),
  );
}
export async function registrarPerda(
  input: z.infer<typeof perdaSchema>,
  usuarioId: number | null,
) {
  return confirmarFato(
    input,
    usuarioId,
    "PERDA_GESTACAO",
    async (tx) => {
      await conferirMatrizTx(
        tx,
        input.animalId,
        input.propriedadeId,
        dia(input.data),
      );
      const g = await tx.gestacaoAnimal.findFirst({
        where: {
          id: input.gestacaoId,
          animalId: input.animalId,
          status: "VALIDO",
          encerradaEm: null,
          confirmadaEm: { lte: dia(input.data) },
        },
      });
      if (!g)
        erro(
          "Gestação não está aberta ou data antecede confirmação",
          "gestacaoId",
        );
      if (await tx.avaliacaoReprodutiva.count({ where: { gestacaoId: g.id, status: "VALIDO", data: { gt: dia(input.data) } } }))
        erro("Perda antecede avaliações vinculadas; revise a cronologia antes", "data");
      const fato = await tx.gestacaoAnimal.update({
        where: { id: g.id },
        data: {
          encerradaEm: dia(input.data),
          motivoEncerramento: input.motivo,
        },
      });
      await auditar(tx, {
        entidade: "GestacaoAnimal",
        entidadeId: g.id,
        animalId: input.animalId,
        propriedadeId: input.propriedadeId,
        acao: "PERDA",
        usuarioId,
        antes: g,
        depois: fato,
      });
      return fato;
    },
    (tx, id) => tx.gestacaoAnimal.findUniqueOrThrow({ where: { id } }),
  );
}
export async function encerrarRestricao(
  id: string,
  propriedadeId: number,
  data: string,
  motivo: string,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const antes = await tx.restricaoReprodutiva.findFirst({
      where: { id, propriedadeId, status: "VALIDO" },
    });
    if (!antes)
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Restrição não encontrada neste sítio",
      );
    await travarAnimais(tx, [antes.animalId]);
    await conferirMatrizTx(tx, antes.animalId, propriedadeId, dia(data));
    if (dia(data) < antes.data || antes.ate)
      erro("Restrição já encerrada ou data inválida", "data");
    const fato = await tx.restricaoReprodutiva.update({
      where: { id },
      data: { ate: dia(data), motivoEncerramento: motivo },
    });
    await auditar(tx, {
      entidade: "RestricaoReprodutiva",
      entidadeId: id,
      animalId: antes.animalId,
      propriedadeId,
      acao: "ENCERRAMENTO",
      usuarioId,
      antes,
      depois: fato,
    });
    return fato;
  });
}
export async function encerrarLactacao(
  id: string,
  propriedadeId: number,
  data: string,
  motivo: string,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const antes = await tx.lactacaoAnimal.findFirst({
      where: { id, propriedadeId, encerradaEm: null },
    });
    if (!antes)
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Lactação aberta não encontrada neste sítio",
      );
    await travarAnimais(tx, [antes.animalId]);
    await conferirMatrizTx(tx, antes.animalId, propriedadeId, dia(data));
    if (dia(data) < antes.inicio) erro("Encerramento antecede início", "data");
    const fato = await tx.lactacaoAnimal.update({
      where: { id },
      data: { encerradaEm: dia(data), motivoEncerramento: motivo, versao: { increment: 1 } },
    });
    await auditar(tx, {
      entidade: "LactacaoAnimal",
      entidadeId: id,
      animalId: antes.animalId,
      propriedadeId,
      acao: "ENCERRAMENTO",
      usuarioId,
      antes,
      depois: fato,
    });
    return fato;
  });
}
export async function configurarRegraSanitaria(
  input: z.infer<typeof regraSanitariaSchema>,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    if (!(await tx.doenca.findUnique({ where: { id: input.doencaId } })))
      erro("Doença não encontrada", "doencaId");
    const antes = await tx.regraSanitariaReprodutiva.findUnique({
      where: {
        propriedadeId_doencaId_acao: {
          propriedadeId: input.propriedadeId,
          doencaId: input.doencaId,
          acao: input.acao,
        },
      },
    });
    const fato = await tx.regraSanitariaReprodutiva.upsert({
      where: {
        propriedadeId_doencaId_acao: {
          propriedadeId: input.propriedadeId,
          doencaId: input.doencaId,
          acao: input.acao,
        },
      },
      create: { ...input, criadoPorId: usuarioId },
      update: input,
    });
    await auditar(tx, {
      entidade: "RegraSanitariaReprodutiva",
      entidadeId: fato.id,
      propriedadeId: input.propriedadeId,
      acao: "CONFIGURACAO",
      usuarioId,
      antes,
      depois: fato,
    });
    return fato;
  });
}
export async function criarExposicao(
  input: z.infer<typeof exposicaoSchema>,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const localizacoes = await tx.localizacaoAnimal.findMany({
      where: {
        loteId: input.loteId,
        propriedadeId: input.propriedadeId,
        desde: { lte: input.fim ? dia(input.fim) : hojeFazendaDate() },
        OR: [{ ate: null }, { ate: { gt: dia(input.inicio) } }],
      },
    });
    const matrizes = await tx.animal.findMany({
      where: { id: { in: localizacoes.map((l) => l.animalId) }, sexo: "F" },
    });
    await travarAnimais(tx, [
      ...matrizes.map((a) => a.id),
      ...(input.touroId ? [input.touroId] : []),
    ]);
    await travarLoteAtivo(tx, input.loteId, input.propriedadeId);
    return operacaoIdempotenteTx(
      tx,
      input,
      usuarioId,
      "EXPOSICAO_TOURO",
      async () => {
        const pai = await genitorTx(
          tx,
          input.touroId,
          input.touroExternoId,
          "M",
        );
        if (!pai) erro("Informe o touro da exposição", "touroId");
        if (
          dia(input.inicio) > hojeFazendaDate() ||
          (input.fim &&
            (dia(input.fim) < dia(input.inicio) ||
              dia(input.fim) > hojeFazendaDate()))
        )
          erro("Intervalo inválido", "inicio");
        const e = await tx.exposicaoTouro.create({
          data: {
            referenciaExterna: `MANUAL:${input.chave}`,
            propriedadeId: input.propriedadeId,
            loteId: input.loteId,
            touroId: input.touroId,
            touroExternoId: input.touroExternoId,
            inicio: dia(input.inicio),
            fim: input.fim ? dia(input.fim) : null,
            observacao: input.observacao,
            criadoPorId: usuarioId,
          },
        });
        for (const a of matrizes) {
          const local = localizacoes.filter((l) => l.animalId === a.id);
          for (const l of local) {
            const inicio = l.desde > e.inicio ? l.desde : e.inicio,
              fim = l.ate && (!e.fim || l.ate < e.fim) ? l.ate : e.fim;
            if (fim && fim <= inicio) continue;
            await tx.participacaoExposicao.create({
              data: { exposicaoId: e.id, animalId: a.id, inicio, fim },
            });
          }
        }
        await auditar(tx, {
          entidade: "ExposicaoTouro",
          entidadeId: e.id,
          propriedadeId: input.propriedadeId,
          acao: "REGISTRO",
          usuarioId,
          depois: e,
        });
        return e;
      },
    );
  });
}
export async function painelReproducao(
  propriedadeId: number | null,
  animalId?: string,
) {
  const hoje = hojeFazendaDate();
  const scope = propriedadeId == null ? {} : { propriedadeId };
  const fatos = { ...scope, ...(animalId ? { animalId } : {}) };
  const [
    animais,
    tentativas,
    avaliacoes,
    partos,
    restricoes,
    gestacoes,
    situacoesIniciais,
    lactacoes,
    regrasSanitarias,
    exposicoes,
  ] = await Promise.all([
    prisma.animal.findMany({
      where: {
        sexo: "F",
        ...(animalId ? { id: animalId } : {}),
        ...(propriedadeId == null
          ? {}
          : { localizacoes: { some: { propriedadeId, desde: { lte: hoje }, OR: [{ ate: null }, { ate: { gt: hoje } }] } } }),
      },
      select: {
        id: true,
        brinco: true,
        nome: true,
        partosAntesDaEntrada: true,
      },
      orderBy: { brinco: "asc" },
    }),
    prisma.tentativaReprodutiva.findMany({
      where: fatos,
      orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
    }),
    prisma.avaliacaoReprodutiva.findMany({
      where: fatos,
      orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
    }),
    prisma.partoAnimal.findMany({ where: fatos, orderBy: { data: "desc" }, include: {
      ocorrenciasRetencaoPlacenta: { include: { doenca: { select: { id: true, nome: true } } } },
      vinculosPesagem: { include: { pesagem: true }, orderBy: { criadoEm: "asc" } },
      examesPosParto: { include: { resultados: { where: { vigente: true } } }, orderBy: { data: "desc" } },
    } }),
    prisma.restricaoReprodutiva.findMany({
      where: fatos,
      orderBy: { data: "desc" },
    }),
    prisma.gestacaoAnimal.findMany({
      where: fatos,
      orderBy: { confirmadaEm: "desc" },
    }),
    prisma.situacaoInicialReprodutiva.findMany({
      where: fatos,
      orderBy: { data: "desc" },
    }),
    prisma.lactacaoAnimal.findMany({
      where: fatos,
      orderBy: { inicio: "desc" },
    }),
    prisma.regraSanitariaReprodutiva.findMany({ where: scope }),
    prisma.exposicaoTouro.findMany({
      where: scope,
      orderBy: { inicio: "desc" },
    }),
  ]);
  const estados = await obterEstadosReprodutivosTx(prisma, animais.map((a) => a.id), hoje);
  const temporais = await obterContextosAnimaisNaDataTx(prisma, animais.map((a) => a.id), hoje);
  if (
    animalId &&
    !animais.length &&
    !tentativas.length &&
    !partos.length &&
    !avaliacoes.length
  )
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Animal não encontrado neste sítio",
    );
  const idsPartos = partos.map((p) => p.id),
    idsExposicoes = exposicoes.map((e) => e.id);
  const [crias, participacoesExposicao] = await Promise.all([
    prisma.criaParto.findMany({ where: { partoId: { in: idsPartos } } }),
    prisma.participacaoExposicao.findMany({
      where: {
        exposicaoId: { in: idsExposicoes },
        ...(animalId ? { animalId } : {}),
      },
    }),
  ]);
  const [animaisCrias, historicosPrevisao, periodosReprodutivos] =
    await Promise.all([
      prisma.animal.findMany({
        where: {
          id: { in: crias.flatMap((c) => (c.animalId ? [c.animalId] : [])) },
        },
        select: {
          id: true,
          brinco: true,
          nome: true,
          identificacaoProvisoria: true,
          codigoProvisorio: true,
        },
      }),
      prisma.historicoPrevisaoParto.findMany({
        where: { gestacaoId: { in: gestacoes.map((g) => g.id) } },
        orderBy: { criadoEm: "desc" },
      }),
      prisma.periodoReprodutivoAnimal.findMany({
        where: fatos,
        orderBy: { inicio: "desc" },
      }),
    ]);
  const locaisExposicoes = await prisma.localizacaoAnimal.findMany({
    where: {
      loteId: { in: exposicoes.map((e) => e.loteId) },
      animal: { sexo: "F" },
    },
  });
  const evidencias = await prisma.interpretacaoReprodutiva.findMany({
    where: { id: { in: avaliacoes.map(a => a.id) } },
    select: { id: true, exame: { select: { id:true, finalidades:true, finalidadePrincipal:true, realizacao:true, responsavel:true, formatoSnapshot:true, resultados:{ where:{vigente:true}, select:{campo:true,valor:true,unidade:true} } } } },
  });
  const examesPorAvaliacao = new Map(evidencias.map(e => [e.id, e.exame]));
  return {
    animais: animais.map((a) => {
      const estado = estados.get(a.id)!;
      return {
        animalId: a.id, brinco: a.brinco, nome: a.nome,
        contextoTemporal: temporais.get(a.id) ?? null,
        versaoContexto: 2, convencaoDel: "D0",
        del: temporais.get(a.id)?.del ?? null, situacaoProdutiva: temporais.get(a.id)?.situacaoProdutiva ?? "NAO_INFORMADA",
        diasPosParto: temporais.get(a.id)?.diasPosParto ?? null,
        diasDesdeConfirmacao: temporais.get(a.id)?.diasDesdeConfirmacao ?? null,
        idadeGestacionalDias: temporais.get(a.id)?.idadeGestacionalDias ?? null,
        retencaoPlacenta: estado.ultimoParto?.retencaoPlacenta ?? null,
        pendenciasContexto: temporais.get(a.id)?.pendencias ?? [],
        situacao: estado.situacao, partos: estado.partos, tentativasCiclo: estado.tentativasCiclo,
        gestacao: estado.gestacao,
        ultimaTentativa: estado.ultimaTentativa,
        restricoes: estado.restricoes,
      };
    }),
    tentativas,
    avaliacoes: avaliacoes.map(a => ({ ...a, exame: examesPorAvaliacao.get(a.id) ?? null })),
    partos: partos.map((p) => ({
      ...p,
      crias: crias
        .filter((c) => c.partoId === p.id)
        .map((c) => ({
          ...c,
          animal: animaisCrias.find((a) => a.id === c.animalId) ?? null,
        })),
    })),
    restricoes,
    gestacoes: gestacoes.map((g) => ({
      ...g,
      historicoPrevisao: historicosPrevisao.filter(
        (h) => h.gestacaoId === g.id,
      ),
    })),
    situacoesIniciais,
    lactacoes,
    regrasSanitarias,
    periodosReprodutivos,
    exposicoes: exposicoes.map((e) => ({
      ...e,
      participantes: locaisExposicoes
        .filter(
          (l) =>
            l.loteId === e.loteId &&
            l.propriedadeId === e.propriedadeId &&
            (!animalId || l.animalId === animalId) &&
            l.desde <= (e.fim ?? hoje) &&
            (!l.ate || l.ate > e.inicio),
        )
        .map((l) => {
          const inicio = l.desde > e.inicio ? l.desde : e.inicio;
          const fim = l.ate && (!e.fim || l.ate < e.fim) ? l.ate : e.fim;
          const registrada = participacoesExposicao.find(
            (p) =>
              p.exposicaoId === e.id &&
              p.animalId === l.animalId &&
              p.inicio.getTime() === inicio.getTime(),
          );
          return {
            id: registrada?.id ?? `${e.id}:${l.id}`,
            exposicaoId: e.id,
            animalId: l.animalId,
            inicio,
            fim,
          };
        })
        .filter((p) => !p.fim || p.fim > p.inicio),
    })),
  };
}
export function mascararCustos<T>(valor: T, verValores: boolean): T {
  if (verValores) return valor;
  const campos = new Set([
    "valorProdutoAtribuido",
    "valorServicoAtribuido",
    "valorTotal",
    "custoUnitario", "evidenciaValor",
    "custoTotal",
    "valor",
    "custoProduto",
    "rateioServico", "valorMaterialDocumentado", "documentoMaterial", "valorMaterial", "valorServico", "totalConhecido", "valorOrigem", "valorAtribuido", "restante",
  ]);
  // Somente relações e observações estruturadas dos DTOs conhecidos. Uma
  // estrutura de exame imitada em outro caminho JSON não recebe a exceção.
  const caminhosResultadosClinicos = new Set([
    "exame.resultados.*",
    "avaliacoes.*.exame.resultados.*",
    "examesPosParto.*.resultados.*",
    "partos.*.examesPosParto.*.resultados.*",
  ]);
  // Retorno de salvar/regularizar participante, confirmação, detalhe e impressão.
  for (const participante of ["", "*.", "participantes.*.", "atividades.*.participantes.*.",
    "snapshot.atividades.*.participantes.*.", "impressoes.*.snapshot.atividades.*.participantes.*."]) {
    caminhosResultadosClinicos.add(`${participante}rascunho.resultados.*`);
    caminhosResultadosClinicos.add(`${participante}rascunho.dados.resultados.*`);
  }
  const limpar = (v: unknown, caminho: string[] = []): unknown => {
    if (
      v instanceof Date ||
      v instanceof Prisma.Decimal ||
      v === null ||
      typeof v !== "object"
    )
      return v;
    if (Array.isArray(v)) return v.map(item => limpar(item, [...caminho, "*"]));
    const resultadoClinico = caminhosResultadosClinicos.has(caminho.join("."))
      && "campo" in v && typeof v.campo === "string" && v.campo.length > 0;
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => {
        const valorClinico = k === "valor" && resultadoClinico
          && (x === null || ["string", "number", "boolean"].includes(typeof x));
        return [k, campos.has(k) && !valorClinico ? null : limpar(x, [...caminho, k])];
      }),
    );
  };
  return limpar(valor) as T;
}
export async function atualizarPrevisao(
  id: string,
  propriedadeId: number,
  previsaoParto: string | null,
  motivo: string,
  origem: string,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const referencia = await tx.gestacaoAnimal.findFirst({
      where: { id, propriedadeId, status: "VALIDO", encerradaEm: null },
    });
    if (!referencia)
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Gestação aberta não encontrada neste sítio",
      );
    await travarAnimais(tx, [referencia.animalId]);
    if (previsaoParto && dia(previsaoParto) < referencia.confirmadaEm)
      erro("Previsão antecede confirmação", "previsaoParto");
    const historico = await tx.historicoPrevisaoParto.create({
      data: {
        gestacaoId: id,
        previsaoAnterior: referencia.previsaoParto,
        previsaoNova: previsaoParto ? dia(previsaoParto) : null,
        motivo,
        origem,
        criadoPorId: usuarioId,
      },
    });
    const salva = await tx.gestacaoAnimal.update({
      where: { id },
      data: { previsaoParto: historico.previsaoNova },
    });
    await auditar(tx, {
      entidade: "GestacaoAnimal",
      entidadeId: id,
      animalId: referencia.animalId,
      propriedadeId,
      acao: "REVISAO_PREVISAO",
      usuarioId,
      antes: referencia,
      depois: { ...salva, historico },
    });
    return salva;
  });
}
export async function completarIdentificacao(
  animalId: string,
  propriedadeId: number,
  brinco: string,
  nome: string | null | undefined,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    await travarAnimais(tx, [animalId]);
    const antes = await tx.animal.findUnique({ where: { id: animalId } });
    if (
      !antes?.identificacaoProvisoria ||
      !(await tx.localizacaoAnimal.count({
        where: { animalId, propriedadeId, ate: null },
      }))
    )
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Cria provisória não encontrada neste sítio",
      );
    await travarBrincos(tx, [
      { propriedadeId, brincoNormalizado: brinco.toLocaleLowerCase("pt-BR") },
    ]);
    if (
      await tx.animal.count({
        where: {
          id: { not: animalId },
          brinco: { equals: brinco, mode: "insensitive" },
          localizacoes: { some: { propriedadeId, ate: null } },
        },
      })
    )
      erro("Brinco já está em uso neste sítio", "brinco");
    const salva = await tx.animal.update({
      where: { id: animalId },
      data: {
        brinco,
        identificacaoProvisoria: false,
        ...(nome !== undefined ? { nome } : {}),
      },
    });
    await auditar(tx, {
      entidade: "Animal",
      entidadeId: animalId,
      animalId,
      propriedadeId,
      acao: "IDENTIFICACAO_COMPLETADA",
      usuarioId,
      antes,
      depois: salva,
    });
    return salva;
  });
}
export async function corrigirVinculoGestacao(
  id: string,
  propriedadeId: number,
  tentativaId: string | null,
  motivo: string,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const antes = await tx.gestacaoAnimal.findFirst({
      where: { id, propriedadeId, status: "VALIDO" },
    });
    if (!antes)
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Gestação não encontrada neste sítio",
      );
    await travarAnimais(tx, [antes.animalId]);
    const tentativa = tentativaId
      ? await tx.tentativaReprodutiva.findFirst({
          where: {
            id: tentativaId,
            animalId: antes.animalId,
            status: "VALIDO",
            data: { lte: antes.confirmadaEm },
          },
        })
      : null;
    if (tentativaId && !tentativa)
      erro("Tentativa incompatível com animal/data", "tentativaId");
    await conferirIntervaloGestacaoTx(tx, antes.animalId, tentativa?.data ?? antes.confirmadaEm, antes.encerradaEm, antes.id);
    const salva = await tx.gestacaoAnimal.update({
      where: { id },
      data: { tentativaId, inicio: tentativa?.data ?? null },
    });
    // Cria real continua com sua identidade e filiação; alteração de vínculo não reescreve pedigree.
    await auditar(tx, {
      entidade: "GestacaoAnimal",
      entidadeId: id,
      animalId: antes.animalId,
      propriedadeId,
      acao: "CORRECAO_VINCULO",
      usuarioId,
      antes,
      depois: { ...salva, motivo, filiacaoCriasPreservada: true },
    });
    return salva;
  });
}
export async function corrigirPartoTx(
  tx: Prisma.TransactionClient,
  id: string,
  input: CorrecaoPartoAmpliadaInput,
  usuarioId: number | null,
) {
    const referencia = await tx.partoAnimal.findFirst({
      where: { id, propriedadeId: input.propriedadeId, status: "VALIDO" },
    });
    if (!referencia)
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Parto não encontrado neste sítio",
      );
    const crias = await tx.criaParto.findMany({ where: { partoId: id } });
    await travarAnimais(tx, [
      referencia.animalId,
      ...crias.flatMap((c) => (c.animalId ? [c.animalId] : [])),
    ]);
    const executar = async () => {
    const antes = await tx.partoAnimal.findUniqueOrThrow({ where: { id } });
    if (antes.status !== "VALIDO") throw new RebanhoError("CONFLITO", "Parto foi anulado; atualize o histórico");
    if (input.versaoEsperada !== undefined && input.versaoEsperada !== antes.versao) throw new RebanhoError("CONFLITO", "Parto alterado por outra pessoa; atualize antes de corrigir");
    const detalhes = normalizarDetalhesParto(input, antes.data.toISOString().slice(0, 10), antes);
    await conferirMatrizTx(tx, antes.animalId, input.propriedadeId, antes.data);
    if (
      ["ABORTO", "NATIMORTO"].includes(detalhes.tipo) &&
      crias.some((c) => c.viva)
    )
      erro(
        "Cria viva é incompatível com aborto/natimorto; não será apagada pela correção",
        "tipo",
      );
    if (
      input.gestacaoId !== undefined &&
      input.gestacaoId !== antes.gestacaoId
    ) {
      const nova = input.gestacaoId
        ? await tx.gestacaoAnimal.findFirst({
            where: {
              id: input.gestacaoId,
              animalId: antes.animalId,
              status: "VALIDO",
              encerradaEm: null,
              confirmadaEm: { lte: antes.data },
            },
          })
        : null;
      if (input.gestacaoId && !nova)
        erro(
          "Gestação deve pertencer ao animal e estar aberta na data",
          "gestacaoId",
        );
      if (antes.gestacaoId) {
        const antiga = await tx.gestacaoAnimal.findUniqueOrThrow({
          where: { id: antes.gestacaoId },
        });
        if (antiga.motivoEncerramento?.startsWith("PARTO_")) {
          // Desvincular não presume gestação novamente ativa; mantém encerramento físico conhecido para revisão explícita.
          await tx.gestacaoAnimal.update({
            where: { id: antiga.id },
            data: { motivoEncerramento: `PARTO_DESVINCULADO: ${input.motivo}` },
          });
        }
      }
      if (nova)
        await tx.gestacaoAnimal.update({
          where: { id: nova.id },
          data: {
            encerradaEm: antes.data,
            motivoEncerramento: `PARTO_${detalhes.tipo}`,
          },
        });
    }
    const salva = await tx.partoAnimal.update({
      where: { id, versao: antes.versao },
      data: {
        ...(input.gestacaoId !== undefined
          ? { gestacaoId: input.gestacaoId }
          : {}),
        ...detalhes,
        versao: { increment: 1 },
        ...(input.responsavel !== undefined ? { responsavel: input.responsavel } : {}),
        ...(input.observacao !== undefined
          ? { observacao: input.observacao }
          : {}),
      },
    });
    await aplicarRetencaoPartoTx(tx, salva, input, usuarioId);
    await aplicarPesoPartoTx(tx, salva, input.pesoMatriz, usuarioId);
    await corrigirPesosCriasTx(tx, salva, input, usuarioId);
    await aplicarEscorePartoTx(tx, salva, input.escoreMatriz, usuarioId);
    if (salva.gestacaoId && salva.tipo !== antes.tipo) {
      await tx.gestacaoAnimal.updateMany({ where: { id: salva.gestacaoId, motivoEncerramento: { startsWith: "PARTO_" } }, data: { motivoEncerramento: `PARTO_${salva.tipo}` } });
    }
    await auditar(tx, {
      entidade: "PartoAnimal",
      entidadeId: id,
      animalId: antes.animalId,
      propriedadeId: input.propriedadeId,
      acao: "CORRECAO",
      usuarioId,
      antes,
      depois: {
        ...salva,
        motivo: input.motivo,
        criasPreservadas: crias.map((c) => c.id),
        filiacaoPreservada: true,
      },
    });
    return lerPartoTx(tx, salva.id);
    };
    return input.chave ? operacaoIdempotenteTx(tx, { ...input, chave: input.chave, id }, usuarioId, "CORRECAO_PARTO", executar) : executar();
  }
export async function corrigirParto(id: string, input: CorrecaoPartoAmpliadaInput, usuarioId: number | null) {
  return transacaoPecuaria(tx => corrigirPartoTx(tx, id, input, usuarioId));
}
export async function corrigirLactacao(
  id: string,
  input: {
    propriedadeId: number;
    chave?: string;
    versaoEsperada?: number;
    partoId?: string | null;
    inicio?: string;
    encerradaEm?: string | null;
    motivo: string;
  },
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const referencia = await tx.lactacaoAnimal.findFirst({
      where: { id, propriedadeId: input.propriedadeId },
    });
    if (!referencia)
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Lactação não encontrada neste sítio",
      );
    await travarAnimais(tx, [referencia.animalId]);
    const executar = async () => {
    if (input.versaoEsperada != null && referencia.versao !== input.versaoEsperada)
      throw new RebanhoError("CONFLITO", "A lactação mudou; atualize os dados antes de corrigir", "versaoEsperada");
    const inicio = input.inicio ? dia(input.inicio) : referencia.inicio,
      fim =
        input.encerradaEm === undefined
          ? referencia.encerradaEm
          : input.encerradaEm
            ? dia(input.encerradaEm)
            : null;
    await conferirMatrizTx(
      tx,
      referencia.animalId,
      input.propriedadeId,
      inicio,
    );
    if (fim && (fim < inicio || fim > hojeFazendaDate()))
      erro("Intervalo da lactação inválido", "encerradaEm");
    if (input.partoId) {
      const parto = await tx.partoAnimal.findFirst({
        where: {
          id: input.partoId,
          animalId: referencia.animalId,
          status: "VALIDO",
        },
      });
      if (!parto || inicio < parto.data)
        erro(
          "Lactação exige parto válido do animal anterior ao início",
          "partoId",
        );
    }
    await conferirIntervaloLactacaoTx(tx, referencia.animalId, inicio, fim, id);
    const salva = await tx.lactacaoAnimal.update({
      where: { id },
      data: {
        ...(input.partoId !== undefined ? { partoId: input.partoId } : {}),
        inicio,
        versao: { increment: 1 },
        encerradaEm: fim,
        motivoEncerramento: fim ? input.motivo : null,
      },
    });
    await auditar(tx, {
      entidade: "LactacaoAnimal",
      entidadeId: id,
      animalId: referencia.animalId,
      propriedadeId: input.propriedadeId,
      acao: "CORRECAO",
      usuarioId,
      antes: referencia,
      depois: { ...salva, motivo: input.motivo },
    });
    return salva;
    };
    return input.chave ? operacaoIdempotenteTx(tx, { ...input, chave: input.chave, id }, usuarioId, "CORRECAO_LACTACAO", executar) : executar();
  });
}
export async function encerrarExposicao(
  id: string,
  propriedadeId: number,
  data: string,
  motivo: string,
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const referencia = await tx.exposicaoTouro.findFirst({
      where: { id, propriedadeId },
    });
    if (!referencia)
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Exposição não encontrada neste sítio",
      );
    const participacoes = await tx.participacaoExposicao.findMany({
      where: { exposicaoId: id },
    });
    await travarAnimais(tx, [
      ...participacoes.map((p) => p.animalId),
      ...(referencia.touroId ? [referencia.touroId] : []),
    ]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-exposicao-id:${id}`}))`;
    if (referencia.fim) erro("Exposição já encerrada", "data");
    const fim = dia(data);
    if (fim < referencia.inicio || fim > hojeFazendaDate())
      erro("Encerramento exige data desde o início até hoje", "data");
    const salva = await tx.exposicaoTouro.update({
      where: { id },
      data: { fim },
    });
    await tx.participacaoExposicao.updateMany({
      where: {
        exposicaoId: id,
        inicio: { lte: fim },
        OR: [{ fim: null }, { fim: { gt: fim } }],
      },
      data: { fim },
    });
    await auditar(tx, {
      entidade: "ExposicaoTouro",
      entidadeId: id,
      propriedadeId,
      acao: "ENCERRAMENTO",
      usuarioId,
      antes: referencia,
      depois: { ...salva, motivo },
    });
    return salva;
  });
}
