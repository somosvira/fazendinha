import "./escolher-sitio-sidebar.css";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listarPropriedades, type PropriedadeDTO } from "../api/propriedades";
import { getPropriedadeAtiva } from "../propriedadeScope";
import { ErrorBox, Empty } from "../financeiro/financeiro-ui";
import { EsqueletoCampo } from "./Esqueleto";

const SELETOR_SIDEBAR = '[aria-label="Propriedade / sítio ativo"]';

/** Abre o seletor de sítio da sidebar (Radix abre no pointerdown). */
function abrirSeletorDaSidebar() {
  const gatilho = document.querySelector<HTMLElement>(SELETOR_SIDEBAR);
  if (!gatilho) return;
  gatilho.focus();
  gatilho.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" }));
}

/** Aviso padrão quando a área exige um sítio e a sidebar está em Consolidado. */
export function AvisoEscolherSitio() {
  const [temSeletor, setTemSeletor] = useState(false);
  useEffect(() => {
    const gatilho = document.querySelector<HTMLElement>(SELETOR_SIDEBAR);
    setTemSeletor(!!gatilho && gatilho.getClientRects().length > 0);
  }, []);
  return <section className="escolher-sitio-sidebar" aria-label="Escolha do sítio">
    <span className="escolher-sitio-simbolo"><MapPin size={24} aria-hidden /></span>
    <h2>Escolha um sítio na barra lateral</h2>
    <p>Esta área mostra um sítio por vez.</p>
    {temSeletor && <Button variant="outline" onClick={abrirSeletorDaSidebar}>Escolher sítio</Button>}
  </section>;
}

function useSitiosAtivos(habilitado: boolean) {
  const [sitios, setSitios] = useState<PropriedadeDTO[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    if (!habilitado) return;
    let ativo = true;
    setErro(null); setSitios(null);
    void listarPropriedades()
      .then(lista => { if (ativo) setSitios(lista.filter(p => p.ativo !== false)); })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar os sítios."); });
    return () => { ativo = false; };
  }, [habilitado, revisao]);
  return { sitios, erro, tentarNovamente: () => setRevisao(v => v + 1) };
}

function EstadoSitios({ erro, tentarNovamente }: { erro: string | null; tentarNovamente: () => void }) {
  return erro
    ? <div className="grid justify-items-start gap-3"><ErrorBox erro={erro} /><Button variant="outline" onClick={tentarNovamente}>Tentar novamente</Button></div>
    : <EsqueletoCampo label="Carregando sítios" />;
}

/**
 * Área que exige um sítio e é controlada pelo shell (Leite, Bezerreiro).
 * Com um único sítio ativo não há escolha a fazer: o shell recebe esse sítio.
 * Com vários, a escolha fica na sidebar; nada é assumido.
 */
export function ExigeSitioDoShell({ onSelecionar }: { onSelecionar?: (id: number) => void }) {
  const { sitios, erro, tentarNovamente } = useSitiosAtivos(true);
  const unico = sitios?.length === 1 ? sitios[0] : null;
  useEffect(() => { if (unico) onSelecionar?.(unico.id); }, [unico, onSelecionar]);
  if (sitios === null || unico) return <EstadoSitios erro={erro} tentarNovamente={tentarNovamente} />;
  if (!sitios.length) return <Empty>Nenhum sítio ativo disponível para esta conta.</Empty>;
  return <AvisoEscolherSitio />;
}

/**
 * Consulta que exige um sítio, lendo sempre o escopo da sidebar.
 * Com um único sítio ativo, consulta esse sítio; com vários em Consolidado, orienta a escolha na sidebar.
 */
export function ConsultaDoSitio({ children, cabecalho }: { children: (sitioId: number) => ReactNode; cabecalho?: ReactNode }) {
  const global = getPropriedadeAtiva();
  const { sitios, erro, tentarNovamente } = useSitiosAtivos(global == null);
  // Trocar o sítio na sidebar remonta a área: rascunhos e conferências do sítio anterior não sobrevivem.
  if (global != null) return <>{cabecalho}<Fragment key={global}>{children(global)}</Fragment></>;
  const unico = sitios?.length === 1 ? sitios[0] : null;
  return <div className="consulta-por-sitio">
    {cabecalho}
    {sitios === null ? <EstadoSitios erro={erro} tentarNovamente={tentarNovamente} />
      : unico ? <div key={unico.id}>{children(unico.id)}</div>
      : !sitios.length ? <Empty>Nenhum sítio disponível para consulta.</Empty>
      : <AvisoEscolherSitio />}
  </div>;
}
