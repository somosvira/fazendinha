import { useState } from "react";
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

export function AnimalCockpit({ animalId, onVoltar, onAbrirAnimal, onEditar, onBaixa }: {
  animalId: string;
  onVoltar: () => void;
  onAbrirAnimal: (id: string) => void;
  onEditar: (a: Animal) => void;
  onBaixa: (a: Animal) => void;
}) {
  const { data: a, loading, erro, recarregar } = useAnimal(animalId);
  const { data: eventos, recarregar: recarregarEventos } = useTimeline(animalId);
  const { data: cfg } = useConfig();
  const { data: insights, recarregar: recarregarInsights } = useAnimalInsights(animalId);
  const [registrando, setRegistrando] = useState(false);
  const [registrandoControle, setRegistrandoControle] = useState(false);
  const modo = cfg?.producaoModo ?? "ORDENHA";
  const tanque = modo === "TANQUE_LOTE";

  const recarregarTudo = () => { recarregar(); recarregarEventos(); recarregarInsights(); };

  if (loading) return <main className="rb-main"><button className="rb-crumb" onClick={onVoltar}>← Rebanho</button><p className="rb-sub">Carregando…</p></main>;
  if (erro) return <main className="rb-main"><button className="rb-crumb" onClick={onVoltar}>← Rebanho</button><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
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

      {/* I — KPI strip: rentabilidade primeiro, depois operacionais */}
      {(insights || r) && (
        <div className="rb-kstrip" style={{ ["--cols" as any]: insights ? 5 : 6 }}>
          {insights && <RentabilidadeKpi f={insights.financeiro} />}
          {r && <div className="rb-k"><div className="lab">DEL</div><div className="val">{r.del ?? "—"}<u>d</u></div><div className="d">pico passou</div></div>}
          {r && <div className="rb-k"><div className="lab">Produção</div><div className="val">{r.producaoMediaDia ?? "—"}<u>L/d</u></div><div className={"d" + (r.producaoTendencia === "subindo" ? " rb-ok" : r.producaoTendencia === "descendo" ? " rb-up" : "")}>{tanque ? "rateio do lote" : r.producaoTendencia === "subindo" ? "↗ subindo" : r.producaoTendencia === "descendo" ? "↘ descendo" : "estável"}</div></div>}
          {r && <div className="rb-k"><div className="lab">CCS</div><div className="val">{r.ccs ?? "—"}<u>mil</u></div><div className={"d" + (r.ccsTendencia === "subindo" ? " rb-up" : "")}>{r.ccsTendencia === "subindo" ? "↑ subindo" : "estável"}</div></div>}
          {r && <div className="rb-k"><div className="lab">Reprodução</div><div className="val" style={{ fontSize: 18, paddingTop: 5 }}>{r.statusReprodutivo === "PRENHE" ? "Prenhe" : r.statusReprodutivo}</div><div className="d">DG+ {r.ultimoDgData ? new Date(r.ultimoDgData).toLocaleDateString("pt-BR") : "—"}</div></div>}
          {r && <div className="rb-k"><div className="lab">Prev. secagem</div><div className="val" style={{ fontSize: 18, paddingTop: 5 }}>{fmtPrevSecagem(r.previsaoSecagem)}</div><div className="d">programada</div></div>}
        </div>
      )}

      {/* II — Insights horizontais quando houver alertas críticos */}
      {insights && insights.insights.length > 0 && <Insights insights={insights.insights} />}

      {/* III — Grid 2 colunas: timeline + tendências à esquerda; cards de decisão à direita */}
      <div className="rb-grid">
        <div>
          <h3 className="rb-sec-title">Linha do tempo</h3>
          <p className="rb-sec-sub">Reprodução, sanidade, nutrição e produção — interpretadas pelo sistema.</p>
          {eventos.length === 0
            ? <div className="rb-empty">Nenhum lançamento ainda. Registre o primeiro evento reprodutivo.</div>
            : <Timeline eventos={eventos} interpretacao={insights?.timelineInterpretacao} />}

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

      {registrando && <EventoForm animalId={animalId} onFechar={() => setRegistrando(false)} onSalvo={() => { setRegistrando(false); recarregarTudo(); }} />}
      {registrandoControle && <ControleForm animalId={animalId} modo={modo} onFechar={() => setRegistrandoControle(false)} onSalvo={() => { setRegistrandoControle(false); recarregarTudo(); }} />}
    </main>
  );
}
