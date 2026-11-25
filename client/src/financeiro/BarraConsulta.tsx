import { OrdenarConsulta, type ControleOrdenacao } from "./OrdenarConsulta";
import { Children, isValidElement, useState, type ReactNode, type FormEventHandler } from "react";
import { Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampoFiltro, PainelFiltros } from "./PainelFiltros";
import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";
import { DateRangePicker, dateFromIso } from "@/components/DateRangePicker";
import "./barra-consulta.css";
import type { CampoConsulta } from "./FiltroColunaConsulta";

export type CriterioConsulta = { id: string; rotulo: string; limpar: () => void };

const dataCurta = (d: Date | null | undefined) => d ? d.toLocaleDateString("pt-BR") : "";
type PeriodoProps = { inicio?: string; fim?: string; label?: string; value?: { start: Date | null; end: Date | null }; triggerAriaLabel?: string };
/** Resumo do período aplicado, para a barra mostrar o recorte sem ocupar espaço com o seletor. */
function resumoPeriodo(p: PeriodoProps) {
  const ini = p.value ? p.value.start : p.inicio ? dateFromIso(p.inicio) : null;
  const fim = p.value ? p.value.end : p.fim ? dateFromIso(p.fim) : null;
  if (!ini && !fim) return null;
  return `${p.label ?? p.triggerAriaLabel ?? "Período"}: ${ini && fim ? `${dataCurta(ini)} a ${dataCurta(fim)}` : ini ? `desde ${dataCurta(ini)}` : `até ${dataCurta(fim)}`}`;
}
/**
 * Uma única barra para a consulta; cada página conserva seus dados e handlers.
 * A barra tem busca e o botão de filtros: seletores de período passados como filhos
 * vão para o painel de filtros e aparecem na barra só como resumo do recorte.
 */
export function BarraConsulta({ children, acao, resumo, adicionais, criterios = [], onLimpar, onChange, edicaoFiltros, campos, erroFiltros, ordenacao }: {
  ordenacao?: ControleOrdenacao;
  erroFiltros?: string | null;
  campos?: CampoConsulta[];
  children?: ReactNode;
  acao?: ReactNode;
  resumo?: ReactNode;
  adicionais?: ReactNode;
  criterios?: CriterioConsulta[];
  onLimpar?: () => void;
  onChange?: FormEventHandler<HTMLDivElement>;
  edicaoFiltros?: { iniciar: () => void; aplicar: () => void; limpar: () => void };
}) {
  const [aberto, setAberto] = useState(false);
  const filhos = Children.toArray(children);
  // Telas com botão e modal de filtros próprios (ex.: Operações) mantêm o período na barra.
  const botaoProprio = filhos.some(f => isValidElement(f) && String((f.props as { className?: string }).className ?? "").includes("consulta-mais-filtros"));
  const periodos = botaoProprio ? [] : filhos.filter(f => isValidElement(f) && (f.type === PeriodoFinanceiroControl || f.type === DateRangePicker));
  const controles = filhos.filter(f => !periodos.includes(f));
  const noPainel = periodos.map((p, i) => <CampoFiltro key={`periodo-${i}`} rotulo={String((p as { props: PeriodoProps }).props.label ?? (p as { props: PeriodoProps }).props.triggerAriaLabel ?? "Período")}>{p}</CampoFiltro>);
  const resumos = periodos.map(p => resumoPeriodo((p as { props: PeriodoProps }).props)).filter(Boolean) as string[];
  const base = campos?.length ? <>{campos.map(c => <div key={c.chave} className="contents">{c.conteudo}</div>)}{adicionais}</> : adicionais;
  const conteudo = noPainel.length ? <>{noPainel}{base}</> : base;
  return <div className="consulta-barra" onChange={onChange}>
    <div className="consulta-linha">
      <div className="consulta-controles">{controles}{conteudo && <Button className="consulta-mais-filtros" variant="outline" type="button" aria-haspopup="dialog" aria-expanded={aberto} onClick={() => { edicaoFiltros?.iniciar(); setAberto(true); }}><Settings2 size={16} aria-hidden />Filtros{criterios.length > 0 && <span>({criterios.length})</span>}</Button>}{ordenacao && <OrdenarConsulta controle={ordenacao} />}</div>
      {(acao || resumo) && <div className="consulta-acoes">{resumo}{acao}</div>}
    </div>
    {(criterios.length > 0 || resumos.length > 0) && <div className="consulta-criterios" aria-label="Filtros ativos">{resumos.map(r => <span key={r} className="consulta-criterio-info">{r}</span>)}{criterios.map(c => <Button key={c.id} variant="outline" type="button" aria-label={`Remover filtro: ${c.rotulo}`} onClick={c.limpar}>{c.rotulo}<X size={14} aria-hidden /></Button>)}{onLimpar && <Button variant="ghost" type="button" onClick={onLimpar}>Limpar filtros</Button>}</div>}
    {conteudo && <PainelFiltros erro={erroFiltros} aberto={aberto} onAbertoChange={setAberto} temFiltros={!!edicaoFiltros || criterios.length > 0} onAplicar={edicaoFiltros ? () => { edicaoFiltros.aplicar(); setAberto(false); } : undefined} onLimpar={edicaoFiltros?.limpar ?? onLimpar ?? (() => criterios.forEach(c => c.limpar()))}>{conteudo}</PainelFiltros>}
  </div>;
}
