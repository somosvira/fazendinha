/* Cabeçalho das telas dos módulos operacionais.
 *
 * Os títulos de topo (eyebrow + título grande) foram REMOVIDOS do produto a
 * pedido — só o Relatório mantém título. Este componente não renderiza mais
 * eyebrow nem título; preserva apenas o slot `actions` (botões de voltar,
 * "+ Novo…", formulários), que é funcional. Sem actions, não renderiza nada e o
 * conteúdo sobe para o topo da tela.
 *
 * As props `eyebrow`/`title` continuam aceitas (compat com ~35 call sites) mas
 * são ignoradas — evita ter de tocar em cada arquivo. */

import * as React from "react";
import { cn } from "@/lib/utils";

export function RebHeader({
  actions,
  className,
}: {
  eyebrow?: React.ReactNode; // compat — não renderizado
  title?: React.ReactNode; // compat — não renderizado
  actions?: React.ReactNode;
  className?: string;
}) {
  if (!actions) return null;
  return (
    <div className={cn("mb-[18px] mt-1 flex items-center justify-end gap-2.5", className)}>
      {actions}
    </div>
  );
}
