import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableCaption } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getHojeISO } from "../lib/hoje";
import { navegarPara } from "../router";
import { CalendarioCompromissos } from "./CalendarioCompromissos";
import { brl, dataBR } from "./financeiro-ui";
import { tituloCompromisso } from "./lib/compromissos";
import type { Compromisso } from "./novo-api";

export function DashboardCompromissos({ itens, href, mes, onChangeMes, onLiquidar }: {
  itens: Compromisso[]; href: string; mes: string; onChangeMes: (mes: string) => void; onLiquidar?: (item: Compromisso) => void;
}) {
  const vencidos = itens.filter(item => item.vencido);
  const hoje = getHojeISO();
  const limite = new Date(`${hoje}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + 7);
  const fim = limite.toISOString().slice(0, 10);
  const proximos = itens.filter(item => !item.vencido && item.dataVencimento.slice(0, 10) >= hoje && item.dataVencimento.slice(0, 10) <= fim);
  const [calendario, setCalendario] = useState(false);
  const grupos = [{ id: "vencidos", label: `Vencidos (${vencidos.length})`, itens: vencidos, vazio: "Nenhum compromisso vencido no período." }, { id: "proximos", label: `Próximos 7 dias (${proximos.length})`, itens: proximos, vazio: "Nenhum compromisso nos próximos 7 dias dentro do período selecionado." }];
  return <Card className="min-w-0 gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none">
    <Tabs defaultValue={vencidos.length ? "vencidos" : "proximos"} className="gap-0">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h2 className="font-serif text-xl">Compromissos</h2>
        <div className="flex flex-wrap items-center gap-2">
          <TabsList className="h-9">{grupos.map(grupo => <TabsTrigger key={grupo.id} value={grupo.id} className="text-sm">{grupo.label}</TabsTrigger>)}</TabsList>
          <Dialog open={calendario} onOpenChange={setCalendario}>
            <DialogTrigger asChild><Button variant="outline"><CalendarDays aria-hidden="true" />Calendário</Button></DialogTrigger>
            <DialogContent className="z-[1100] max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl grid-cols-1 overflow-y-auto" overlayClassName="z-[1090]">
              <DialogHeader className="min-w-0 border-b border-border p-4 pr-12"><DialogTitle>Calendário de compromissos</DialogTitle><DialogDescription>Vencimentos pendentes no período selecionado, de {dataBR(hrefPeriodo(href, "inicio"))} a {dataBR(hrefPeriodo(href, "fim"))}.</DialogDescription></DialogHeader>
              <CalendarioCompromissos itens={itens} mes={mes} onChangeMes={onChangeMes} onLiquidar={onLiquidar ? item => { setCalendario(false); onLiquidar(item); } : undefined} />
            </DialogContent>
          </Dialog>
          <Button variant="link" asChild><a href={href} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navegarPara(href); } }}>Ver todos</a></Button>
        </div>
      </div>
      {grupos.map(grupo => <TabsContent key={grupo.id} value={grupo.id} className="m-0">
        {grupo.itens.length ? <Table containerLabel="Tabela de compromissos" className="text-sm"><TableCaption className="sr-only">Compromissos do período</TableCaption>
          <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead>{onLiquidar && <TableHead className="text-right">Ação</TableHead>}</TableRow></TableHeader>
          <TableBody>{grupo.itens.slice(0, 5).map(item => <TableRow key={item.id}>
            <TableCell className="max-w-48 whitespace-normal px-4 py-2"><span className="block truncate font-semibold" title={tituloCompromisso(item)}>{tituloCompromisso(item)}</span><p className="mt-1 truncate text-muted-foreground" title={item.parceiro?.nome}>{item.parceiro?.nome ?? "Sem parceiro"}</p></TableCell>
            <TableCell><span className="block">{dataBR(item.dataVencimento)}</span>{item.vencido && <Badge variant="outline" className="mt-1 border-destructive/20 bg-destructive/10 text-destructive">Vencido</Badge>}</TableCell><TableCell className={`text-right font-semibold tabular-nums ${item.tipo === "RECEBER" ? "text-[var(--pos)]" : ""}`}>{brl(item.saldoPendente)}</TableCell>
            {onLiquidar && <TableCell className="text-right"><Button variant="link" className="px-2" aria-label={item.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"} onClick={() => onLiquidar(item)}>{item.tipo === "PAGAR" ? "Pagar" : "Receber"}</Button></TableCell>}
          </TableRow>)}</TableBody>
        </Table> : <p role="status" className="p-6 text-center text-sm text-muted-foreground">{grupo.vazio}</p>}
        {!!grupo.itens.length && <p className="px-4 py-2 text-sm text-muted-foreground sm:hidden">Deslize a tabela para ver valores e ações.</p>}
      </TabsContent>)}
    </Tabs>
  </Card>;
}

function hrefPeriodo(href: string, chave: string) {
  return new URLSearchParams(href.split("?")[1]).get(chave) ?? "";
}
