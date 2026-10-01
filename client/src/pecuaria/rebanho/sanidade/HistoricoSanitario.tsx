import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { reqSanidade } from "./api";
type Fato = { id: string; inicio?: string; data?: string; previstaPara?: string; status?: string; situacao?: string; doenca?: { nome: string }; tipoExame?: { nome: string }; execucao?: { protocolo: { nome: string } } };
export function HistoricoSanitario({ animalId, loteId }: { animalId?: string; loteId?: string }) {
  const [dados, setDados] = useState<{ ocorrencias: Fato[]; exames: Fato[]; tarefas: Fato[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const q = new URLSearchParams({ ...(animalId ? { animalId } : {}), ...(loteId ? { loteId } : {}), porPagina: "10", pagina: "1" }).toString();
  useEffect(() => { let vivo = true; setDados(null); Promise.all([reqSanidade<Fato[]>(`/ocorrencias?${q}`), reqSanidade<Fato[]>(`/exames?${q}`), reqSanidade<Fato[]>(`/tarefas?${q}`)]).then(([ocorrencias, exames, tarefas]) => { if (vivo) { setDados({ ocorrencias, exames, tarefas }); setErro(null); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [q, tentativa]);
  return <section className="mt-4 grid gap-3 rounded-lg border border-border p-3"><h3 className="font-semibold">Agenda, ocorrências e exames</h3><ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setTentativa((v) => v + 1)}>Tentar novamente</Button>}{!dados && !erro && <p className="text-sm">Carregando histórico…</p>}{dados && (["ocorrencias", "exames", "tarefas"] as const).map((tipo) => <details key={tipo}><summary className="cursor-pointer text-sm">{tipo === "ocorrencias" ? "Ocorrências" : tipo === "exames" ? "Exames" : "Agenda"} · até 10 registros</summary>{dados[tipo].length ? dados[tipo].map((f) => <p key={f.id} className="mt-2 text-sm">{(f.inicio ?? f.data ?? f.previstaPara)?.slice(0, 10)} · {f.doenca?.nome ?? f.tipoExame?.nome ?? f.execucao?.protocolo.nome} · {f.situacao ?? f.status}</p>) : <p className="mt-2 text-sm text-ink-3">Nenhum registro.</p>}</details>)}<a className="text-sm font-semibold text-green-800 underline" href={`/pecuaria/rebanho/sanidade?${q}`}>Abrir Sanidade completa para consultar, registrar ou executar tarefas</a></section>;
}
