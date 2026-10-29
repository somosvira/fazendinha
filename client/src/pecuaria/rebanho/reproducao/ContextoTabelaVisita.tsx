import { rotuloLactacao } from "../lib/lactacao";
import type { ReactNode } from "react";

/** Campos opcionais presentes nas prévias do planner e em snapshots de visita. */
export type ContextoTabelaVisitaProps = {
  brinco?: string | null;
  nome?: string | null;
  categoria?: { nome?: string | null } | null;
  lote?: { nome?: string | null } | null;
  situacao?: string | null;
  situacaoProdutiva?: string | null;
  del?: number | null;
  partos?: number | null;
  tentativasCiclo?: number | null;
  diasTentativa?: number | null;
  tentativa?: { tipo?: string | null; data?: string | null } | null;
  ultimoParto?: { data?: string | null } | null;
  retencaoPlacenta?: boolean | null;
  seca?: boolean | null;
};

type CelulasProps = {
  contexto: ContextoTabelaVisitaProps;
  /** Data preservada da visita; não é usada para recalcular os dados clínicos. */
  dataReferencia?: string;
  animalSticky?: boolean;
  compacto?: boolean;
};

export const contarColunasContextoVisita = () => 9;

function conhecido(valor: string | number | null | undefined): string {
  return valor == null || valor === "" ? "—" : String(valor);
}

function delPreservado(c: ContextoTabelaVisitaProps): string {
  if (c.situacaoProdutiva === "SECA" || !c.situacaoProdutiva && c.seca === true) return "Seca";
  if (c.situacaoProdutiva && c.situacaoProdutiva !== "LACTANTE") return rotuloLactacao(c.situacaoProdutiva);
  return conhecido(c.del);
}

function situacao(c: ContextoTabelaVisitaProps): string {
  const rotulos: Record<string, string> = {
    VAZIA: "Vazia", GESTANTE: "Gestante", DESCONHECIDA: "Desconhecida",
    APTA: "Apta", AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico",
  };
  return c.situacao ? rotulos[c.situacao] ?? c.situacao : "Não informada";
}

function diasEntreDatas(dataReferencia: string | undefined, dataFato: string | null | undefined): number | null {
  const referencia = dataReferencia?.slice(0, 10), fato = dataFato?.slice(0, 10);
  if (!referencia || !fato || !/^\d{4}-\d{2}-\d{2}$/.test(referencia) || !/^\d{4}-\d{2}-\d{2}$/.test(fato)) return null;
  const [ra, rm, rd] = referencia.split("-").map(Number), [fa, fm, fd] = fato.split("-").map(Number);
  const delta = Date.UTC(ra, rm - 1, rd) - Date.UTC(fa, fm - 1, fd);
  return Number.isFinite(delta) && delta >= 0 ? Math.floor(delta / 86400000) : null;
}

function tipoTentativa(tipo: string | null | undefined): string | null {
  if (!tipo) return null;
  const normalizado = tipo.toLocaleUpperCase("pt-BR");
  if (normalizado === "IA" || normalizado.includes("INSEMIN")) return "IA";
  if (normalizado === "TE" || normalizado.includes("TRANSFER")) return "TE";
  if (normalizado.includes("COBERT")) return "Cobertura";
  return null;
}

function rp(c: ContextoTabelaVisitaProps): string {
  if (c.retencaoPlacenta === true) return "Sim";
  if (c.retencaoPlacenta === false) return "Não";
  if (c.partos === 0) return "Sem parto";
  return "Não informado";
}

