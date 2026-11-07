import { reqV4 } from "./api";
import {
  chaveGrupo,
  type ConsultaPlanner,
  type GrupoPlanner,
  type PreviaPlanner,
} from "./planner-api";
import { reqProtocolo, type CabecalhoProtocolo } from "../protocolos/api";
import type { PaginaProtocolo } from "../protocolos/EtapasProtocolo";

type Pagina<T> = {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
};
async function lerTodasAsPaginas<T>(
  carregar: (pagina: number) => Promise<Pagina<T>>,
  chave: (item: T) => string,
) {
  const primeira = await carregar(1);
  if (
    !Array.isArray(primeira.itens) ||
    !Number.isInteger(primeira.total) ||
    !Number.isInteger(primeira.porPagina) ||
    primeira.porPagina < 1
  )
    throw new Error(
      "A consulta retornou dados incompletos. Atualize a visão geral.",
    );
  const itens = [...primeira.itens];
  for (let p = 2; p <= Math.ceil(primeira.total / primeira.porPagina); p++) {
    const atual = await carregar(p);
    if (
      atual.total !== primeira.total ||
      atual.pagina !== p ||
      !atual.itens.length
    )
      throw new Error(
        "Os cuidados mudaram durante a consulta. Atualize a visão geral.",
      );
    itens.push(...atual.itens);
  }
  const unicos = new Map(itens.map((item) => [chave(item), item]));
  if (unicos.size !== primeira.total)
    throw new Error(
      "Os registros mudaram entre páginas. Atualize a visão geral.",
    );
  return [...unicos.values()];
}

export async function consultarAgendaVisaoGeral(
  propriedadeId: number,
  data: string,
) {
  const todos = await lerTodasAsPaginas<GrupoPlanner>(
    async (pagina) => {
      const q = new URLSearchParams({
        propriedadeId: String(propriedadeId),
        data,
        pagina: String(pagina),
        tamanhoPagina: "10",
      });
      const d = await reqV4<ConsultaPlanner>(
        `/visitas/agenda?${q}`,
        undefined,
        "GET",
        propriedadeId,
      );
      return {
        itens: d.grupos,
        total: d.totalGrupos,
        pagina: d.pagina,
        porPagina: d.tamanhoPagina,
      };
    },
    (g) => chaveGrupo(g.grupo),
  );
  return todos.filter((g) => g.secao === "REPRODUCAO");
}

export async function consultarExecucoesVisaoGeral(propriedadeId: number) {
  const ler = (tipo: "programacoes" | "participacoes") =>
    lerTodasAsPaginas<CabecalhoProtocolo>(
      (pagina) =>
        reqProtocolo<PaginaProtocolo<CabecalhoProtocolo>>(
          `/${tipo}?${new URLSearchParams({ tipo: "REPRODUTIVO", status: "ABERTA", pagina: String(pagina), porPagina: "10" })}`,
          propriedadeId,
        ),
      (p) => p.id,
    );
  const [coletivas, individuais] = await Promise.all([
    ler("programacoes"),
    ler("participacoes"),
  ]);
  return [...coletivas, ...individuais].filter((p) => p.status === "ABERTA");
}

export function consultarAnimaisGrupoVisaoGeral(
  propriedadeId: number,
  data: string,
  grupo: GrupoPlanner,
  pagina: number,
) {
  const q = new URLSearchParams({
    propriedadeId: String(propriedadeId),
    data,
    grupo: JSON.stringify(grupo.grupo),
    pagina: String(pagina),
    tamanhoPagina: "10",
  });
  return reqV4<PreviaPlanner>(
    `/visitas/planner/previa?${q}`,
    undefined,
    "GET",
    propriedadeId,
  );
}

