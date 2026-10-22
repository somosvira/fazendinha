import { useEffect, useState } from "react";
import { CalendarDays, LayoutGrid, List } from "lucide-react";
import "./visualizacao-consulta.css";

export type ModoConsulta = "visual" | "tabela";
function chavePreferencia(chave: string, dominio: string) {
  try { const usuario = JSON.parse(localStorage.getItem("rionovo:usuario") ?? "null"); return `terrano:${dominio}:${usuario?.id ?? "sessao"}:${chave}`; } catch { return `terrano:${dominio}:sessao:${chave}`; }
}
export function useVisualizacaoConsulta(chave: string, dominio = "consultas") {
  const ler = (): ModoConsulta => {
    const url = new URLSearchParams(window.location.search).get(chave);
    if (url === "visual" || url === "tabela") return url;
    try { return localStorage.getItem(chavePreferencia(chave, dominio)) === "tabela" ? "tabela" : "visual"; } catch { return "visual"; }
  };
  const [modo, setModo] = useState<ModoConsulta>(ler);
  useEffect(() => { const restaurar = () => setModo(ler()); window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar); }, [chave, dominio]);
  const mudar = (valor: ModoConsulta) => {
    setModo(valor);
    try { localStorage.setItem(chavePreferencia(chave, dominio), valor); } catch { /* A preferência em memória continua disponível. */ }
    const url = new URL(window.location.href); url.searchParams.set(chave, valor);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  };
  return { modo, mudar };
}
export function AlternarVisualizacaoConsulta({ modo, mudar, visual = "Cartões", rotulo }: { modo: ModoConsulta; mudar: (v: ModoConsulta) => void; visual?: "Cartões" | "Semana" | "Calendário"; rotulo: string }) {
  const Icone = visual !== "Cartões" ? CalendarDays : LayoutGrid;
  return <div role="group" aria-label={rotulo} className="consulta-visual-alternador"><button type="button" aria-pressed={modo === "visual"} onClick={() => mudar("visual")}><Icone size={16} aria-hidden />{visual}</button><button type="button" aria-pressed={modo === "tabela"} onClick={() => mudar("tabela")}><List size={16} aria-hidden />Tabela</button></div>;
}
