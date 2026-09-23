import { forwardRef, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, X } from "lucide-react";
import { Loader } from "../components/Loading";

export const brl = (valor: string | number | null | undefined) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor ?? 0));
export const dataBR = (valor: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(valor));
export const hoje = () => new Date().toISOString().slice(0, 10);
export const emDias = (dias: number) => { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };
export const mesAtual = () => new Date().toISOString().slice(0, 7);
export const limitesMes = (mes: string) => { const [ano, numero] = mes.split("-").map(Number); return { inicio: `${mes}-01`, fim: new Date(Date.UTC(ano, numero, 0, 23, 59, 59)).toISOString() }; };

export const TIPO_OPERACAO: Record<string, string> = {
  COMPRA_ESTOQUE: "Compra para estoque", COMPRA_CONSUMO_DIRETO: "Compra para consumo direto",
  SERVICO: "Serviço", VENDA: "Venda", APORTE: "Aporte", RETIRADA: "Retirada",
  TRANSFERENCIA_FINANCEIRA: "Transferência", AJUSTE_ESTOQUE: "Ajuste de estoque",
  TRANSFERENCIA_ESTOQUE: "Transferência de estoque", INVENTARIO_INICIAL: "Inventário inicial",
  BONIFICACAO: "Bonificação", DEVOLUCAO: "Devolução", PRODUCAO: "Produção própria",
};

const STATUS: Record<string, string> = {
  RASCUNHO: "Rascunho", CONFIRMADA: "Confirmada", CANCELADA: "Cancelada",
  PENDENTE: "Pendente", PARCIAL: "Parcial", LIQUIDADO: "Liquidado", CANCELADO: "Cancelado",
  REVERTIDA: "Revertida", PROCESSANDO: "Processando", CONCLUIDO: "Concluído", FALHOU: "Falhou",
};

/* Envelope de toda página financeira. O gutter e o ritmo vertical (inclusive a
 * folga que impede o botão flutuante de menu de cobrir o cabeçalho em ≤900px)
 * vêm de `.shell-wide.pagina-financeira` em base.css — utilitário Tailwind de
 * padding não funciona aqui, `.shell-wide` é regra não-camada e vence a camada. */
export function PaginaFinanceira({ children }: { children: React.ReactNode }) {
  return <div className="shell-wide pagina-financeira">{children}</div>;
}

/* Carregamento em nível de página: ocupa a área de conteúdo (.app-main, que já
 * exclui a sidebar) e centraliza o loader nos dois eixos. Usa `.pagina-carregando`
 * em vez de `PaginaFinanceira` de propósito — o padding vertical da página somaria
 * POR FORA dos 100dvh do loader e criaria barra de rolagem. Ver base.css. */
export function PaginaCarregando({ label }: { label: string }) {
  return <div className="shell-wide pagina-carregando"><Loader label={label} full /></div>;
}

/* Página cujos dados ainda não chegaram: carrega, ou mostra o erro. Existe para
 * que uma falha no fetch nunca deixe a tela girando para sempre — o guard
 * `if (!dados) return <PaginaCarregando/>` sozinho engole o erro, porque os
 * dados continuam nulos e o ErrorBox lá embaixo nunca é alcançado. */
export function PaginaSemDados({ titulo, descricao, label, erro }: { titulo: string; descricao: string; label: string; erro: string | null }) {
  if (!erro) return <PaginaCarregando label={label} />;
  return <PaginaFinanceira><PageHeader titulo={titulo} descricao={descricao} /><ErrorBox erro={erro} /></PaginaFinanceira>;
}

