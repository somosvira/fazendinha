import { useState } from "react";
import { useTalhoes } from "../api";
import { LavouraDomainView } from "./LavouraDomainView";
import { DOMAINS, type DomainConfig } from "../domains";
import { resumos as mockResumos } from "../mock";
import { prontosParaColher, emColheita } from "../lib/worklists";
import { FASES_LABEL } from "../lib/fenologia";
import type { ResumoTalhao, Talhao } from "../types";
import { eventos as mockEventos } from "../mock";

/* Domínio "Colheita" — fica num arquivo separado porque os critérios de
 * worklist são específicos (cereja > 60% é o gatilho de derriça). */
const colheitaCfg: DomainConfig = {
  titulo: "Colheita 2026",
  eyebrow: "Lavoura · Rio Novo",
  kpis: (rs) => {
    const cereja = rs.filter((r) => (r.maturacaoCereja ?? 0) >= 60).length;
    const colhendo = rs.filter((r) => r.fase === "COLHEITA").length;
    const totalSc = rs.reduce((a, r) => a + (r.produtividadeEsperada ?? 0), 0);
    const cerejaMedia = rs.length ? Math.round(rs.reduce((a, r) => a + (r.maturacaoCereja ?? 0), 0) / rs.length) : 0;
    return [
      { lab: "Prontos pra colher", val: String(cereja), d: "cereja ≥ 60%" },
      { lab: "Em derriça", val: String(colhendo) },
      { lab: "Cereja média", val: `${cerejaMedia}`, sufixo: "%" },
      { lab: "Total esperado", val: String(Math.round(totalSc)), sufixo: "sc/ha" },
    ];
  },
  worklists: [
    { id: "prontos", label: "Prontos pra colher", selecionar: prontosParaColher },
    { id: "colhendo", label: "Em colheita", selecionar: emColheita },
    { id: "verdes", label: "Maturação verde (atrasados)", selecionar: (rs) => rs.filter((r) => r.fase === "MATURACAO_VERDE") },
  ],
  colunas: [
    { nome: "Fase", render: (r) => <span className="rb-pill">{FASES_LABEL[r.fase]}</span> },
    { nome: "Cereja", render: (r) => `${Math.round(r.maturacaoCereja ?? 0)}%` },
    { nome: "Verde", render: (r) => `${Math.round(r.maturacaoVerde ?? 0)}%` },
    { nome: "Boia/passa", render: (r) => `${Math.round(r.maturacaoBoia ?? 0)}%` },
    { nome: "Esperado", render: (r) => r.produtividadeEsperada ? `${r.produtividadeEsperada} sc/ha` : "—" },
  ],
};

export function ColheitaTab({ onAbrirTalhao }: { onAbrirTalhao: (id: string) => void }) {
  const { data, loading } = useTalhoes({ estado: "ATIVO" });
  const [aba, setAba] = useState<"painel" | "passadas">("painel");
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Lavoura</div><div className="rb-head"><h1>Colheita</h1></div><p className="rb-sub">Carregando…</p></main>;

  const resumos: ResumoTalhao[] = data.map((t) => mockResumos.find((x) => x.talhaoId === t.id) ?? ({ talhaoId: t.id, fase: "REPOUSO" } as ResumoTalhao));
  const nomes = Object.fromEntries(data.map((t) => [t.id, { nome: t.nome, codigo: t.codigo }]));

  if (aba === "passadas") return <PassadasView talhoes={data} onVoltarPainel={() => setAba("painel")} />;

  return (
    <>
      <LavouraDomainView
        config={colheitaCfg}
        resumos={resumos}
        nomes={nomes}
        onAbrirTalhao={onAbrirTalhao}
        dicaLinha="clique num talhão para abrir o cockpit"
        controles={
          <>
            <div className="rb-seg" style={{ display: "flex", gap: 6 }}>
              <button className="rb-btn" aria-pressed onClick={() => setAba("painel")}>Painel</button>
              <button className="rb-btn" onClick={() => setAba("passadas")}>Passadas registradas</button>
            </div>
          </>
        }
      />
    </>
  );
}

function PassadasView({ talhoes, onVoltarPainel }: { talhoes: Talhao[]; onVoltarPainel: () => void }) {
  // Reaproveita os eventos do mock para mostrar histórico real.
  const passadas = mockEventos.filter((e) => e.dominio === "colheita").sort((a, b) => b.data.localeCompare(a.data));
  const totalSc = passadas.reduce((a, e) => {
    const m = e.impacto?.match(/(\d+(?:[\.,]\d+)?)\s*sc/);
    return a + (m ? Number(m[1].replace(",", ".")) : 0);
  }, 0);
  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Lavoura · colheita 2026</div>
      <div className="rb-head">
        <h1>Passadas registradas</h1>
        <button className="rb-btn" onClick={onVoltarPainel}>← Painel</button>
      </div>
      <div className="rb-kstrip" style={{ ["--cols" as any]: 3 }}>
        <div className="rb-k"><div className="lab">Passadas</div><div className="val">{passadas.length}</div></div>
        <div className="rb-k"><div className="lab">Talhões colhidos</div><div className="val">{new Set(passadas.map((p) => p.talhaoId)).size}</div></div>
        <div className="rb-k"><div className="lab">Sc beneficiadas</div><div className="val">{Math.round(totalSc)}<u>sc</u></div></div>
      </div>
      <h2 className="rb-sec-title">Histórico</h2>
      {passadas.length === 0 ? (
        <div className="rb-empty">Nenhuma passada registrada ainda. Abra um talhão e use <b>+ Registrar operação</b> → Colheita.</div>
      ) : (
        <div className="rb-tbl-wrap"><table className="rb-tbl">
          <thead><tr><th>Data</th><th>Talhão</th><th>Operação</th><th>Detalhe</th><th>Saída</th></tr></thead>
          <tbody>
            {passadas.map((p) => {
              const t = talhoes.find((x) => x.id === p.talhaoId);
              return (
                <tr key={p.id}>
                  <td>{new Date(p.data).toLocaleDateString("pt-BR")}</td>
                  <td className="rb-anm">{t ? `${t.nome} · ${t.codigo}` : p.talhaoId}</td>
                  <td>{p.titulo}</td>
                  <td>{p.detalhe ?? "—"}</td>
                  <td>{p.impacto ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
    </main>
  );
}
