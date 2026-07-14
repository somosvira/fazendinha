// Motor da camada semântica: valida a consulta do LLM contra o registro do
// domínio, traduz para Prisma, executa e agrega deterministicamente. Toda a
// aritmética (somas, médias, deltas, %, razões) acontece aqui — a IA só narra
// o que este módulo devolve.

import { prisma } from "../../db.js";
import { jsonSafe } from "../bot/serialize.js";
import type {
  ConsultaEntidade,
  ConsultaRazao,
  ContextoConsulta,
  DominioDef,
  EntidadeDef,
  LadoRazao,
  LinhaBase,
} from "./tipos.js";
import { validarConsulta, ConsultaInvalidaError } from "./validacao.js";
import { traduzir, whereComPeriodo, type PlanoExecucao } from "./tradutor.js";
import { agregar, compararAgregados, dividirAgregados, type Agregado } from "./agregador.js";
import { obterDominio } from "./registro/index.js";

const MAX_LINHAS_DEFAULT = 50_000;
const SEM_TRUNCAR = Number.MAX_SAFE_INTEGER;

async function buscarLinhas(
  plano: PlanoExecucao,
  de: string | undefined,
  ate: string | undefined,
  maxLinhas: number,
): Promise<LinhaBase[]> {
  const delegate = (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<LinhaBase[]> }>)[
    plano.modelo
  ];
  if (!delegate) throw new Error(`Registro inconsistente: modelo Prisma '${plano.modelo}' não existe.`);
  const linhas = await delegate.findMany({
    where: whereComPeriodo(plano, de, ate),
    select: plano.select,
    take: maxLinhas + 1,
  });
  if (linhas.length > maxLinhas)
    throw new ConsultaInvalidaError(
      `Consulta muito ampla (mais de ${maxLinhas} linhas). Restrinja o período ou adicione filtros.`,
    );
  return linhas;
}

const mesAtual = () => new Date().toISOString().slice(0, 7);

function observacoesComuns(
  def: EntidadeDef,
  entidade: string,
  c: { ate?: string },
  campoData: string | null,
  ctx: ContextoConsulta,
): string[] {
  const obs: string[] = [];
  if (campoData && (!c.ate || c.ate.slice(0, 7) >= mesAtual()))
    obs.push(`O mês corrente (${mesAtual()}) está INCOMPLETO — não o compare com meses fechados.`);
  if (ctx.propriedadeId != null && !def.escopoPropriedade)
    obs.push(`A entidade '${entidade}' não é particionada por propriedade — números da fazenda inteira.`);
  return obs;
}

function paramsDe(def: EntidadeDef, c: ConsultaEntidade, limite: number) {
  return {
    dimensoes: c.agruparPor.map((nome) => ({ nome, def: def.dimensoes[nome] })),
    metricas: c.metricas.map((nome) => ({ nome, def: def.metricas[nome] })),
    campoData: def.regimes[c.regime].campoData,
    granularidadeTempo: c.granularidadeTempo,
    ordenarPor: c.ordenarPor,
    limite,
  };
}

async function executarEntidade(dom: DominioDef, c: ConsultaEntidade, ctx: ContextoConsulta) {
  const def = dom.entidades[c.entidade];
  const plano = traduzir(def, c, ctx);
  const maxLinhas = def.maxLinhasBase ?? MAX_LINHAS_DEFAULT;
  const observacoes = observacoesComuns(def, c.entidade, c, plano.campoData, ctx);

  const base = {
    dominio: dom.nome,
    entidade: c.entidade,
    regime: c.regime,
    regimeDescricao: def.regimes[c.regime].descricao,
    periodo: c.de || c.ate ? { de: c.de ?? null, ate: c.ate ?? null } : null,
  };

  // ── Comparação A/B ─────────────────────────────────────────────────────────
  // Agrega os dois lados SEM truncar (truncar antes do join desalinharia os
  // grupos e produziria deltas errados) e corta só o porGrupo final.
  if (c.comparar) {
    const params = paramsDe(def, c, SEM_TRUNCAR);
    let agA: Agregado;
    let agB: Agregado;
    let rotuloComparacao: Record<string, unknown>;

    if (c.comparar.tipo === "periodos") {
      const [linhasA, linhasB] = await Promise.all([
        buscarLinhas(plano, c.de, c.ate, maxLinhas),
        buscarLinhas(plano, c.comparar.deB, c.comparar.ateB, maxLinhas),
      ]);
      agA = agregar(linhasA, params);
      agB = agregar(linhasB, params);
      rotuloComparacao = {
        tipo: "periodos",
        periodoA: { de: c.de, ate: c.ate },
        periodoB: { de: c.comparar.deB, ate: c.comparar.ateB },
      };
    } else {
      const { dimensao, valorA, valorB } = c.comparar;
      const op = def.dimensoes[dimensao].operadores.includes("contem") ? ("contem" as const) : ("igual" as const);
      const fatia = (valor: string): ConsultaEntidade => ({
        ...c,
        comparar: undefined,
        filtros: [...c.filtros, { dimensao, operador: op, valor }],
      });
      const [linhasA, linhasB] = await Promise.all([
        buscarLinhas(traduzir(def, fatia(valorA), ctx), c.de, c.ate, maxLinhas),
        buscarLinhas(traduzir(def, fatia(valorB), ctx), c.de, c.ate, maxLinhas),
      ]);
      agA = agregar(linhasA, params);
      agB = agregar(linhasB, params);
      rotuloComparacao = { tipo: "fatias", dimensao, fatiaA: valorA, fatiaB: valorB };
    }

    const comp = compararAgregados(agA, agB, params.metricas);
    const truncado = comp.porGrupo.length > c.limite;
    if (truncado)
      observacoes.push(
        `Mostrando os ${c.limite} grupos de maior variação (de ${comp.porGrupo.length}); 'totais' cobre todos.`,
      );
    return jsonSafe({
      ...base,
      comparacao: {
        ...rotuloComparacao,
        totais: comp.totais,
        porGrupo: comp.porGrupo.slice(0, c.limite),
        somenteA: comp.somenteA,
        somenteB: comp.somenteB,
        truncado,
      },
      observacoes,
    });
  }

  // ── Consulta simples ───────────────────────────────────────────────────────
  const linhas = await buscarLinhas(plano, c.de, c.ate, maxLinhas);
  const ag = agregar(linhas, paramsDe(def, c, c.limite));
  if (ag.truncado)
    observacoes.push(`Mostrando top ${c.limite} de ${ag.numGrupos} grupos; 'totais' cobre TODOS os grupos.`);
  return jsonSafe({
    ...base,
    grupos: ag.grupos,
    totais: ag.totais,
    numGrupos: ag.numGrupos,
    truncado: ag.truncado,
    observacoes,
  });
}

