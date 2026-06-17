import { useState } from "react";
import { useAnimal, useTimeline } from "../api";
import { idadeMeses } from "../lib/derive";
import { HOJE } from "../HOJE";
import { Timeline } from "./Timeline";
import { EventoForm } from "./EventoForm";
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
  const [registrando, setRegistrando] = useState(false);
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
          <h1>{a.nome || `#${a.numero}`} <small>· #{a.numero}</small></h1>
          <div className="rb-sub">{a.categoria === "VACA" ? "Vaca" : a.categoria.toLowerCase()}{a.raca ? ` · ${a.raca}` : ""}{a.dataNascimento ? ` · nascida ${new Date(a.dataNascimento).toLocaleDateString("pt-BR")} (${idade})` : ""}{a.brincoEletronico ? ` · brinco ${a.brincoEletronico}` : ""}</div>
        </div>
        <div className="rb-chips">
          {r?.statusReprodutivo === "PRENHE" && <span className="rb-chip preg">Prenhe · {r.diasGestacao} dias</span>}
          {r?.ordemLactacao && <span className="rb-chip lact">{r.ordemLactacao}ª lactação · DEL {r.del}</span>}
          {a.ativo && (
            <span className="rb-head-actions">
              <button className="rb-btn pri" onClick={() => setRegistrando(true)}>+ Registrar evento</button>
              <button className="rb-btn" onClick={() => onEditar(a)}>Editar</button>
              <button className="rb-btn" onClick={() => onBaixa(a)}>Dar baixa</button>
            </span>
          )}
        </div>
      </div>

      {r && (
        <div className="rb-stats">
          <div className="rb-stat"><div className="k">DEL</div><div className="v">{r.del ?? "—"}<u>d</u></div><div className="t">pico passou</div></div>
          <div className="rb-stat"><div className="k">Produção</div><div className="v">{r.producaoMediaDia ?? "—"}<u>L/d</u></div><div className="t rb-ok">média 7d ↗</div></div>
          <div className="rb-stat"><div className="k">Reprodução</div><div className="v" style={{ fontSize: 18, paddingTop: 5 }}>{r.statusReprodutivo === "PRENHE" ? "Prenhe" : r.statusReprodutivo}</div><div className="t">DG+ {r.ultimoDgData ? new Date(r.ultimoDgData).toLocaleDateString("pt-BR") : "—"}</div></div>
          <div className="rb-stat"><div className="k">IEP previsto</div><div className="v">{r.iepProjetado ?? "—"}<u>d</u></div><div className="t rb-ok">meta ≤ 400</div></div>
          <div className="rb-stat"><div className="k">Prev. secagem</div><div className="v" style={{ fontSize: 18, paddingTop: 5 }}>{fmtPrevSecagem(r.previsaoSecagem)}</div><div className="t">programada</div></div>
          <div className="rb-stat"><div className="k">CCS</div><div className="v">{r.ccs ?? "—"}<u>mil</u></div><div className={"t" + (r.ccsTendencia === "subindo" ? " rb-up" : "")}>{r.ccsTendencia === "subindo" ? "↑ subindo" : "estável"}</div></div>
        </div>
      )}

      <div className="rb-grid">
        <div>
          <h3 className="rb-sec-title">Linha do tempo</h3>
          <p className="rb-sec-sub">Todos os domínios costurados — reprodução, sanidade, nutrição e produção em uma história só.</p>
          {eventos.length === 0
            ? <div className="rb-empty">Nenhum lançamento ainda. Registre o primeiro evento reprodutivo.</div>
            : <Timeline eventos={eventos} />}
        </div>
        <div>
          <div className="rb-box">
            <h4>Estado atual</h4>
            <div className="rb-kv"><span>Grupo / lote</span><b>{a.grupoNome ?? "—"}</b></div>
            <div className="rb-kv"><span>Setor</span><b>{a.setor ?? "—"}</b></div>
            <div className="rb-kv"><span>Status reprod.</span><b>{r?.statusReprodutivo ?? "—"}</b></div>
          </div>
          <div className="rb-box">
            <h4>Genealogia</h4>
            <div className="rb-ped">
              {a.maeId ? <div>Mãe <button onClick={() => onAbrirAnimal(a.maeId!)}>{a.maeNome ?? "—"} #{a.maeNumero ?? "—"}</button></div> : <div>Mãe <span style={{ color: "var(--ink-mute)" }}>—</span></div>}
              <div>Pai <span style={{ color: "var(--ink-mute)" }}>{a.paiNome ?? "—"}</span></div>
            </div>
          </div>
          {r && (
            <div className="rb-box">
              <h4>Produção · {r.ordemLactacao}ª lactação</h4>
              <div className="rb-kv"><span>Média atual</span><b>{r.producaoMediaDia} L/dia</b></div>
              <div className="rb-kv"><span>Proj. 305d</span><b>{r.producao305?.toLocaleString("pt-BR")} L</b></div>
            </div>
          )}
        </div>
      </div>

      {registrando && <EventoForm animalId={animalId} onFechar={() => setRegistrando(false)} onSalvo={() => { setRegistrando(false); recarregarEventos(); recarregar(); }} />}
    </main>
  );
}
