import { useState } from "react";
import type { TarefaPlanejada, TipoOperacao } from "../types";
import { criarTarefa, editarTarefa, useTalhoes, useLavouras } from "../api";
import { HOJE } from "../HOJE";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";

// Conjunto de tipos de operação — reusa os mesmos rótulos do OperacaoForm,
// agora num único select (a tarefa não distingue domínio).
const TIPOS: { v: TipoOperacao; label: string }[] = [
  { v: "ADUBACAO_SOLO", label: "Adubação de solo (parcelada)" },
  { v: "ADUBACAO_FOLIAR", label: "Adubação foliar" },
  { v: "CALAGEM", label: "Calagem" },
  { v: "GESSAGEM", label: "Gessagem" },
  { v: "APLICACAO_FUNGICIDA", label: "Aplicação de fungicida" },
  { v: "APLICACAO_INSETICIDA", label: "Aplicação de inseticida" },
  { v: "APLICACAO_HERBICIDA", label: "Aplicação de herbicida" },
  { v: "ROCAGEM_MECANICA", label: "Roçagem mecânica" },
  { v: "CAPINA_MANUAL", label: "Capina manual" },
  { v: "PODA_RECEPA", label: "Poda — Recepa (baixa, 30-40 cm)" },
  { v: "PODA_DECOTE", label: "Poda — Decote (1,80-2,40 m)" },
  { v: "PODA_ESQUELETAMENTO", label: "Poda — Esqueletamento" },
  { v: "PODA_DESPONTE", label: "Poda — Desponte" },
  { v: "DESBROTA", label: "Desbrota" },
  { v: "IRRIGACAO", label: "Irrigação" },
  { v: "REPLANTIO", label: "Replantio (falhas)" },
  { v: "AMOSTRAGEM_SOLO", label: "Amostragem de solo" },
  { v: "AMOSTRAGEM_FOLIAR", label: "Amostragem foliar" },
  { v: "MONITORAMENTO_MIP", label: "Inspeção MIP" },
];

const STATUS: { v: string; label: string }[] = [
  { v: "PLANEJADA", label: "Planejada" },
  { v: "EM_ANDAMENTO", label: "Em andamento" },
  { v: "CONCLUIDA", label: "Concluída" },
  { v: "CANCELADA", label: "Cancelada" },
];

