import { useEffect, useState } from "react";
import { Loader } from "../../components/Loading";
import { useAnimal, useTimeline, useConfig, useAnimalInsights } from "../api";
import { idadeMeses } from "../lib/derive";
import { HOJE } from "../HOJE";
import { Timeline } from "./Timeline";
import { EventoForm } from "./EventoForm";
import { ControleForm } from "./ControleForm";
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

  if (loading) return <main className="rb-main"><button className="rb-crumb" onClick={onVoltar}>← Rebanho</button><Loader /></main>;
  if (erro) return <main className="rb-main"><button className="rb-crumb" onClick={onVoltar}>← Rebanho</button><p className="rb-sub" style={{ color: "var(--prejuizo)" }}>Erro: {erro}</p></main>;
  if (!a) return <main className="rb-main"><button className="rb-crumb" onClick={onVoltar}>← Rebanho</button><p>Animal não encontrado.</p></main>;

  const r = a.resumo;
  const meses = a.dataNascimento ? idadeMeses(a.dataNascimento, HOJE) : null;
  const idade = meses != null ? `${Math.floor(meses / 12)}a ${meses % 12}m` : "—";

  return (
    <main className="rb-main">
      <button className="rb-crumb" onClick={onVoltar}>← <b>Rebanho</b> &nbsp;/&nbsp; Animal #{a.numero}</button>

      <div className="rb-head">
        <div>
          <h1>
            {a.nome ? <>{a.nome} <small>· #{a.numero}</small></> : <>#{a.numero}</>}
            {insights?.score && <ScoreBadge score={insights.score} />}
          </h1>
          <div className="rb-sub">{a.categoria === "VACA" ? "Vaca" : a.categoria.toLowerCase()}{a.raca ? ` · ${a.raca}` : ""}{a.dataNascimento ? ` · nascida ${new Date(a.dataNascimento).toLocaleDateString("pt-BR")} (${idade})` : ""}{a.brincoEletronico ? ` · brinco ${a.brincoEletronico}` : ""}</div>
        </div>
        <div className="rb-chips">
          {r?.statusReprodutivo === "PRENHE" && <span className="rb-chip preg">Prenhe · {r.diasGestacao} dias</span>}
          {r?.ordemLactacao && <span className="rb-chip lact">{r.ordemLactacao}ª lactação · DEL {r.del}</span>}
          {a.ativo && (
            <span className="rb-head-actions">
              <button className="rb-btn pri" onClick={() => setRegistrando(true)}>+ Registrar evento</button>
              {!tanque && <button className="rb-btn" onClick={() => setRegistrandoControle(true)}>+ Registrar controle</button>}
              <button className="rb-btn" onClick={() => onEditar(a)}>Editar</button>
              <button className="rb-btn" onClick={() => onBaixa(a)}>Dar baixa</button>
            </span>
          )}
        </div>
      </div>

      {/* I — KPI strip: rentabilidade primeiro, depois operacionais.
              Cada KPI responde 3 perguntas (o quê + significado + ação/impacto) */}
      {(insights || r) && (
        <div className="rb-kstrip" style={{ ["--cols" as any]: insights ? 5 : 6 }}>
          {insights && <RentabilidadeKpi f={insights.financeiro} />}
          {r && (() => {
            const diasSec = diasAte(r.previsaoSecagem);
            return (
              <div className="rb-k">
                <div className="lab">DEL</div>
                <div className="val">{r.del ?? "—"}<u>d</u></div>
                <div className="d">{delInterpretacao(r.del)}</div>
                {diasSec != null && diasSec > 0 && <div className="kpi-cock-imp" style={{ marginTop: 4 }}>Faltam {diasSec} dias para secagem</div>}
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
              <div className="rb-k">
                <div className="lab">Produção</div>
                <div className="val">{litros ?? "—"}<u>L/d</u></div>
                <div className={"d" + (r.producaoTendencia === "subindo" ? " rb-ok" : r.producaoTendencia === "descendo" ? " rb-up" : "")}>{tendTexto}</div>
                {receitaDia != null && <div className="kpi-cock-imp" style={{ marginTop: 4 }}>Receita R$ {receitaDia.toFixed(2).replace(".", ",")}/dia</div>}
              </div>
            );
          })()}
          {r && (() => {
            const cls = ccsClassificacao(r.ccs);
            const tomCls = cls.tom === "lucro" ? " rb-ok" : (cls.tom === "prejuizo" || cls.tom === "atencao") ? " rb-up" : "";
            return (
              <div className="rb-k">
                <div className="lab">CCS</div>
                <div className="val">{r.ccs ?? "—"}<u>mil</u></div>
                <div className={"d" + tomCls}>{cls.texto}</div>
                {r.ccsTendencia === "subindo" && <div className="kpi-cock-imp is-neg" style={{ marginTop: 4 }}>Tendência de alta — risco de mastite</div>}
              </div>
            );
          })()}
          {r && (() => {
            const diasDG = diasAte(r.ultimoDgData);
            return (
              <div className="rb-k">
                <div className="lab">Reprodução</div>
                <div className="val" style={{ fontSize: 22, paddingTop: 4 }}>{r.statusReprodutivo === "PRENHE" ? "Prenhe" : r.statusReprodutivo}</div>
                <div className="d">{r.ultimoDgData ? `DG ${new Date(r.ultimoDgData).toLocaleDateString("pt-BR")}` : "Sem DG registrado"}</div>
                {diasDG != null && diasDG < 0 && <div className="kpi-cock-imp" style={{ marginTop: 4 }}>{Math.abs(diasDG)} dias atrás</div>}
              </div>
            );
          })()}
          {r && (
            <div className="rb-k">
              <div className="lab">Prev. secagem</div>
              <div className="val" style={{ fontSize: 22, paddingTop: 4 }}>{fmtPrevSecagem(r.previsaoSecagem)}</div>
              <div className="d">Programada pelo sistema</div>
            </div>
          )}
        </div>
      )}

      {/* II — Insights horizontais quando houver alertas críticos */}
      {insights && insights.insights.length > 0 && <Insights insights={insights.insights} />}

      {/* III — Grid 2 colunas: timeline + tendências à esquerda; cards de decisão à direita */}
      <div className="rb-grid">
        <div>
          <div key={flashTick} className={"rb-tl-card" + (flashLocalId ? " rb-tl-card-flash" : "")}>
            <h3 className="rb-sec-title">Linha do tempo</h3>
            <p className="rb-sec-sub">Reprodução, sanidade, nutrição e produção — interpretadas pelo sistema.</p>
            {eventos.length === 0
              ? <div className="rb-empty">Nenhum lançamento ainda. Registre o primeiro evento reprodutivo.</div>
              : <Timeline eventos={eventos} interpretacao={insights?.timelineInterpretacao} flashEventoId={flashLocalId} />}
          </div>

          {insights && <Tendencias tendencias={insights.tendencias} />}
        </div>
        <div>
          <div className="rb-box">
            <div className="rb-box-section">
              <h4>Estado atual</h4>
              <div className="rb-kv"><span>Grupo / lote</span><b>{a.grupoNome ?? "—"}</b></div>
              <div className="rb-kv"><span>Dieta</span><b>{a.dietaNome ?? "—"}</b></div>
              <div className="rb-kv"><span>Setor</span><b>{a.setor ?? "—"}</b></div>
              <div className="rb-kv"><span>Status reprod.</span><b>{r?.statusReprodutivo ?? "—"}</b></div>
              {tanque && <p className="rb-sec-sub" style={{ margin: "8px 0 0" }}>Produção estimada por rateio do lote.</p>}
            </div>
          </div>
          {insights && <Percentis p={insights.percentis} />}
          {insights && <ProducaoFinanceira pf={insights.producaoFinanceira} />}
          {insights && <EficienciaGauge e={insights.eficiencia} />}
          {insights && <Projecoes p={insights.projecoes} fontePreco={insights.financeiro.fontePreco} />}
          {insights && <Genealogia g={insights.genealogia} onAbrirAnimal={onAbrirAnimal} />}
        </div>
      </div>

      {registrando && <EventoForm animalId={animalId} animal={a} onFechar={() => setRegistrando(false)} onSalvo={(evento) => { setRegistrando(false); recarregarTudo(); if (evento?.id) { setFlashLocalId(evento.id); setFlashTick((n) => n + 1); } }} />}
      {registrandoControle && <ControleForm animalId={animalId} modo={modo} onFechar={() => setRegistrandoControle(false)} onSalvo={() => { setRegistrandoControle(false); recarregarTudo(); }} />}
    </main>
  );
}
