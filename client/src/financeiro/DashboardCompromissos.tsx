import { useTelaPequena } from "./useTelaPequena";
import { CompromissoDetalheDialog } from "./CompromissoDetalheDialog";
import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableCaption } from "@/components/ui/table";
import { getHojeISO } from "../lib/hoje";
import { navegarPara } from "../router";
import { brl, dataBR } from "./financeiro-ui";
import { tituloCompromisso } from "./lib/compromissos";
import type { Compromisso } from "./novo-api";

export function DashboardCompromissos({ itens, href, onLiquidar, resumo, integrado = false }: {
  itens: Compromisso[]; href: string; resumo?: ReactNode; integrado?: boolean; onLiquidar?: (item: Compromisso) => void;
}) {
  const pequena = useTelaPequena();
  const [selecionado, setSelecionado] = useState<Compromisso | null>(null);
  const vencidos = itens.filter(item => item.vencido);
  const hoje = getHojeISO();
  const limite = new Date(`${hoje}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + 7);
  const fim = limite.toISOString().slice(0, 10);
  const proximos = itens.filter(item => !item.vencido && item.dataVencimento.slice(0, 10) >= hoje && item.dataVencimento.slice(0, 10) <= fim);
  const proximoFuturo = itens.filter(item => !item.vencido && item.dataVencimento.slice(0, 10) > fim).sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))[0];
  const grupos = [{ id: "vencidos", label: `Vencidos (${vencidos.length})`, itens: vencidos, vazio: "Nenhum compromisso vencido no período." }, { id: "proximos", label: `Próximos 7 dias (${proximos.length})`, itens: proximos, vazio: "Nenhum compromisso nos próximos 7 dias dentro do período selecionado." }];
  const Container = integrado ? "section" : Card;
  return <Container data-fin-tom="pendente" className={`${integrado ? "" : "fin-painel"} min-w-0 gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none`}>
    <Tabs defaultValue={vencidos.length ? "vencidos" : "proximos"} className="gap-0">
      <div className="fin-cabecalho flex flex-wrap items-center justify-between gap-3 p-4">
        {integrado ? <h3 className="text-sm font-semibold">Próximos compromissos</h3> : <h2 className="font-serif text-xl">Compromissos</h2>}
        <Button variant="link" asChild><a href={href} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navegarPara(href); } }}>Ver todos</a></Button>
        {resumo && <div className="w-full">{resumo}</div>}
        <div className="w-full"><TabsList className="h-9 max-w-full">{grupos.map(grupo => <TabsTrigger key={grupo.id} value={grupo.id} className="px-2 text-xs">{grupo.label}</TabsTrigger>)}</TabsList></div>
      </div>
      {grupos.map(grupo => <TabsContent key={grupo.id} value={grupo.id} className="m-0">
        {grupo.itens.length ? pequena ? <ul aria-label="Compromissos prioritários" className="max-h-72 divide-y divide-border overflow-y-auto">{grupo.itens.slice(0, 5).map(item => <li key={item.id} data-fin-tom={item.vencido ? "alerta" : item.tipo === "RECEBER" ? "entrada" : "saida"} className="fin-linha">
          <Button type="button" variant="ghost" onClick={() => setSelecionado(item)} className="h-auto w-full flex-col items-start gap-1 whitespace-normal rounded-none p-3 text-left"><strong className="line-clamp-2 break-words">{tituloCompromisso(item)}</strong><span className="text-xs text-muted-foreground">{item.parceiro?.nome ?? "Sem parceiro"}</span><span className="flex w-full flex-wrap items-center justify-between gap-2 text-sm"><time dateTime={item.dataVencimento}>{dataBR(item.dataVencimento)}</time><strong className="fin-valor tabular-nums">{brl(item.saldoPendente)}</strong></span></Button>
          {onLiquidar && <div className="flex justify-end px-3 pb-2"><Button size="sm" variant="outline" aria-label={item.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"} onClick={() => onLiquidar(item)}>{item.tipo === "PAGAR" ? "Pagar" : "Receber"}</Button></div>}
        </li>)}</ul> : <Table containerLabel="Tabela de compromissos" className="text-sm"><TableCaption className="sr-only">Compromissos do período</TableCaption>
          <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead>{onLiquidar && <TableHead className="text-right">Ação</TableHead>}</TableRow></TableHeader>
          <TableBody>{grupo.itens.slice(0, 5).map(item => <TableRow key={item.id} data-fin-tom={item.vencido ? "alerta" : item.tipo === "RECEBER" ? "entrada" : "saida"} className="fin-linha">
            <TableCell className="max-w-48 whitespace-normal px-4 py-2"><span className="block truncate font-semibold" title={tituloCompromisso(item)}>{tituloCompromisso(item)}</span><p className="mt-1 truncate text-muted-foreground" title={item.parceiro?.nome}>{item.parceiro?.nome ?? "Sem parceiro"}</p></TableCell>
            <TableCell><span className="block">{dataBR(item.dataVencimento)}</span>{item.vencido && <Badge variant="outline" className="mt-1 border-destructive/20 bg-destructive/10 text-destructive">Vencido</Badge>}</TableCell><TableCell className={`text-right font-semibold tabular-nums ${item.tipo === "RECEBER" ? "text-[var(--fin-entrada)]" : "text-[var(--fin-saida)]"}`}>{brl(item.saldoPendente)}</TableCell>
            {onLiquidar && <TableCell className="text-right"><Button variant="link" className="px-2" aria-label={item.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"} onClick={() => onLiquidar(item)}>{item.tipo === "PAGAR" ? "Pagar" : "Receber"}</Button></TableCell>}
          </TableRow>)}</TableBody>
        </Table> : <p role="status" className="px-4 py-3 text-left text-sm text-muted-foreground">{grupo.vazio}</p>}
        {!grupo.itens.length && grupo.id === "proximos" && proximoFuturo && <div className="mx-4 mb-4 rounded-md border border-border p-3"><p className="mb-1 text-xs text-muted-foreground">Próximo vencimento · fora dos próximos 7 dias</p><Button variant="ghost" className="h-auto w-full justify-between gap-2 whitespace-normal px-0 text-left" onClick={() => setSelecionado(proximoFuturo)}><span className="min-w-0"><strong className="block break-words">{tituloCompromisso(proximoFuturo)}</strong><time className="text-xs text-muted-foreground" dateTime={proximoFuturo.dataVencimento}>{dataBR(proximoFuturo.dataVencimento)}</time></span><strong className="shrink-0 tabular-nums">{brl(proximoFuturo.saldoPendente)}</strong></Button></div>}
        {grupo.itens.length > 5 && <p className="px-3 py-2 text-xs text-muted-foreground">Exibindo 5 de {grupo.itens.length} · consulte os demais em Ver todos.</p>}
      </TabsContent>)}
    </Tabs>
    {selecionado && <CompromissoDetalheDialog compromisso={selecionado} onClose={() => setSelecionado(null)} onLiquidar={onLiquidar} />}
  </Container>;
}
