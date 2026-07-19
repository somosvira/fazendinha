import { useEffect, useState } from "react";
import { Loader } from "../../components/Loading";
import { useAnimal, useTimeline, useConfig, useAnimalInsights } from "../api";
import { idadeMeses } from "../lib/derive";
import { HOJE } from "../HOJE";
import { Timeline } from "./Timeline";
import { EventoForm } from "./EventoForm";
import { ControleForm } from "./ControleForm";
import { LactacoesSection } from "./LactacoesSection";
import { VacinasSection } from "./VacinasSection";
import { IatfSection } from "./IatfSection";
import { RebButton } from "@/components/rb/RebButton";
import { RebKpiStrip } from "@/components/rb/RebKpiStrip";
import { RebMain } from "@/components/rb/RebPrimitives";
import {
  ScoreBadge, RentabilidadeKpi, Tendencias, Insights, Percentis,
  ProducaoFinanceira, EficienciaGauge, Projecoes, Genealogia,
} from "./animal-cockpit/InsightsPanel";
import type { Animal } from "../types";

function fmtPrevSecagem(iso?: string | null) {
  if (!iso) return "—";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}/${meses[d.getMonth()]}`;
}

// "DD/MM HH:mm" no fuso local — fim da carência (leite liberado a partir daí).
function fmtDataHora(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function diasAte(iso?: string | null): number | null {
  if (!iso) return null;
  const alvo = new Date(iso).getTime();
  const hoje = new Date(HOJE).getTime();
  return Math.round((alvo - hoje) / 86400000);
}

function delInterpretacao(del: number | null | undefined): string {
  if (del == null) return "";
  if (del < 60) return "Início da lactação";
  if (del < 150) return "Plena lactação";
  if (del < 240) return "Persistência boa";
  return "Próxima da secagem";
}

function ccsClassificacao(ccs: number | null | undefined): { texto: string; tom: "lucro" | "atencao" | "prejuizo" | "" } {
  if (ccs == null) return { texto: "Sem leitura", tom: "" };
  if (ccs < 200) return { texto: "Excelente", tom: "lucro" };
  if (ccs < 400) return { texto: "Atenção", tom: "atencao" };
  return { texto: "Alarme — investigar", tom: "prejuizo" };
}

// Migalha (voltar) — breadcrumb-botão.
const CRUMB = "mb-4 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm text-ink-3 [&_b]:text-ink-2";
// .rb-k — célula base da faixa de KPI (a 1ª perde a border-left dentro do grid).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)] [&_u]:ml-1 [&_u]:text-[15px] [&_u]:font-medium [&_u]:not-italic [&_u]:no-underline [&_u]:text-ink-2";
const RB_K_D = "mt-2 text-[15px] font-medium text-ink-2";
// .kpi-cock-imp — linha de impacto do KPI (cockpit.css).
const KPI_IMP = "mt-1 text-sm font-semibold tabular-nums text-[color:var(--ink)]";

export function AnimalCockpit({ animalId, onVoltar, onAbrirAnimal, onEditar, onBaixa, flashEventoId, flashKey }: {
  animalId: string;
  onVoltar: () => void;
  onAbrirAnimal: (id: string) => void;
  onEditar: (a: Animal) => void;
  onBaixa: (a: Animal) => void;
  flashEventoId?: string | null;
  flashKey?: number;
}) {
  const { data: a, loading, erro, recarregar } = useAnimal(animalId);
  const { data: eventos, recarregar: recarregarEventos } = useTimeline(animalId);
  const { data: cfg } = useConfig();
  const { data: insights, recarregar: recarregarInsights } = useAnimalInsights(animalId);
  const [registrando, setRegistrando] = useState(false);
  const [registrandoControle, setRegistrandoControle] = useState(false);
  // Destaque visual da Linha do tempo: id do evento recém-criado + token que reinicia
  // a animação a cada novo registro (incrementa quando salva pela ficha; sincroniza com
  // o prop externo quando o registro vem da lista de Reprodução/Sanidade).
  const [flashLocalId, setFlashLocalId] = useState<string | null>(null);
  const [flashTick, setFlashTick] = useState(0);
  const modo = cfg?.producaoModo ?? "ORDENHA";
  const tanque = modo === "TANQUE_LOTE";

  const recarregarTudo = () => { recarregar(); recarregarEventos(); recarregarInsights(); };

  // Quando chega flash de fora (registro vindo da aba Reprodução/Sanidade), espelha local
  // e dispara nova rodada da animação trocando o key do wrapper da timeline.
  useEffect(() => {
    if (flashEventoId) { setFlashLocalId(flashEventoId); setFlashTick((n) => n + 1); }
  }, [flashEventoId, flashKey]);

  // Flash some sozinho após 4s para não poluir a visualização contínua.
  useEffect(() => {
    if (!flashLocalId) return;
    const t = window.setTimeout(() => setFlashLocalId(null), 4000);
    return () => window.clearTimeout(t);
  }, [flashLocalId, flashTick]);

  if (loading) return <RebMain><button className={CRUMB} onClick={onVoltar}>← Rebanho</button><Loader /></RebMain>;
  if (erro) return <RebMain><button className={CRUMB} onClick={onVoltar}>← Rebanho</button><p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p></RebMain>;
  if (!a) return <RebMain><button className={CRUMB} onClick={onVoltar}>← Rebanho</button><p>Animal não encontrado.</p></RebMain>;

  const r = a.resumo;
  const meses = a.dataNascimento ? idadeMeses(a.dataNascimento, HOJE) : null;
  const idade = meses != null ? `${Math.floor(meses / 12)}a ${meses % 12}m` : "—";

  return (
    <RebMain>
      <button className={CRUMB} onClick={onVoltar}>← <b>Rebanho</b> &nbsp;/&nbsp; Animal #{a.numero}</button>

      <div className="mb-[18px] mt-1 flex items-end justify-between gap-5 border-b border-[color:var(--rule)] pb-4">
        <div>
          <h1 className="mt-1 font-serif text-[38px] font-medium leading-[1.05] [&_small]:text-2xl [&_small]:font-medium [&_small]:text-ink-2">
            {a.nome ? <>{a.nome} <small>· #{a.numero}</small></> : <>#{a.numero}</>}
            {insights?.score && <ScoreBadge score={insights.score} />}
          </h1>
          <div className="mt-[7px] text-sm text-ink-3">{a.categoria === "VACA" ? "Vaca" : a.categoria.toLowerCase()}{a.raca ? ` · ${a.raca}` : ""}{a.dataNascimento ? ` · nascida ${new Date(a.dataNascimento).toLocaleDateString("pt-BR")} (${idade})` : ""}{a.brincoEletronico ? ` · brinco ${a.brincoEletronico}` : ""}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {r?.statusReprodutivo === "PRENHE" && <span className="rounded-[13px] border border-[#D8C3A8] bg-[color:var(--cafe-soft)] px-[11px] py-[5px] text-sm font-semibold text-cafe">Prenhe · {r.diasGestacao} dias</span>}
          {r?.ordemLactacao && <span className="rounded-[13px] border border-[#E0CF9E] bg-[color:var(--leite-soft)] px-[11px] py-[5px] text-sm font-semibold text-[#6e5a26]">{r.ordemLactacao}ª lactação · DEL {r.del}</span>}
          {a.ativo && (
            <span className="flex gap-2">
              <RebButton variant="pri" onClick={() => setRegistrando(true)}>+ Registrar evento</RebButton>
              {!tanque && <RebButton onClick={() => setRegistrandoControle(true)}>+ Registrar controle</RebButton>}
              <RebButton onClick={() => onEditar(a)}>Editar</RebButton>
              <RebButton onClick={() => onBaixa(a)}>Dar baixa</RebButton>
            </span>
          )}
        </div>
      </div>

      {/* Carência de leite ativa: aviso destacado — o leite desta vaca não deve ser vendido. */}
      {insights?.carenciaAtiva && (
        <div
          role="alert"
          className="mb-[18px] flex items-center gap-3 rounded-xl border border-[#E4B7B0] bg-[#FBEDEB] px-4 py-3 text-[color:var(--prejuizo,#9A3B2E)]"
        >
          <span className="text-lg" aria-hidden>⚠️</span>
          <div className="text-sm font-semibold leading-snug">
            Leite em carência — não vender até {fmtDataHora(insights.carenciaAtiva.fim)}
            <span className="ml-1 font-medium opacity-80">
              (faltam {insights.carenciaAtiva.horasRestantes >= 24
                ? `${insights.carenciaAtiva.diasRestantes} dia(s)`
                : `${insights.carenciaAtiva.horasRestantes}h`})
            </span>
          </div>
        </div>
      )}

      {/* I — KPI strip: rentabilidade primeiro, depois operacionais.
              Cada KPI responde 3 perguntas (o quê + significado + ação/impacto) */}
      {(insights || r) && (
        <RebKpiStrip cols={insights ? 5 : 6}>
          {insights && <RentabilidadeKpi f={insights.financeiro} />}
          {r && (() => {
            const diasSec = diasAte(r.previsaoSecagem);
            return (
              <div className={RB_K}>
                <div className={RB_K_LAB}>DEL</div>
                <div className={RB_K_VAL}>{r.del ?? "—"}<u>d</u></div>
                <div className={RB_K_D}>{delInterpretacao(r.del)}</div>
                {diasSec != null && diasSec > 0 && <div className={KPI_IMP}>Faltam {diasSec} dias para secagem</div>}
              </div>
            );
          })()}
          {r && (() => {
            const litros = r.producaoMediaDia;
            const precoLitro = insights?.financeiro?.precoLeite;
            const receitaDia = litros != null && precoLitro != null ? litros * precoLitro : null;
            const tendTexto = tanque
              ? "rateio do lote"
              : r.producaoTendencia === "subindo" ? "Subindo nas últimas 4 semanas"
              : r.producaoTendencia === "descendo" ? "Caindo — investigar"
              : "Estável nas últimas 4 semanas";
            return (
              <div className={RB_K}>
                <div className={RB_K_LAB}>Produção</div>
                <div className={RB_K_VAL}>{litros ?? "—"}<u>L/d</u></div>
                <div className={RB_K_D + (r.producaoTendencia === "subindo" ? " text-lucro" : r.producaoTendencia === "descendo" ? " text-prejuizo" : "")}>{tendTexto}</div>
                {receitaDia != null && <div className={KPI_IMP}>Receita R$ {receitaDia.toFixed(2).replace(".", ",")}/dia</div>}
              </div>
            );
          })()}
          {r && (() => {
            const cls = ccsClassificacao(r.ccs);
            const tomCls = cls.tom === "lucro" ? " text-lucro" : (cls.tom === "prejuizo" || cls.tom === "atencao") ? " text-prejuizo" : "";
            return (
              <div className={RB_K}>
                <div className={RB_K_LAB}>CCS</div>
                <div className={RB_K_VAL}>{r.ccs ?? "—"}<u>mil</u></div>
                <div className={RB_K_D + tomCls}>{cls.texto}</div>
                {r.ccsTendencia === "subindo" && <div className={KPI_IMP + " text-prejuizo"}>Tendência de alta — risco de mastite</div>}
              </div>
            );
          })()}
          {r && (() => {
            const diasDG = diasAte(r.ultimoDgData);
            return (
              <div className={RB_K}>
                <div className={RB_K_LAB}>Reprodução</div>
                <div className={RB_K_VAL + " !text-[22px] pt-1"}>{r.statusReprodutivo === "PRENHE" ? "Prenhe" : r.statusReprodutivo}</div>
                <div className={RB_K_D}>{r.ultimoDgData ? `DG ${new Date(r.ultimoDgData).toLocaleDateString("pt-BR")}` : "Sem DG registrado"}</div>
                {diasDG != null && diasDG < 0 && <div className={KPI_IMP}>{Math.abs(diasDG)} dias atrás</div>}
              </div>
            );
          })()}
          {r && (
            <div className={RB_K}>
              <div className={RB_K_LAB}>Prev. secagem</div>
              <div className={RB_K_VAL + " !text-[22px] pt-1"}>{fmtPrevSecagem(r.previsaoSecagem)}</div>
              <div className={RB_K_D}>Programada pelo sistema</div>
            </div>
          )}
        </RebKpiStrip>
      )}

      {/* II — Insights horizontais quando houver alertas críticos */}
      {insights && insights.insights.length > 0 && <Insights insights={insights.insights} />}

      {/* III — Grid 2 colunas: timeline + tendências à esquerda; cards de decisão à direita */}
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_clamp(280px,24vw,360px)] gap-[clamp(20px,2.4vw,36px)] max-[1100px]:grid-cols-1">
        <div>
          <div key={flashTick} className={"rb-tl-card" + (flashLocalId ? " rb-tl-card-flash" : "")}>
            <h3 className="mb-3 font-serif text-xl font-medium">Linha do tempo</h3>
            <p className="mb-4 mt-0 text-sm text-ink-3">Reprodução, sanidade, nutrição e produção — interpretadas pelo sistema.</p>
            {eventos.length === 0
              ? <div className="rounded-[10px] border border-dashed border-[color:var(--rule)] bg-[color:var(--bg-card-2)] p-[22px] text-sm text-ink-3">Nenhum lançamento ainda. Registre o primeiro evento reprodutivo.</div>
              : <Timeline eventos={eventos} interpretacao={insights?.timelineInterpretacao} flashEventoId={flashLocalId} />}
          </div>

          {insights && <Tendencias tendencias={insights.tendencias} />}
        </div>
        <div>
          <div className="mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
            <div>
              <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Estado atual</h4>
              <div className="flex justify-between border-b border-dashed border-[color:var(--rule-soft)] py-[5px] text-sm [&_b]:font-semibold"><span>Grupo / lote</span><b>{a.grupoNome ?? "—"}</b></div>
              <div className="flex justify-between border-b border-dashed border-[color:var(--rule-soft)] py-[5px] text-sm [&_b]:font-semibold"><span>Dieta</span><b>{a.dietaNome ?? "—"}</b></div>
              <div className="flex justify-between border-b border-dashed border-[color:var(--rule-soft)] py-[5px] text-sm [&_b]:font-semibold"><span>Setor</span><b>{a.setor ?? "—"}</b></div>
              <div className="flex justify-between py-[5px] text-sm [&_b]:font-semibold"><span>Status reprod.</span><b>{r?.statusReprodutivo ?? "—"}</b></div>
              {tanque && <p className="mb-0 mt-2 text-sm text-ink-3">Produção estimada por rateio do lote.</p>}
            </div>
          </div>
          {insights && <Percentis p={insights.percentis} />}
          {insights && <ProducaoFinanceira pf={insights.producaoFinanceira} />}
          {insights && <EficienciaGauge e={insights.eficiencia} />}
          {insights && <Projecoes p={insights.projecoes} fontePreco={insights.financeiro.fontePreco} />}
          {insights && <Genealogia g={insights.genealogia} onAbrirAnimal={onAbrirAnimal} />}
          <LactacoesSection animalId={animalId} />
          <VacinasSection animalId={animalId} />
          <IatfSection animalId={animalId} />
        </div>
      </div>

      {registrando && <EventoForm animalId={animalId} animal={a} onFechar={() => setRegistrando(false)} onSalvo={(evento) => { setRegistrando(false); recarregarTudo(); if (evento?.id) { setFlashLocalId(evento.id); setFlashTick((n) => n + 1); } }} />}
      {registrandoControle && <ControleForm animalId={animalId} modo={modo} onFechar={() => setRegistrandoControle(false)} onSalvo={() => { setRegistrandoControle(false); recarregarTudo(); }} />}
    </RebMain>
  );
}
