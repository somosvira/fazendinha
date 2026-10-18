import { CalendarDays, FileText, FlaskConical } from "lucide-react";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
import { useEffect, useState } from "react";
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
  return <div className="historico-sanitario-animal"><ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setTentativa((v) => v + 1)}>Tentar novamente</Button>}{!dados && !erro && <p className="text-sm">Carregando histórico…</p>}{dados && (["ocorrencias", "exames", "tarefas"] as const).map((tipo) => {
    const titulo = tipo === "ocorrencias" ? "Ocorrências" : tipo === "exames" ? "Exames" : "Agenda";
    const Icone = tipo === "ocorrencias" ? FileText : tipo === "exames" ? FlaskConical : CalendarDays;
    return <SecaoRecolhivel key={tipo} titulo={<span className="ficha-titulo-com-icone"><Icone size={20} aria-hidden />{titulo}<span className="font-normal text-ink-3"> · {dados[tipo].length === 10 ? "até 10" : dados[tipo].length} {tipo === "tarefas" ? "tarefas" : "registros"}</span></span>} abertaInicial={tipo === "ocorrencias" || dados[tipo].length > 0} acoes={tipo === "tarefas" ? <a className="ficha-link-contorno" href={`/pecuaria/rebanho/sanidade?${q}`}>Abrir sanidade completa</a> : undefined}>
      {dados[tipo].length ? dados[tipo].map((f) => <p key={f.id} className="historico-sanitario-registro">{dataSanitaria(f.inicio ?? f.data ?? f.previstaPara)} · {f.doenca?.nome ?? f.tipoExame?.nome ?? f.execucao?.protocolo.nome} · {f.situacao ?? (f.status === "ANULADO" ? "Anulado" : tipo === "ocorrencias" ? "Ocorrência" : "")}{tipo === "exames" && f.formatoSnapshot && ` · ${resultadoExameSanitario(f as ExameResultado)}`}{abrir && tipo !== "tarefas" && <button type="button" className="ficha-link-contorno" onClick={() => abrir(tipo === "exames" ? "exame" : "ocorrencia", f.id)}>Ver detalhes</button>}</p>) : <p className="historico-sanitario-vazio">{tipo === "ocorrencias" ? `Nenhuma ocorrência registrada para este ${animalId ? "animal" : "lote"}.` : tipo === "exames" ? "Nenhum exame registrado." : "Nenhuma tarefa registrada."}</p>}
    </SecaoRecolhivel>;
  })}</div>;
}
