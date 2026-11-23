import { useLayoutEffect, useEffect, useState } from "react";
import { CalendarDays, ChartColumn, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import "./visualizacao-consulta.css";

export type ModoConsulta = "visual" | "tabela";
function chavePreferencia(chave: string, dominio: string) {
  try { const usuario = JSON.parse(localStorage.getItem("rionovo:usuario") ?? "null"); return `terrano:${dominio}:${usuario?.id ?? "sessao"}:${chave}`; } catch { return `terrano:${dominio}:sessao:${chave}`; }
}
/**
 * Listas abrem em tabela: quem administra a fazenda compara linhas, não cartões.
 * `padraoAmplo = "visual"` fica para visualizações que mostram algo que a tabela não
 * mostra (calendário, linha do tempo, prazos, gráficos).
 */
export function useVisualizacaoConsulta(chave: string, dominio = "consultas", padraoAmplo: ModoConsulta = "tabela") {
  const padrao = padraoAmplo;
  const ler = (): ModoConsulta => {
    const url = new URLSearchParams(window.location.search).get(chave);
    if (url === "visual" || url === "tabela") return url;
    try { const salvo = localStorage.getItem(chavePreferencia(chave, dominio)); return salvo === "visual" || salvo === "tabela" ? salvo : padrao; } catch { return padrao; }
  };
  const [modo, setModo] = useState<ModoConsulta>(ler);
  useEffect(() => { const restaurar = () => setModo(ler()); window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar); }, [chave, dominio, padrao]);
  const mudar = (valor: ModoConsulta) => {
    setModo(valor);
    try { localStorage.setItem(chavePreferencia(chave, dominio), valor); } catch { /* A preferência em memória continua disponível. */ }
    const url = new URL(window.location.href); url.searchParams.set(chave, valor);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  };
  /** Volta para tabela sem gravar preferência (usado quando a tela não tem outra visualização). */
  const forcarTabela = () => setModo("tabela");
  return { modo, mudar, forcarTabela };
}
type PropsAlternador = { modo: ModoConsulta; mudar: (v: ModoConsulta) => void; forcarTabela?: () => void; visual?: "Cartões" | "Semana" | "Calendário" | "Linha do tempo" | "Prazos" | "Gráfico"; rotulo: string };

/**
 * Listas são sempre tabelas: o alternador de "Cartões" não existe mais e uma preferência
 * antiga salva como cartão é descartada. Só aparecem alternadores de visualizações que
 * mostram algo que a tabela não mostra (semana, calendário, linha do tempo, prazos, gráfico).
 */
export function AlternarVisualizacaoConsulta(props: PropsAlternador) {
  const ehCartao = !props.visual || props.visual === "Cartões";
  const { modo, mudar, forcarTabela } = props;
  useLayoutEffect(() => {
    if (ehCartao && modo !== "tabela") (forcarTabela ?? (() => mudar("tabela")))();
  }, [ehCartao, modo, mudar, forcarTabela]);
  return ehCartao ? null : <ControleVisualizacao {...props} />;
}

function ControleVisualizacao({ modo, mudar, visual, rotulo }: PropsAlternador) {
  const Icone = visual === "Gráfico" ? ChartColumn : CalendarDays;
  return <ToggleGroup type="multiple" role="group" value={[modo]} onValueChange={valores => {
    const proximo = valores.find(valor => valor !== modo);
    if (proximo === "visual" || proximo === "tabela") mudar(proximo);
  }} aria-label={rotulo} className="consulta-visual-alternador">
    <ToggleGroupItem value="visual" aria-label={visual} className="h-auto"><Icone size={16} aria-hidden /><span>{visual}</span></ToggleGroupItem>
    <ToggleGroupItem value="tabela" aria-label="Tabela" className="h-auto"><List size={16} aria-hidden /><span>Tabela</span></ToggleGroupItem>
  </ToggleGroup>;
}
