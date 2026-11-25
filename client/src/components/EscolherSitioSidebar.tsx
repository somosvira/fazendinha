import "./escolher-sitio-sidebar.css";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listarPropriedades, type PropriedadeDTO } from "../api/propriedades";
import { getPropriedadeAtiva } from "../propriedadeScope";
import { ErrorBox, Empty } from "../financeiro/financeiro-ui";
import { EsqueletoCampo } from "./Esqueleto";

const SELETOR_SIDEBAR = '[aria-label="Propriedade / sítio ativo"]';

const MENU_CELULAR = 'button[aria-label="Abrir menu"]';
const visivel = (el: HTMLElement | null | undefined): el is HTMLElement => !!el && el.getClientRects().length > 0;
// Há um seletor na sidebar do desktop e outro no menu do celular: vale o que está à vista.
const seletorVisivel = () => [...document.querySelectorAll<HTMLElement>(SELETOR_SIDEBAR)].find(el => visivel(el));

/** Abre o seletor de sítio da sidebar (Radix abre no pointerdown). */
function abrirGatilho(gatilho: HTMLElement) {
  gatilho.focus();
  gatilho.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" }));
}

/**
 * No desktop o seletor está à vista; no celular a sidebar fica no menu ☰:
 * abre o menu e, quando o seletor aparecer, abre o seletor.
 */
function abrirSeletorDaSidebar() {
  const gatilho = seletorVisivel();
  if (gatilho) { abrirGatilho(gatilho); return; }
  const menu = document.querySelector<HTMLElement>(MENU_CELULAR);
  if (!visivel(menu)) return;
  menu.click();
  // O menu desliza da esquerda: só abre o seletor quando ele parou dentro da tela,
  // senão o clique cai durante a animação e o Radix fecha o seletor na hora.
  let tentativas = 0, ultimoX = Number.NaN;
  const esperar = () => {
    const noMenu = seletorVisivel();
    const x = noMenu ? noMenu.getBoundingClientRect().left : Number.NaN;
    if (noMenu && x >= 0 && x === ultimoX) { abrirGatilho(noMenu); return; }
    ultimoX = x;
    if (++tentativas < 90) requestAnimationFrame(esperar);
  };
  requestAnimationFrame(esperar);
}

/** Aviso padrão quando a área exige um sítio e a sidebar está em Consolidado. */
export function AvisoEscolherSitio() {
  return <section className="escolher-sitio-sidebar" aria-label="Escolha do sítio">
    <span className="escolher-sitio-simbolo"><MapPin size={24} aria-hidden /></span>
    <h2>Escolha um sítio na barra lateral</h2>
    <p>Esta área mostra um sítio por vez.</p>
    <Button variant="outline" onClick={abrirSeletorDaSidebar}>Escolher sítio</Button>
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
export function ExigeSitioDoShell({ onSelecionar, consolidado }: { onSelecionar?: (id: number) => void; /** Com 2+ sítios ativos, mostra esta visão consolidada em vez do aviso. */ consolidado?: ReactNode }) {
  const { sitios, erro, tentarNovamente } = useSitiosAtivos(true);
  const unico = sitios?.length === 1 ? sitios[0] : null;
  useEffect(() => { if (unico) onSelecionar?.(unico.id); }, [unico, onSelecionar]);
  if (sitios === null || unico) return <EstadoSitios erro={erro} tentarNovamente={tentarNovamente} />;
  if (!sitios.length) return <Empty>Nenhum sítio ativo disponível para esta conta.</Empty>;
  return consolidado ? <>{consolidado}</> : <AvisoEscolherSitio />;
}

/**
 * Consulta que exige um sítio, lendo sempre o escopo da sidebar.
 * Com um único sítio ativo, consulta esse sítio; com vários em Consolidado, orienta a escolha na sidebar.
 */
/** `cabecalhoAviso` só aparece junto do aviso: a página sem sítio ainda diz onde a pessoa está e como voltar. */
export function ConsultaDoSitio({ children, cabecalho, cabecalhoAviso }: { children: (sitioId: number) => ReactNode; cabecalho?: ReactNode; cabecalhoAviso?: ReactNode }) {
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
      : <>{cabecalhoAviso}<AvisoEscolherSitio /></>}
  </div>;
}
