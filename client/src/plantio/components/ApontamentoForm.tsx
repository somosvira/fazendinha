import { useState } from "react";
import { criarApontamento, useTalhoes } from "../api";
import { HOJE } from "../HOJE";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { fmtMoneyExact } from "@/components/charts";

const num = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export function ApontamentoForm({ safraId, onFechar, onSalvo }: {
  safraId: number;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const { data: talhoes } = useTalhoes({ estado: "TODOS" });

  const [tipo, setTipo] = useState<"MAQUINA" | "HOMEM">("MAQUINA");
  const [data, setData] = useState(HOJE);
  const [talhaoId, setTalhaoId] = useState<string>("");
  const [recurso, setRecurso] = useState("");
  const [operador, setOperador] = useState("");
  const [implemento, setImplemento] = useState("");
  const [horas, setHoras] = useState("");
  const [valorHora, setValorHora] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Prévia do valor total (o backend é a fonte da verdade; só ajuda o usuário).
  const previa = (() => {
    const h = num(horas); const v = num(valorHora);
    return h != null && v != null ? h * v : null;
  })();

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      await criarApontamento({
        safraId,
        talhaoId: talhaoId ? Number(talhaoId) : null,
        data,
        tipo,
        recurso: recurso.trim(),
        operador: operador.trim() || null,
        implemento: tipo === "MAQUINA" ? (implemento.trim() || null) : null,
        horas: num(horas) ?? 0,
        valorHora: num(valorHora),
        observacao: observacao.trim() || null,
      });
      onSalvo();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao salvar.");
      setSalvando(false);
    }
  }

  return (
    <RebModal
      title={`Apontar hora-${tipo === "MAQUINA" ? "máquina" : "homem"}`}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar} disabled={salvando}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !recurso.trim() || !horas.trim()} onClick={salvar}>{salvando ? "Salvando…" : "Apontar"}</RebButton>
        </>
      }
    >
      <>
          <div className="mb-[18px] flex gap-1.5">
            <RebButton aria-pressed={tipo === "MAQUINA"} onClick={() => setTipo("MAQUINA")}>Hora-máquina</RebButton>
            <RebButton aria-pressed={tipo === "HOMEM"} onClick={() => setTipo("HOMEM")}>Hora-homem</RebButton>
          </div>

          <RebField label="Data">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </RebField>

          <RebField label="Talhão">
            <select className="rb-field-select" value={talhaoId} onChange={(e) => setTalhaoId(e.target.value)}>
              <option value="">— (geral / lavoura)</option>
              {talhoes.map((th) => <option key={th.id} value={th.id}>{th.codigo} · {th.nome}</option>)}
            </select>
          </RebField>

          <RebField label={tipo === "MAQUINA" ? "Máquina / recurso*" : "Pessoa / equipe*"}>
            <input value={recurso} onChange={(e) => setRecurso(e.target.value)} placeholder={tipo === "MAQUINA" ? "Ex.: Trator MF 4275" : "Ex.: Diarista / turma de colheita"} />
          </RebField>

          <RebField label="Operador">
            <input value={operador} onChange={(e) => setOperador(e.target.value)} placeholder="Quem operou" />
          </RebField>

          {tipo === "MAQUINA" && (
            <RebField label="Implemento">
              <input value={implemento} onChange={(e) => setImplemento(e.target.value)} placeholder="Ex.: Distribuidor de calcário" />
            </RebField>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <RebField label="Horas*" style={{ flex: 1 }}>
              <input type="number" step="0.1" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="Ex.: 6,5" />
            </RebField>
            <RebField label="Valor / hora (R$)" style={{ flex: 1 }}>
              <input type="number" step="0.01" value={valorHora} onChange={(e) => setValorHora(e.target.value)} />
            </RebField>
          </div>

          {previa != null && (
            <p className="text-sm text-ink-3">Total estimado: <b>{fmtMoneyExact(previa)}</b></p>
          )}

          <RebField label="Observação">
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </RebField>

          {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      </>
    </RebModal>
  );
}
