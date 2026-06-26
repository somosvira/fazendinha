import { useState } from "react";
import { criarDieta, editarDieta, excluirDieta, type DietaDTO } from "../api";

type Props = {
  dieta?: DietaDTO | null;
  onFechar: () => void;
  onSalvo: (d: DietaDTO) => void;
  onExcluido?: () => void;
};

export function DietaForm({ dieta, onFechar, onSalvo, onExcluido }: Props) {
  const [f, setF] = useState({
    nome: dieta?.nome ?? "",
    descricao: dieta?.descricao ?? "",
    pb: dieta?.pb != null ? String(dieta.pb) : "",
    edMcal: dieta?.edMcal != null ? String(dieta.edMcal) : "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const editando = !!dieta;

  async function salvar() {
    if (!f.nome.trim()) { setErro("Informe o nome da dieta."); return; }
    setSalvando(true); setErro(null);
    try {
      const payload = {
        nome: f.nome.trim(),
        descricao: f.descricao || undefined,
        pb: f.pb ? Number(f.pb) : undefined,
        edMcal: f.edMcal ? Number(f.edMcal) : undefined,
      };
      const d = editando ? await editarDieta(dieta!.id, payload) : await criarDieta(payload);
      onSalvo(d);
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  async function confirmarExcluir() {
    if (!dieta) return;
    setSalvando(true); setErro(null);
    try {
      await excluirDieta(dieta.id);
      onExcluido?.();
    } catch (e: any) { setErro(e.message); setConfirmandoExcluir(false); } finally { setSalvando(false); }
  }

  if (confirmandoExcluir && dieta) {
    return (
      <>
        <div className="rb-drawer-bg" onClick={() => !salvando && setConfirmandoExcluir(false)} />
        <aside className="rb-drawer rb-confirm" role="alertdialog">
          <div className="rb-confirm-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h3 style={{ margin: "10px 0 6px", textAlign: "center" }}>Excluir dieta {dieta.nome}?</h3>
          <p style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 13.5, margin: "0 0 18px" }}>
            Só é possível excluir se a dieta não estiver atribuída a nenhum lote.
          </p>
          {erro && <p style={{ color: "var(--neg)", fontSize: 13, marginTop: 10, textAlign: "center" }}>{erro}</p>}
          <div className="rb-drawer-actions" style={{ justifyContent: "space-between", marginTop: 18 }}>
            <button className="rb-btn" onClick={() => setConfirmandoExcluir(false)} disabled={salvando}>Cancelar</button>
            <button className="rb-btn rb-btn-danger" onClick={confirmarExcluir} disabled={salvando}>{salvando ? "Excluindo…" : "Excluir dieta"}</button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer">
        <h3>{editando ? `Editar ${dieta!.nome}` : "Nova dieta"}</h3>
        <label className="rb-fld">Nome*<input value={f.nome} onChange={(e) => set("nome", e.target.value)} autoFocus /></label>
        <label className="rb-fld">Descrição<input value={f.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="ex.: silagem + concentrado 22%" /></label>
        <label className="rb-fld">% Proteína bruta<input type="number" step="0.1" value={f.pb} onChange={(e) => set("pb", e.target.value)} /></label>
        <label className="rb-fld">Energia (Mcal/kg)<input type="number" step="0.01" value={f.edMcal} onChange={(e) => set("edMcal", e.target.value)} /></label>
        {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        <div className="rb-drawer-actions" style={{ justifyContent: "space-between" }}>
          {editando ? (
            <button className="rb-btn rb-btn-danger" onClick={() => setConfirmandoExcluir(true)} disabled={salvando}>Excluir</button>
          ) : <span />}
          <span style={{ display: "flex", gap: 8 }}>
            <button className="rb-btn" onClick={onFechar} disabled={salvando}>Cancelar</button>
            <button className="rb-btn pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
          </span>
        </div>
      </aside>
    </>
  );
}