// ── Razões pré-instrumentadas (ex.: custo por litro) ─────────────────────────

async function executarLadoRazao(
  lado: LadoRazao,
  c: ConsultaRazao,
  ctx: ContextoConsulta,
): Promise<{ ag: Agregado; def: EntidadeDef }> {
  const domLado = obterDominio(lado.dominio);
  const def = domLado.entidades[lado.entidade];
  if (!def || !def.metricas[lado.metrica])
    throw new Error(`Registro inconsistente: '${lado.dominio}.${lado.entidade}.${lado.metrica}' não existe.`);
  const consulta: ConsultaEntidade = {
    tipo: "entidade",
    entidade: lado.entidade,
    regime: lado.regime ?? def.regimeDefault,
    metricas: [lado.metrica],
    filtros: [
      ...(lado.filtrosFixos ?? []),
      ...c.filtros.filter((f) => lado.aceitaFiltros?.includes(f.dimensao)),
    ],
    agruparPor: [],
    granularidadeTempo: c.granularidadeTempo,
    de: c.de,
    ate: c.ate,
    limite: SEM_TRUNCAR,
  };
  const plano = traduzir(def, consulta, ctx);
  const linhas = await buscarLinhas(plano, c.de, c.ate, def.maxLinhasBase ?? MAX_LINHAS_DEFAULT);
  const ag = agregar(linhas, paramsDe(def, consulta, SEM_TRUNCAR));
  return { ag, def };
}

async function executarRazao(dom: DominioDef, c: ConsultaRazao, ctx: ContextoConsulta) {
  const rz = dom.razoes![c.razao];
  const [num, den] = await Promise.all([
    executarLadoRazao(rz.numerador, c, ctx),
    executarLadoRazao(rz.denominador, c, ctx),
  ]);
  const { linhas, total, buracos } = dividirAgregados(
    num.ag,
    den.ag,
    rz.numerador.metrica,
    rz.denominador.metrica,
  );

  const observacoes: string[] = [];
  if (!c.ate || c.ate.slice(0, 7) >= mesAtual())
    observacoes.push(`O mês corrente (${mesAtual()}) está INCOMPLETO — não o compare com meses fechados.`);
  if (buracos.length)
    observacoes.push(`Sem denominador em: ${buracos.join(", ")} — razão nula nesses buckets.`);
  if (ctx.propriedadeId != null && (!num.def.escopoPropriedade || !den.def.escopoPropriedade))
    observacoes.push(
      "Um dos lados da razão não é particionado por propriedade — o valor considera a fazenda inteira nesse lado.",
    );

  return jsonSafe({
    dominio: dom.nome,
    razao: c.razao,
    descricao: rz.descricao,
    periodo: c.de || c.ate ? { de: c.de ?? null, ate: c.ate ?? null } : null,
    granularidade: c.granularidadeTempo ?? "total",
    grupos: linhas,
    total,
    observacoes,
  });
}

// ── Entrada única do motor ───────────────────────────────────────────────────

export async function executarConsulta(
  nomeDominio: string,
  input: unknown,
  ctx: ContextoConsulta,
): Promise<unknown> {
  const dom = obterDominio(nomeDominio);
  const c = validarConsulta(dom, input, obterDominio);
  return c.tipo === "razao" ? executarRazao(dom, c, ctx) : executarEntidade(dom, c, ctx);
}
