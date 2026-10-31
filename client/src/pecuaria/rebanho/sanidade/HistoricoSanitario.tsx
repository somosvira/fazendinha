import { LinkInterno } from "../../../components/LinkInterno";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { reqSanidade } from "./api";
import { dataSanitaria, resultadoExameSanitario } from "./rotulos";
import { rotuloSituacaoTarefa } from "./RegularizacaoTarefa";
import type { ExameResultado } from "./ResultadoExame";
type Fato = Partial<ExameResultado> & { id: string; propriedadeId?: number; inicio?: string; data?: string; previstaPara?: string; status?: string; situacao?: string; doenca?: { nome: string }; tipoExame?: { nome: string }; execucao?: { protocolo: { nome: string } } };
export function HistoricoSanitario({ animalId, loteId, abrir, onNovoFato }: { animalId?: string; loteId?: string; abrir?: (tipo: string, id: string, propriedadeId?: number) => void; onNovoFato?: (tipo: "ocorrencia" | "exame") => void }) {
  const [dados, setDados] = useState<{ ocorrencias: Fato[]; exames: Fato[]; tarefas: Fato[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const q = new URLSearchParams({ ...(animalId ? { animalId } : {}), ...(loteId ? { loteId } : {}), porPagina: "10", pagina: "1" }).toString();
  useEffect(() => { let vivo = true; setDados(null); Promise.all([reqSanidade<Fato[]>(`/ocorrencias?${q}`), reqSanidade<Fato[]>(`/exames?${q}`), reqSanidade<Fato[]>(`/tarefas?${q}`)]).then(([ocorrencias, exames, tarefas]) => { if (vivo) { setDados({ ocorrencias, exames, tarefas }); setErro(null); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [q, tentativa]);
  function endereco(aba: string) {
    const parametros = new URLSearchParams({ ...(animalId ? { animalId } : {}), ...(loteId ? { loteId } : {}), aba, ...(aba === "agenda" ? { visaoAgenda: "tarefas" } : {}) });
    return `/pecuaria/sanidade?${parametros}`;
  }
  const secoes = [
    { tipo: "ocorrencias", titulo: "Ocorrências", aba: "ocorrencias" },
    { tipo: "exames", titulo: "Exames", aba: "exames" },
    { tipo: "tarefas", titulo: "Agenda", aba: "agenda" },
  ] as const;
  return <section className="historico-sanitario-animal" aria-label="Agenda, ocorrências e exames">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Acompanhamento</h3><LinkInterno area="pecuaria" aparencia="botao-secundario" href={endereco("agenda")}>Abrir sanidade completa<ExternalLink size={16} aria-hidden /></LinkInterno></div>
    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => { setErro(null); setTentativa((v) => v + 1); }}>Tentar novamente</Button>}
    {!dados && !erro && <p role="status" className="text-sm">Carregando histórico…</p>}
    <div className="sanidade-acompanhamento-secoes">{secoes.map(({ tipo, titulo, aba }) => <section key={tipo} className="sanidade-acompanhamento-secao">
      <header><h4 className="font-semibold">{titulo} {dados && <span className="text-sm font-normal text-ink-3">· {dados[tipo].length === 10 ? "até 10" : dados[tipo].length} {tipo === "tarefas" ? "tarefas" : "registros"}</span>}</h4><div className="flex flex-wrap items-center gap-2">{onNovoFato && tipo !== "tarefas" && <Button secondary onClick={() => onNovoFato(tipo === "exames" ? "exame" : "ocorrencia")}>{tipo === "exames" ? "Registrar exame" : "Nova ocorrência"}</Button>}<LinkInterno area="pecuaria" href={endereco(aba)}>Ver {titulo.toLocaleLowerCase("pt-BR")}</LinkInterno></div></header>
      {dados && (dados[tipo].length ? <ul className="divide-y divide-border">{dados[tipo].map((f) => <li key={f.id} className="grid gap-1 py-3 text-sm">
        <span className="font-medium">{f.doenca?.nome ?? f.tipoExame?.nome ?? f.execucao?.protocolo.nome ?? titulo}</span><span className="text-ink-3">{dataSanitaria(f.inicio ?? f.data ?? f.previstaPara)}{f.situacao || f.status === "ANULADO" ? ` · ${f.situacao ? rotuloSituacaoTarefa(f.situacao) : "Anulado"}` : ""}</span>
        {tipo === "exames" && f.formatoSnapshot && <span>{resultadoExameSanitario(f as ExameResultado)}</span>}
        {abrir && tipo !== "tarefas" && <button type="button" className="min-h-10 justify-self-start text-left font-semibold underline underline-offset-4" onClick={() => abrir(tipo === "exames" ? "exame" : "ocorrencia", f.id, f.propriedadeId)}>Ver detalhes</button>}
      </li>)}</ul> : <p className="py-3 text-sm text-ink-3">{tipo === "ocorrencias" ? `Nenhuma ocorrência registrada para este ${animalId ? "animal" : "lote"}.` : tipo === "exames" ? "Nenhum exame registrado." : "Nenhuma tarefa registrada."}</p>)}
    </section>)}</div>

  </section>;

}
