import { useState } from "react";
import { criarApontamento, useTalhoes } from "../api";
import { HOJE } from "../HOJE";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";

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

          <div className="rb-fld">
            <label>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          <div className="rb-fld">
            <label>Talhão</label>
            <select value={talhaoId} onChange={(e) => setTalhaoId(e.target.value)}>
              <option value="">— (geral / lavoura)</option>
              {talhoes.map((th) => <option key={th.id} value={th.id}>{th.codigo} · {th.nome}</option>)}
            </select>
          </div>

          <div className="rb-fld">
            <label>{tipo === "MAQUINA" ? "Máquina / recurso*" : "Pessoa / equipe*"}</label>
            <input value={recurso} onChange={(e) => setRecurso(e.target.value)} placeholder={tipo === "MAQUINA" ? "Ex.: Trator MF 4275" : "Ex.: Diarista / turma de colheita"} />
          </div>

          <div className="rb-fld">
            <label>Operador</label>
            <input value={operador} onChange={(e) => setOperador(e.target.value)} placeholder="Quem operou" />
          </div>

          {tipo === "MAQUINA" && (
            <div className="rb-fld">
              <label>Implemento</label>
              <input value={implemento} onChange={(e) => setImplemento(e.target.value)} placeholder="Ex.: Distribuidor de calcário" />
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Horas*</label>
              <input type="number" step="0.1" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="Ex.: 6,5" />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Valor / hora (R$)</label>
              <input type="number" step="0.01" value={valorHora} onChange={(e) => setValorHora(e.target.value)} />
            </div>
          </div>

          {previa != null && (
            <p className="text-sm text-ink-3">Total estimado: <b>{previa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b></p>
          )}

          <div className="rb-fld">
            <label>Observação</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>

          {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      </>
    </RebModal>
  );
}
