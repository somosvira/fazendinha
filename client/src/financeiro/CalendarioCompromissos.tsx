import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell, TableCaption } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFinanceiro as Modal } from "./DialogFinanceiro";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Compromisso } from "./novo-api";
import { brl, dataBR, hoje, mesAtual, STATUS } from "./financeiro-ui";
import { diasDoCalendario, deslocarMes, nomeMes } from "./lib/calendario";
import { tituloCompromisso } from "./lib/compromissos";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";

export function CalendarioCompromissos({ itens, mes, onChangeMes, onLiquidar, compacto = false }: {
  compacto?: boolean;
  itens: Compromisso[];
  mes: string;
  onChangeMes: (mes: string) => void;
  onLiquidar?: (compromisso: Compromisso) => void;
}) {
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const selecionado = itens.find(c => c.id === selecionadoId);
  const dias = diasDoCalendario(mes);
  const porDia = new Map<string, Compromisso[]>();
  for (const item of itens) {
    const data = item.dataVencimento.slice(0, 10);
    const compromissos = porDia.get(data) ?? [];
    compromissos.push(item);
    porDia.set(data, compromissos);
  }
  const mudarMes = (valor: string) => { setSelecionadoId(null); setDiaSelecionado(null); onChangeMes(valor); };
  const temCompromissosNoMes = itens.some(c => c.dataVencimento.startsWith(mes));

  return <div className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" type="button" aria-label="Mês anterior" onClick={() => mudarMes(deslocarMes(mes, -1))} className="rounded-lg border border-border p-2 hover:bg-surface-2"><ChevronLeft size={18} /></Button>
        <Button variant="outline" size="icon" type="button" aria-label="Próximo mês" onClick={() => mudarMes(deslocarMes(mes, 1))} className="rounded-lg border border-border p-2 hover:bg-surface-2"><ChevronRight size={18} /></Button>
        <h3 className="ml-1 text-sm font-semibold capitalize" aria-live="polite">{nomeMes(mes)}</h3>
      </div>
      <Button variant="outline" onClick={() => mudarMes(mesAtual())}>Hoje</Button>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3 text-sm text-ink-3"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--fin-pendente)]" />A pagar</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--fin-entrada)]" />A receber</span><span>Clique em um compromisso para consultar os detalhes.</span></div>
    {!temCompromissosNoMes && <p role="status" className="px-4 pb-3 text-sm text-ink-3">Nenhum compromisso neste mês para a visão selecionada.</p>}
    <p className="px-4 pb-3 text-sm text-ink-3 md:hidden">Deslize o calendário para ver os outros dias da semana.</p>
    <div role="region" aria-label="Dias do calendário" tabIndex={0} className="overflow-x-auto">
      <Table className="w-full table-fixed border-collapse text-left [&_td]:whitespace-normal" style={{ minWidth: 700 }}>
        <TableCaption className="sr-only">Calendário de compromissos — {nomeMes(mes)}</TableCaption>
        <TableHeader><TableRow>{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(dia => <TableHead key={dia} scope="col" className="border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-ink-3">{dia}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{Array.from({ length: dias.length / 7 }, (_, semana) => <TableRow key={semana}>{dias.slice(semana * 7, semana * 7 + 7).map(({ data, dia }) => <TableCell key={data} data-dia={data} className={`border border-border p-2 align-top ${data.startsWith(mes) ? "bg-white" : "bg-stone-50 text-ink-3"}`}>
          <div className={compacto ? "min-h-[clamp(64px,calc((100dvh-300px)/6),96px)]" : "min-h-[130px]"}>
            <time dateTime={data} aria-label={dataBR(data)} aria-current={data === hoje() ? "date" : undefined} className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${data === hoje() ? "bg-mast text-white" : ""}`}>{dia}</time>
            <ul className="max-h-48 space-y-1 overflow-y-auto" aria-label={`Compromissos de ${dataBR(data)}`}>{(porDia.get(data) ?? []).map(c => <li key={c.id}>
              <Button data-fin-tom={c.tipo === "PAGAR" ? "pendente" : "entrada"} type="button" onClick={() => setSelecionadoId(c.id)} aria-label={`${tituloCompromisso(c)}, ${c.tipo === "PAGAR" ? "a pagar" : "a receber"}, ${brl(c.saldoPendente)}${c.vencido ? ", vencido" : ""}`} variant="ghost" className={`fin-evento h-auto w-full flex-col items-start gap-0 whitespace-normal rounded-md border-l-2 p-2 text-left text-sm leading-snug hover:brightness-95 `}>
                <span className="line-clamp-2 break-words font-semibold">{tituloCompromisso(c)}</span>
                <span className="mt-1 block">{c.tipo === "PAGAR" ? "A pagar" : "A receber"} · {brl(c.saldoPendente)}</span>
                {c.vencido && <span className="mt-1 block font-semibold text-red-800">Vencido</span>}
                {c.status === "LIQUIDADO" && <span className="mt-1 block">Liquidado</span>}
              </Button>
            </li>)}</ul>
            {(porDia.get(data)?.length ?? 0) > 3 && <Button type="button" onClick={() => setDiaSelecionado(data)} variant="link" className="mt-2 h-auto whitespace-normal px-0 text-left text-sm font-semibold text-green-800 underline underline-offset-2">Ver {porDia.get(data)!.length} compromissos</Button>}
          </div>
        </TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </div>
    {diaSelecionado && <Modal tom="pendente" titulo={`Compromissos de ${dataBR(diaSelecionado)}`} eyebrow="Agenda financeira" onClose={() => setDiaSelecionado(null)}>
      <ul className="divide-y divide-border">{(porDia.get(diaSelecionado) ?? []).map(c => <li key={c.id}><Button type="button" onClick={() => { setDiaSelecionado(null); setSelecionadoId(c.id); }} variant="ghost" className="h-auto w-full flex-col items-start whitespace-normal space-y-2 p-5 text-left hover:bg-surface-2"><strong className="block break-words text-sm">{tituloCompromisso(c)}</strong><span className="block text-sm">{c.tipo === "PAGAR" ? "A pagar" : "A receber"} · {brl(c.saldoPendente)}</span><Badge variant="outline">{STATUS[c.status] ?? c.status}</Badge>{c.vencido && <Badge variant="outline" className="border-destructive/20 text-destructive">Vencido</Badge>}</Button></li>)}</ul>
    </Modal>}
    {selecionado && <Modal tom="pendente" titulo="Detalhes do compromisso" eyebrow="Agenda financeira" onClose={() => setSelecionadoId(null)}>
      <div className="space-y-5 p-5">
        <div><h3 className="break-words font-serif text-xl">{tituloCompromisso(selecionado)}</h3><p className="mt-2 text-sm text-ink-3">{selecionado.parceiro?.nome ?? "Sem parceiro"}</p></div>
        <div className="flex flex-wrap gap-2"><Badge variant="outline">{STATUS[selecionado.status] ?? selecionado.status}</Badge>{selecionado.vencido && <Badge variant="outline" className="border-destructive/20 text-destructive">Vencido</Badge>}</div>
        <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-ink-3">Vencimento</dt><dd className="mt-1 font-semibold">{dataBR(selecionado.dataVencimento)}</dd></div><div><dt className="text-ink-3">{selecionado.tipo === "PAGAR" ? "A pagar" : "A receber"}</dt><dd className="mt-1 font-semibold">{brl(selecionado.saldoPendente)}</dd></div><div><dt className="text-ink-3">Valor original</dt><dd className="mt-1">{brl(selecionado.valorOriginal)}</dd></div><div><dt className="text-ink-3">Operação</dt><dd className="mt-1"><LinkOperacaoFinanceira id={selecionado.operacao.id} numero={selecionado.operacao.numero} /></dd></div></dl>
        {onLiquidar && ["PENDENTE", "PARCIAL"].includes(selecionado.status) && <div className="flex justify-end"><Button onClick={() => { setSelecionadoId(null); onLiquidar(selecionado); }}>{selecionado.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"}</Button></div>}
      </div>
    </Modal>}
  </div>;
}
