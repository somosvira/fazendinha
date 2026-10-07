import { useRef, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../financeiro/financeiro-ui";

export function PainelDetalheSanitario({ onFechar, children }: { onFechar: () => void; children: ReactNode }) {
  const origem = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return <Dialog open onOpenChange={(aberto) => { if (!aberto) onFechar(); }}>
    <DialogContent overlayClassName="z-[1100]" className="z-[1100] max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl" onCloseAutoFocus={(evento) => {
      if (origem.current?.isConnected) { evento.preventDefault(); origem.current.focus(); }
    }}>
      <header className="border-b border-border p-5 pr-12"><DialogTitle>Detalhe do fato sanitário</DialogTitle><DialogDescription className="sr-only">Dados e vínculos do lançamento sanitário.</DialogDescription></header>
      <div className="min-h-0 overflow-y-auto p-5">{children}</div>
      <footer className="flex justify-end border-t border-border p-4"><Button secondary onClick={onFechar}>Voltar à lista</Button></footer>
    </DialogContent>
  </Dialog>;
}
