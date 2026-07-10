import { useState } from "react";
import { Loader } from "../../components/Loading";
import { useTalhoes, usePassadas, type PassadaDTO } from "../api";
import { LavouraDomainView } from "./LavouraDomainView";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebButton } from "@/components/rb/RebButton";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebPill, RebEmpty, RebAnm } from "@/components/rb/RebPrimitives";
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
    { nome: "Fase", render: (r) => <RebPill>{FASES_LABEL[r.fase]}</RebPill> },
    { nome: "Cereja", render: (r) => `${Math.round(r.maturacaoCereja ?? 0)}%` },
    { nome: "Verde", render: (r) => `${Math.round(r.maturacaoVerde ?? 0)}%` },
    { nome: "Boia/passa", render: (r) => `${Math.round(r.maturacaoBoia ?? 0)}%` },
    { nome: "Esperado", render: (r) => r.produtividadeEsperada ? `${r.produtividadeEsperada} sc/ha` : "—" },
  ],
};

export function ColheitaTab({ onAbrirTalhao }: { onAbrirTalhao: (id: string) => void }) {
  const { data, loading } = useTalhoes({ estado: "ATIVO" });
  const [aba, setAba] = useState<"painel" | "passadas">("painel");
  if (loading) return <RebMain><RebHeader eyebrow="Lavoura" title="Colheita" /><Loader /></RebMain>;

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
          <div className="flex gap-1.5">
            <RebButton aria-pressed onClick={() => setAba("painel")}>Painel</RebButton>
            <RebButton onClick={() => setAba("passadas")}>Passadas registradas</RebButton>
          </div>
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
    <RebMain>
      <RebHeader
        eyebrow="Lavoura · colheita 2026"
        title="Passadas registradas"
        actions={<RebButton onClick={onVoltarPainel}>← Painel</RebButton>}
      />
      {loading ? (
        <Loader />
      ) : erro ? (
        <p className="text-sm text-prejuizo">Erro: {erro}</p>
      ) : (
        <>
          <RebKpiStrip cols={4}>
            <RebKpi lab="Passadas" val={passadas.length} />
            <RebKpi lab="Talhões colhidos" val={new Set(passadas.map((p) => p.talhaoId)).size} />
            <RebKpi lab="Litros cereja" val={Math.round(totalLitros).toLocaleString("pt-BR")} sufixo="L" />
            <RebKpi lab="Sc beneficiadas" val={Math.round(totalSc)} sufixo="sc" />
          </RebKpiStrip>
          <h2 className="mb-3 font-serif text-xl font-medium">Histórico</h2>
          {passadas.length === 0 ? (
            <RebEmpty>Nenhuma passada registrada ainda. Abra um talhão e use <b>+ Registrar operação</b> → Colheita.</RebEmpty>
          ) : (
            <RebTable>
              <thead><tr><th>Data</th><th>Talhão</th><th>Passada</th><th>Litros cereja</th><th>Rend. (L/sc)</th><th>Sc beneficiadas</th></tr></thead>
              <tbody>
                {passadas.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.data).toLocaleDateString("pt-BR")}</td>
                    <td><RebAnm>{p.talhaoNome ? `${p.talhaoNome} · ${p.talhaoCodigo}` : p.talhaoCodigo || p.talhaoId}</RebAnm></td>
                    <td>{rotuloPassada(p)}</td>
                    <td>{p.litrosCereja.toLocaleString("pt-BR")} L</td>
                    <td>{p.rendimentoLPorSc ? p.rendimentoLPorSc.toLocaleString("pt-BR") : "—"}</td>
                    <td>{Math.round(p.sacasBeneficiadas)} sc</td>
                  </tr>
                ))}
              </tbody>
            </RebTable>
          )}
        </>
      )}
    </RebMain>
  );
}

function rotuloPassada(p: PassadaDTO): string {
  const ord = ORDINAL[p.numero] ?? `${p.numero}ª`;
  const metodo = METODO_LABEL[p.metodo] ?? "passada";
  return `${ord} · ${metodo}`;
}