// Converte string de input numérico em number|null (vazio → null). Tolera vírgula pt-BR.
const num = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export function TarefaForm({ modo, safraId, tarefa, onFechar, onSalvo }: {
  modo: "novo" | "realizar";
  safraId: number;
  tarefa?: TarefaPlanejada;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const { data: talhoes } = useTalhoes({ estado: "TODOS" });
  const { data: lavouras } = useLavouras();
  const t = tarefa;

  // Planejado (editável em "novo"; mostrado como referência em "realizar")
  const [descricao, setDescricao] = useState(t?.descricao ?? "");
  const [tipo, setTipo] = useState<string>(t?.tipo ?? TIPOS[0].v);
  const [talhaoId, setTalhaoId] = useState<string>(t?.talhaoId != null ? String(t.talhaoId) : "");
  const [lavouraId, setLavouraId] = useState<string>(t?.lavouraId != null ? String(t.lavouraId) : "");
  const [responsavel, setResponsavel] = useState(t?.responsavel ?? "");
  const [produto, setProduto] = useState(t?.produto ?? "");
  const [unidade, setUnidade] = useState(t?.unidade ?? "");
  const [qtdHaPrev, setQtdHaPrev] = useState(t?.qtdHaPrev != null ? String(t.qtdHaPrev) : "");
  const [qtdTotalPrev, setQtdTotalPrev] = useState(t?.qtdTotalPrev != null ? String(t.qtdTotalPrev) : "");
  const [dataPrevista, setDataPrevista] = useState(t?.dataPrevista ?? "");
  const [custoPrev, setCustoPrev] = useState(t?.custoPrev != null ? String(t.custoPrev) : "");

  // Realizado (modo "realizar")
  const [qtdHaReal, setQtdHaReal] = useState(t?.qtdHaReal != null ? String(t.qtdHaReal) : "");
  const [qtdTotalReal, setQtdTotalReal] = useState(t?.qtdTotalReal != null ? String(t.qtdTotalReal) : "");
  const [dataRealizada, setDataRealizada] = useState(t?.dataRealizada ?? HOJE);
  const [custoReal, setCustoReal] = useState(t?.custoReal != null ? String(t.custoReal) : "");
  const [status, setStatus] = useState<string>(t?.status ?? "CONCLUIDA");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      if (modo === "novo") {
        await criarTarefa({
          safraId,
          descricao: descricao.trim(),
          tipo,
          talhaoId: talhaoId ? Number(talhaoId) : null,
          lavouraId: lavouraId ? Number(lavouraId) : null,
          responsavel: responsavel.trim() || null,
          produto: produto.trim() || null,
          unidade: unidade.trim() || null,
          qtdHaPrev: num(qtdHaPrev),
          qtdTotalPrev: num(qtdTotalPrev),
          dataPrevista: dataPrevista || null,
          custoPrev: num(custoPrev),
        });
      } else if (t) {
        await editarTarefa(t.id, {
          qtdHaReal: num(qtdHaReal),
          qtdTotalReal: num(qtdTotalReal),
          dataRealizada: dataRealizada || null,
          custoReal: num(custoReal),
          status,
        });
      }
      onSalvo();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao salvar.");
      setSalvando(false);
    }
  }

  const titulo = modo === "novo" ? "Nova tarefa" : `Realizar — ${t?.descricao ?? "tarefa"}`;

  return (
    <RebModal
      title={titulo}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar} disabled={salvando}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || (modo === "novo" && !descricao.trim())} onClick={salvar}>
            {salvando ? "Salvando…" : modo === "novo" ? "Criar tarefa" : "Salvar realizado"}
          </RebButton>
        </>
      }
    >
      <>
          {modo === "novo" ? (
            <>
              <RebField label="Descrição*">
                <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: 1ª parcela de N — talhão CAF-12" />
              </RebField>

              <RebField label="Tipo de operação">
                <select className="rb-field-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {TIPOS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </RebField>

              <div style={{ display: "flex", gap: 10 }}>
                <RebField label="Talhão" style={{ flex: 1 }}>
                  <select className="rb-field-select" value={talhaoId} onChange={(e) => setTalhaoId(e.target.value)}>
                    <option value="">— (lavoura toda)</option>
                    {talhoes.map((th) => <option key={th.id} value={th.id}>{th.codigo} · {th.nome}</option>)}
                  </select>
                </RebField>
                <RebField label="Lavoura" style={{ flex: 1 }}>
                  <select className="rb-field-select" value={lavouraId} onChange={(e) => setLavouraId(e.target.value)}>
                    <option value="">—</option>
                    {lavouras.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                </RebField>
              </div>

              <RebField label="Responsável">
                <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem vai executar" />
              </RebField>

              <div style={{ display: "flex", gap: 10 }}>
                <RebField label="Produto / insumo" style={{ flex: 2 }}>
                  <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex.: 20-00-20" />
                </RebField>
                <RebField label="Unidade" style={{ flex: 1 }}>
                  <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="kg/ha" />
                </RebField>
              </div>

              <fieldset style={{ border: "1px solid var(--rule)", borderRadius: 8, padding: 12, margin: "10px 0" }}>
                <legend style={{ fontSize: 13, color: "var(--ink-3)", padding: "0 6px" }}>Previsto</legend>
                <div style={{ display: "flex", gap: 10 }}>
                  <RebField label="Qtd / ha" style={{ flex: 1 }}>
                    <input type="number" step="0.01" value={qtdHaPrev} onChange={(e) => setQtdHaPrev(e.target.value)} />
                  </RebField>
                  <RebField label="Qtd total" style={{ flex: 1 }}>
                    <input type="number" step="0.01" value={qtdTotalPrev} onChange={(e) => setQtdTotalPrev(e.target.value)} />
                  </RebField>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <RebField label="Data prevista" style={{ flex: 1 }}>
                    <input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
                  </RebField>
                  <RebField label="Custo previsto (R$)" style={{ flex: 1 }}>
                    <input type="number" step="0.01" value={custoPrev} onChange={(e) => setCustoPrev(e.target.value)} />
                  </RebField>
                </div>
              </fieldset>
            </>
          ) : (
            <>
              <p className="mt-0 text-sm text-ink-3">
                Planejado: <b>{t?.descricao}</b>
                {t?.dataPrevista ? ` · prev. ${t.dataPrevista}` : ""}
                {t?.custoPrev != null ? ` · R$ ${t.custoPrev.toLocaleString("pt-BR")}` : ""}
              </p>

              <RebField label="Status">
                <select className="rb-field-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
              </RebField>

              <fieldset style={{ border: "1px solid var(--rule)", borderRadius: 8, padding: 12, margin: "10px 0" }}>
                <legend style={{ fontSize: 13, color: "var(--ink-3)", padding: "0 6px" }}>Realizado</legend>
                <div style={{ display: "flex", gap: 10 }}>
                  <RebField label="Qtd / ha" style={{ flex: 1 }}>
                    <input type="number" step="0.01" value={qtdHaReal} onChange={(e) => setQtdHaReal(e.target.value)} />
                  </RebField>
                  <RebField label="Qtd total" style={{ flex: 1 }}>
                    <input type="number" step="0.01" value={qtdTotalReal} onChange={(e) => setQtdTotalReal(e.target.value)} />
                  </RebField>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <RebField label="Data realizada" style={{ flex: 1 }}>
                    <input type="date" value={dataRealizada} onChange={(e) => setDataRealizada(e.target.value)} />
                  </RebField>
                  <RebField label="Custo real (R$)" style={{ flex: 1 }}>
                    <input type="number" step="0.01" value={custoReal} onChange={(e) => setCustoReal(e.target.value)} />
                  </RebField>
                </div>
              </fieldset>
            </>
          )}

          {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      </>
    </RebModal>
  );
}
