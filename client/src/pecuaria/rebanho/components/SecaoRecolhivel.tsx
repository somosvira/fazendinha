import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import "./secao-recolhivel.css";

export interface SecaoRecolhivelProps {
  titulo: ReactNode;
  resumo?: ReactNode;
  children: ReactNode;
  acoes?: ReactNode;
  abertaInicial?: boolean;
  id?: string;
  className?: string;
  recolhivel?: boolean;
}

/** Revela uma seção a partir de uma ação externa sem alterar filtros ou fragmentos. */
export function revelarSecao(id: string) {
  document.getElementById(id)?.dispatchEvent(new Event("revelar-secao"));
}

/** Recolhe apenas a apresentação: os formulários e seus rascunhos seguem montados. */
export function SecaoRecolhivel({ titulo, resumo, children, acoes, abertaInicial = true, id, className = "", recolhivel = true }: SecaoRecolhivelProps) {
  const gerado = useId();
  const conteudoId = `${id ?? gerado}-conteudo`;
  const tituloId = `${id ?? gerado}-titulo`;
  const [aberta, setAberta] = useState(() => abertaInicial || (!!id && window.location.hash === `#${id}`));
  const secao = useRef<HTMLElement>(null);
  useEffect(() => {
    const elemento = secao.current;
    const abrir = () => {
      setAberta(true);
      requestAnimationFrame(() => elemento?.scrollIntoView?.({ block: "center" }));
    };
    elemento?.addEventListener("revelar-secao", abrir);
    return () => elemento?.removeEventListener("revelar-secao", abrir);
  }, []);
  useEffect(() => {
    if (!id) return;
    const revelar = () => {
      if (window.location.hash !== `#${id}`) return;
      setAberta(true);
      requestAnimationFrame(() => secao.current?.scrollIntoView?.({ block: "start" }));
    };
    revelar();
    window.addEventListener("hashchange", revelar);
    window.addEventListener("popstate", revelar);
    return () => { window.removeEventListener("hashchange", revelar); window.removeEventListener("popstate", revelar); };
  }, [id]);
  return <section ref={secao} id={id} className={`secao-recolhivel${recolhivel ? "" : " secao-ficha-direta"} ${className}`} aria-labelledby={tituloId}>
    <header className="secao-recolhivel-cabecalho">
      <h2 id={tituloId}>{!recolhivel ? titulo : <button type="button" aria-labelledby={`${tituloId}-rotulo`} aria-describedby={resumo ? `${tituloId}-resumo` : undefined} aria-expanded={aberta} aria-controls={conteudoId} onClick={() => setAberta(valor => !valor)}>
        <span className="secao-recolhivel-texto"><span id={`${tituloId}-rotulo`} className="secao-recolhivel-titulo">{titulo}</span>{resumo && <span id={`${tituloId}-resumo`} className="secao-recolhivel-resumo">{resumo}</span>}</span>
        <ChevronDown aria-hidden="true" size={20} className={aberta ? "secao-recolhivel-chevron aberta" : "secao-recolhivel-chevron"} />
      </button>}</h2>
      {acoes && <div className="secao-recolhivel-acoes">{acoes}</div>}
    </header>
    <div id={conteudoId} hidden={recolhivel && !aberta} className="secao-recolhivel-conteudo">{children}</div>
  </section>;
}

/** Seção de leitura sem uma segunda navegação de abrir/fechar. */
export function SecaoFicha(props: SecaoRecolhivelProps) {
  return <SecaoRecolhivel {...props} recolhivel={false} />;
}
