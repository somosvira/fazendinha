// Registro declarativo do domínio REBANHO (leiteiro) para o motor de consulta.
//
// - producao_lote: fatos de produção por lote/tanque (ProducaoLote). SEM
//   propriedadeId no schema — escopo null de propósito (particionar via grupo
//   descartaria o tanque geral, grupoId=null); o motor avisa em `observacoes`.
// - animal: RETRATO ATUAL do rebanho (snapshot, sem campo de data). Métricas de
//   produção/CCS/DEL vêm do read-model ResumoAnimal (materializado pelos
//   *.recompute do módulo) — o motor não recalcula nada que já é derivado lá.

import { CategoriaAnimal, Prisma, SexoAnimal, StatusAnimal, StatusReprodutivo } from "@prisma/client";
import type { DominioDef, LinhaBase, OperadorFiltro } from "../tipos.js";
import { condEnum } from "./financeiro.js";

const condTexto = (op: OperadorFiltro, valor: string | string[]): Record<string, unknown> => {
  switch (op) {
    case "igual":
      return { equals: valor as string, mode: "insensitive" };
    case "diferente":
      return { not: { equals: valor as string }, mode: "insensitive" };
    case "contem":
      return { contains: valor as string, mode: "insensitive" };
    case "em":
      return { in: valor as string[], mode: "insensitive" };
  }
};

type Rel = { nome?: string | null } | null | undefined;
type Resumo = {
  statusReprodutivo?: string | null;
  del?: number | null;
  ccs?: number | null;
  producaoMediaDia?: Prisma.Decimal | null;
  producao305?: number | null;
} | null;

const resumoDe = (l: LinhaBase): Resumo => l.resumo as Resumo;