export function PageHeader({ titulo, descricao, acao, eyebrow = "Financeiro" }: { titulo: string; descricao: string; acao?: React.ReactNode; /** rótulo acima do título; padrão "Financeiro" */ eyebrow?: string }) {
  return <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-6 pt-7 max-[900px]:pt-0">
    <div className="min-w-0 max-w-3xl flex-[1_1_320px]">{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1 className={`h1 break-words hyphens-auto ${eyebrow ? "mt-2" : ""}`}>{titulo}</h1><p className="mt-2 break-words text-sm leading-6 text-ink-3">{descricao}</p></div>{acao}
  </header>;
}

// forwardRef (não ref-as-prop): um <Button> usado como `asChild` de um
// PopoverTrigger/DialogTrigger do Radix precisa repassar a ref de verdade
// para o <button> nativo, senão o Radix não consegue posicionar/focar nele.
export const Button = forwardRef<HTMLButtonElement, { children: React.ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean; danger?: boolean; secondary?: boolean; className?: string; /** id do form a submeter quando o botão vive fora dele (rodapé de painel) */ form?: string; /** associa o botão a uma mensagem de erro/ajuda (ex.: o alerta de confirmação) */ ariaDescribedby?: string }>(
  ({ children, onClick, type = "button", disabled, danger, secondary, className = "", form, ariaDescribedby }, ref) => {
    const cor = danger ? "bg-red-800 text-white hover:bg-red-900" : secondary ? "border border-border bg-white text-ink hover:bg-surface-2" : "bg-mast text-white hover:opacity-90";
    return <button ref={ref} type={type} form={form} onClick={onClick} disabled={disabled} aria-describedby={ariaDescribedby} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${cor} ${className}`}>{children}</button>;
  },
);
Button.displayName = "Button";

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(30,35,28,.04)] ${className}`}>{children}</section>;
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "blue" | "brown" }) {
  const tons = { neutral: "bg-stone-100 text-stone-700", green: "bg-green-100 text-green-800", amber: "bg-amber-100 text-amber-900", red: "bg-red-100 text-red-800", blue: "bg-blue-100 text-blue-800", brown: "bg-[#eee7d8] text-[#63543c]" };
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${tons[tone]}`}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const tone = status === "CONFIRMADA" || status === "LIQUIDADO" || status === "CONCLUIDO" ? "green" : status === "PENDENTE" || status === "PROCESSANDO" ? "amber" : status === "PARCIAL" ? "blue" : status.includes("CANCEL") || status === "REVERTIDA" || status === "FALHOU" ? "red" : "neutral";
  return <Pill tone={tone}>{STATUS[status] ?? status}</Pill>;
}

export function Metric({ label, valor, detalhe, icon: Icon, tone = "default" }: { label: string; valor: string; detalhe: string; icon: LucideIcon; tone?: "default" | "green" | "red" }) {
  const iconTone = tone === "green" ? "bg-green-50 text-green-800" : tone === "red" ? "bg-red-50 text-red-800" : "bg-[#eef1e9] text-mast";
  return <Panel className="@container p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3">{label}</div><div className="mt-3 break-words font-serif text-[clamp(19px,8cqw,28px)] leading-none tracking-tight text-ink">{valor}</div></div><div className={`shrink-0 rounded-lg p-2.5 @max-[240px]:hidden ${iconTone}`}><Icon size={18} /></div></div><div className="mt-3 break-words text-xs text-ink-3">{detalhe}</div></Panel>;
}

export function ErrorBox({ erro }: { erro: string | null }) {
  return erro ? <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</div> : null;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-10 text-center text-sm text-ink-3">{children}</div>;
}

export function Modal({ titulo, eyebrow, onClose, children, width = "max-w-xl", semCabecalho = false }: { titulo: string; eyebrow: string; onClose: () => void; children: React.ReactNode; width?: string; semCabecalho?: boolean }) {
  return <div className="fixed inset-0 z-[1100] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={titulo}><Panel className={`${semCabecalho ? "h-[92vh] overflow-hidden" : "max-h-[92vh] overflow-auto"} w-full ${width}`}>{!semCabecalho && <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-[#f4f2e9] p-5"><div className="min-w-0"><div className="eyebrow">{eyebrow}</div><h2 className="mt-1 break-words font-serif text-2xl">{titulo}</h2></div><button onClick={onClose} aria-label="Fechar" className="shrink-0 rounded-lg p-2 hover:bg-white"><X size={18} /></button></div>}{children}</Panel></div>;
}

export function ReviewLine({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "amber" | "brown" | "neutral" }) {
  const cor = { green: "text-[#9fc28d]", amber: "text-[#e3c66f]", brown: "text-[#d3bd8c]", neutral: "text-[#aeb9aa]" }[tone];
  return <div className="flex gap-2"><Check size={16} className={`mt-0.5 shrink-0 ${cor}`} /><span>{children}</span></div>;
}

/* ────────────────────────────────────────────────────────────────────────────
   Tabela financeira responsiva.

   Uma única declaração de colunas alimenta as DUAS representações, então o
   alinhamento do cabeçalho e o do conteúdo nunca divergem — `alinhamento` é a
   fonte única para <th> e <td> (e para o valor no card).

     ≥768px  tabela com rolagem HORIZONTAL própria (a largura mínima vive no
             wrapper `overflow-x-auto`, nunca vaza para a página);
     <768px  cartões empilhados — a coluna `principal` vira o título e as demais
             viram pares rótulo/valor, sem truncar dinheiro.
   ──────────────────────────────────────────────────────────────────────────── */

export type ColunaTabela<T> = {
  chave: string;
  titulo: string;
  /** governa <th>, <td> e o valor no cartão — não repetir alinhamento na célula */
  alinhamento?: "esquerda" | "centro" | "direita";
  celula: (item: T) => React.ReactNode;
  /** largura mínima da coluna (px) — a soma vira o min-width da tabela */
  larguraMinima?: number;
  /** coluna que vira o título do cartão no mobile (uma por tabela) */
  principal?: boolean;
  /** já representada no título do cartão — não repetir como par rótulo/valor */
  ocultarNoCartao?: boolean;
  /** célula com botões próprios: no cartão é renderizada FORA do botão que abre
   *  a linha (evita <button> dentro de <button>) */
  acoes?: boolean;
};

const alinhaCelula = (alinhamento?: "esquerda" | "centro" | "direita") => alinhamento === "direita" ? "text-right" : alinhamento === "centro" ? "text-center" : "text-left";

export function TabelaFinanceira<T>({ colunas, itens, chaveDe, onAbrir, classeLinha, rotulo, ancoraDe, barraRolagemSuperior = false }: {
  colunas: ColunaTabela<T>[];
  itens: T[];
  chaveDe: (item: T) => React.Key;
  onAbrir?: (item: T) => void;
  classeLinha?: (item: T) => string;
  ancoraDe?: (item: T) => string;
  rotulo: string;
  /** Exibe uma barra horizontal acima da tabela em telas intermediárias. */
  barraRolagemSuperior?: boolean;
}) {
  const larguraMinima = colunas.reduce((soma, coluna) => soma + (coluna.larguraMinima ?? 120), 0);
  const principal = colunas.find((coluna) => coluna.principal) ?? colunas[0];
  const secundarias = colunas.filter((coluna) => coluna !== principal && !coluna.ocultarNoCartao && !coluna.acoes && coluna.titulo);
  const acoes = colunas.filter((coluna) => coluna.acoes);
  const tabelaRef = useRef<HTMLDivElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const [temRolagem, setTemRolagem] = useState(false);
  // Largura real da tabela renderizada — colunas com conteúdo longo podem
  // esticar além de `larguraMinima`, então o espaçador da barra precisa
  // medir o scrollWidth de verdade para a barra rolar até o fim.
  const [larguraRolagem, setLarguraRolagem] = useState(larguraMinima);

  useEffect(() => {
    if (!barraRolagemSuperior) return;
    const tabela = tabelaRef.current;
    if (!tabela) return;
    const atualizar = () => {
      setTemRolagem(tabela.scrollWidth > tabela.clientWidth + 1);
      setLarguraRolagem(tabela.scrollWidth);
    };
    atualizar();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", atualizar);
      return () => window.removeEventListener("resize", atualizar);
    }
    const observador = new ResizeObserver(atualizar);
    observador.observe(tabela);
    return () => observador.disconnect();
  }, [barraRolagemSuperior, larguraMinima, itens.length]);

  const sincronizarRolagem = (origem: "tabela" | "barra") => {
    const tabela = tabelaRef.current;
    const barra = barraRef.current;
    if (!tabela || !barra) return;
    if (origem === "tabela" && barra.scrollLeft !== tabela.scrollLeft) barra.scrollLeft = tabela.scrollLeft;
    if (origem === "barra" && tabela.scrollLeft !== barra.scrollLeft) tabela.scrollLeft = barra.scrollLeft;
  };
  const roladaPorTeclado = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const barra = barraRef.current;
    if (!barra) return;
    if (e.key === "ArrowRight") { barra.scrollLeft += 96; e.preventDefault(); }
    else if (e.key === "ArrowLeft") { barra.scrollLeft -= 96; e.preventDefault(); }
  };

  return <>
    {/* ≥768px — tabela; a rolagem horizontal fica presa a este wrapper */}
    {barraRolagemSuperior && temRolagem && <div ref={barraRef} role="group" aria-label={`Rolagem horizontal: ${rotulo}`} tabIndex={0} onKeyDown={roladaPorTeclado} className="sticky top-0 z-10 hidden overflow-x-auto border-b border-border bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6f7d68]/40 md:block" onScroll={() => sincronizarRolagem("barra")}>
      <div style={{ width: larguraRolagem, height: 1 }} />
    </div>}
    <div ref={tabelaRef} className={`hidden overflow-x-auto md:block ${barraRolagemSuperior && temRolagem ? "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""}`} onScroll={() => sincronizarRolagem("tabela")}>
      <table className="w-full text-left text-sm" style={{ minWidth: larguraMinima }}>
        <caption className="sr-only">{rotulo}</caption>
        <thead className="bg-[#f4f2e9] text-[11px] uppercase tracking-[.08em] text-ink-3">
          <tr>{colunas.map((coluna) => <th key={coluna.chave} scope="col" className={`p-4 font-semibold ${alinhaCelula(coluna.alinhamento)}`}>{coluna.titulo}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {itens.map((item) => <tr
            key={chaveDe(item)} data-ancora={ancoraDe?.(item)}
            /* linha acionável pelo teclado sem sobrescrever o role="row" — trocar
               por role="button" quebraria a semântica de tabela para leitores de tela */
            {...(onAbrir ? { onClick: () => onAbrir(item), tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onAbrir(item); } } } : {})}
            className={`${onAbrir ? "cursor-pointer hover:bg-[#faf9f4]" : ""} ${classeLinha?.(item) ?? ""}`}
          >{colunas.map((coluna) => <td key={coluna.chave} className={`p-4 align-top ${alinhaCelula(coluna.alinhamento)}`}>{coluna.celula(item)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>

    {/* <768px — cartões: nada de rolagem lateral, nada de coluna espremida */}
    <ul className="divide-y divide-border md:hidden" aria-label={rotulo}>
      {itens.map((item) => {
        const corpo = <>
          <div className="min-w-0 break-words text-left">{principal.celula(item)}</div>
          <dl className="mt-3 space-y-2">
            {secundarias.map((coluna) => <div key={coluna.chave} className="flex items-start justify-between gap-3">
              <dt className="shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">{coluna.titulo}</dt>
              <dd className="min-w-0 flex-1 break-words text-right text-sm">{coluna.celula(item)}</dd>
            </div>)}
          </dl>
        </>;
        return <li key={chaveDe(item)} data-ancora={ancoraDe?.(item)} className={classeLinha?.(item) ?? ""}>
          {onAbrir
            ? <button type="button" onClick={() => onAbrir(item)} className="w-full p-4 text-left hover:bg-[#faf9f4]">{corpo}</button>
            : <div className="p-4">{corpo}</div>}
          {acoes.length > 0 && <div className="flex justify-end gap-2 px-4 pb-4">{acoes.map((coluna) => <div key={coluna.chave}>{coluna.celula(item)}</div>)}</div>}
        </li>;
      })}
    </ul>
  </>;
}