export function CabecalhoContextoVisita({ onOrdenar, ordem, desc }: { onOrdenar?: (campo: "BRINCO" | "DEL" | "DIAS_TENTATIVA") => void; ordem?: string; desc?: boolean } = {}) {
  const coluna = (titulo: string, campo: "BRINCO" | "DEL" | "DIAS_TENTATIVA") => onOrdenar ? <button className="visita-ordenar h-auto" onClick={()=>onOrdenar(campo)} aria-label={`Ordenar por ${titulo}`}>{titulo}{ordem === campo ? desc ? " ↓" : " ↑" : ""}</button> : titulo;
  return <>
    <th scope="col" className="contexto-visita-animal">{coluna("Animal", "BRINCO")}</th>
    <th scope="col">Lote</th>
    <th scope="col">Categoria</th>
    <th scope="col">Situação</th>
    <th scope="col" className="text-right tabular-nums">{coluna("DEL", "DEL")}</th>
    <th scope="col" className="text-right tabular-nums">Tentativas</th>
    <th scope="col" className="text-right tabular-nums">{coluna("Dias desde tentativa", "DIAS_TENTATIVA")}</th>
    <th scope="col" className="text-right tabular-nums">Partos</th>
    <th scope="col">RP</th>
  </>;
}

export function CelulasContextoVisita({ contexto: c, dataReferencia, animalSticky = false, compacto = false }: CelulasProps): ReactNode {
  const animal = [conhecido(c.brinco), c.nome].filter(Boolean).join(" · ") || "—";
  const diasTentativa = c.diasTentativa ?? diasEntreDatas(dataReferencia, c.tentativa?.data);
  const tipo = tipoTentativa(c.tentativa?.tipo);
  const detalheDias = c.diasTentativa != null ? "Intervalo preservado" : diasTentativa != null ? "Calculado entre datas preservadas" : "Sem intervalo informado";
  const rotuloDias = tipo ? `Dias desde ${tipo}` : "Dias desde tentativa";
  return <>
    <td title={animal} className={`contexto-visita-animal ${animalSticky ? "contexto-visita-animal-sticky" : ""}`}>{compacto ? <><strong>{conhecido(c.brinco)}</strong>{c.nome && <span>{c.nome}</span>}</> : animal}</td>
    <td className="contexto-visita-lote" title={c.lote?.nome ?? undefined}>{conhecido(c.lote?.nome)}</td>
    <td>{conhecido(c.categoria?.nome)}</td>
    <td>{compacto ? <span className={`visita-badge ${c.situacao === "GESTANTE" ? "verde" : c.situacao === "VAZIA" ? "" : "azul"}`}>{situacao(c)}</span> : situacao(c)}</td>
    <td className="text-right tabular-nums">{delPreservado(c)}</td>
    <td className="text-right tabular-nums">{conhecido(c.tentativasCiclo)}</td>
    <td className="text-right tabular-nums" title={detalheDias} aria-label={`${rotuloDias}: ${conhecido(diasTentativa)}${tipo ? ` (${tipo})` : ""}`}>{conhecido(diasTentativa)}</td>
    <td className="text-right tabular-nums">{conhecido(c.partos)}</td>
    <td title={rp(c)}>{compacto && c.retencaoPlacenta == null ? "—" : rp(c)}</td>
  </>;
}

/** Contexto clínico completo para consulta inline quando a tabela vira cartão no celular. */
export function ContextoInlineVisita({ contexto: c, dataReferencia }: { contexto: ContextoTabelaVisitaProps; dataReferencia?: string }) {
  const dias = c.diasTentativa ?? diasEntreDatas(dataReferencia, c.tentativa?.data);
  return <dl className="visita-contexto-inline" aria-label="Contexto do animal">
    <div><dt>Lote</dt><dd>{conhecido(c.lote?.nome)}</dd></div>
    <div><dt>Categoria</dt><dd>{conhecido(c.categoria?.nome)}</dd></div>
    <div><dt>Situação</dt><dd>{situacao(c)}</dd></div>
    <div><dt>DEL</dt><dd>{delPreservado(c)}</dd></div>
    <div><dt>Tentativas</dt><dd>{conhecido(c.tentativasCiclo)}</dd></div>
    <div><dt>Dias desde tentativa</dt><dd>{conhecido(dias)}</dd></div>
    <div><dt>Partos</dt><dd>{conhecido(c.partos)}</dd></div>
    <div><dt>RP</dt><dd>{rp(c)}</dd></div>
  </dl>;
}
