import { useState, type ReactNode, type FormEventHandler } from "react";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PainelFiltros } from "./PainelFiltros";
import "./barra-consulta.css";

export type CriterioConsulta = { id: string; rotulo: string; limpar: () => void };

/** Uma única barra para a consulta; cada página conserva seus dados e handlers. */
export function BarraConsulta({ children, acao, resumo, adicionais, criterios = [], onLimpar, onChange, edicaoFiltros }: {
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
  return <div className="consulta-barra" onChange={onChange}>
    <div className="consulta-linha">
      <div className="consulta-controles">{children}{adicionais && <Button variant="outline" type="button" aria-haspopup="dialog" aria-expanded={aberto} onClick={() => { edicaoFiltros?.iniciar(); setAberto(true); }}><SlidersHorizontal size={16} aria-hidden />Mais filtros{criterios.length > 0 && <span>({criterios.length})</span>}</Button>}</div>
      {(acao || resumo) && <div className="consulta-acoes">{resumo}{acao}</div>}
    </div>
    {criterios.length > 0 && <div className="consulta-criterios" aria-label="Filtros ativos">{criterios.map(c => <Button key={c.id} variant="outline" type="button" aria-label={`Remover filtro: ${c.rotulo}`} onClick={c.limpar}>{c.rotulo}<X size={14} aria-hidden /></Button>)}{onLimpar && <Button variant="ghost" type="button" onClick={onLimpar}>Limpar filtros</Button>}</div>}
    {adicionais && <PainelFiltros aberto={aberto} onAbertoChange={setAberto} temFiltros={!!edicaoFiltros || criterios.length > 0} onAplicar={edicaoFiltros ? () => { edicaoFiltros.aplicar(); setAberto(false); } : undefined} onLimpar={edicaoFiltros?.limpar ?? onLimpar ?? (() => criterios.forEach(c => c.limpar()))}>{adicionais}</PainelFiltros>}
  </div>;
}

/** Estados comuns diretos; os restantes continuam disponíveis, sem duplicação. */
export function SituacoesConsulta({ rotulo = "Situação", valor, opcoes, onChange, diretas = 3 }: {
  rotulo?: string; valor: string; opcoes: Array<{ valor: string; texto: string }>; onChange: (valor: string) => void; diretas?: number;
}) {
  const principais = opcoes.length <= diretas + 1 ? opcoes : opcoes.slice(0, diretas + 1);
  const restantes = opcoes.slice(principais.length);
  const selecionada = restantes.find(o => o.valor === valor);
  return <div className="consulta-situacoes" role="group" aria-label={rotulo}>
    {principais.map(o => <Button type="button" key={o.valor} data-value={o.valor} variant={valor === o.valor ? "default" : "outline"} aria-pressed={valor === o.valor} onClick={() => onChange(o.valor)}>{o.texto}</Button>)}
    {restantes.length > 0 && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant={selecionada ? "default" : "outline"}>{selecionada?.texto ?? "Outras situações"}<ChevronDown size={14} aria-hidden /></Button></DropdownMenuTrigger><DropdownMenuContent>{restantes.map(o => <DropdownMenuItem key={o.valor} onSelect={() => onChange(o.valor)}>{o.texto}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}
  </div>;
}
