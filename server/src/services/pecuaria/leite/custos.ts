import { linhasProducaoGeralTx } from "./producao-geral-consulta.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { carregarFontesCustoTx } from "../custos/custos.js";
import { componentesDaFonte, consolidarCustos } from "../custos/custos.calc.js";
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
        include: { medicoes: { include: { origensEstoque: { where: { ativo: true }, include: { entrada: { include: { classificacoes: { orderBy: { versao: "desc" }, take: 1 } } } } } } } },
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
  const linhasGerais = filtro.animalId ? [] : (await linhasProducaoGeralTx(tx, dias)).filter(l => !filtro.posicaoId || l.posicaoId === filtro.posicaoId);
  const diasGerais = new Set(dias.filter(d => d.configuracao?.fonteProducao === "GERAL").map(d => d.dataOperacional.toISOString().slice(0,10)));
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
  const componentes = fontes.flatMap(componentesDaFonte);
  const resultado = calcularCustosLeite({
    periodo, finalidades, baixas, animaisFinalidadePendente,
    animalIds,
    custos: {
      periodo,
      animalIds,
      componentes,
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
    const geral = !filtro.animalId && diasGerais.has(data);
    const resumo = geral ? resumirProducao(linhasGerais.filter(l => l.data === data)) : resumirProducao(
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
        !geral && (folha.animais.some(a => (!filtro.animalId || a.animalId === filtro.animalId) && a.finalidade.estado !== "COMPROVADA") || populacao.estado === "FINALIDADE_PENDENTE")
          ? "FINALIDADE_PENDENTE"
          : resumo.esperadas === 0
          ? !geral && populacao.estado === "SEM_ANIMAIS_ELEGIVEIS" ? "SEM_ANIMAIS_ELEGIVEIS" : "SEM_PARTICIPANTES"
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
    diasParciais: ritmo.filter(d => d.estado === "PARCIAL").map(d => d.data),
    completa:
      ritmo.every(d => d.estado === "COMPLETA" || d.estado === "SEM_ANIMAIS_ELEGIVEIS"),
  };
  const comCobertura = (resumo: ResumoCustosLeite): ResumoCustosLeite =>
    coberturaPeriodo.completa
      ? resumo
      : {
          ...resumo,
          custoPorLitro: null,
          situacao: verValores ? ("NAO_APURADO" as const) : ("OCULTO" as const),
          motivos: [...resumo.motivos, ...(diasSemFolha.length ? ["DIAS_SEM_FOLHA" as const] : []), ...(coberturaPeriodo.diasFinalidadePendente.length ? ["FINALIDADE_PRODUCAO_PENDENTE" as const] : [])],
        };
  let consolidado = comCobertura(resultado.consolidado);
  if (!filtro.animalId && diasGerais.size) {
    const individuais = folhas.filter(f => !diasGerais.has(f.dataOperacional)).flatMap(f => f.animais.flatMap(a => a.medicoes.filter(m => !filtro.posicaoId || m.posicaoId === filtro.posicaoId)));
    const producao = resumirProducao([...individuais, ...linhasGerais]);
    const populacaoConferida = [...diasGerais].every(data => {
      const populacao = populacaoPeriodo.find(p => p.data === data);
      if (!populacao || populacao.pendentes.length || populacao.potenciais.length) return false;
      const esperados = populacao.elegiveis;
      const sessoes = dias.find(d => d.dataOperacional.toISOString().slice(0,10) === data)!.sessoes.filter(s => !filtro.posicaoId || s.posicaoId === filtro.posicaoId);
      return esperados.length > 0 && sessoes.every(s => {
        const origens = new Set(linhasGerais.filter(l => l.data === data && l.posicaoId === s.posicaoId).flatMap(l => l.animaisOrigem));
        return origens.size === esperados.length && esperados.every(id => origens.has(id));
      });
    });
    const motivos: ResumoCustosLeite["motivos"] = resultado.consolidado.motivos.filter(m => m !== "PRODUCAO_PARCIAL" && m !== "SEM_VOLUME_POSITIVO");
    if (!producao.completa || !coberturaPeriodo.completa) motivos.push("PRODUCAO_PARCIAL");
    if (producao.litros == null || producao.litros <= 0) motivos.push("SEM_VOLUME_POSITIVO");
    if (!populacaoConferida) motivos.push("POPULACAO_GERAL_NAO_CONCILIADA");
    consolidado = { ...resultado.consolidado, producao, motivos, custoPorLitro: verValores && !motivos.length && resultado.consolidado.custos.totalConhecido != null && producao.litros != null && producao.litros > 0 ? new Prisma.Decimal(resultado.consolidado.custos.totalConhecido).div(producao.litros).toFixed(2) : null, situacao: !verValores ? "OCULTO" : motivos.length ? "NAO_APURADO" : "APURADO" };
  }
  const naturezas = ["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO", "A_CLASSIFICAR"] as const;
  const medidasIndividuais = dias.filter(d => filtro.animalId || d.configuracao.fonteProducao !== "GERAL").flatMap(d =>
    d.participantes.filter(a => !a.excluidoEm && (!filtro.animalId || a.animalId === filtro.animalId)).flatMap(a =>
      a.medicoes.filter(m => !filtro.posicaoId || d.sessoes.some(s => s.id === m.sessaoId && s.posicaoId === filtro.posicaoId)).map(m => {
        const declaradas = new Set((m.origensEstoque ?? []).filter(o => o.entrada.status === "CONFIRMADA").map(o => o.entrada.classificacoes[0]?.natureza ?? "NAO_INFORMADA"));
        const natureza = declaradas.size === 1 ? [...declaradas][0] : "NAO_INFORMADA";
        return { data: d.dataOperacional.toISOString().slice(0, 10), estado: m.estado, litros: m.litros?.toNumber() ?? null, natureza: natureza === "NAO_INFORMADA" ? "A_CLASSIFICAR" : natureza };
      })));
  const producaoClassificada = [...medidasIndividuais, ...linhasGerais];
  const porNatureza = naturezas.filter(n => !filtro.natureza || filtro.natureza === n).map(natureza => ({
    natureza, producao: resumirProducao(producaoClassificada.filter(l => l.natureza === natureza)),
    custoTotal: null, custoPorLitro: null, situacao: verValores ? "NAO_APURADO" as const : "OCULTO" as const,
    motivos: ["NATUREZA_SEM_VINCULO" as const],
  }));
  // Os componentes têm classificação do fato/animal, mas não vínculo monetário à
  // parcela de leite. Filtrar natureza nunca autoriza distribuir valores por litros.
  if (filtro.natureza) consolidado = { ...consolidado,
    custos: { ...consolidado.custos, totalConhecido: null, componentes: [] },
    producao: porNatureza[0].producao, custoPorLitro: null,
    situacao: verValores ? "NAO_APURADO" : "OCULTO", motivos: [...consolidado.motivos, "NATUREZA_SEM_VINCULO"],
  };
  const consolidados = resultado.consolidado.custos.componentes;
  const porClassificacao = filtro.natureza ? [] : [...new Set(consolidados.map(c => c.finalidade))].map(finalidade => {
    const chaves = new Set(consolidados.filter(c => c.finalidade === finalidade).map(c => c.chave));
    // Valores são reconstruídos das fontes originais somente para componentes já
    // validados pelo motor temporal, conservando custos sem valor como pendentes.
    const linhas = componentes.filter(c => chaves.has(c.chave)).map(c => {
      const validado = consolidados.find(v => v.chave === c.chave)!;
      return { ...c, estado: validado.estado, valor: validado.valor === null ? null : new Prisma.Decimal(validado.valor) };
    });
    return { finalidade, custos: consolidarCustos(linhas, verValores) };
  });
  const individual = (a: ResumoCustosLeite): ResumoCustosLeite => diasGerais.size ? { ...a, custoPorLitro: null, situacao: verValores ? "NAO_APURADO" : "OCULTO", motivos: [...a.motivos, "PRODUCAO_INDIVIDUAL_PERIODICA"] } : a;
  return {
    propriedadeId,
    periodo,
    posicaoId: filtro.posicaoId ?? null,
    natureza: filtro.natureza ?? null,
    porNatureza, porClassificacao,
    coberturaPeriodo,
    ritmo: filtro.natureza ? ritmo.map(d => {
      const resumo = resumirProducao(producaoClassificada.filter(l => l.data === d.data && l.natureza === filtro.natureza));
      return { ...d, litros: resumo.litros, esperadas: resumo.esperadas, resolvidas: resumo.resolvidas, pendentes: resumo.pendentes,
        estado: d.estado === "SEM_FOLHA" ? d.estado : !resumo.esperadas ? "SEM_PARTICIPANTES" as const : resumo.completa ? "COMPLETA" as const : "PARCIAL" as const };
    }) : ritmo,
    animais: resultado.animais.map((a) => {
      const identificacao = porAnimal.get(a.animalId)?.[0];
      return {
        ...a,
        ...individual(comCobertura(a)),
        ...(filtro.natureza ? { custoPorLitro: null, situacao: verValores ? "NAO_APURADO" as const : "OCULTO" as const, custos: { ...a.custos, totalConhecido: null, componentes: [] }, motivos: [...a.motivos, "NATUREZA_SEM_VINCULO" as const] } : {}),
        brinco: identificacao?.brinco ?? null,
        nome: identificacao?.nome ?? null,
      };
    }),
    consolidado: filtro.animalId ? individual(consolidado) : consolidado,
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

type ResultadoCustosSitio = Awaited<ReturnType<typeof consultarCustosLeiteTx>>;
type CustosResumo = ResultadoCustosSitio["consolidado"]["custos"];
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

/** Soma custos de sítios distintos: total conhecido somado, cobertura completa só se todos estiverem completos. */
function somarCustos(partes: CustosResumo[], verValores: boolean): CustosResumo {
  const coberturas = partes.map(p => p.cobertura);
  const cobertura = !partes.length || coberturas.every(c => c === "DESCONHECIDO") ? "DESCONHECIDO"
    : coberturas.every(c => c === "COMPLETO") ? "COMPLETO" : "PARCIAL";
  const conhecidos = partes.filter(p => p.totalConhecido !== null);
  return { ...(partes[0] ?? { rotulo: "Custo direto registrado", limitacoes: [] }), cobertura, situacao: verValores ? cobertura : "OCULTO",
    totalConhecido: verValores && conhecidos.length ? conhecidos.reduce((s, p) => s.plus(p.totalConhecido!), D(0)).toFixed(2) : null,
    componentesPendentes: partes.reduce((s, p) => s + p.componentesPendentes, 0),
    componentes: partes.flatMap(p => p.componentes) } as CustosResumo;
}

/**
 * Custos do leite em Consolidado: cada sítio é apurado com as próprias regras e os resultados são somados.
 * Custo por litro = custo total conhecido ÷ litros totais (nunca média dos custos por litro dos sítios);
 * qualquer motivo de não apuração em um sítio torna o consolidado não apurado.
 */
export async function consultarCustosLeiteConsolidadoTx(tx: Prisma.TransactionClient, input: ConsultaCustosLeite, verValores: boolean) {
  const sitios = await tx.propriedade.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: [{ principal: "desc" }, { nome: "asc" }] });
  const resultados: Array<{ sitio: { id: number; nome: string }; r: ResultadoCustosSitio }> = [];
  for (const sitio of sitios) resultados.push({ sitio, r: await consultarCustosLeiteTx(tx, sitio.id, input, verValores) });
  return combinarCustosSitios(resultados, verValores);
}
/** Combinação pura dos resultados por sítio (exportada para teste). */
export function combinarCustosSitios(todos: Array<{ sitio: { id: number; nome: string }; r: Pick<ResultadoCustosSitio, "consolidado" | "porClassificacao" | "periodo"> }>, verValores: boolean) {
  // Sítio sem leite e sem custo no período (ex.: só cria ou recria) não participa da soma: o
  // "sem volume" dele não pode travar o custo por litro da fazenda. Continua listado em porSitio.
  const comAtividade = todos.filter(({ r: { consolidado: c } }) => c.producao.esperadas > 0 || (c.producao.litros ?? 0) > 0
    || c.custos.totalConhecido !== null || c.custos.componentes.length > 0 || c.custos.componentesPendentes > 0);
  const resultados = comAtividade.length ? comAtividade : todos;
  const resumos = resultados.map(x => x.r.consolidado);
  const producao = resumos.reduce((s, r) => ({
    litros: r.producao.litros === null ? s.litros : (s.litros ?? 0) + r.producao.litros,
    esperadas: s.esperadas + r.producao.esperadas, medidas: s.medidas + r.producao.medidas, naoOrdenhadas: s.naoOrdenhadas + r.producao.naoOrdenhadas,
    resolvidas: s.resolvidas + r.producao.resolvidas, pendentes: s.pendentes + r.producao.pendentes,
    completa: s.completa && (r.producao.completa || r.producao.esperadas === 0),
  }), { litros: null as number | null, esperadas: 0, medidas: 0, naoOrdenhadas: 0, resolvidas: 0, pendentes: 0, completa: true });
  const custos = somarCustos(resumos.map(r => r.custos), verValores);
  const motivos = [...new Set(resumos.flatMap(r => r.motivos))];
  const custoPorLitro = verValores && !motivos.length && custos.totalConhecido !== null && producao.litros !== null && producao.litros > 0
    ? D(custos.totalConhecido).div(producao.litros).toFixed(2) : null;
  const finalidades = [...new Set(resultados.flatMap(x => x.r.porClassificacao.map(p => p.finalidade)))];
  return {
    propriedadeId: null, escopoConsolidado: true as const,
    periodo: todos[0]?.r.periodo ?? null,
    porClassificacao: finalidades.map(finalidade => ({ finalidade,
      custos: somarCustos(resultados.flatMap(x => x.r.porClassificacao.filter(p => p.finalidade === finalidade).map(p => p.custos)), verValores) })),
    consolidado: { custos, producao, animaisSemComponentes: resumos.flatMap(r => r.animaisSemComponentes), custoPorLitro,
      situacao: !verValores ? "OCULTO" as const : motivos.length ? "NAO_APURADO" as const : "APURADO" as const, motivos },
    porSitio: todos.map(({ sitio, r }) => ({ propriedadeId: sitio.id, nome: sitio.nome, custoPorLitro: r.consolidado.custoPorLitro,
      totalConhecido: r.consolidado.custos.totalConhecido, litros: r.consolidado.producao.litros, situacao: r.consolidado.situacao })),
  };
}
export function consultarCustosLeiteConsolidado(input: ConsultaCustosLeite, verValores: boolean) {
  return prisma.$transaction(tx => consultarCustosLeiteConsolidadoTx(tx, input, verValores), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
