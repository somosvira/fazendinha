/* Navegação compartilhada: abas com contorno e seleção ligada à superfície branca.
 * A alternância Ciclos/Tarefas usa a aparência explícita de botões. */

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";

export type SubTab<T extends string> = { id: T; label: string; icon?: ComponentType<LucideProps> };

export function SubTabs<T extends string>({ tabs, active, onSelect, className, ariaLabel, variant, aparencia = "abas" }: {
  tabs: SubTab<T>[];
  active: T;
  onSelect: (id: T) => void;
  className?: string;
  ariaLabel?: string;
  variant?: "financeiro";
  aparencia?: "abas" | "botoes";
}) {
  if (variant === "financeiro") return <Tabs value={active} onValueChange={id => onSelect(id as T)} className={cn("min-w-0", aparencia === "abas" && "abas-navegacao", className)}>
    <TabsList variant={aparencia === "botoes" ? "default" : "pasta"} aria-label={ariaLabel} className="fin-abas">
      {tabs.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id} onClick={event => { if (event.detail === 0 && active !== id) onSelect(id); }} className="h-auto min-h-10 whitespace-normal px-3 text-left">{Icon && <Icon size={16} strokeWidth={1.8} aria-hidden="true" />}{label}</TabsTrigger>)}
    </TabsList>
  </Tabs>;
  return (
    <div className={cn("mb-5 flex", className)}>
      <div
        role="tablist" aria-label={ariaLabel}
        className="abas-pasta"
      >
        {tabs.map((t) => {
          const on = t.id === active;
          const Icon = t.icon;
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
              {Icon && <Icon size={16} aria-hidden="true" />}
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
