import { useTelaPequena } from "./useTelaPequena";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

export function SecaoFinanceira({ titulo, children, abrir = false, abrirNoDesktop = false, detalhe }: { titulo: string; children: ReactNode; abrir?: boolean; abrirNoDesktop?: boolean; detalhe?: ReactNode }) {
  const pequena = useTelaPequena();
  const [aberta, setAberta] = useState(abrir || (abrirNoDesktop && !pequena));
  useEffect(() => { if (abrirNoDesktop) setAberta(!pequena); }, [abrirNoDesktop, pequena]);
  useEffect(() => { if (abrir) setAberta(true); }, [abrir]);
  return <Collapsible open={aberta} onOpenChange={setAberta} className="min-w-0 rounded-lg border border-border bg-card">
    <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="h-auto min-h-10 w-full justify-between whitespace-normal px-3 py-2 text-left"><span>{titulo}{detalhe && <span className="ml-2 text-muted-foreground">{detalhe}</span>}</span><ChevronDown className={aberta ? "rotate-180" : ""} aria-hidden /></Button></CollapsibleTrigger>
    <CollapsibleContent className="border-t border-border p-3">{children}</CollapsibleContent>
  </Collapsible>;
}
