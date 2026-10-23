import type { ComponentType, ReactNode } from "react";
import { ChevronRight, CalendarDays, type LucideProps } from "lucide-react";
import { navegarPara } from "../router";
import "./consulta-visual.css";

/** O link principal e as ações são irmãos: teclado e menus não acionam a navegação do cartão. */
export function CartaoConsulta({ titulo, detalhe, icon: Icone, href, onAbrir, children, acoes, selecao, status, rotuloAbrir, className = "" }: {
  titulo: ReactNode; detalhe?: ReactNode; icon?: ComponentType<Pick<LucideProps, "size" | "aria-hidden">>; href?: string; onAbrir?: () => void;
  rotuloAbrir?: string; children: ReactNode; acoes?: ReactNode; selecao?: ReactNode; status?: ReactNode; className?: string;
}) {
  return <article className={`consulta-entidade ${className}`}>
    <header>{selecao && <div className="consulta-entidade-acao">{selecao}</div>}{Icone && <span className="consulta-entidade-icone"><Icone size={24} aria-hidden /></span>}<div className="consulta-entidade-identidade"><h3>{href ? <a aria-label={rotuloAbrir} className="consulta-entidade-link" href={href} onClick={e => { if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.button === 0) { e.preventDefault(); navegarPara(href); } }}>{titulo}</a> : onAbrir ? <button aria-label={rotuloAbrir} type="button" className="consulta-entidade-link" onClick={onAbrir}>{titulo}</button> : titulo}</h3>{detalhe && <div className="consulta-entidade-detalhe">{detalhe}</div>}</div>{status && <div className="consulta-entidade-status">{status}</div>}{(href || onAbrir) && <ChevronRight size={18} aria-hidden className="consulta-entidade-seta" />}</header>
    <div className="consulta-entidade-conteudo">{children}</div>{acoes && <footer className="consulta-entidade-acao">{acoes}</footer>}
  </article>;
}
export function FatoConsulta({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="consulta-fato"><span>{rotulo}</span><div>{children}</div></div>;
}
/** Agrupa só datas consecutivas; conserva integralmente a ordenação e a paginação recebidas. */
export function LinhaTempoConsulta<T>({ itens, dataDe, chaveDe, render, rotulo }: { itens: T[]; dataDe: (item: T) => string; chaveDe: (item: T) => string | number; render: (item: T) => ReactNode; rotulo: string }) {
  return <ol className="consulta-cronologia" aria-label={rotulo}>{itens.map((item, i) => {
    const data = dataDe(item).slice(0, 10);
    const nova = i === 0 || dataDe(itens[i - 1]).slice(0, 10) !== data;
    return <li key={chaveDe(item)}>{nova && <div className="consulta-cronologia-data"><CalendarDays size={16} aria-hidden /><time dateTime={data}>{new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR")}</time></div>}{render(item)}</li>;
  })}</ol>;
}
