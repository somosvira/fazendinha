import { useState } from "react";
import "./comercial-consulta.css";
import { Button } from "@/components/ui/button";
import { CabecalhoTabela } from "../../../financeiro/financeiro-ui";
import { PeriodoFinanceiroControl } from "../../../financeiro/PeriodoFinanceiroControl";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { consultarLeite } from "./operacoes-api";
import { hojeOperacional } from "./modelo";
interface LinhaProducao { data: string; brinco: string; nome: string | null; ordenha: string; natureza: string; estado: string; litros: number | null; confirmada: boolean; fonte?: string; finalidade?: { estado: string; dataOperacional?: string; regra?: string } | null }
const naturezas: Record<string,string> = { COMERCIAL: "Comercial", NAO_COMERCIAL: "Descarte", COLOSTRO: "Colostro", A_CLASSIFICAR: "A classificar" };
export function csvProducaoLeite(linhas: LinhaProducao[]) {
  const celula = (v: unknown) => { const texto = v === null || v === undefined ? "Não informado" : String(v); return `"${(/^\s*[=+@-]/.test(texto) ? "'" : "") + texto.replace(/"/g, '""')}"`; };
  return [["Data produção", "Animal ou tanque", "Nome", "Ordenha", "Natureza", "Estado", "Litros medidos", "Confirmada no estoque", "Finalidade na produção", "Data da finalidade", "Regra da finalidade"], ...linhas.map(l => [l.data,l.brinco,l.nome,l.ordenha,naturezas[l.natureza] ?? l.natureza,l.estado,l.litros,l.confirmada ? "Sim" : "Não",l.fonte === "GERAL" ? "Aferição geral do tanque" : l.finalidade?.estado === "COMPROVADA" ? "Leite comprovada na data" : "Finalidade histórica a conciliar",l.finalidade?.dataOperacional ?? l.data,l.finalidade?.regra ?? null])].map(l => l.map(celula).join(";")).join("\r\n");
}
export function ExportacaoProducaoLeite({ podeExportar, propriedadeId }: { podeExportar: boolean; propriedadeId?: number | null }) {
  const [periodo,setPeriodo] = useState({ inicio: `${hojeOperacional().slice(0,7)}-01`, fim: hojeOperacional() }), [natureza,setNatureza] = useState("");
  const [ocupado,setOcupado] = useState(false), [erro,setErro] = useState("");
  const sitio = propriedadeId ?? getPropriedadeAtiva();
  async function exportar() {
    if (!podeExportar || ocupado) return;
    setOcupado(true); setErro("");
    try {
      const q = new URLSearchParams({ inicio:periodo.inicio,fim:periodo.fim,...(natureza ? {natureza} : {}) });
      const r = await consultarLeite<{ itens: LinhaProducao[] }>(`/consultas-producao/exportacao?${q}`,sitio);
      const url = URL.createObjectURL(new Blob([`\uFEFF${csvProducaoLeite(r.itens)}`],{type:"text/csv;charset=utf-8"}));
      const link = document.createElement("a"); link.href=url; link.download=`producao-${periodo.inicio}-${periodo.fim}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
    } catch(e) { setErro(e instanceof Error ? e.message : "Não foi possível exportar a produção."); } finally { setOcupado(false); }
  }
  return <section className="leite-comercial-consulta" aria-label="Exportar produção de leite"><CabecalhoTabela titulo="Produção em CSV" ajuda="Medições atuais do período, por animal ou tanque e ordenha." rotuloAjuda="Sobre produção em csv" />
    {podeExportar ? <div className="leite-comercial-acoes"><PeriodoFinanceiroControl showIcon inicio={periodo.inicio} fim={periodo.fim} onChange={setPeriodo} label="Período da exportação de produção" /><label>Natureza da produção<SelectCampo value={natureza} onValueChange={setNatureza}><option value="">Todas</option>{Object.entries(naturezas).map(([v,nome]) => <option key={v} value={v}>{nome}</option>)}</SelectCampo></label><Button variant="outline" disabled={ocupado || !periodo.inicio || !periodo.fim || periodo.inicio > periodo.fim} onClick={() => void exportar()}>{ocupado ? "Exportando…" : "Exportar produção do período"}</Button></div> : <p>Exportar produção exige permissão de exportação.</p>}{erro && <p role="alert">{erro}</p>}
  </section>;
}
