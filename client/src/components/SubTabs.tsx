/* Rio Novo — barra de sub-abas (segmented control) para páginas-hub.
 *
 * Controle segmentado: uma pista sutil (--bg-card-2) com a aba ativa flutuando
 * numa "pílula" mais clara (--bg-card) + sombra macia. Diferencia-se dos chips
 * de filtro escuros (A vencer / Vencidas / Pagas) logo abaixo, dando hierarquia:
 * troca de seção = controle claro; filtro = chips escuros.
 *
 * Usado para dobrar telas dentro de uma página só (Gastos › Contas|Caixinha;
 * Configurações › Geral|Cadastros|Categorias|Acessos). */

import { cn } from "@/lib/utils";

export type SubTab<T extends string> = { id: T; label: string };

export function SubTabs<T extends string>({ tabs, active, onSelect, className }: {
  tabs: SubTab<T>[];
  active: T;
  onSelect: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex", className)}>
      <div
        role="tablist"
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-[11px] border border-[color:var(--rule-soft)] bg-[var(--bg-card-2)] p-1 [scrollbar-width:none]"
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
                "shrink-0 cursor-pointer whitespace-nowrap rounded-[8px] border-0 bg-transparent px-4 py-[7px] font-sans text-[13.5px] text-ink-mute transition-[color,background-color,box-shadow] duration-150",
                "hover:text-ink",
                on &&
                  "bg-card font-semibold text-ink shadow-[0_1px_2px_rgba(30,20,8,0.10),0_2px_5px_rgba(30,20,8,0.05)]",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
