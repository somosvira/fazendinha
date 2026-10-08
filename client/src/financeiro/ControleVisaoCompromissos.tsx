import { Button } from "@/components/ui/button";
import { CalendarDays, List } from "lucide-react";

export type VisaoCompromissos = "lista" | "calendario";

export function ControleVisaoCompromissos({ visao, onChange }: { visao: VisaoCompromissos; onChange: (visao: VisaoCompromissos) => void }) {
  return <div role="group" aria-label="Visualização dos compromissos" className="inline-flex shrink-0 gap-1 rounded-lg border border-border bg-white p-1">
    {([["lista", "Lista", List], ["calendario", "Calendário", CalendarDays]] as const).map(([valor, titulo, Icone]) => <Button variant={visao === valor ? "default" : "ghost"} key={valor} type="button" aria-pressed={visao === valor} onClick={() => onChange(valor)} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${visao === valor ? "bg-mast text-white" : "text-ink-3 hover:bg-surface-2"}`}><Icone size={16} />{titulo}</Button>)}
  </div>;
}
