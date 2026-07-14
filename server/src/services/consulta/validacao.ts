// Validação da consulta enviada pelo LLM contra o registro do domínio, com
// mensagens de erro que LISTAM os nomes válidos — o modelo lê o erro e re-tenta
// (o dispatchTool devolve { erro } como resultado da ferramenta). PURO.
//
// Também gera o JSON Schema (function-calling OpenAI) da tool do domínio a
// partir do próprio registro, para o modelo errar cedo via enums explícitos.

import { z } from "zod";
import type {
  ConsultaEntidade,
  ConsultaRazao,
  ConsultaValidada,
  DominioDef,
  EntidadeDef,
  FiltroInput,
  OperadorFiltro,
} from "./tipos.js";

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
export const LIMITE_DEFAULT = 20;
export const LIMITE_TETO = 100;

const OPERADORES: readonly OperadorFiltro[] = ["igual", "diferente", "contem", "em"];

// Shape estrutural (o semântico — nomes válidos por entidade — vem depois,
// em código, para controlar as mensagens de erro).
const filtroSchema = z.object({
  dimensao: z.string(),
  operador: z.enum(OPERADORES as [OperadorFiltro, ...OperadorFiltro[]]),
  valor: z.union([z.string(), z.array(z.string()).min(1)]),
});

const consultaSchema = z.object({
  entidade: z.string().optional(),
  razao: z.string().optional(),
  regime: z.string().optional(),
  metricas: z.array(z.string()).min(1).optional(),
  filtros: z.array(filtroSchema).optional(),
  agruparPor: z.array(z.string()).max(2, "agruparPor aceita no máximo 2 dimensões").optional(),
  granularidadeTempo: z.enum(["mes", "ano"]).optional(),
  de: z.string().regex(DATA_RE, "de deve ser YYYY-MM-DD").optional(),
  ate: z.string().regex(DATA_RE, "ate deve ser YYYY-MM-DD").optional(),
  ordenarPor: z
    .object({ alvo: z.string(), direcao: z.enum(["asc", "desc"]) })
    .optional(),
  limite: z.number().int().min(1).max(LIMITE_TETO).optional(),
  comparar: z
    .union([
      z.object({ tipo: z.literal("periodos"), deB: z.string().regex(DATA_RE), ateB: z.string().regex(DATA_RE) }),
      z.object({
        tipo: z.literal("fatias"),
        dimensao: z.string(),
        valorA: z.string(),
        valorB: z.string(),
      }),
    ])
    .optional(),
});

export class ConsultaInvalidaError extends Error {}

const falha = (msg: string): never => {
  throw new ConsultaInvalidaError(msg);
};

const listar = (nomes: string[]) => nomes.map((n) => `'${n}'`).join(", ");

// Valida filtros contra as dimensões de uma entidade (reusado pelas razões).
function validarFiltros(filtros: FiltroInput[], def: EntidadeDef, contexto: string) {
  for (const f of filtros) {
    const dim = def.dimensoes[f.dimensao];
    if (!dim)
      falha(
        `Dimensão '${f.dimensao}' não existe em ${contexto}. Dimensões válidas: ${listar(Object.keys(def.dimensoes))}.`,
      );
    if (!dim!.operadores.includes(f.operador))
      falha(
        `Operador '${f.operador}' não é permitido na dimensão '${f.dimensao}' (permitidos: ${listar([...dim!.operadores])}).`,
      );
    if (f.operador === "em" && !Array.isArray(f.valor))
      falha(`Operador 'em' na dimensão '${f.dimensao}' exige uma LISTA de valores.`);
    if (f.operador !== "em" && Array.isArray(f.valor))
      falha(`Operador '${f.operador}' na dimensão '${f.dimensao}' exige um valor ÚNICO (string).`);
    if (dim!.valores) {
      const vals = Array.isArray(f.valor) ? f.valor : [f.valor];
      for (const v of vals)
        if (!dim!.valores.includes(v))
          falha(
            `Valor '${v}' não é válido para a dimensão '${f.dimensao}'. Valores válidos: ${listar([...dim!.valores])}.`,
          );
    }
  }
}

