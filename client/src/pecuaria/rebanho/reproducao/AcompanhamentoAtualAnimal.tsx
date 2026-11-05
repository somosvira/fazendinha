import { CalendarDays, ClipboardList, HeartPulse, History, Syringe } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { VacaIcon } from "../../../components/icons/VacaIcon";
import { formatBRDateISO } from "../../../lib/hoje";
import { navegarPara } from "../../../router";
import { rotulosReprodutivos, tituloFato, type FatoHistorico } from "./HistoricoReprodutivo";

// Desempate visual por etapa quando os fatos compartilham o dia; não representa horário de execução.
const ordemNoDia: Record<string, number> = { "Situação inicial": 0, Parto: 0, Protocolo: 1, Tentativa: 2, "Avaliação": 3, "Gestação": 4 };

/** A referência vem do servidor; um DG negativo ou novo protocolo não abre outro ciclo. */
type FatoAcompanhamento = FatoHistorico & { tentativaId?: string | null; encerradaEm?: string | null; tipoEncerramento?: string | null };
export function separarAcompanhamento(fatos: FatoAcompanhamento[], referencia?: { data: string; tipo?: "PARTO" | "ABORTO" | "SITUACAO_INICIAL" } | null) {
  const inicio = referencia?.data.slice(0, 10);
  const reinicioPorParto = referencia?.tipo === "PARTO" || referencia?.tipo === "ABORTO";
  const tentativasAnteriores = new Set(fatos.filter(f => f.grupo === "Tentativa" && inicio && f.data.slice(0, 10) <= inicio).map(f => f.id));
  const gestacoesAnteriores = new Set(reinicioPorParto ? fatos.flatMap(f => {
    if (f.grupo === "Parto" && f.data.slice(0, 10) === inicio && f.status !== "ANULADO" && f.gestacaoId) return [f.gestacaoId];
    if (f.grupo === "Gestação" && (f.tentativaId && tentativasAnteriores.has(f.tentativaId) || f.tipoEncerramento === "PARTO" && f.encerradaEm && inicio && f.encerradaEm.slice(0, 10) <= inicio)) return [f.id];
    return [];
  }) : []);
  const atuais = inicio ? fatos.filter(f => {
    const dia = f.data?.slice(0, 10);
    if (reinicioPorParto && (f.grupo === "Situação inicial" && dia <= inicio || f.grupo === "Gestação" && gestacoesAnteriores.has(f.id) || f.grupo === "Avaliação" && f.gestacaoId && gestacoesAnteriores.has(f.gestacaoId))) return false;
    // O parto de origem continua acessível; tentativas daquele dia pertencem ao ciclo anterior.
    return !!dia && (f.grupo === "Tentativa" && reinicioPorParto ? dia > inicio : dia >= inicio);
  }) : fatos;
  const chaves = new Set(atuais.map(f => f.chaveHistorico ?? `${f.grupo}:${f.id}`));
  return { atuais: [...atuais].sort((a,b) => a.data.slice(0, 10).localeCompare(b.data.slice(0, 10)) || (ordemNoDia[a.grupo] ?? 5) - (ordemNoDia[b.grupo] ?? 5) || a.data.localeCompare(b.data) || (a.chaveHistorico ?? a.id).localeCompare(b.chaveHistorico ?? b.id)), anteriores: fatos.filter(f => !chaves.has(f.chaveHistorico ?? `${f.grupo}:${f.id}`)) };
}
export function resultadoAcompanhamento(f: FatoHistorico) {
  if (f.status === "ANULADO") return "Anulado";
  const conclusao = f.exame?.resultados.find(r => r.campo === "CONCLUSAO_GESTACIONAL")?.valor;
  const valor = conclusao == null ? f.resultado : String(conclusao);
  return valor ? rotulosReprodutivos[valor] ?? valor : f.grupo === "Tentativa" ? "Consultar avaliações vinculadas" : rotulosReprodutivos[f.desfecho ?? f.tipo ?? ""] ?? "Registrado";
}
export function AcompanhamentoAtualAnimal({ fatos, onAbrir }: { fatos: FatoHistorico[]; onAbrir: (f: FatoHistorico) => void }) {
  return fatos.length ? <ol className="repro-timeline-atual" aria-label="Linha do tempo do acompanhamento atual">{fatos.map(f => {
    const Icon = f.grupo === "Protocolo" ? ClipboardList : f.grupo === "Tentativa" ? Syringe : f.grupo === "Avaliação" ? HeartPulse : f.grupo === "Parto" ? VacaIcon : History;
    const abrir = () => {
      if (f.urlDetalhe) return navegarPara(f.urlDetalhe);
      if (f.grupo === "Parto") return navegarPara(`/pecuaria/reproducao/partos/${encodeURIComponent(f.id)}?retorno=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}${f.propriedadeId != null ? `&sitio=${f.propriedadeId}` : ""}`);
      onAbrir(f);
    };
    return <li key={f.chaveHistorico ?? `${f.grupo}:${f.id}`}><time dateTime={f.data}>{f.data ? formatBRDateISO(f.data) : "Data não informada"}</time><span className="pec-icone"><Icon width={18} height={18} aria-hidden="true"/></span><div><strong>{f.registro ?? (f.grupo === "Avaliação" ? f.exame?.formatoSnapshot.nome ?? "Avaliação reprodutiva" : tituloFato(f))}</strong><p>{resultadoAcompanhamento(f)}</p></div><Button size="sm" onClick={abrir}>{f.grupo === "Protocolo" ? "Ver protocolo" : f.grupo === "Parto" ? "Ver parto" : f.grupo === "Avaliação" ? "Ver resultado" : "Ver detalhes"}</Button></li>;
  })}</ol> : <p className="text-sm text-ink-3"><CalendarDays className="inline mr-2" size={16} aria-hidden/>Sem fatos registrados neste acompanhamento.</p>;
}
