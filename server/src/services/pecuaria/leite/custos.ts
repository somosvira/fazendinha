import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { carregarFontesCustoTx } from "../custos/custos.js";
import { componentesDaFonte } from "../custos/custos.calc.js";
import { RebanhoError } from "../rebanho/regras.js";
import { calcularCustosLeite, type ResumoCustosLeite } from "./custos.calc.js";
import {
  consultaCustosLeiteSchema,
  type ConsultaCustosLeite,
} from "./custos.schemas.js";
import { consultarPopulacaoPeriodoLeiteTx } from "./populacao-periodo.js";
import { folhaLeiteDTO } from "./producao.js";
import { resumirProducao } from "./producao.calc.js";

/** Consulta gerencial: não grava estoque, preço ou nova despesa. */
export async function consultarCustosLeiteTx(
  tx: Prisma.TransactionClient,
  propriedadeId: number,
  input: ConsultaCustosLeite,
  verValores: boolean,
) {
  const filtro = consultaCustosLeiteSchema.parse(input);
  const recorte = {
    propriedadeId,
    dataOperacional: {
      gte: new Date(filtro.inicio),
      lte: new Date(filtro.fim),
    },
  };
  // Evita materializar um ano inteiro de células em memória no Worker.
  const quantidadeCelulas = await tx.medicaoLeite.count({
    where: { sessao: { dia: recorte } },
  });
  if (quantidadeCelulas > 50_000)
    throw new RebanhoError(
      "VALIDACAO",
      "O recorte contém muitas medições. Consulte um período menor",
    );
  const dias = await tx.diaProducaoLeite.findMany({
    where: recorte,
    include: {
      configuracao: { include: { ordenhas: { orderBy: { ordem: "asc" } } } },
      sessoes: { orderBy: { ordem: "asc" } },
      participantes: {
        include: { medicoes: true },
        orderBy: [{ brinco: "asc" }, { animalId: "asc" }],
      },
    },
    orderBy: { dataOperacional: "asc" },
  });
  // Esta consulta usa apenas medições e população. Os vínculos físicos não participam
  // do cálculo nem são expostos no relatório; evita carregar snapshots de estoque.
  const folhas = dias.map((dia) =>
    folhaLeiteDTO({
      ...dia,
      sessoes: dia.sessoes.map((sessao) => ({
        ...sessao,
        entradasEstoque: [],
      })),
      participantes: dia.participantes.map((participante) => ({
        ...participante,
        medicoes: participante.medicoes.map((medicao) => ({
          ...medicao,
          origensEstoque: [],
        })),
      })),
    }),
  );
  const populacaoPeriodo = await consultarPopulacaoPeriodoLeiteTx(tx, propriedadeId, filtro.inicio, filtro.fim, filtro.animalId);
  const todosAnimais = [
    ...new Set([...folhas.flatMap((f) => f.animais.map((a) => a.animalId)), ...populacaoPeriodo.flatMap(d => d.elegiveis)]),
  ];
  if (filtro.animalId && !todosAnimais.includes(filtro.animalId))
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Animal sem participação nas folhas deste sítio e período",
    );
  const animalIds = filtro.animalId ? [filtro.animalId] : todosAnimais;
  if (animalIds.length > 2000)
    throw new RebanhoError(
      "VALIDACAO",
      "Reduza o período ou filtre um animal para consultar os custos",
    );
  const periodo = { inicio: filtro.inicio, fim: filtro.fim };
  const fontes = animalIds.length
    ? await carregarFontesCustoTx(tx, propriedadeId, { animalIds })
    : [];
  const porAnimal = new Map<string, (typeof folhas)[number]["animais"]>();
  for (const folha of folhas)
    for (const animal of folha.animais) {
      const registros = porAnimal.get(animal.animalId) ?? [];
      registros.push(animal);
      porAnimal.set(animal.animalId, registros);
    }
  const producao = animalIds.map((animalId) => ({
    animalId,
    producao: resumirProducao(
      (porAnimal.get(animalId) ?? []).flatMap((a) =>
        a.medicoes.filter(
          (m) => !filtro.posicaoId || m.posicaoId === filtro.posicaoId,
        ),
      ),
    ),
  }));
  const finalidades = await tx.finalidadeAnimal.findMany({ where: { animalId: { in: animalIds } } });
  const baixas = await tx.baixaAnimal.findMany({ where: { animalId: { in: animalIds }, estornadaEm: null } });
  const animaisFinalidadePendente = [...new Set(folhas.flatMap(f => f.animais.filter(a => a.finalidade.estado !== "COMPROVADA").map(a => a.animalId)))];
  const resultado = calcularCustosLeite({
    periodo, finalidades, baixas, animaisFinalidadePendente,
    animalIds,
    custos: {
      periodo,
      animalIds,
      componentes: fontes.flatMap(componentesDaFonte),
    },
    producao: {
      periodo,
      animalIds,
      animais: producao,
      posicaoId: filtro.posicaoId,
    },
    verValores,
  });
  const informados = new Set(folhas.map((f) => f.dataOperacional));
  const porData = new Map(folhas.map((f) => [f.dataOperacional, f]));
  const ritmo: {
    data: string;
    litros: number | null;
    estado: "SEM_FOLHA" | "SEM_PARTICIPANTES" | "PARCIAL" | "COMPLETA" | "SEM_ANIMAIS_ELEGIVEIS" | "FINALIDADE_PENDENTE";
    esperadas: number | null;
    resolvidas: number | null;
    pendentes: number | null;
  }[] = [];
  const diasSemFolha: string[] = [];
  for (
    let instante = Date.parse(filtro.inicio);
    instante <= Date.parse(filtro.fim);
    instante += 86400000
  ) {
    const data = new Date(instante).toISOString().slice(0, 10);
    const populacao = populacaoPeriodo.find(d => d.data === data)!;
    if (!informados.has(data) && populacao.estado !== "SEM_ANIMAIS_ELEGIVEIS") diasSemFolha.push(data);
    const folha = porData.get(data);
    if (!folha) {
      ritmo.push({
        data,
        litros: null,
        estado: populacao.estado === "SEM_ANIMAIS_ELEGIVEIS" || populacao.estado === "FINALIDADE_PENDENTE" ? populacao.estado : "SEM_FOLHA",
        esperadas: null,
        resolvidas: null,
        pendentes: null,
      });
      continue;
    }
    const resumo = resumirProducao(
      folha.animais
        .filter((a) => !filtro.animalId || a.animalId === filtro.animalId)
        .flatMap((a) =>
          a.medicoes.filter(
            (m) => !filtro.posicaoId || m.posicaoId === filtro.posicaoId,
          ),
        ),
    );
    ritmo.push({
      data,
      litros: resumo.litros,
      estado:
        folha.animais.some(a => (!filtro.animalId || a.animalId === filtro.animalId) && a.finalidade.estado !== "COMPROVADA") || populacao.estado === "FINALIDADE_PENDENTE"
          ? "FINALIDADE_PENDENTE"
          : resumo.esperadas === 0
          ? populacao.estado === "SEM_ANIMAIS_ELEGIVEIS" ? "SEM_ANIMAIS_ELEGIVEIS" : "SEM_PARTICIPANTES"
          : resumo.completa
            ? "COMPLETA"
            : "PARCIAL",
      esperadas: resumo.esperadas,
      resolvidas: resumo.resolvidas,
      pendentes: resumo.pendentes,
    });
  }
  // A completude das células das folhas existentes não prova cobertura do período.
  // Nunca dividir os custos do mês apenas pelos litros dos dias informados.
  const coberturaPeriodo = {
    diasInformados: folhas.length,
    diasSemFolha,
    diasSemAnimaisElegiveis: ritmo.filter(d => d.estado === "SEM_ANIMAIS_ELEGIVEIS").map(d => d.data),
    diasFinalidadePendente: ritmo.filter(d => d.estado === "FINALIDADE_PENDENTE").map(d => d.data),
    diasParciais: folhas
      .filter((f) => !f.totais.completa)
      .map((f) => f.dataOperacional),
    completa:
      ritmo.every(d => d.estado === "COMPLETA" || d.estado === "SEM_ANIMAIS_ELEGIVEIS"),
  };
  const comCobertura = (resumo: ResumoCustosLeite) =>
    coberturaPeriodo.completa
      ? resumo
      : {
          ...resumo,
          custoPorLitro: null,
          situacao: verValores ? ("NAO_APURADO" as const) : ("OCULTO" as const),
          motivos: [...resumo.motivos, ...(diasSemFolha.length ? ["DIAS_SEM_FOLHA"] : []), ...(coberturaPeriodo.diasFinalidadePendente.length ? ["FINALIDADE_PRODUCAO_PENDENTE"] : [])],
        };
  return {
    propriedadeId,
    periodo,
    posicaoId: filtro.posicaoId ?? null,
    coberturaPeriodo,
    ritmo,
    animais: resultado.animais.map((a) => {
      const identificacao = porAnimal.get(a.animalId)?.[0];
      return {
        ...a,
        ...comCobertura(a),
        brinco: identificacao?.brinco ?? null,
        nome: identificacao?.nome ?? null,
      };
    }),
    consolidado: comCobertura(resultado.consolidado),
  };
}

export function consultarCustosLeite(
  propriedadeId: number,
  input: ConsultaCustosLeite,
  verValores: boolean,
) {
  return prisma.$transaction(
    (tx) => consultarCustosLeiteTx(tx, propriedadeId, input, verValores),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    },
  );
}
