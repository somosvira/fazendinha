import type { DemandaManejo } from "./elegibilidade-api";
import { listarAnimais } from "../api";
import type { AnimalResumo, CategoriaDTO } from "../types";
import type { PainelReprodutivo } from "./api";
import type { AcompanhamentoIndicadores } from "./IndicadoresAcompanhamento";

export type FilaLegadaManejo = "liberadas" | "diagnostico" | "pendencias";
export type FilaManejo = FilaLegadaManejo | "avaliacao" | "agendamento" | "retorno" | "aptidao";
export type LinhaManejo = {
  animalId: string;
  brinco: string;
  nome: string | null;
  lote: { id: string; nome: string } | null;
  data: string | null;
  dias: number | null;
  motivos: string[];
  aptidaoClinica?: "APTA" | "NAO_APTA" | "NAO_DETERMINADA";
  necessidadeId?: string;
  demandasAcompanhamento?: DemandaManejo[];
  visitas?: { id: string; nome: string }[];
};
export type ConsultaManejo = { fila: FilaManejo | "todas" | "manejo"; busca: string; lote: string; ordem: string; pagina: number; tamanho: number };
const numero = (v: string | null, padrao: number) => v && /^\d+$/.test(v) && Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : padrao;
export function lerConsultaManejo(): ConsultaManejo {
  const p = new URLSearchParams(window.location.search);
  const fila = p.get("fila");
  return {
    fila: fila === "diagnostico" || fila === "pendencias" || fila === "liberadas" || fila === "todas" || fila === "avaliacao" || fila === "agendamento" || fila === "retorno" || fila === "aptidao" ? fila : "manejo",
    busca: p.get("q") ?? "", lote: p.get("lote") ?? "",
    ordem: ["maior-espera", "menor-espera", "animal", "animal-desc"].includes(p.get("ordem") ?? "") ? p.get("ordem")! : "maior-espera",
    pagina: numero(p.get("pagina"), 1), tamanho: [4, 10, 25, 50].includes(numero(p.get("porPagina"), 4)) ? numero(p.get("porPagina"), 4) : 4,
  };
}

/** Percorre o conjunto autorizado antes dos filtros e da paginação visual. */
export async function carregarAnimaisManejo(propriedadeId: number, atual: () => boolean): Promise<AnimalResumo[]> {
  const itens: AnimalResumo[] = [];
  for (let pagina = 1; ; pagina++) {
    const resposta = await listarAnimais({ propriedadeId, sexo: "F", situacao: "ATIVO", page: pagina, pageSize: 100 }, propriedadeId);
    if (!atual()) return [];
    itens.push(...resposta.itens);
    if (itens.length >= resposta.total) return [...new Map(itens.map(a => [a.id, a])).values()];
    if (!resposta.itens.length) throw new Error("A lista de animais mudou durante a consulta. Atualize para conferir o conjunto completo.");
  }
}

