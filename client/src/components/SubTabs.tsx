/* Rio Novo — barra de sub-abas (underline) para páginas-hub.
 *
 * Estilo do protótipo "Shell" (`.gtabs/.gtab`): rótulos discretos com sublinhado
 * café na aba ativa. Usado para dobrar telas raras dentro de uma página só
 * (Gastos › Contas|Caixinha; Configurações › Geral|Cadastros|Categorias|Acessos). */

import { cn } from "@/lib/utils";

export type SubTab<T extends string> = { id: T; label: string };

export function SubTabs<T extends string>({ tabs, active, onSelect, className }: {
  tabs: SubTab<T>[];
  active: T;
  onSelect: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "mb-5 flex gap-6 overflow-x-auto border-b border-[color:var(--rule-soft)] [scrollbar-width:none]",
        className,
      )}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(t.id)}
            className={cn(
              "relative shrink-0 cursor-pointer whitespace-nowrap border-0 bg-transparent px-0 pb-[11px] pt-0 font-sans text-[13.5px] text-ink-mute",
              "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-cafe after:opacity-0 after:content-['']",
              on && "font-semibold text-ink after:opacity-100",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
