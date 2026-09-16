import { useState } from "react";
import type { Lote, Pesagem } from "../types";
import { criarPesagem, type PesagemInput } from "../api";
import { HOJE } from "../HOJE";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { RebSelect } from "@/components/rb/RebSelect";
import { CampoData } from "@/components/CampoData";

type Metodo = Pesagem["metodo"];
const METODOS: { k: Metodo; lab: string; desc: string }[] = [
  { k: "BALANCA_LOTE", lab: "Balança de lote", desc: "Pesa vários animais juntos e divide pelo número de cabeças." },
  { k: "BALANCA_INDIVIDUAL", lab: "Balança individual", desc: "Pesa um animal por vez e tira a média." },
  { k: "FITA_TORACICA", lab: "Fita torácica", desc: "Estima o peso medindo a volta do peito do animal com uma fita." },
  { k: "VISUAL_ESTIMADO", lab: "Estimativa visual", desc: "Peso calculado no olho, sem balança nem fita." },
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
        <RebField label="Data*" style={{ flex: 1 }}>
          <CampoData variante="sublinhado" aria-label="Data" value={data} onChange={setData} max={HOJE} />
        </RebField>
        <RebField label="Peso médio (kg)*" style={{ flex: 1 }}>
          <input type="number" step="0.1" value={pesoMedio} onChange={(e) => setPesoMedio(e.target.value)} />
        </RebField>
        <RebField label="Cabeças pesadas*" style={{ flex: 1 }}>
          <input type="number" value={numCabecas} onChange={(e) => setNumCabecas(e.target.value)} />
        </RebField>
      </div>

      <RebField label="Método*">
        <RebSelect aria-label="Método" value={metodo} onChange={(v) => setMetodo(v as Metodo)}>
          {METODOS.map((m) => <option key={m.k} value={m.k} data-descricao={m.desc}>{m.lab}</option>)}
        </RebSelect>
      </RebField>

      <RebField label="Responsável">
        <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Ex.: Vaqueiro João" />
      </RebField>

      <RebField label="Observação">
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
      </RebField>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