export function diasManejo(data: string | null, hoje: string): number | null {
  if (!data || data.slice(0, 10) > hoje) return null;
  const dias = (Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${data.slice(0, 10)}T00:00:00Z`)) / 86400000;
  return Number.isFinite(dias) ? dias : null;
}
export function montarFilasManejo(painel: PainelReprodutivo, acompanhamento: AcompanhamentoIndicadores, animais: AnimalResumo[], hoje: string, categorias: CategoriaDTO[] = []): Record<FilaLegadaManejo, LinhaManejo[]> {
  const porId = new Map(animais.map(a => [a.id, a]));
  const porIdPainel = new Map(painel.animais.map(a => [a.animalId, a]));
  const linha = (animalId: string, data: string | null, motivos: string[] = []): LinhaManejo | null => {
    const animal = porId.get(animalId);
    if (!animal || animal.situacao !== "ATIVO" || animal.sexo !== "F") return null;
    return { animalId, brinco: animal.brinco, nome: animal.nome, lote: animal.lote, data, dias: diasManejo(data, hoje), motivos };
  };
  const diagnostico = painel.animais.filter(a => a.situacao === "AGUARDANDO_DIAGNOSTICO").flatMap(a => {
    const data = a.ultimaTentativa?.data?.slice(0, 10) ?? null;
    const r = linha(a.animalId, data && data <= hoje ? data : null);
    return r ? [r] : [];
  });
  const idsDiagnostico = new Set(diagnostico.map(a => a.animalId));
  const liberadas = acompanhamento.espera.filaAtual.flatMap(c => {
    const data = c.primeiraLiberacao?.data?.slice(0, 10) ?? null;
    // O servidor comprova disponibilidade no corte. Ausência/futuro nunca vira liberação atual.
    if (!data || data > hoje || c.primeiroServico || idsDiagnostico.has(c.animalId) || porIdPainel.get(c.animalId)?.situacao === "GESTANTE") return [];
    const r = linha(c.animalId, data);
    return r ? [r] : [];
  });
  // Usa a classificação atual calculada pelo servidor, inclusive atribuição manual.
  // O código 5 identifica a categoria padrão feminina; nome, lote e idade isolada não decidem.
  const crescimento = new Set(categorias.filter(c => c.ativo && c.padrao && c.ideagriId === 5 && c.sexo === "F").map(c => c.id));
  const foraDaFase = (id: string) => {
    const animal = porId.get(id), estado = porIdPainel.get(id);
    if (!animal?.categoria || !crescimento.has(animal.categoria.id) || !estado) return false;
    // Evidência reprodutiva ou conflito prevalece sobre a categoria de crescimento.
    return estado.temHistoricoReprodutivo === false && estado.situacao === "DESCONHECIDA" && estado.partos === 0 && estado.tentativasCiclo === 0
      && !estado.ultimaTentativa && !estado.gestacao && !estado.resumoAcompanhamento?.referencia
      && !estado.restricoes.length && !estado.pendenciasContexto?.length
      && animal.papelReprodutivoEstado !== "CONFLITO"
      && animal.papelReprodutivo !== "RECEPTORA" && animal.papelReprodutivo !== "DOADORA"
      && !painel.avaliacoes.some(a => a.animalId === id && a.status === "VALIDO" && a.data.slice(0, 10) <= hoje);
  };
  const pendentes = new Map<string, LinhaManejo>();
  const incluir = (id: string, motivo: string, data: string | null = null) => {
    if (idsDiagnostico.has(id) || liberadas.some(a => a.animalId === id)) return;
    if (["INICIO_CICLO_NAO_COMPROVADO", "CICLO_DESCONHECIDO", "LIBERACAO_NAO_COMPROVADA"].includes(motivo) && foraDaFase(id)) return;
    const r = pendentes.get(id) ?? linha(id, data);
    if (r) { r.motivos = [...new Set([...r.motivos, motivo])]; pendentes.set(id, r); }
  };
  acompanhamento.espera.pendenciasFila.forEach(p => incluir(p.linha.animalId, p.motivo, p.linha.primeiraLiberacao?.data ?? null));
  acompanhamento.pendenciasOrigemCiclo.forEach(p => incluir(p.animalId, p.motivo));
  acompanhamento.exclusoesEscopo?.filter(p => p.populacao === "FILA_ATUAL").forEach(p => p.motivos.forEach(m => incluir(p.animalId, m)));
  return { liberadas: [...new Map(liberadas.map(a => [a.animalId, a])).values()], diagnostico, pendencias: [...pendentes.values()] };
}
export function filtrarManejo(linhas: LinhaManejo[], consulta: ConsultaManejo): LinhaManejo[] {
  const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  return linhas.filter(a => (!consulta.lote || (consulta.lote === "sem-lote" ? !a.lote : a.lote?.id === consulta.lote)) && normalizar(`${a.brinco} ${a.nome ?? ""}`).includes(normalizar(consulta.busca.trim())))
    .sort((a, b) => {
      if (!consulta.ordem.startsWith("animal")) {
        if (a.dias === null && b.dias !== null) return 1;
        if (b.dias === null && a.dias !== null) return -1;
        const diferenca = (a.dias ?? 0) - (b.dias ?? 0);
        if (diferenca) return consulta.ordem === "menor-espera" ? diferenca : -diferenca;
      }
      return (consulta.ordem === "animal-desc" ? -1 : 1) * (a.brinco.localeCompare(b.brinco, "pt-BR", { numeric: true }) || a.animalId.localeCompare(b.animalId));
    });
}
