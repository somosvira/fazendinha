import { OrdenarConsulta, type ControleOrdenacao } from "./OrdenarConsulta";
import { useState, type ReactNode, type FormEventHandler } from "react";
import { Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PainelFiltros } from "./PainelFiltros";
import "./barra-consulta.css";
import type { CampoConsulta } from "./FiltroColunaConsulta";

export type CriterioConsulta = { id: string; rotulo: string; limpar: () => void };

/** Uma única barra para a consulta; cada página conserva seus dados e handlers. */
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
  const conteudo = campos?.length ? <>{campos.map(c => <div key={c.chave} className="contents">{c.conteudo}</div>)}{adicionais}</> : adicionais;
  return <div className="consulta-barra" onChange={onChange}>
    <div className="consulta-linha">
      <div className="consulta-controles">{children}{conteudo && <Button className="consulta-mais-filtros" variant="outline" type="button" aria-haspopup="dialog" aria-expanded={aberto} onClick={() => { edicaoFiltros?.iniciar(); setAberto(true); }}><Settings2 size={16} aria-hidden />Filtros{criterios.length > 0 && <span>({criterios.length})</span>}</Button>}{ordenacao && <OrdenarConsulta controle={ordenacao} />}</div>
      {(acao || resumo) && <div className="consulta-acoes">{resumo}{acao}</div>}
    </div>
    {criterios.length > 0 && <div className="consulta-criterios" aria-label="Filtros ativos">{criterios.map(c => <Button key={c.id} variant="outline" type="button" aria-label={`Remover filtro: ${c.rotulo}`} onClick={c.limpar}>{c.rotulo}<X size={14} aria-hidden /></Button>)}{onLimpar && <Button variant="ghost" type="button" onClick={onLimpar}>Limpar filtros</Button>}</div>}
    {conteudo && <PainelFiltros erro={erroFiltros} aberto={aberto} onAbertoChange={setAberto} temFiltros={!!edicaoFiltros || criterios.length > 0} onAplicar={edicaoFiltros ? () => { edicaoFiltros.aplicar(); setAberto(false); } : undefined} onLimpar={edicaoFiltros?.limpar ?? onLimpar ?? (() => criterios.forEach(c => c.limpar()))}>{conteudo}</PainelFiltros>}
  </div>;
}
