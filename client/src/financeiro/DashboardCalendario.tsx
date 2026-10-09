import { useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { registrarOrigemDialogo } from "./DialogFinanceiro";
import { CalendarioCompromissos } from "./CalendarioCompromissos";
import { dataBR } from "./financeiro-ui";
import type { Compromisso } from "./novo-api";

export function DashboardCalendario({ itens, href, mes, onChangeMes, onLiquidar }: {
  itens: Compromisso[]; href: string; mes: string; onChangeMes: (mes: string) => void; onLiquidar?: (item: Compromisso) => void;
}) {
  const acionadorCalendario = useRef<HTMLButtonElement>(null);
  const [calendario, setCalendario] = useState(false);
  const quantidade = itens.filter(item => item.dataVencimento.startsWith(mes)).length;
  return <Card className="fin-painel dashboard-calendario min-w-0 gap-0 overflow-hidden rounded-lg py-0 shadow-none">
    <div className="fin-cabecalho flex items-center justify-between gap-2 px-4 pt-3"><h2>Calendário</h2>
          <Dialog open={calendario} onOpenChange={setCalendario}>
            <DialogTrigger asChild><Button ref={acionadorCalendario} variant="ghost" size="sm" aria-label="Expandir calendário"><Maximize2 aria-hidden="true" />Expandir</Button></DialogTrigger>
            <DialogContent ref={elemento => registrarOrigemDialogo(elemento, acionadorCalendario.current)} data-fin-tom="pendente" className="financeiro-colorido z-[1100] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden" overlayClassName="z-[1090]">
              <DialogHeader className="fin-cabecalho min-w-0 border-b border-border p-4 pr-12"><DialogTitle>Calendário de compromissos</DialogTitle><DialogDescription>Vencimentos pendentes no período selecionado, de {dataBR(hrefPeriodo(href, "inicio"))} a {dataBR(hrefPeriodo(href, "fim"))}.</DialogDescription></DialogHeader>
              <div className="min-h-0 min-w-0 overflow-auto"><CalendarioCompromissos compacto itens={itens} mes={mes} onChangeMes={onChangeMes} onLiquidar={onLiquidar ? item => { setCalendario(false); onLiquidar(item); } : undefined} /></div>
            </DialogContent>
          </Dialog>
    </div>
    <p className="px-4 pb-2 text-xs text-muted-foreground">{quantidade} {quantidade === 1 ? "compromisso pendente no mês" : "compromissos pendentes no mês"}</p>
    <div aria-hidden={calendario || undefined}><CalendarioCompromissos resumo itens={itens} mes={mes} onChangeMes={onChangeMes} onLiquidar={onLiquidar} /></div>
  </Card>;
}
function hrefPeriodo(href: string, chave: string) {
  return new URLSearchParams(href.split("?")[1]).get(chave) ?? "";
}
