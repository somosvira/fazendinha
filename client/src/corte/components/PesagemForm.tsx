import { useState } from "react";
import type { Lote, Pesagem } from "../types";
import { criarPesagem, type PesagemInput } from "../api";
import { HOJE } from "../HOJE";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";

type Metodo = Pesagem["metodo"];
const METODOS: { k: Metodo; lab: string }[] = [
  { k: "BALANCA_LOTE", lab: "Balança de lote" },
  { k: "BALANCA_INDIVIDUAL", lab: "Balança individual" },
  { k: "FITA_TORACICA", lab: "Fita torácica" },
  { k: "VISUAL_ESTIMADO", lab: "Estimativa visual" },
];

/* Drawer de registro de pesagem — espelha o OperacaoForm do plantio.
 * CRÍTICO: campos opcionais vazios são OMITIDOS (undefined), nunca enviados
 * como null/""; o método é sempre um enum em UPPERCASE. */
export function PesagemForm({ lote, onFechar, onSalvo }: { lote: Lote; onFechar: () => void; onSalvo: () => void }) {
  const [data, setData] = useState<string>(HOJE);
  const [pesoMedio, setPesoMedio] = useState<string>(String(lote.resumo?.pesoMedio ?? ""));
  const [numCabecas, setNumCabecas] = useState<string>(String(lote.numCabecas ?? ""));
  const [metodo, setMetodo] = useState<Metodo>("BALANCA_LOTE");
  const [responsavel, setResponsavel] = useState<string>("");
  const [observacao, setObservacao] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload: PesagemInput = {
        data: data || HOJE,
        pesoMedio: Number(pesoMedio),
        numCabecas: Number(numCabecas),
        metodo,
        // Opcionais: só entram no payload quando preenchidos.
        responsavel: responsavel || undefined,
        observacao: observacao || undefined,
      };
      await criarPesagem(lote.id, payload);
      onSalvo();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <RebModal
      title={`Pesar ${lote.codigo}`}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !pesoMedio || !numCabecas} onClick={salvar}>{salvando ? "Salvando…" : "Salvar pesagem"}</RebButton>
        </>
      }
    >
      <p className="text-sm text-ink-3">{lote.nome} · {lote.numCabecas} cabeças. O GMD é recalculado a partir da pesagem anterior.</p>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="rb-fld" style={{ flex: 1 }}>
          <label>Data*</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} max={HOJE} />
        </div>
        <div className="rb-fld" style={{ flex: 1 }}>
          <label>Peso médio (kg)*</label>
          <input type="number" step="0.1" value={pesoMedio} onChange={(e) => setPesoMedio(e.target.value)} />
        </div>
        <div className="rb-fld" style={{ flex: 1 }}>
          <label>Cabeças pesadas*</label>
          <input type="number" value={numCabecas} onChange={(e) => setNumCabecas(e.target.value)} />
        </div>
      </div>

      <div className="rb-fld">
        <label>Método*</label>
        <select value={metodo} onChange={(e) => setMetodo(e.target.value as Metodo)}>
          {METODOS.map((m) => <option key={m.k} value={m.k}>{m.lab}</option>)}
        </select>
      </div>

      <div className="rb-fld">
        <label>Responsável</label>
        <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Ex.: Vaqueiro João" />
      </div>

      <div className="rb-fld">
        <label>Observação</label>
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
      </div>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
