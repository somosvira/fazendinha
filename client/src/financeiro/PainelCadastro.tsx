import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useRef, useState, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { AjudaCampo } from "@/components/Dica";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function PainelCadastro({ aberto, titulo, onFechar, children, rodape, largura = "sm:max-w-3xl", compacto = false, bloqueado = false, alteracoesExternas = false }: {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  rodape: ReactNode;
  /** classe Tailwind de largura máxima do painel — mais largo para conteúdo com tabela (ex.: seletor de animais). */
  largura?: string;
  compacto?: boolean;
  bloqueado?: boolean;
  alteracoesExternas?: boolean;
}) {
  const alterado = useRef(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const fechar = () => { if (bloqueado) return; if (alterado.current || alteracoesExternas) setConfirmarSaida(true); else onFechar(); };
  const corpo = <div className="min-h-0 flex-1 overflow-y-auto p-4" onChangeCapture={() => { alterado.current = true; }}>{children}</div>;
  const confirmar = <ConfirmDialog open={confirmarSaida} title="Descartar alterações?" message="Os dados preenchidos não serão salvos." confirmLabel="Descartar alterações" cancelLabel="Continuar editando" tone="danger" onConfirm={onFechar} onCancel={() => setConfirmarSaida(false)} />;
  return <>{compacto ? <Dialog open={aberto} onOpenChange={v => { if (!v) fechar(); }}>
    <DialogContent className="financeiro-colorido z-[1100] max-h-[90dvh] max-w-lg overflow-hidden p-0" overlayClassName="z-[1090]" onEscapeKeyDown={e => { if (bloqueado) e.preventDefault(); }}>
      <DialogHeader className="fin-cabecalho border-b border-border p-4 pr-12"><DialogTitle>{titulo}</DialogTitle><DialogDescription className="sr-only">{titulo}</DialogDescription></DialogHeader>
      {corpo}<DialogFooter className="border-t border-border bg-card p-4">{rodape}</DialogFooter>
    </DialogContent>
  </Dialog> : <Sheet open={aberto} onOpenChange={v => { if (!v) fechar(); }}>
    <SheetContent side="right" overlayClassName="z-[1090]" className={`financeiro-colorido z-[1100] flex w-full flex-col gap-0 overflow-hidden p-0 ${largura}`}>
      <SheetHeader className="fin-cabecalho shrink-0 border-b border-border p-4 pr-12 text-left"><SheetTitle className="font-serif text-2xl font-normal">{titulo}</SheetTitle><SheetDescription className="sr-only">{titulo}</SheetDescription></SheetHeader>
      {corpo}<SheetFooter className="shrink-0 flex-row justify-end gap-2 border-t border-border bg-card p-4">{rodape}</SheetFooter>
    </SheetContent>
  </Sheet>}{confirmar}</>;

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
  const descricao = [erro && `${id}-erro`, ajuda && `${id}-ajuda`].filter(Boolean).join(" ") || undefined;
  return <div className="text-sm font-medium">
    <label htmlFor={id}>{rotulo}{obrigatorio && <span aria-hidden="true"> *</span>}</label>{ajuda && <AjudaCampo texto={ajuda} rotulo={`Ajuda: ${rotulo}`} />}
    {children({ id, "aria-label": rotulo, "aria-invalid": Boolean(erro), "aria-describedby": descricao })}
    {erro && <p id={`${id}-erro`} role="alert" className="mt-1 flex items-start gap-1.5 text-xs font-normal text-red-700"><CircleAlert size={14} className="mt-px shrink-0" aria-hidden />{erro}</p>}
    {ajuda && <p id={`${id}-ajuda`} className="sr-only">{ajuda}</p>}
  </div>;
}
