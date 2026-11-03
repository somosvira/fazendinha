import type { ElegibilidadeNaData } from "./elegibilidade-api";
import type { LinhaManejo } from "./manejo-reprodutivo";
import { diasManejo } from "./manejo-reprodutivo";
import type { AnimalResumo } from "../types";
export type FilaAptidaoManejo = "avaliacao" | "agendamento" | "retorno" | "aptidao";
export type FilasComAptidao = Record<"liberadas" | "diagnostico" | "pendencias" | FilaAptidaoManejo, LinhaManejo[]>;
const estados = { AVALIACAO_DEVIDA: "avaliacao", AGENDAMENTO: "agendamento", RETORNO: "retorno", APTIDAO: "aptidao" } as const;
const pendenciasCadastro = new Set(["CICLO_DESCONHECIDO", "INICIO_CICLO_NAO_COMPROVADO", "LOCALIZACAO_DESCONHECIDA", "LOCALIZACOES_CONFLITANTES", "LOCALIZACOES_SOBREPOSTAS", "PAPEL_DESCONHECIDO", "PAPEIS_CONFLITANTES", "GESTACOES_CONFLITANTES", "ORIGEM_INICIAL_ANULADA", "ENCERRAMENTO_GESTACAO_DESCONHECIDO", "CLASSE_REPRODUTIVA_NAO_COMPROVADA", "CLASSE_REPRODUTIVA_CONFLITANTE"]);
/** As filas são dimensões da mesma ficha; todas une animais, não soma necessidades. */
export function incorporarAptidaoManejo(base: Pick<FilasComAptidao, "liberadas" | "diagnostico" | "pendencias">, itens: ElegibilidadeNaData[], animais: AnimalResumo[], hoje: string): FilasComAptidao {
  const porId = new Map(animais.map(a => [a.id, a]));
  const projecoes = new Map(itens.map(e => [e.animalId, e]));
  const pendencias = new Map<string, LinhaManejo>();
  const filas: FilasComAptidao = { liberadas: base.liberadas.filter(a => projecoes.get(a.animalId)?.elegivel === true), diagnostico: [], pendencias: [], avaliacao: [], agendamento: [], retorno: [], aptidao: [] };
  const linha = (e: ElegibilidadeNaData, data: string | null, motivos: string[] = []): LinhaManejo | null => {
    const a = porId.get(e.animalId);
    if (!a || a.sexo !== "F" || a.situacao !== "ATIVO") return null;
    return { animalId: a.id, brinco: a.brinco, nome: a.nome, lote: a.lote, data, dias: diasManejo(data, hoje), motivos, aptidaoClinica: e.aptidaoClinica?.estado ?? "NAO_DETERMINADA", necessidadeId: e.acompanhamentoAptidao?.necessidadeId ?? e.necessidadeAptidao?.necessidadeId, visitas: e.acompanhamentoAptidao?.visitasAbertas ?? [] };
  };
  const diagnosticos = new Map(base.diagnostico.map(a => [a.animalId, a]));
  for (const e of itens) {
    if (e.demandasAcompanhamento?.length) {
      const demandas = [...new Map(e.demandasAcompanhamento.map(d => [d.id, d])).values()]
        .sort((a, b) => (a.previstaPara ?? "9999").localeCompare(b.previstaPara ?? "9999") || a.ocorrencia - b.ocorrencia || a.id.localeCompare(b.id));
      const diagnostico = linha(e, demandas[0].previstaPara);
      if (diagnostico) diagnosticos.set(e.animalId, { ...diagnostico, demandasAcompanhamento: demandas });
    }
    const acompanhamento = e.acompanhamentoAptidao;
    const estado = acompanhamento?.fila;
    const fila = estado && estado in estados ? estados[estado as keyof typeof estados] : null;
    const data = fila === "agendamento" ? acompanhamento?.visitasAbertas[0]?.data ?? null : fila === "retorno" ? e.aptidaoClinica?.retornoEm ?? null : fila === "aptidao" ? e.aptidaoClinica?.data ?? null : e.necessidadeAptidao?.devidaDesde ?? null;
    const l = linha(e, data);
    if (fila && l) filas[fila].push(l);
    const crescendo = e.necessidadeAptidao?.estado === "CRITERIOS_NAO_ATINGIDOS";
    const legados = base.pendencias.find(a => a.animalId === e.animalId)?.motivos.filter(m => pendenciasCadastro.has(m)) ?? [];
    const motivos = [...new Set([
      ...legados.filter(m => !(crescendo && ["CICLO_DESCONHECIDO", "INICIO_CICLO_NAO_COMPROVADO"].includes(m))),
      ...e.necessidadeAptidao?.pendencias ?? [],
      ...e.motivos.filter(m => pendenciasCadastro.has(m) && (e.necessidadeAptidao || !["CICLO_DESCONHECIDO", "INICIO_CICLO_NAO_COMPROVADO"].includes(m) || legados.includes(m)) && !(crescendo && ["CICLO_DESCONHECIDO", "INICIO_CICLO_NAO_COMPROVADO"].includes(m))),
    ])];
    const p = motivos.length ? linha(e, null, motivos) : null;
    if (p) pendencias.set(e.animalId, p);
  }
  filas.diagnostico = [...diagnosticos.values()];
  filas.pendencias = [...pendencias.values()];
  for (const fila of ["liberadas", "diagnostico"] as const) filas[fila] = filas[fila].map(a => { const e = projecoes.get(a.animalId); return e ? { ...a, aptidaoClinica: e.aptidaoClinica?.estado ?? "NAO_DETERMINADA" } : a; });
  return filas;
}
