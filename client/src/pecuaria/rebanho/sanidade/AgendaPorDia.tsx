import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/financeiro/financeiro-ui";

/** Campos mínimos que a agenda precisa de cada tarefa (uma por animal). */
export type TarefaAgenda = {
  id: string;
  etapaId: string;
  previstaPara: string;
  situacao: string;
  rodada?: { id: string; nome: string } | null;
  parametros: { tipo: string; tipoAplicacaoNomeSnapshot?: string };
  execucao: {
    animalId: string;
    rodada?: { id: string; nome: string } | null;
    animal?: { id: string; brinco: string; nome: string | null };
    protocolo: { nome: string; versao: number };
  };
};

export type GrupoAgenda<T extends TarefaAgenda> = {
  chave: string;
  dia: string;
  titulo: string;
  subtitulo: string;
  tarefas: T[];
  pendentes: T[];
};

const DIA_MS = 86400000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const doIso = (dia: string) => new Date(`${dia}T12:00:00`);
const somar = (dia: string, n: number) => iso(new Date(doIso(dia).getTime() + n * DIA_MS));
const curto = (dia: string) => doIso(dia).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
const semana = (dia: string) => doIso(dia).toLocaleDateString("pt-BR", { weekday: "long" });
const semanaCurta = (dia: string) => doIso(dia).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").toUpperCase();
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Uma etapa de um ciclo em um dia vira uma linha só, com todos os animais. */
export function agruparPorEtapa<T extends TarefaAgenda>(tarefas: T[]): GrupoAgenda<T>[] {
  const grupos = new Map<string, GrupoAgenda<T>>();
  for (const t of tarefas) {
    const dia = t.previstaPara.slice(0, 10);
    const rodada = t.rodada ?? t.execucao.rodada ?? null;
    const chave = `${t.etapaId}:${dia}:${rodada?.id ?? ""}`;
    let g = grupos.get(chave);
    if (!g) {
      const nome = t.parametros.tipoAplicacaoNomeSnapshot ?? (t.parametros.tipo === "APLICACAO" ? "Aplicação" : "Exame");
      g = { chave, dia, titulo: nome, subtitulo: `${rodada?.nome ?? "Sem ciclo"} · ${t.execucao.protocolo.nome} · v${t.execucao.protocolo.versao}`, tarefas: [], pendentes: [] };
      grupos.set(chave, g);
    }
    g.tarefas.push(t);
    if (t.situacao === "PENDENTE") g.pendentes.push(t);
  }
  return [...grupos.values()].sort((a, b) => a.dia.localeCompare(b.dia) || a.titulo.localeCompare(b.titulo));
}

const nomeAnimalCurto = (t: TarefaAgenda) => t.execucao.animal ? [t.execucao.animal.nome, t.execucao.animal.brinco ? `#${t.execucao.animal.brinco}` : ""].filter(Boolean).join(" ") : "";

/** Faixa de 14 dias (a partir da segunda-feira da semana) com um ponto por etapa; clicar no dia filtra. */
export function FaixaDias<T extends TarefaAgenda>({ hoje, tarefas, diaSelecionado, onSelecionar }: { hoje: string; tarefas: T[]; diaSelecionado: string | null; onSelecionar: (dia: string | null) => void }) {
  const dow = (doIso(hoje).getDay() + 6) % 7;
  const inicio = somar(hoje, -dow);
  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of agruparPorEtapa(tarefas)) if (g.pendentes.length) m.set(g.dia, (m.get(g.dia) ?? 0) + 1);
    return m;
  }, [tarefas]);
  const dias = Array.from({ length: 14 }, (_, i) => somar(inicio, i));
  return <div>
    <div className="agenda-faixa" role="group" aria-label="Etapas dos próximos 14 dias">
      {dias.map(dia => {
        const n = porDia.get(dia) ?? 0;
        const atrasado = dia < hoje && n > 0;
        return <button type="button" key={dia} className="agenda-faixa-dia" data-hoje={dia === hoje || undefined} aria-pressed={diaSelecionado === dia} aria-label={`${capital(semana(dia))}, ${curto(dia)}: ${n} ${n === 1 ? "etapa" : "etapas"}`} onClick={() => onSelecionar(diaSelecionado === dia ? null : dia)}>
          <span>{semanaCurta(dia)}</span><strong>{Number(dia.slice(8))}</strong>
          <i className="agenda-faixa-pontos" aria-hidden>{Array.from({ length: Math.min(n, 3) }, (_, k) => <b key={k} data-atrasada={atrasado || undefined} />)}</i>
        </button>;
      })}
    </div>
    <div className="agenda-faixa-legenda">{[...porDia.keys()].some(d => d >= hoje) && <span><b />Etapas previstas</span>}{[...porDia.keys()].some(d => d < hoje) && <span><b data-atrasada />Atrasadas</span>}</div>
  </div>;
}

