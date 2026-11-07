import { useEffect, useState } from "react";
import { CalendarDays, LayoutGrid, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import "./visualizacao-consulta.css";

export type ModoConsulta = "visual" | "tabela";
function chavePreferencia(chave: string, dominio: string) {
  try { const usuario = JSON.parse(localStorage.getItem("rionovo:usuario") ?? "null"); return `terrano:${dominio}:${usuario?.id ?? "sessao"}:${chave}`; } catch { return `terrano:${dominio}:sessao:${chave}`; }
}
/**
 * Listas operacionais abrem em tabela: quem administra a fazenda compara linhas,
 * não cartões. `padrao = "visual"` fica para visualizações que mostram algo que a
 * tabela não mostra (calendário, linha do tempo, prazos, gráficos, ordenhas do dia).
 * Abaixo de 768px a tabela mostra uma ou duas colunas e pede rolagem lateral: sem
 * escolha salva, o padrão ali é o cartão.
 */
function padraoNaLargura(padrao: ModoConsulta): ModoConsulta {
  try { return padrao === "tabela" && window.matchMedia("(max-width: 767px)").matches ? "visual" : padrao; } catch { return padrao; }
}
export function useVisualizacaoConsulta(chave: string, dominio = "consultas", padraoAmplo: ModoConsulta = "tabela") {
  const padrao = padraoNaLargura(padraoAmplo);
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
  return { modo, mudar };
}
export function AlternarVisualizacaoConsulta({ modo, mudar, visual = "Cartões", rotulo }: { modo: ModoConsulta; mudar: (v: ModoConsulta) => void; visual?: "Cartões" | "Semana" | "Calendário" | "Linha do tempo" | "Prazos"; rotulo: string }) {
  const Icone = visual !== "Cartões" ? CalendarDays : LayoutGrid;
  return <ToggleGroup type="multiple" role="group" value={[modo]} onValueChange={valores => {
    // Um modo sempre permanece selecionado; o grupo mantém a navegação por setas.
    const proximo = valores.find(valor => valor !== modo);
    if (proximo === "visual" || proximo === "tabela") mudar(proximo);
  }} aria-label={rotulo} className="consulta-visual-alternador">
    <ToggleGroupItem value="visual" className="h-auto"><Icone size={16} aria-hidden />{visual}</ToggleGroupItem>
    <ToggleGroupItem value="tabela" className="h-auto"><List size={16} aria-hidden />Tabela</ToggleGroupItem>
  </ToggleGroup>;
}