function validarPeriodo(de?: string, ate?: string) {
  if (de && ate && de > ate) falha(`Período inválido: de (${de}) é depois de ate (${ate}).`);
}

export function validarConsulta(
  dom: DominioDef,
  input: unknown,
  resolverDominio: (nome: string) => DominioDef = (nome) => {
    if (nome !== dom.nome) falha(`Domínio '${nome}' indisponível.`);
    return dom;
  },
): ConsultaValidada {
  const parsed = consultaSchema.safeParse(input ?? {});
  if (!parsed.success)
    falha(`Parâmetros inválidos: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const c = parsed.data!;
  validarPeriodo(c.de, c.ate);

  // ── Razão pré-instrumentada ────────────────────────────────────────────────
  if (c.razao != null) {
    if (c.entidade || c.metricas || c.agruparPor || c.comparar || c.ordenarPor)
      falha("Ao usar 'razao' não passe entidade/metricas/agruparPor/ordenarPor/comparar — só filtros, período e granularidadeTempo.");
    const razoes = dom.razoes ?? {};
    const rz = razoes[c.razao];
    if (!rz)
      falha(
        Object.keys(razoes).length
          ? `Razão '${c.razao}' não existe. Razões válidas: ${listar(Object.keys(razoes))}.`
          : `O domínio '${dom.nome}' não tem razões instrumentadas.`,
      );
    const gran = c.granularidadeTempo ?? "total";
    if (!rz!.granularidades.includes(gran))
      falha(`A razão '${c.razao}' só aceita granularidades: ${listar([...rz!.granularidades])}.`);
    const filtros = c.filtros ?? [];
    for (const f of filtros) {
      const lados = [rz!.numerador, rz!.denominador].filter((l) => l.aceitaFiltros?.includes(f.dimensao));
      if (!lados.length)
        falha(
          `A razão '${c.razao}' não aceita filtro pela dimensão '${f.dimensao}'. Filtros aceitos: ${listar([
            ...new Set([...(rz!.numerador.aceitaFiltros ?? []), ...(rz!.denominador.aceitaFiltros ?? [])]),
          ])}.`,
        );
      for (const lado of lados) {
        const domLado = resolverDominio(lado.dominio);
        const defLado =
          domLado.entidades[lado.entidade] ?? falha(`Registro inconsistente: entidade '${lado.entidade}' não existe.`);
        validarFiltros([f], defLado as EntidadeDef, `'${lado.entidade}'`);
      }
    }
    const out: ConsultaRazao = {
      tipo: "razao",
      razao: c.razao,
      filtros,
      granularidadeTempo: c.granularidadeTempo,
      de: c.de,
      ate: c.ate,
    };
    return out;
  }

  // ── Consulta por entidade ──────────────────────────────────────────────────
  if (!c.entidade)
    falha(`Informe 'entidade' (${listar(Object.keys(dom.entidades))})${dom.razoes ? " ou 'razao'" : ""}.`);
  const def = dom.entidades[c.entidade!];
  if (!def)
    falha(`Entidade '${c.entidade}' não existe no domínio '${dom.nome}'. Entidades válidas: ${listar(Object.keys(dom.entidades))}.`);

  const regime = c.regime ?? def!.regimeDefault;
  const regimeDef = def!.regimes[regime];
  if (!regimeDef)
    falha(`Regime '${c.regime}' não existe na entidade '${c.entidade}'. Regimes válidos: ${listar(Object.keys(def!.regimes))}.`);

  if (!c.metricas?.length)
    falha(`Informe ao menos uma métrica. Métricas de '${c.entidade}': ${listar(Object.keys(def!.metricas))}.`);
  for (const m of c.metricas!)
    if (!def!.metricas[m])
      falha(`Métrica '${m}' não existe em '${c.entidade}'. Métricas válidas: ${listar(Object.keys(def!.metricas))}.`);

  validarFiltros(c.filtros ?? [], def!, `'${c.entidade}'`);

  const agruparPor = c.agruparPor ?? [];
  for (const d of agruparPor) {
    const dim = def!.dimensoes[d];
    if (!dim)
      falha(`Dimensão '${d}' não existe em '${c.entidade}'. Dimensões válidas: ${listar(Object.keys(def!.dimensoes))}.`);
    if (!dim!.agrupavel)
      falha(
        `A dimensão '${d}' não é agrupável (só filtro). Agrupáveis: ${listar(
          Object.keys(def!.dimensoes).filter((k) => def!.dimensoes[k].agrupavel),
        )}.`,
      );
  }

  // Entidade snapshot (sem campo de data) não tem período/série/comparação temporal.
  if (regimeDef!.campoData == null) {
    if (c.de || c.ate)
      falha(`A entidade '${c.entidade}' é um retrato ATUAL (snapshot) — não aceita período de/ate.`);
    if (c.granularidadeTempo)
      falha(`A entidade '${c.entidade}' é um snapshot — não aceita granularidadeTempo.`);
    if (c.comparar?.tipo === "periodos")
      falha(`A entidade '${c.entidade}' é um snapshot — comparação de períodos não se aplica (use comparar por 'fatias').`);
  }

  if (c.comparar?.tipo === "periodos") {
    if (!c.de || !c.ate) falha("Comparação de períodos exige o período A completo (de e ate).");
    validarPeriodo(c.comparar.deB, c.comparar.ateB);
  }
  if (c.comparar?.tipo === "fatias") {
    const dim = def!.dimensoes[c.comparar.dimensao];
    if (!dim)
      falha(
        `Dimensão '${c.comparar.dimensao}' (comparar.fatias) não existe em '${c.entidade}'. Válidas: ${listar(Object.keys(def!.dimensoes))}.`,
      );
    if (!dim!.operadores.includes("igual") && !dim!.operadores.includes("contem"))
      falha(`A dimensão '${c.comparar.dimensao}' não permite comparação de fatias.`);
  }

  if (c.ordenarPor && !c.metricas!.includes(c.ordenarPor.alvo))
    falha(`ordenarPor.alvo deve ser uma das métricas pedidas (${listar(c.metricas!)}).`);

  const out: ConsultaEntidade = {
    tipo: "entidade",
    entidade: c.entidade!,
    regime,
    metricas: c.metricas!,
    filtros: c.filtros ?? [],
    agruparPor,
    granularidadeTempo: c.granularidadeTempo,
    de: c.de,
    ate: c.ate,
    ordenarPor: c.ordenarPor,
    limite: c.limite ?? LIMITE_DEFAULT,
    comparar: c.comparar,
  };
  return out;
}

// ── JSON Schema da tool (function-calling OpenAI) ────────────────────────────
// Enums explícitos = o modelo erra cedo. O mapa entidade→campos válidos vai na
// description da tool (o JSON Schema da OpenAI não expressa condicionais por
// entidade); o erro do Zod com a lista de válidos cobre o resto via retry.

type Json = Record<string, unknown>;

export function gerarParametrosTool(dom: DominioDef): Json {
  const entidades = Object.keys(dom.entidades);
  const defs = Object.values(dom.entidades);
  const uniq = (xs: string[]) => [...new Set(xs)];
  const metricas = uniq(defs.flatMap((d) => Object.keys(d.metricas)));
  const dimensoes = uniq(defs.flatMap((d) => Object.keys(d.dimensoes)));
  const agrupaveis = uniq(defs.flatMap((d) => Object.keys(d.dimensoes).filter((k) => d.dimensoes[k].agrupavel)));
  const regimes = uniq(defs.flatMap((d) => Object.keys(d.regimes)));
  const razoes = Object.keys(dom.razoes ?? {});

  const props: Json = {
    entidade: {
      type: "string",
      enum: entidades,
      description: "Entidade a consultar (veja o mapa de campos por entidade na descrição da ferramenta).",
    },
    regime: {
      type: "string",
      enum: regimes,
      description: "Regime/recorte da entidade. Omita para usar o default.",
    },
    metricas: {
      type: "array",
      items: { type: "string", enum: metricas },
      description: "Métricas a calcular (≥1). O motor calcula — nunca calcule você.",
    },
    filtros: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dimensao: { type: "string", enum: dimensoes },
          operador: { type: "string", enum: OPERADORES as unknown as string[] },
          valor: {
            anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
            description: "String; para operador 'em', lista de strings.",
          },
        },
        required: ["dimensao", "operador", "valor"],
      },
    },
    agruparPor: {
      type: "array",
      items: { type: "string", enum: agrupaveis },
      maxItems: 2,
      description: "Até 2 dimensões agrupáveis.",
    },
    granularidadeTempo: {
      type: "string",
      enum: ["mes", "ano"],
      description: "Bucket temporal adicional (série mensal/anual).",
    },
    de: { type: "string", description: "Data inicial YYYY-MM-DD" },
    ate: { type: "string", description: "Data final YYYY-MM-DD" },
    ordenarPor: {
      type: "object",
      properties: {
        alvo: { type: "string", enum: metricas },
        direcao: { type: "string", enum: ["asc", "desc"] },
      },
      required: ["alvo", "direcao"],
    },
    limite: { type: "integer", description: `Máximo de grupos (default ${LIMITE_DEFAULT}, teto ${LIMITE_TETO})` },
    comparar: {
      anyOf: [
        {
          type: "object",
          description: "Compara o período A (de/ate) com o período B — devolve delta e deltaPct prontos.",
          properties: {
            tipo: { type: "string", enum: ["periodos"] },
            deB: { type: "string", description: "Início do período B (YYYY-MM-DD)" },
            ateB: { type: "string", description: "Fim do período B (YYYY-MM-DD)" },
          },
          required: ["tipo", "deB", "ateB"],
        },
        {
          type: "object",
          description: "Compara duas fatias de uma dimensão (ex.: centroCusto 'Leiteira' vs 'Café').",
          properties: {
            tipo: { type: "string", enum: ["fatias"] },
            dimensao: { type: "string", enum: dimensoes },
            valorA: { type: "string" },
            valorB: { type: "string" },
          },
          required: ["tipo", "dimensao", "valorA", "valorB"],
        },
      ],
    },
  };

  if (razoes.length) {
    props.razao = {
      type: "string",
      enum: razoes,
      description:
        "Razão pré-instrumentada entre duas métricas (ex.: custo por litro). Mutuamente exclusiva com entidade/metricas — o motor faz a divisão.",
    };
  }

  return { type: "object", properties: props };
}

// Resumo da instrumentação para a description da tool (e, no futuro, para o
// system prompt): mapa entidade → regimes/métricas/dimensões.
export function descreverDominio(dom: DominioDef): string {
  const partes: string[] = [];
  for (const [nome, e] of Object.entries(dom.entidades)) {
    const dims = Object.entries(e.dimensoes)
      .map(([k, d]) => `${k}${d.agrupavel ? "" : " (só filtro)"}${d.valores ? ` [${d.valores.join("|")}]` : ""}`)
      .join(", ");
    const regimes = Object.entries(e.regimes)
      .map(([k, r]) => `${k}${k === e.regimeDefault ? " (default)" : ""}: ${r.descricao}`)
      .join("; ");
    partes.push(
      `ENTIDADE '${nome}' — ${e.descricao} Regimes: ${regimes}. Métricas: ${Object.keys(e.metricas).join(", ")}. Dimensões: ${dims}.`,
    );
  }
  for (const [nome, r] of Object.entries(dom.razoes ?? {})) {
    partes.push(`RAZÃO '${nome}' — ${r.descricao}`);
  }
  return partes.join(" ");
}
