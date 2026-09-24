/* Painel lateral direito usado pelos cadastros financeiros (conta e parceiro).
 * Envolve o Sheet (Radix) com cabeçalho/rodapé padronizados para não repetir
 * a estrutura em cada formulário. Escape e clique fora descartam sem
 * confirmar — os formulários são curtos e não há rascunho aqui. */

import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function PainelCadastro({ aberto, titulo, eyebrow, onFechar, children, rodape, largura = "sm:max-w-lg" }: {
  aberto: boolean;
  titulo: string;
  eyebrow: string;
  onFechar: () => void;
  children: ReactNode;
  rodape: ReactNode;
  /** classe Tailwind de largura máxima do painel — mais largo para conteúdo com tabela (ex.: seletor de animais). */
  largura?: string;
}) {
  return <Sheet open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
    <SheetContent side="right" overlayClassName="z-[1100]" className={`z-[1100] flex w-full flex-col gap-0 overflow-y-auto p-0 ${largura}`}>
      <SheetHeader className="border-b border-border p-5 text-left">
        <div className="eyebrow">{eyebrow}</div>
        <SheetTitle className="mt-1 font-serif text-2xl font-normal">{titulo}</SheetTitle>
        <SheetDescription className="sr-only">{titulo}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 p-5">{children}</div>
      <SheetFooter className="sticky bottom-0 flex-row justify-end gap-2 border-t border-border bg-card p-5">{rodape}</SheetFooter>
    </SheetContent>
  </Sheet>;
}

/* Rótulo + controle + mensagem de erro junto ao campo. O controle recebe
 * `id`, `aria-invalid` e `aria-describedby` via render prop para ficar ligado
 * à mensagem sem o chamador ter que repetir a fiação. */
export const classeInput = "mt-1.5 block w-full rounded-lg border border-border bg-white p-2.5 font-normal disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3 aria-[invalid=true]:border-red-700";

export function CampoFormulario({ id, rotulo, erro, ajuda, children, obrigatorio = false }: {
  id: string;
  rotulo: string;
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  children: (props: { id: string; "aria-label": string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => ReactNode;
}) {
  const descricao = erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined;
  return <div className="text-sm font-medium">
    <label htmlFor={id}>{rotulo}{obrigatorio && <span aria-hidden="true"> *</span>}</label>
    {children({ id, "aria-label": rotulo, "aria-invalid": Boolean(erro), "aria-describedby": descricao })}
    {erro
      ? <p id={`${id}-erro`} role="alert" className="mt-1 text-xs font-normal text-red-700">{erro}</p>
      : ajuda ? <p id={`${id}-ajuda`} className="mt-1 text-xs font-normal text-ink-3">{ajuda}</p> : null}
  </div>;
}
