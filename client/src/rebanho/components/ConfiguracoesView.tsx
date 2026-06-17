import { useState } from "react";
import { useConfig, salvarConfig, type ModoProducao } from "../api";

const MODOS: { id: ModoProducao; titulo: string; desc: string }[] = [
  { id: "ORDENHA", titulo: "Controle leiteiro", desc: "Peso por ordenha (manhã/tarde/noite) por vaca — controle individual." },
  { id: "TOTAL_DIARIO", titulo: "Total diário", desc: "Um total de leite por vaca a cada dia, sem separar as ordenhas." },
  { id: "TANQUE_LOTE", titulo: "Tanque / lote", desc: "Litros do tanque ou lote; a produção por vaca vem por rateio." },
];

export function ConfiguracoesView() {
  const { data, loading, erro, recarregar } = useConfig();
  const [salvando, setSalvando] = useState<ModoProducao | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Configurações</div><div className="rb-head"><h1>Configurações</h1></div><p className="rb-sub">Carregando…</p></main>;
  if (erro || !data) return <main className="rb-main"><div className="rb-head"><h1>Configurações</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;

  const escolher = async (modo: ModoProducao) => {
    if (modo === data.producaoModo || salvando) return;
    setSalvando(modo); setErroSalvar(null); setFeedback(null);
    try {
      await salvarConfig(modo);
      recarregar();
      setFeedback("Modo de produção atualizado. O rebanho foi recalculado.");
    } catch (e: any) {
      setErroSalvar(e.message);
    } finally {
      setSalvando(null);
    }
  };

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Configurações · Sítio São Francisco</div>
      <div className="rb-head"><h1>Configurações</h1></div>

      <h2 className="rb-sec-title">Como a fazenda mede o leite?</h2>
      <p className="rb-sec-sub">Define como a produção é registrada e como a média por vaca é calculada. Trocar o modo recalcula todo o rebanho.</p>

      <div className="rb-dcards" role="radiogroup" aria-label="Modo de produção">
        {MODOS.map((m) => {
          const ativo = data.producaoModo === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              className={"rb-dcard" + (ativo ? " on" : "")}
              onClick={() => escolher(m.id)}
              disabled={salvando != null}
            >
              <h4>{m.titulo}<span className="go">{ativo ? "✓ atual" : salvando === m.id ? "salvando…" : "selecionar"}</span></h4>
              <ul><li>{m.desc}</li></ul>
            </button>
          );
        })}
      </div>

      {feedback && <p className="rb-sub" style={{ marginTop: 14, color: "var(--pos)" }}>{feedback}</p>}
      {erroSalvar && <p className="rb-sub" style={{ marginTop: 14, color: "var(--neg)" }}>Erro: {erroSalvar}</p>}
    </main>
  );
}
