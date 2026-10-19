import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, FlaskConical, ExternalLink } from "lucide-react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { reqSanidade } from "./api";
import { dataSanitaria, resultadoExameSanitario } from "./rotulos";
import type { ExameResultado } from "./ResultadoExame";
type Fato = Partial<ExameResultado> & { id: string; inicio?: string; data?: string; previstaPara?: string; status?: string; situacao?: string; doenca?: { nome: string }; tipoExame?: { nome: string }; execucao?: { protocolo: { nome: string } } };
export function HistoricoSanitario({ animalId, loteId, abrir }: { animalId?: string; loteId?: string; abrir?: (tipo: string, id: string) => void }) {
  const [dados, setDados] = useState<{ ocorrencias: Fato[]; exames: Fato[]; tarefas: Fato[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const q = new URLSearchParams({ ...(animalId ? { animalId } : {}), ...(loteId ? { loteId } : {}), porPagina: "10", pagina: "1" }).toString();
  useEffect(() => { let vivo = true; setDados(null); Promise.all([reqSanidade<Fato[]>(`/ocorrencias?${q}`), reqSanidade<Fato[]>(`/exames?${q}`), reqSanidade<Fato[]>(`/tarefas?${q}`)]).then(([ocorrencias, exames, tarefas]) => { if (vivo) { setDados({ ocorrencias, exames, tarefas }); setErro(null); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [q, tentativa]);
  function endereco(aba: string) {
    const parametros = new URLSearchParams({ ...(animalId ? { animalId } : {}), ...(loteId ? { loteId } : {}), aba });
    return `/pecuaria/sanidade?${parametros}`;
  }
  const secoes = [
    { tipo: "ocorrencias", titulo: "Ocorrências", aba: "ocorrencias", Icone: ClipboardList },
    { tipo: "exames", titulo: "Exames", aba: "exames", Icone: FlaskConical },
    { tipo: "tarefas", titulo: "Agenda", aba: "agenda", Icone: CalendarDays },
  ] as const;
  return <section className="mt-5 grid gap-4" aria-label="Agenda, ocorrências e exames">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Agenda, ocorrências e exames</h3><a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-surface-2" href={endereco("agenda")}>Abrir sanidade<ExternalLink size={16} aria-hidden /></a></div>
    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => { setErro(null); setTentativa((v) => v + 1); }}>Tentar novamente</Button>}
    {!dados && !erro && <p role="status" className="text-sm">Carregando histórico…</p>}
    {dados && <div className="grid gap-4 xl:grid-cols-3">{secoes.map(({ tipo, titulo, aba, Icone }) => <section key={tipo} className="min-w-0 rounded-xl border border-border" aria-label={titulo}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><h4 className="inline-flex items-center gap-2 font-semibold"><Icone size={17} aria-hidden />{titulo}</h4><a className="min-h-10 content-center text-sm font-semibold underline underline-offset-4" href={endereco(aba)}>Ver {titulo.toLocaleLowerCase("pt-BR")}</a></header>
      <p className="px-4 pt-3 text-xs text-ink-3">Até 10 registros</p>
      {dados[tipo].length ? <ul className="divide-y divide-border px-4">{dados[tipo].map((f) => <li key={f.id} className="grid gap-1 py-3 text-sm">
        <span className="font-medium">{f.doenca?.nome ?? f.tipoExame?.nome ?? f.execucao?.protocolo.nome ?? titulo}</span><span className="text-ink-3">{dataSanitaria(f.inicio ?? f.data ?? f.previstaPara)}{f.situacao || f.status === "ANULADO" ? ` · ${f.situacao ?? "Anulado"}` : ""}</span>
        {tipo === "exames" && f.formatoSnapshot && <span>{resultadoExameSanitario(f as ExameResultado)}</span>}
        {abrir && tipo !== "tarefas" && <button type="button" className="min-h-10 justify-self-start text-left font-semibold underline underline-offset-4" onClick={() => abrir(tipo === "exames" ? "exame" : "ocorrencia", f.id)}>Ver detalhes</button>}
      </li>)}</ul> : <p className="px-4 py-4 text-sm text-ink-3">Nenhum registro.</p>}
    </section>)}</div>}
  </section>;
}
