import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { diasDoCalendario, deslocarMes, nomeMes } from "../../../financeiro/lib/calendario";
import { getHojeISO } from "../../../lib/hoje";
import { Button } from "../../../components/ui/button";
import type { DemandaAcompanhamento } from "./acompanhamento-api";
export function nomeAvaliacao(d: DemandaAcompanhamento) { return d.finalidade === "DIAGNOSTICO" ? "Diagnóstico" : d.finalidade === "SEXAGEM" ? "Sexagem" : `Reconfirmação ${d.ocorrencia}`; }
export function CalendarioAvaliacoes({ itens, abrir }: { itens: DemandaAcompanhamento[]; abrir: (item: DemandaAcompanhamento) => void }) {
  const [mes, setMes] = useState(() => getHojeISO().slice(0, 7));
  const dias = diasDoCalendario(mes);
  return <div className="repro-calendario"><header><div><Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => setMes(deslocarMes(mes, -1))}><ChevronLeft/></Button><Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => setMes(deslocarMes(mes, 1))}><ChevronRight/></Button><h4>{nomeMes(mes)}</h4></div><Button variant="outline" onClick={() => setMes(getHojeISO().slice(0,7))}>Hoje</Button></header><div className="repro-calendario-scroll" role="region" aria-label="Calendário de avaliações e retornos" tabIndex={0}><table><thead><tr>{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => <th key={d} scope="col">{d}</th>)}</tr></thead><tbody>{Array.from({ length: dias.length / 7 }, (_, semana) => <tr key={semana}>{dias.slice(semana * 7, semana * 7 + 7).map(d => <td key={d.data} data-fora={d.data.slice(0,7) !== mes}><time dateTime={d.data}>{d.dia}</time>{itens.filter(i => i.previstaPara?.slice(0,10) === d.data).map(i => <button type="button" key={i.id} onClick={() => abrir(i)}><strong>{nomeAvaliacao(i)}</strong><span>{i.estado === "PENDENTE" ? "Pendente" : i.estado === "RESOLVIDA" ? "Resolvida" : "Encerrada"}</span></button>)}</td>)}</tr>)}</tbody></table></div>{itens.some(i => !i.previstaPara) && <div className="repro-calendario-sem-data"><h4>Sem data definida</h4>{itens.filter(i => !i.previstaPara).map(i => <Button key={i.id} variant="outline" onClick={() => abrir(i)}>{nomeAvaliacao(i)}</Button>)}</div>}</div>;
}
