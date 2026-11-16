import { createContext, useCallback, useContext, useLayoutEffect, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChartColumn, LayoutGrid, List } from "lucide-react";
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
type ConsultaAtiva = { ancora: HTMLElement; modo: ModoConsulta };
const RegistrarConsulta = createContext<((consulta: ConsultaAtiva) => () => void) | null>(null);
const ConsultasAtivas = createContext<ConsultaAtiva[]>([]);
const PreferenciaGlobal = createContext<{ modo: ModoConsulta | null; mudar: (modo: ModoConsulta) => void } | null>(null);

function consultaVisivel(ancora: HTMLElement) {
  return ancora.isConnected && !ancora.parentElement?.closest('[hidden], [role="tabpanel"][data-state="inactive"], [role="dialog"]');
}

export function VisualizacaoNoCabecalho({ children, usuarioId = "sessao" }: { children: ReactNode; usuarioId?: string | number }) {
  const chave = `terrano:consultas:${usuarioId}:visualizacao-global`;
  const [modo, setModo] = useState<ModoConsulta | null>(() => {
    try {
      const salvo = localStorage.getItem(chave);
      return salvo === "visual" || salvo === "tabela" ? salvo : null;
    } catch { return null; }
  });
  const mudar = useCallback((valor: ModoConsulta) => {
    setModo(valor);
    try { localStorage.setItem(chave, valor); } catch { /* A preferência em memória continua disponível. */ }
  }, [chave]);
  const [consultas, setConsultas] = useState<ConsultaAtiva[]>([]);
  const registrar = useCallback((consulta: ConsultaAtiva) => {
    setConsultas(atuais => [...atuais, consulta]);
    return () => setConsultas(atuais => atuais.filter(atual => atual !== consulta));
  }, []);

  const preferencia = useMemo(() => ({ modo, mudar }), [modo, mudar]);
  return <RegistrarConsulta.Provider value={registrar}>
    <ConsultasAtivas.Provider value={consultas}>
      <PreferenciaGlobal.Provider value={preferencia}>{children}</PreferenciaGlobal.Provider>
    </ConsultasAtivas.Provider>
  </RegistrarConsulta.Provider>;
}

export function AlternadorDoCabecalho() {
  const consultas = useContext(ConsultasAtivas);
  const preferencia = useContext(PreferenciaGlobal);
  const visiveis = consultas.filter(({ ancora }) => consultaVisivel(ancora));
  if (!preferencia || !visiveis.length) return null;
  const modoAtual = visiveis.every(consulta => consulta.modo === visiveis[0].modo) ? visiveis[0].modo : null;
  return <ControleVisualizacao modo={preferencia.modo ?? modoAtual} mudar={preferencia.mudar} confirmarAtual={preferencia.modo === null} rotulo="Visualização da tela" visual="Cartões" />;
}

type PropsAlternador = { modo: ModoConsulta; mudar: (v: ModoConsulta) => void; visual?: "Cartões" | "Semana" | "Calendário" | "Linha do tempo" | "Prazos" | "Gráfico"; rotulo: string };

export function AlternarVisualizacaoConsulta(props: PropsAlternador) {
  const registrar = useContext(RegistrarConsulta);
  const modoGlobal = useContext(PreferenciaGlobal)?.modo;
  const centralizar = !!registrar && (!props.visual || props.visual === "Cartões");
  const ancora = useRef<HTMLSpanElement>(null);
  const mudar = useRef(props.mudar);
  mudar.current = props.mudar;
  useLayoutEffect(() => {
    if (centralizar && ancora.current) return registrar?.({ ancora: ancora.current, modo: props.modo });
  }, [registrar, centralizar, props.modo]);
  useLayoutEffect(() => {
    if (centralizar && modoGlobal && modoGlobal !== props.modo) {
      mudar.current(modoGlobal);
    }
  }, [centralizar, modoGlobal, props.modo]);

  return centralizar ? <span ref={ancora} hidden /> : <ControleVisualizacao {...props} />;
}

function ControleVisualizacao({ modo, mudar, visual = "Cartões", rotulo, confirmarAtual = false }: Omit<PropsAlternador, "modo"> & { modo: ModoConsulta | null; confirmarAtual?: boolean }) {
  const Icone = visual === "Cartões" ? LayoutGrid : visual === "Gráfico" ? ChartColumn : CalendarDays;
  return <ToggleGroup type="multiple" role="group" value={modo ? [modo] : []} onValueChange={valores => {
    const proximo = valores.find(valor => valor !== modo);
    if (proximo === "visual" || proximo === "tabela") mudar(proximo);
    else if (confirmarAtual && modo) mudar(modo);
  }} aria-label={rotulo} className="consulta-visual-alternador">
    <ToggleGroupItem value="visual" aria-label={visual} className="h-auto"><Icone size={16} aria-hidden /><span>{visual}</span></ToggleGroupItem>
    <ToggleGroupItem value="tabela" aria-label="Tabela" className="h-auto"><List size={16} aria-hidden /><span>Tabela</span></ToggleGroupItem>
  </ToggleGroup>;
}