type Secao<T extends TarefaAgenda> = { id: string; titulo: string; detalhe?: string; atrasada?: boolean; grupos: GrupoAgenda<T>[] };

export function AgendaPorDia<T extends TarefaAgenda>({ tarefas, hoje, podeLancar, onRegistrar, rotuloSituacao, abrirAnimal }: {
  tarefas: T[]; hoje: string; podeLancar: boolean; onRegistrar: (tarefas: T[]) => void; rotuloSituacao: (t: T) => string; abrirAnimal?: (t: T) => ReactNode;
}) {
  const [recolhidas, setRecolhidas] = useState<Record<string, boolean>>({});
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});
  const secoes = useMemo(() => {
    const grupos = agruparPorEtapa(tarefas);
    const atrasadas = grupos.filter(g => g.dia < hoje && g.pendentes.length > 0);
    const futuros = grupos.filter(g => g.dia >= hoje);
    const anteriores = grupos.filter(g => g.dia < hoje && g.pendentes.length === 0);
    const lista: Secao<T>[] = [];
    if (atrasadas.length) lista.push({ id: "atrasadas", titulo: "Atrasadas", atrasada: true, detalhe: `${atrasadas.length} ${atrasadas.length === 1 ? "etapa" : "etapas"}`, grupos: atrasadas });
    const dias = [...new Set(futuros.map(g => g.dia))];
    for (const dia of dias) {
      const doDia = futuros.filter(g => g.dia === dia);
      const nome = dia === hoje ? "Hoje" : dia === somar(hoje, 1) ? "Amanhã" : capital(semana(dia));
      lista.push({ id: dia, titulo: nome, detalhe: `${dia === hoje || dia === somar(hoje, 1) ? `${semana(dia)}, ` : ""}${curto(dia)} · ${doDia.length} ${doDia.length === 1 ? "etapa" : "etapas"}`, grupos: doDia });
    }
    if (anteriores.length) lista.push({ id: "anteriores", titulo: "Anteriores", detalhe: `${anteriores.length} ${anteriores.length === 1 ? "etapa" : "etapas"}`, grupos: [...anteriores].reverse() });
    return lista;
  }, [tarefas, hoje]);
  if (!secoes.length) return null;
  return <div className="agenda-dias">{secoes.map(s => {
    const fechada = recolhidas[s.id];
    const limite = 5;
    const visiveis = expandidas[s.id] ? s.grupos : s.grupos.slice(0, limite);
    return <section key={s.id} aria-label={s.titulo}>
      <header className="agenda-dia-cabecalho" data-atrasada={s.atrasada || undefined}>
        <h3>{s.titulo}</h3>{s.detalhe && <small>{s.detalhe}</small>}
        <button type="button" className="agenda-dia-recolher" aria-expanded={!fechada} onClick={() => setRecolhidas(r => ({ ...r, [s.id]: !r[s.id] }))}>{fechada ? "Expandir" : "Recolher"}</button>
      </header>
      {!fechada && <>
        <ul className="agenda-etapas">{visiveis.map(g => {
          const nomes = g.tarefas.slice(0, 3).map(nomeAnimalCurto).filter(Boolean).join(", ");
          const resto = g.tarefas.length - 3;
          const pendente = g.pendentes.length > 0;
          return <li key={g.chave} className="agenda-etapa">
            <div><strong>{g.titulo}</strong><div className="agenda-etapa-sub">{g.subtitulo}</div></div>
            <div className="agenda-etapa-animais"><strong>{g.tarefas.length} {g.tarefas.length === 1 ? "animal" : "animais"}</strong>{nomes && <span> · {nomes}{resto > 0 ? ` +${resto}` : ""}</span>}
              {s.atrasada && <div className="agenda-etapa-atraso">Previsto {capital(semana(g.dia))}, {curto(g.dia)}</div>}
              {!pendente && <div className="agenda-etapa-sub">{rotuloSituacao(g.tarefas[0])}</div>}
            </div>
            <div className="agenda-etapa-acao">{pendente && podeLancar ? <Button secondary onClick={() => onRegistrar(g.pendentes)}>Registrar</Button> : abrirAnimal?.(g.tarefas[0])}</div>
          </li>;
        })}</ul>
        {s.grupos.length > limite && !expandidas[s.id] && <button type="button" className="agenda-dia-mais" onClick={() => setExpandidas(e => ({ ...e, [s.id]: true }))}>Ver mais {s.grupos.length - limite} {s.grupos.length - limite === 1 ? "etapa" : "etapas"}</button>}
      </>}
    </section>;
  })}</div>;
}
