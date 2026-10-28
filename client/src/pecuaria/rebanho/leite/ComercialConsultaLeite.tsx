import { type ReactNode } from "react";
import { BuscaLista } from "@/components/BuscaLista";
import { BarraConsulta } from "../../../financeiro/BarraConsulta";
import { CampoFiltro } from "../../../financeiro/PainelFiltros";
import { useRascunhoConsulta } from "../../../financeiro/useRascunhoConsulta";
import { PeriodoFinanceiroControl } from "../../../financeiro/PeriodoFinanceiroControl";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { hojeOperacional } from "./modelo";
import "./comercial-consulta.css";

export interface FiltrosComerciais { de: string; ate: string; comprador: string; busca: string; situacao: string; modalidade: string }
export const filtrosComerciaisIniciais = (): FiltrosComerciais => ({ de: `${hojeOperacional().slice(0, 7)}-01`, ate: hojeOperacional(), comprador: "", busca: "", situacao: "", modalidade: "" });
export function lerFiltrosComerciais(prefixo: string): FiltrosComerciais {
  const q = new URLSearchParams(location.search), defaults = filtrosComerciaisIniciais();
  return { de: q.get(`${prefixo}De`) ?? (prefixo === "vendas" ? q.get("operacoesDe") : null) ?? defaults.de, ate: q.get(`${prefixo}Ate`) ?? (prefixo === "vendas" ? q.get("operacoesAte") : null) ?? defaults.ate, comprador: q.get(`${prefixo}Comprador`) ?? "", busca: q.get(`${prefixo}Busca`) ?? "", situacao: q.get(`${prefixo}Situacao`) ?? "", modalidade: q.get(`${prefixo}Modalidade`) ?? "" };
}
export function preservarFiltrosComerciais(prefixo: string, f: FiltrosComerciais) {
  const url = new URL(location.href);
  for (const [nome, valor] of Object.entries(f)) { const chave = `${prefixo}${nome[0].toUpperCase()}${nome.slice(1)}`; if (valor) url.searchParams.set(chave, valor); else url.searchParams.delete(chave); }
  history.replaceState(null, "", url);
}
export function BarraComercialLeite({ filtros, onChange, parceiros, vendas = false }: { filtros: FiltrosComerciais; onChange: (f: FiltrosComerciais) => void; parceiros: { id: string; nome: string }[]; vendas?: boolean }) {
  const draft = useRascunhoConsulta(filtros, filtrosComerciaisIniciais(), onChange);
  return <BarraConsulta edicaoFiltros={draft} erroFiltros={!draft.rascunho.de || !draft.rascunho.ate || draft.rascunho.de > draft.rascunho.ate ? "Informe um período válido." : undefined}
    criterios={[
      ...(filtros.comprador ? [{ id: "comprador", rotulo: parceiros.find(p => p.id === filtros.comprador)?.nome ?? "Comprador", limpar: () => onChange({ ...filtros, comprador: "" }) }] : []),
      ...(filtros.situacao ? [{ id: "situacao", rotulo: filtros.situacao, limpar: () => onChange({ ...filtros, situacao: "" }) }] : []),
      ...(filtros.modalidade ? [{ id: "modalidade", rotulo: filtros.modalidade === "periodo" ? "Por período" : "Avulsa", limpar: () => onChange({ ...filtros, modalidade: "" }) }] : []),
    ]} onLimpar={() => onChange({ ...filtrosComerciaisIniciais(), busca: filtros.busca })}
    adicionais={<><CampoFiltro rotulo="Desde"><input type="date" value={draft.rascunho.de} onChange={e => draft.editar("de", e.target.value)} /></CampoFiltro><CampoFiltro rotulo="Até"><input type="date" value={draft.rascunho.ate} onChange={e => draft.editar("ate", e.target.value)} /></CampoFiltro>
      <CampoFiltro rotulo="Comprador"><SelectCampo value={draft.rascunho.comprador} onValueChange={v => draft.editar("comprador", v)}><option value="">Todos os compradores</option>{parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</SelectCampo></CampoFiltro>
      <CampoFiltro rotulo={vendas ? "Situação" : "Preço"}><SelectCampo value={draft.rascunho.situacao} onValueChange={v => draft.editar("situacao", v)}><option value="">Todas</option>{(vendas ? ["Aberta", "Fechada", "Confirmada", "Cancelada"] : ["Preço pendente", "Preço definido"]).map(v => <option key={v} value={v}>{v}</option>)}</SelectCampo></CampoFiltro>
      {vendas && <CampoFiltro rotulo="Modalidade"><SelectCampo value={draft.rascunho.modalidade} onValueChange={v => draft.editar("modalidade", v)}><option value="">Todas</option><option value="periodo">Por período</option><option value="avulsa">Avulsa</option></SelectCampo></CampoFiltro>}</>}
  > <BuscaLista rotulo={vendas ? "Buscar comprador ou venda" : "Buscar comprador, coleta ou romaneio"} placeholder={vendas ? "Buscar comprador ou venda" : "Buscar comprador, coleta ou romaneio"} valor={filtros.busca} onChange={busca => onChange({ ...filtros, busca: busca.slice(0, 100) })} />
    <PeriodoFinanceiroControl inicio={filtros.de} fim={filtros.ate} label={vendas ? "Período comercial" : "Período das coletas"} onChange={({ inicio, fim }) => onChange({ ...filtros, de: inicio, ate: fim })} />
  </BarraConsulta>;
}
export function DialogComercialLeite({ titulo, aberto, onFechar, children }: { titulo: string; aberto: boolean; onFechar: () => void; children: ReactNode }) {
  return <Dialog open={aberto} onOpenChange={v => { if (!v) onFechar(); }}><DialogContent className="financeiro-colorido leite-operacoes leite-comercial-dialog" aria-describedby={undefined}><DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>{children}<div className="leite-comercial-rodape"><Button type="button" variant="outline" onClick={onFechar}>Fechar</Button></div></DialogContent></Dialog>;
}
