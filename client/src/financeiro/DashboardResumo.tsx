import type { LucideIcon } from "lucide-react";
import { ChevronDown, Landmark, WalletCards } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Compromisso, Conta } from "./novo-api";
import { navegarPara } from "../router";
import { brl } from "./financeiro-ui";

export function resumoVencidos(itens: Compromisso[], tipo: Compromisso["tipo"]) {
  const vencidos = itens.filter(item => item.vencido && item.tipo === tipo);
  const centavos = vencidos.reduce((total, item) => total + Math.round(Number(item.saldoPendente) * 100), 0);
  return `Vencido: ${brl(centavos / 100)} · ${vencidos.length} ${vencidos.length === 1 ? "item" : "itens"}`;
}

export function IndicadorFinanceiro({ label, valor, detalhe, icon: Icon, alerta = false, href }: {
  label: string; valor: string; detalhe: string; icon: LucideIcon; alerta?: boolean; href?: string;
}) {
  const card = <Card className="h-full @container min-w-0 gap-1 rounded-lg border-border p-3 shadow-none">
    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon size={16} aria-hidden="true" />{label}</div>
    <strong className="whitespace-nowrap font-serif text-[clamp(20px,12cqw,26px)] leading-tight tabular-nums">{brl(valor)}</strong>
    <p className={`text-sm ${alerta ? "text-destructive" : "text-muted-foreground"}`}>{detalhe}</p>
  </Card>;
  return href ? <a href={href} aria-label={`Ver ${label.toLocaleLowerCase("pt-BR")}`} className="min-w-0 rounded-lg outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring" onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navegarPara(href); } }}>{card}</a> : card;
}

function ListaContas({ contas, onAbrir }: { contas: Conta[]; onAbrir: () => void }) {
  return <ul className="divide-y divide-border">{contas.map(conta => <li key={conta.id}>
    <Button variant="ghost" onClick={onAbrir} className="h-auto w-full justify-between gap-3 whitespace-normal rounded-none px-4 py-3 text-left">
      <span className="flex min-w-0 items-center gap-2">{conta.tipo === "BANCO" ? <Landmark aria-hidden="true" /> : <WalletCards aria-hidden="true" />}<span className="min-w-0 break-words">{conta.nome}</span></span>
      <strong className={`shrink-0 tabular-nums ${Number(conta.saldoAtual) < 0 ? "text-destructive" : ""}`}>{brl(conta.saldoAtual)}</strong>
    </Button>
  </li>)}</ul>;
}

export function ContasDisponibilidade({ contas, onAbrir }: { contas: Conta[]; onAbrir: () => void }) {
  const incluidas = contas.filter(conta => conta.incluirNoSaldoGeral);
  const excluidas = contas.filter(conta => !conta.incluirNoSaldoGeral);
  return <Card className="min-w-0 gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none">
    <div className="p-4"><h2 className="font-serif text-xl">Contas e disponibilidade</h2><p className="mt-1 text-sm text-muted-foreground">Saldos atuais · contas incluídas no saldo disponível</p></div>
    {incluidas.length ? <ListaContas contas={incluidas} onAbrir={onAbrir} /> : <p className="px-4 pb-4 text-sm text-muted-foreground">Nenhuma conta incluída no saldo disponível.</p>}
    {!!excluidas.length && <Collapsible className="border-t border-border">
      <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto w-full justify-between whitespace-normal rounded-none p-4 text-left">{excluidas.length} {excluidas.length === 1 ? "conta fora do saldo" : "contas fora do saldo"}<ChevronDown aria-hidden="true" /></Button></CollapsibleTrigger>
      <CollapsibleContent><ListaContas contas={excluidas} onAbrir={onAbrir} /></CollapsibleContent>
    </Collapsible>}
    <Button variant="link" className="mt-auto self-end p-4" onClick={onAbrir}>Ver extratos</Button>
  </Card>;
}