export function diaDoGrupo(
  g: Pick<GrupoPlanner, "previstaPara" | "precisaoTemporal">,
) {
  if (!g.previstaPara) return null;
  if (g.precisaoTemporal !== "HORA" || g.previstaPara.length === 10)
    return g.previstaPara.slice(0, 10);
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(g.previstaPara));
  const campo = (tipo: string) => partes.find((p) => p.type === tipo)?.value;
  return `${campo("year")}-${campo("month")}-${campo("day")}`;
}

export function organizarVisaoGeral(
  grupos: GrupoPlanner[],
  execucoes: CabecalhoProtocolo[],
  hoje: string,
  inicio: string,
  fim: string,
) {
  const atuais = grupos.filter((g) => diaDoGrupo(g) === hoje);
  const proximos = grupos.filter((g) => {
    const dia = diaDoGrupo(g);
    return !!dia && dia > hoje && dia >= inicio && dia <= fim;
  });
  const emDestaque = new Set(
    [...atuais, ...proximos].flatMap((g) =>
      g.turma
        ? [
            `${typeof g.contexto?.programacaoId === "string" ? "COLETIVO" : "INDIVIDUAL"}:${g.turma.id}`,
          ]
        : [],
    ),
  );
  return {
    hoje: atuais,
    proximos,
    emAndamento: execucoes.filter((p) => !emDestaque.has(`${p.modo}:${p.id}`)),
    semPrazo: grupos.filter((g) => !g.previstaPara),
  };
}

export function demandaDoGrupo(
  grupo: GrupoPlanner,
  animalId: string,
): string | null {
  const mapa = grupo.contexto?.demandasPorAnimal;
  if (!mapa || typeof mapa !== "object") return null;
  const id = Reflect.get(mapa, animalId);
  return typeof id === "string" ? id : null;
}

export type EtapaDoDia = {
  contextoId: string;
  modo: "COLETIVO" | "INDIVIDUAL";
  nome: string;
  modelo: string;
  etapaId: string;
  etapa: string;
  tarefasIds?: string[];
  totalAnimais: number;
  atendidos: number;
  pendentes: number;
  encerrados: number;
};
export function consultarEtapasDoDia(propriedadeId: number, data: string) {
  return lerTodasAsPaginas<EtapaDoDia>(
    (pagina) =>
      reqProtocolo<Pagina<EtapaDoDia>>(
        `/etapas-do-dia?${new URLSearchParams({ data, pagina: String(pagina), porPagina: "10" })}`,
        propriedadeId,
      ),
    (e) => `${e.modo}:${e.contextoId}:${e.etapaId}`,
  );
}

/** Une cuidados operacionais à etapa sem contar duas vezes tarefas já representadas. */
export function organizarHoje(etapas: EtapaDoDia[], agenda: GrupoPlanner[], hoje: string) {
  const linhas = etapas.map(e => ({...e, tarefasIds: e.tarefasIds ? [...e.tarefasIds] : undefined}));
  const grupos: GrupoPlanner[] = [];
  for (const grupo of agenda.filter(g => diaDoGrupo(g) === hoje)) {
    const ids = grupo.contexto?.tarefasIds;
    const modo = typeof grupo.contexto?.programacaoId === "string" ? "COLETIVO" : "INDIVIDUAL";
    const linha = grupo.grupo.origem === "PROTOCOLO" && grupo.turma && grupo.etapa
      ? linhas.find(e => e.modo === modo && e.contextoId === grupo.turma!.id && e.etapaId === grupo.etapa!.id) : undefined;
    if (!linha?.tarefasIds || !Array.isArray(ids) || !ids.every((id): id is string => typeof id === "string") || new Set(ids).size !== grupo.totalAnimais) {
      grupos.push(grupo);
      continue;
    }
    const cobertas = new Set(linha.tarefasIds);
    const adicionais = [...new Set(ids)].filter(id => !cobertas.has(id));
    linha.totalAnimais += adicionais.length;
    linha.pendentes += adicionais.length;
    linha.tarefasIds.push(...adicionais);
  }
  return {etapas: linhas, grupos};
}
