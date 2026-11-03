import { AjudaCampo } from "../../../components/Dica";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { CalendarMonth, dateFromIso, isoDate } from "../../../components/DateRangePicker";
import { formatBRDateISO, getHojeISO } from "../../../lib/hoje";
import type { ReactNode } from "react";

/** A seleção só consulta os eventos já recebidos; nunca cria uma previsão. */
export function CalendarioAgenda<T>({ itens, dataDe, chaveDe, render }: {
  itens: T[]; dataDe: (item: T) => string | null; chaveDe: (item: T) => string; render: (item: T) => ReactNode;
}) {
  const [selecionada, setSelecionada] = useState(getHojeISO);
  const [mes, setMes] = useState(() => dateFromIso(getHojeISO())!);
  const dia = dateFromIso(selecionada);
  const doDia = itens.filter(item => dataDe(item)?.slice(0, 10) === selecionada);
  const diasComAtividades = [...new Set(itens.map(dataDe).filter((d): d is string => !!d).map(d => d.slice(0, 10)))].filter(d => d.startsWith(isoDate(mes).slice(0, 7))).sort();
  function navegar(data: Date) { setMes(data); }
  return <aside className="repro-agenda-calendario" aria-label="Calendário da agenda">
    <header><h2>{mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} <AjudaCampo rotulo="Ajuda sobre o calendário da agenda" texto="Previsões a definir permanecem na lista. O calendário considera os filtros da consulta."/></h2><div><Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => navegar(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}><ChevronLeft/></Button><Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => navegar(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}><ChevronRight/></Button></div></header>
    <div data-calendars><CalendarMonth year={mes.getFullYear()} month={mes.getMonth()} hideTitle range={{ start: dia, end: dia }} hoverEnd={null} onHoverDay={() => {}} onPickDay={d => setSelecionada(isoDate(d))} onNavigate={navegar}/></div>
    <div className="repro-agenda-dias"><span>Dias com atividades</span>{diasComAtividades.length ? diasComAtividades.map(d => <Button key={d} variant={d === selecionada ? "default" : "outline"} size="sm" aria-label={`Consultar atividades de ${formatBRDateISO(d)}`} onClick={() => setSelecionada(d)}>{Number(d.slice(8))}</Button>) : <p>Nenhuma atividade datada neste mês com os critérios atuais.</p>}</div>
    <Button variant="outline" size="sm" onClick={() => { const d = getHojeISO(); setSelecionada(d); setMes(dateFromIso(d)!); }}>Hoje</Button>
    <section className="repro-agenda-dia" aria-label="Atividades do dia selecionado"><h3>{formatBRDateISO(selecionada)}</h3>{doDia.length ? <ul>{doDia.map(item => <li key={chaveDe(item)}>{render(item)}</li>)}</ul> : <p>Nenhuma atividade prevista neste dia com os critérios atuais.</p>}</section>

  </aside>;
}
