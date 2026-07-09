import { useState } from "react";
import { Loader } from "../../components/Loading";
import { useTalhoes, usePassadas, type PassadaDTO } from "../api";
import { LavouraDomainView } from "./LavouraDomainView";
import { DOMAINS, type DomainConfig } from "../domains";
import { prontosParaColher, emColheita } from "../lib/worklists";
import { FASES_LABEL } from "../lib/fenologia";
import type { ResumoTalhao } from "../types";

const METODO_LABEL: Record<string, string> = {
  DERRICA_PANO: "derriça no pano",
  DERRICA_MECANIZADA: "derriça mecanizada",
  SELETIVA: "colheita seletiva",
  VARRICAO: "varrição",
};
const ORDINAL = ["", "1ª", "2ª", "3ª", "4ª", "5ª", "6ª"];

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
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Lavoura</div><div className="rb-head"><h1>Colheita</h1></div><Loader /></main>;

  // Resumo real embutido em cada talhão (.resumo); filtra nulos (talhão sem resumo).
  const resumos: ResumoTalhao[] = data.map((t) => t.resumo).filter(Boolean) as ResumoTalhao[];
  const nomes = Object.fromEntries(data.map((t) => [t.id, { nome: t.nome, codigo: t.codigo }]));

  if (aba === "passadas") return <PassadasView onVoltarPainel={() => setAba("painel")} />;

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

function PassadasView({ onVoltarPainel }: { onVoltarPainel: () => void }) {
  // Histórico real de derriças (PassadaColheita) via GET /plantio/passadas.
  const { data: passadas, loading, erro } = usePassadas();
  const totalSc = passadas.reduce((a, p) => a + (p.sacasBeneficiadas ?? 0), 0);
  const totalLitros = passadas.reduce((a, p) => a + (p.litrosCereja ?? 0), 0);
  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Lavoura · colheita 2026</div>
      <div className="rb-head">
        <h1>Passadas registradas</h1>
        <button className="rb-btn" onClick={onVoltarPainel}>← Painel</button>
      </div>
      {loading ? (
        <Loader />
      ) : erro ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p>
      ) : (
        <>
          <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
            <div className="rb-k"><div className="lab">Passadas</div><div className="val">{passadas.length}</div></div>
            <div className="rb-k"><div className="lab">Talhões colhidos</div><div className="val">{new Set(passadas.map((p) => p.talhaoId)).size}</div></div>
            <div className="rb-k"><div className="lab">Litros cereja</div><div className="val">{Math.round(totalLitros).toLocaleString("pt-BR")}<u>L</u></div></div>
            <div className="rb-k"><div className="lab">Sc beneficiadas</div><div className="val">{Math.round(totalSc)}<u>sc</u></div></div>
          </div>
          <h2 className="rb-sec-title">Histórico</h2>
          {passadas.length === 0 ? (
            <div className="rb-empty">Nenhuma passada registrada ainda. Abra um talhão e use <b>+ Registrar operação</b> → Colheita.</div>
          ) : (
            <div className="rb-tbl-wrap"><table className="rb-tbl">
              <thead><tr><th>Data</th><th>Talhão</th><th>Passada</th><th>Litros cereja</th><th>Rend. (L/sc)</th><th>Sc beneficiadas</th></tr></thead>
              <tbody>
                {passadas.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.data).toLocaleDateString("pt-BR")}</td>
                    <td className="rb-anm">{p.talhaoNome ? `${p.talhaoNome} · ${p.talhaoCodigo}` : p.talhaoCodigo || p.talhaoId}</td>
                    <td>{rotuloPassada(p)}</td>
                    <td>{p.litrosCereja.toLocaleString("pt-BR")} L</td>
                    <td>{p.rendimentoLPorSc ? p.rendimentoLPorSc.toLocaleString("pt-BR") : "—"}</td>
                    <td>{Math.round(p.sacasBeneficiadas)} sc</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </>
      )}
    </main>
  );
}

function rotuloPassada(p: PassadaDTO): string {
  const ord = ORDINAL[p.numero] ?? `${p.numero}ª`;
  const metodo = METODO_LABEL[p.metodo] ?? "passada";
  return `${ord} · ${metodo}`;
}
