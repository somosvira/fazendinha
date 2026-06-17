import { useState } from "react";
import { criarDieta, type DietaDTO } from "../api";
export function DietaForm({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: (d: DietaDTO) => void }) {
  const [f, setF] = useState({ nome: "", descricao: "", pb: "", edMcal: "" });
  const [erro, setErro] = useState<string | null>(null); const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  async function salvar() { setSalvando(true); setErro(null); try { const d = await criarDieta({ nome: f.nome, descricao: f.descricao || undefined, pb: f.pb ? Number(f.pb) : undefined, edMcal: f.edMcal ? Number(f.edMcal) : undefined }); onSalvo(d); } catch (e: any) { setErro(e.message); } finally { setSalvando(false); } }
  return (<><div className="rb-drawer-bg" onClick={onFechar} /><aside className="rb-drawer"><h3>Nova dieta</h3>
    <label className="rb-fld">Nome*<input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></label>
    <label className="rb-fld">Descrição<input value={f.descricao} onChange={(e) => set("descricao", e.target.value)} /></label>
    <label className="rb-fld">% Proteína bruta<input type="number" value={f.pb} onChange={(e) => set("pb", e.target.value)} /></label>
    <label className="rb-fld">Energia (Mcal/kg)<input type="number" value={f.edMcal} onChange={(e) => set("edMcal", e.target.value)} /></label>
    {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
    <div className="rb-drawer-actions"><button className="rb-btn" onClick={onFechar}>Cancelar</button><button className="rb-btn pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button></div>
  </aside></>); }
