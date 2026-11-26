import "./modal-cadastro-animal.css";
import type { ReactNode } from "react";
import { DialogFinanceiro } from "../../../financeiro/DialogFinanceiro";

/** A mesma moldura para cadastro direto e inclusão no rascunho de compra. */
export function ModalCadastroAnimal({ titulo, contexto, onFechar, salvando = false, rodape, children }: {
  titulo: string; contexto?: string; onFechar: () => void; salvando?: boolean; rodape: ReactNode; children: ReactNode;
}) {
  return <DialogFinanceiro titulo={titulo} eyebrow={contexto} onClose={() => { if (!salvando) onFechar(); }} className="modal-cadastro-animal fin-cadastro-dialog max-w-4xl bg-white" rodape={rodape}>
    {children}
  </DialogFinanceiro>;
}
