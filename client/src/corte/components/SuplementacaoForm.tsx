import { useState } from "react";
import type { Lote, TipoSuplemento } from "../types";
import { registrarSuplementacao, type SuplementacaoInput } from "../api";
import { HOJE } from "../HOJE";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { fmtMoneyExact, fmtBRL } from "@/components/charts";

/* Catálogo de suplementos típicos Sul de Minas (espelha o da NutricaoTab). O
 * valor é o enum TipoSuplemento em UPPERCASE; o resto pré-preenche o formulário. */
const SUPLEMENTOS: { v: TipoSuplemento; lab: string; produto: string; gCabDia: number; custoKg: number }[] = [
  { v: "MINERAL", lab: "Mineral 80", produto: "Mineral 80", gCabDia: 80, custoKg: 5.20 },
  { v: "PROTEICO_SECA", lab: "Proteinado 30% PB · seca", produto: "Proteinado 30% PB", gCabDia: 800, custoKg: 4.80 },
  { v: "ENERGETICO_AGUAS", lab: "Energético 18% PB + ureia · águas", produto: "Energético 18% PB", gCabDia: 500, custoKg: 4.30 },
  { v: "RACAO_CONFINAMENTO", lab: "Ração alto-grão (terminação)", produto: "Ração confinamento alto-grão", gCabDia: 9_500, custoKg: 1.95 },
  { v: "SAL_BRANCO", lab: "Sal branco (manutenção)", produto: "Sal branco", gCabDia: 60, custoKg: 1.10 },
];

/* Drawer de registro de suplementação — espelha o PesagemForm. O select de tipo
 * pré-preenche produto/consumo/custo, mas tudo é editável.
 * CRÍTICO: campos opcionais vazios são OMITIDOS (undefined), nunca null/""; o
 * `tipo` é sempre um enum em UPPERCASE vindo do select tipado. */
export function SuplementacaoForm({ lote, onFechar, onSalvo }: { lote: Lote; onFechar: () => void; onSalvo: () => void }) {
  const [tipo, setTipo] = useState<TipoSuplemento>("MINERAL");
  const [dataInicio, setDataInicio] = useState<string>(HOJE);
  const [dataFim, setDataFim] = useState<string>("");
  const [produto, setProduto] = useState<string>(SUPLEMENTOS[0].produto);
  const [consumo, setConsumo] = useState<string>(String(SUPLEMENTOS[0].gCabDia));
  const [custoKg, setCustoKg] = useState<string>(String(SUPLEMENTOS[0].custoKg));
  const [observacao, setObservacao] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Trocar o tipo repõe os defaults editáveis do catálogo.
  function escolherTipo(v: TipoSuplemento) {
    setTipo(v);
    const s = SUPLEMENTOS.find((x) => x.v === v);
    if (s) { setProduto(s.produto); setConsumo(String(s.gCabDia)); setCustoKg(String(s.custoKg)); }
  }

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload: SuplementacaoInput = {
        dataInicio: dataInicio || HOJE,
        tipo,
        produto,
        consumoCabecaDiaG: Number(consumo),
        // Opcionais: só entram no payload quando preenchidos (undefined caso contrário).
        dataFim: dataFim || undefined,
        custoKg: custoKg ? Number(custoKg) : undefined,
        observacao: observacao || undefined,
      };
      await registrarSuplementacao(lote.id, payload);
      onSalvo();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao salvar.");
      setSalvando(false);
    }
  }

  const custoCabDia = consumo && custoKg ? (Number(consumo) / 1000) * Number(custoKg) : 0;

  return (
    <RebModal
      title={`Registrar suplementação — ${lote.codigo}`}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar} disabled={salvando}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !produto || !consumo} onClick={salvar}>{salvando ? "Salvando…" : "Salvar suplementação"}</RebButton>
        </>
      }
    >
      <p className="text-sm text-ink-3">{lote.nome} · {lote.numCabecas} cabeças. Define o protocolo de suplemento vigente do lote.</p>

      <RebField label="Tipo de suplemento*">
        <select className="rb-field-select" value={tipo} onChange={(e) => escolherTipo(e.target.value as TipoSuplemento)}>
          {SUPLEMENTOS.map((s) => <option key={s.v} value={s.v}>{s.lab}</option>)}
        </select>
      </RebField>

      <RebField label="Produto*">
        <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex.: Proteinado 30% PB" />
      </RebField>

      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Consumo (g/cab/dia)*" style={{ flex: 1 }}>
          <input type="number" value={consumo} onChange={(e) => setConsumo(e.target.value)} />
        </RebField>
        <RebField label="Custo (R$/kg)" style={{ flex: 1 }}>
          <input type="number" step="0.01" value={custoKg} onChange={(e) => setCustoKg(e.target.value)} />
        </RebField>
      </div>

      {custoCabDia > 0 && (
        <p className="text-sm text-ink-3" style={{ marginTop: 0 }}>
          Custo estimado: <b>{fmtMoneyExact(custoCabDia)}/cab/dia</b>
          {" · "}{fmtBRL(custoCabDia * lote.numCabecas * 30, { compact: false })}/mês no lote.
        </p>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Início*" style={{ flex: 1 }}>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} max={HOJE} />
        </RebField>
        <RebField label="Fim (opcional)" style={{ flex: 1 }}>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </RebField>
      </div>

      <RebField label="Observação">
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
      </RebField>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
