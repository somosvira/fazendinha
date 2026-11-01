import { useRef, type ReactNode } from "react";
import { Milk } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DateRangePicker, dateFromIso, isoDate } from "@/components/DateRangePicker";
import { hojeOperacional } from "./modelo";

export function VazioProducao({ children }: { children: ReactNode }) {
  return <div className="producao-ficha-vazio" role="status"><Milk size={28} aria-hidden="true"/><strong>{children}</strong></div>;
}
export function DetalheProducao({ titulo, children, fechar }: { titulo: string; children: ReactNode; fechar: () => void }) {
  const tituloRef = useRef<HTMLHeadingElement>(null);
  return <Dialog open onOpenChange={v => { if (!v) fechar(); }}><DialogContent className="producao-detalhe-dialog" onOpenAutoFocus={e => { e.preventDefault(); tituloRef.current?.focus(); }} aria-describedby={undefined}>
    <DialogHeader><DialogTitle ref={tituloRef} tabIndex={-1}>{titulo}</DialogTitle></DialogHeader>
    <div className="producao-detalhe-corpo">{children}</div>
    <DialogFooter><Button variant="outline" onClick={fechar}>Fechar</Button></DialogFooter>
  </DialogContent></Dialog>;
}
export function PeriodoProducao({ periodo, onChange, rotulo }: { periodo: { inicio: string; fim: string }; onChange: (p: { inicio: string; fim: string }) => void; rotulo: string }) {
  return <DateRangePicker anchor="right" triggerLabel="Período" triggerAriaLabel={`${rotulo}: ${periodo.inicio.split("-").reverse().join("/")} a ${periodo.fim.split("-").reverse().join("/")}`} value={{ start: dateFromIso(periodo.inicio), end: dateFromIso(periodo.fim) }} onChange={({ start, end }) => {
    if (!start || !end) return;
    const fim = isoDate(end) > hojeOperacional() ? hojeOperacional() : isoDate(end);
    onChange({ inicio: isoDate(start), fim });
  }}/>;
}