export const rebanho: DominioDef = {
  nome: "rebanho",
  descricao: "Rebanho leiteiro: produção de leite por lote/tanque e retrato atual dos animais.",
  entidades: {
    producao_lote: {
      descricao:
        "Registros de produção de leite (litros) por dia, por lote/tanque; grupo vazio = tanque da fazenda inteira.",
      modelo: "producaoLote",
      regimes: {
        padrao: { descricao: "todos os registros de produção, por data", filtrosFixos: {}, campoData: "data" },
      },
      regimeDefault: "padrao",
      // ProducaoLote não tem propriedadeId; escopo via grupo descartaria o
      // tanque geral (grupoId null) — melhor número da fazenda inteira + aviso.
      escopoPropriedade: null,
      dimensoes: {
        grupo: {
          descricao: "Lote/grupo do rebanho (vazio = tanque da fazenda inteira)",
          tipo: "texto",
          cardinalidade: "baixa",
          operadores: ["igual", "diferente", "contem", "em"],
          agrupavel: true,
          where: (op, v) => ({ grupo: { nome: condTexto(op, v) } }),
          select: { grupo: { select: { nome: true } } },
          rotulo: (l) => (l.grupo as Rel)?.nome ?? "(tanque geral)",
        },
      },
      metricas: {
        litrosTotal: {
          descricao: "Total de litros produzidos",
          agregacao: "soma",
          select: { litros: true },
          valor: (l) => (l.litros as Prisma.Decimal | null) ?? null,
          formato: "litros",
        },
        numRegistros: {
          descricao: "Quantidade de registros de produção",
          agregacao: "contagem",
          formato: "inteiro",
        },
        diasComRegistro: {
          descricao: "Dias distintos com produção registrada",
          agregacao: "contagem_distinta",
          select: { data: true },
          valor: (l) => (l.data instanceof Date ? l.data.toISOString().slice(0, 10) : null),
          formato: "inteiro",
        },
      },
    },
    animal: {
      descricao:
        "Retrato ATUAL do rebanho, animal a animal (snapshot — sem período). Indicadores individuais (DEL, CCS, produção) vêm do resumo pré-calculado.",
      modelo: "animal",
      regimes: {
        ativos: { descricao: "só animais ativos", filtrosFixos: { status: "ATIVO" }, campoData: null },
        todos: { descricao: "inclui baixados (vendidos/mortos)", filtrosFixos: {}, campoData: null },
        // Mesmo critério da tela/dashboard do rebanho (dashboard.agg.ts): em
        // lactação = ativo com DEL registrado no resumo. NÃO é o total de vacas.
        em_lactacao: {
          descricao: "só animais EM LACTAÇÃO (ativos com DEL registrado) — mesmo número da tela de Produção",
          filtrosFixos: { status: "ATIVO", resumo: { del: { not: null } } },
          campoData: null,
        },
      },
      regimeDefault: "ativos",
      escopoPropriedade: (propriedadeId) => ({ propriedadeId }),
      dimensoes: {
        categoria: {
          descricao: "Categoria do animal",
          tipo: "enum",
          valores: Object.values(CategoriaAnimal),
          cardinalidade: "baixa",
          operadores: ["igual", "em"],
          agrupavel: true,
          where: (op, v) => ({ categoria: condEnum(op, v) }),
          select: { categoria: true },
          rotulo: (l) => String(l.categoria),
        },
        sexo: {
          descricao: "Sexo (F/M)",
          tipo: "enum",
          valores: Object.values(SexoAnimal),
          cardinalidade: "baixa",
          operadores: ["igual"],
          agrupavel: true,
          where: (op, v) => ({ sexo: condEnum(op, v) }),
          select: { sexo: true },
          rotulo: (l) => String(l.sexo),
        },
        status: {
          descricao: "Status do animal (use o regime 'todos' para enxergar baixados)",
          tipo: "enum",
          valores: Object.values(StatusAnimal),
          cardinalidade: "baixa",
          operadores: ["igual", "em"],
          agrupavel: true,
          where: (op, v) => ({ status: condEnum(op, v) }),
          select: { status: true },
          rotulo: (l) => String(l.status),
        },
        statusReprodutivo: {
          descricao: "Status reprodutivo atual (do resumo)",
          tipo: "enum",
          valores: Object.values(StatusReprodutivo),
          cardinalidade: "baixa",
          operadores: ["igual", "em"],
          agrupavel: true,
          where: (op, v) => ({ resumo: { statusReprodutivo: condEnum(op, v) } }),
          select: { resumo: { select: { statusReprodutivo: true } } },
          rotulo: (l) => resumoDe(l)?.statusReprodutivo ?? "(sem resumo)",
        },
        raca: {
          descricao: "Raça do animal",
          tipo: "texto",
          cardinalidade: "baixa",
          operadores: ["igual", "diferente", "contem", "em"],
          agrupavel: true,
          where: (op, v) => ({ raca: { nome: condTexto(op, v) } }),
          select: { raca: { select: { nome: true } } },
          rotulo: (l) => (l.raca as Rel)?.nome ?? "(sem raça)",
        },
        grupo: {
          descricao: "Lote/grupo do animal",
          tipo: "texto",
          cardinalidade: "baixa",
          operadores: ["igual", "diferente", "contem", "em"],
          agrupavel: true,
          where: (op, v) => ({ grupo: { nome: condTexto(op, v) } }),
          select: { grupo: { select: { nome: true } } },
          rotulo: (l) => (l.grupo as Rel)?.nome ?? "(sem grupo)",
        },
        // Dimensão INDIVIDUAL: agrupar por 'animal' + ordenarPor uma métrica dá
        // rankings ("vaca mais produtiva", "top 10 CCS"). Alta cardinalidade →
        // sempre sai top-N. Filtro casa número exato OU parte do nome.
        animal: {
          descricao:
            "O animal individual (nome #número). Use em agruparPor + ordenarPor para rankings: 'vaca mais produtiva' = agruparPor ['animal'], ordenarPor mediaProducaoDia desc, limite 1.",
          tipo: "texto",
          cardinalidade: "alta",
          operadores: ["igual", "contem"],
          agrupavel: true,
          where: (_op, v) => ({
            OR: [{ numero: String(v) }, { nome: { contains: v as string, mode: "insensitive" } }],
          }),
          select: { nome: true, numero: true },
          rotulo: (l) => `${(l.nome as string | null) ?? "Sem nome"} #${l.numero}`,
        },
      },
      metricas: {
        numAnimais: {
          descricao: "Quantidade de animais",
          agregacao: "contagem",
          formato: "inteiro",
        },
        mediaDel: {
          descricao: "DEL médio (dias em lactação; ignora animais sem resumo)",
          agregacao: "media",
          select: { resumo: { select: { del: true } } },
          valor: (l) => resumoDe(l)?.del ?? null,
          formato: "numero",
        },
        mediaCcs: {
          descricao: "CCS média (mil céls/mL; ignora animais sem medição)",
          agregacao: "media",
          select: { resumo: { select: { ccs: true } } },
          valor: (l) => resumoDe(l)?.ccs ?? null,
          formato: "numero",
        },
        mediaProducaoDia: {
          descricao: "Produção média diária por animal (L/dia, do resumo)",
          agregacao: "media",
          select: { resumo: { select: { producaoMediaDia: true } } },
          valor: (l) => resumoDe(l)?.producaoMediaDia ?? null,
          formato: "litros",
        },
        maxProducaoDia: {
          descricao: "MAIOR produção diária individual do recorte (L/dia, do resumo)",
          agregacao: "max",
          select: { resumo: { select: { producaoMediaDia: true } } },
          valor: (l) => resumoDe(l)?.producaoMediaDia ?? null,
          formato: "litros",
        },
        mediaProducao305: {
          descricao: "Produção 305 dias média (L, do resumo)",
          agregacao: "media",
          select: { resumo: { select: { producao305: true } } },
          valor: (l) => resumoDe(l)?.producao305 ?? null,
          formato: "litros",
        },
      },
    },
  },
};
