import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useRef, useState, type ReactNode } from "react";
import { CircleAlert, type LucideIcon } from "lucide-react";
import { AjudaCampo } from "@/components/Dica";

export function PainelCadastro({ aberto, titulo, onFechar, children, rodape, largura = "sm:max-w-3xl", compacto = false, bloqueado = false, alteracoesExternas = false, camada = "padrao", icon: Icon }: {
  camada?: "padrao" | "sobreDetalhe";
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  rodape: ReactNode | ((fechar: () => void) => ReactNode);
  /** classe Tailwind de largura máxima do painel — mais largo para conteúdo com tabela (ex.: seletor de animais). */
  largura?: string;
  compacto?: boolean;
  bloqueado?: boolean;
  alteracoesExternas?: boolean;
  icon?: LucideIcon;
}) {
  const sobreDetalhe = camada === "sobreDetalhe";
  const overlay = sobreDetalhe ? "z-[1290]" : "z-[1090]";
  const conteudoCamada = sobreDetalhe ? "z-[1300]" : "z-[1100]";
  const alterado = useRef(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const fechar = () => { if (bloqueado) return; if (alterado.current || alteracoesExternas) setConfirmarSaida(true); else onFechar(); };
  const corpo = <div className="min-h-0 flex-1 overflow-y-auto p-4" onChangeCapture={() => { alterado.current = true; }}>{children}</div>;
  const confirmar = <ConfirmDialog camada={camada} open={confirmarSaida} title="Descartar alterações?" message="Os dados preenchidos não serão salvos." confirmLabel="Descartar alterações" cancelLabel="Continuar editando" tone="danger" processando={bloqueado} onConfirm={() => { if (!bloqueado) onFechar(); }} onCancel={() => setConfirmarSaida(false)} />;
  return <><Dialog open={aberto} onOpenChange={v => { if (!v) fechar(); }}>
    <DialogContent className={`financeiro-colorido ${conteudoCamada} flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 ${compacto ? "max-w-lg" : largura}`} overlayClassName={overlay} onEscapeKeyDown={e => { if (bloqueado) e.preventDefault(); }}>
      <DialogHeader className="fin-cabecalho shrink-0 border-b border-border p-5 pr-12"><div className="flex items-center gap-3">{Icon && <span className="fin-section-icon"><Icon aria-hidden="true" /></span>}<DialogTitle>{titulo}</DialogTitle></div><DialogDescription className="sr-only">{titulo}</DialogDescription></DialogHeader>
      {corpo}<DialogFooter className="shrink-0 border-t border-border bg-card p-4">{typeof rodape === "function" ? rodape(fechar) : rodape}</DialogFooter>
    </DialogContent>
  </Dialog>{confirmar}</>;


}

/* Rótulo + controle + mensagem de erro junto ao campo. O controle recebe
 * `id`, `aria-invalid` e `aria-describedby` via render prop para ficar ligado
 * à mensagem sem o chamador ter que repetir a fiação. */
export const classeInput = "mt-1.5 block w-full rounded-lg border border-border bg-card p-2.5 font-normal disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3 aria-[invalid=true]:border-destructive";

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
    <span className="campo-formulario-rotulo inline-flex min-h-6 items-center gap-1"><label htmlFor={id}>{rotulo}{obrigatorio && <span aria-hidden="true"> *</span>}</label>{ajuda && <AjudaCampo texto={ajuda} rotulo={`Ajuda: ${rotulo}`} />}</span>
    {children({ id, "aria-label": rotulo, "aria-invalid": Boolean(erro), "aria-describedby": descricao })}
    {erro && <p id={`${id}-erro`} role="alert" className="mt-1 flex items-start gap-1.5 text-xs font-normal text-destructive"><CircleAlert size={14} className="mt-px shrink-0" aria-hidden />{erro}</p>}
    {ajuda && <p id={`${id}-ajuda`} className="sr-only">{ajuda}</p>}
  </div>;
}
