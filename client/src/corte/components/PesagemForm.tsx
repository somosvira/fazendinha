import { useState } from "react";
import { criarPesagemSchema } from "@rionovo/shared";
import type { Lote, Pesagem } from "../types";
import { useRegistrarPesagem, type PesagemInput } from "../api";
import { HOJE } from "../HOJE";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { useToast } from "@/components/Toast";

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
  const [erro, setErro] = useState<string | null>(null);
  const registrar = useRegistrarPesagem();
  const toast = useToast();

  // Offline-aware: `mutate` já aplica o patch otimista e enfileira na hora
  // (não espera rede) — por isso fecha o drawer direto, sem "Salvando…".
  // Erro real do servidor (chegado bem depois, quando a fila sincronizar)
  // vira toast + desfaz o otimista sozinho (useOfflineMutation).
  function salvar() {
    const payload: PesagemInput = {
      data: data || HOJE,
      pesoMedio: Number(pesoMedio),
      numCabecas: Number(numCabecas),
      metodo,
      // Opcionais: só entram no payload quando preenchidos.
      responsavel: responsavel || undefined,
      observacao: observacao || undefined,
    };
    // Mesmo schema Zod do backend (packages/shared) — pega erro de input
    // (ex.: peso ≤ 0) antes de enfileirar.
    const valido = criarPesagemSchema.safeParse(payload);
    if (!valido.success) {
      setErro(valido.error.issues[0]?.message ?? "Dado inválido.");
      return;
    }
    registrar.mutate(
      { ...payload, loteId: lote.id },
      { onError: (e: any) => toast.error("Erro ao salvar a pesagem", e?.message ?? undefined) },
    );
    onSalvo();
  }

  return (
    <RebModal
      title={`Pesar ${lote.codigo}`}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={!pesoMedio || !numCabecas} onClick={salvar}>Salvar pesagem</RebButton>
        </>
      }
    >
      <p className="text-sm text-ink-3">{lote.nome} · {lote.numCabecas} cabeças. O GMD é recalculado a partir da pesagem anterior.</p>
      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Data*" style={{ flex: 1 }}>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} max={HOJE} />
        </RebField>
        <RebField label="Peso médio (kg)*" style={{ flex: 1 }}>
          <input type="number" step="0.1" value={pesoMedio} onChange={(e) => setPesoMedio(e.target.value)} />
        </RebField>
        <RebField label="Cabeças pesadas*" style={{ flex: 1 }}>
          <input type="number" value={numCabecas} onChange={(e) => setNumCabecas(e.target.value)} />
        </RebField>
      </div>

      <RebField label="Método*">
        <select className="rb-field-select" value={metodo} onChange={(e) => setMetodo(e.target.value as Metodo)}>
          {METODOS.map((m) => <option key={m.k} value={m.k}>{m.lab}</option>)}
        </select>
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
