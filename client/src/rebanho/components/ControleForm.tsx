import { useState } from "react";
import { registrarControle, type ModoProducao, type ControlePayload } from "../api";
import { HOJE } from "../HOJE";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";

export function ControleForm({ animalId, modo, onFechar, onSalvo }: {
  animalId: string;
  modo: ModoProducao;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [f, setF] = useState({ data: HOJE, peso1: "", peso2: "", peso3: "", pesoTotal: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const num = (v: string) => (v.trim() !== "" ? Number(v) : undefined);

  async function salvar() {
    const p: ControlePayload = { data: f.data };
    if (modo === "ORDENHA") { p.peso1 = num(f.peso1); p.peso2 = num(f.peso2); p.peso3 = num(f.peso3); }
    else { p.pesoTotal = num(f.pesoTotal); }
    if ((p.peso1 ?? p.peso2 ?? p.peso3 ?? p.pesoTotal) == null) { setErro("Informe ao menos um peso."); return; }
    setSalvando(true); setErro(null);
    try {
      await registrarControle(animalId, p);
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <RebModal
      title="Registrar controle leiteiro"
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <label className="rb-fld">Data*<input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} /></label>
      {modo === "ORDENHA" ? (
        <>
          <label className="rb-fld">1ª ordenha (manhã) · L<input type="number" min={0} step="0.1" value={f.peso1} onChange={(e) => set("peso1", e.target.value)} /></label>
          <label className="rb-fld">2ª ordenha (tarde) · L<input type="number" min={0} step="0.1" value={f.peso2} onChange={(e) => set("peso2", e.target.value)} /></label>
          <label className="rb-fld">3ª ordenha (noite) · L<input type="number" min={0} step="0.1" value={f.peso3} onChange={(e) => set("peso3", e.target.value)} /></label>
        </>
      ) : (
        <label className="rb-fld">Total do dia · L*<input type="number" min={0} step="0.1" value={f.pesoTotal} onChange={(e) => set("pesoTotal", e.target.value)} /></label>
      )}
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
