import { useState } from "react";
import { usePropriedades, criarPropriedade, editarPropriedade, type PropriedadeDTO, type PropriedadeInput } from "../api";

// Seletor de sítio + cadastro. Com 1 propriedade a camada é quase invisível
// (só um link discreto pra criar a 2ª); com ≥2 vira o seletor Consolidado/Sítio.
export function PropriedadeSelector({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
  const { data: props, loading, recarregar } = usePropriedades();
  const [gerenciar, setGerenciar] = useState(false);
  const ativos = props.filter((p) => p.ativo);

  if (loading) return null;

  return (
    <div className="propriedade-selector" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
      {ativos.length >= 2 ? (
        <>
          <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Sítio:</span>
          <select value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} style={{ padding: "4px 8px" }}>
            <option value="">Consolidado</option>
            {ativos.map((p) => <option key={p.id} value={p.id}>{p.apelido || p.nome}</option>)}
          </select>
          <button className="rb-btn" type="button" onClick={() => setGerenciar(true)}>Gerenciar</button>
        </>
      ) : (
        <button className="rb-btn" type="button" onClick={() => setGerenciar(true)} style={{ fontSize: 12, opacity: 0.65 }}>＋ Propriedade</button>
      )}
      {gerenciar && <GerenciarPropriedades propriedades={props} onFechar={() => setGerenciar(false)} onMudou={recarregar} />}
    </div>
  );
}

function GerenciarPropriedades({ propriedades, onFechar, onMudou }: { propriedades: PropriedadeDTO[]; onFechar: () => void; onMudou: () => void }) {
  const [editando, setEditando] = useState<PropriedadeDTO | "nova" | null>(null);

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer">
        <h3>Propriedades</h3>
        <p className="rb-sub" style={{ margin: "0 0 12px", fontSize: 12.5 }}>Sítios da fazenda. Cada animal e lote pertence a um sítio; a principal é o default.</p>

        {propriedades.length === 0 ? <p className="rb-sub" style={{ fontStyle: "italic" }}>Nenhuma propriedade.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {propriedades.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                <span>
                  {p.apelido ? <b>{p.apelido}</b> : <b>{p.nome}</b>}
                  {p.apelido && <span style={{ color: "var(--ink-3)" }}> · {p.nome}</span>}
                  {p.principal && <span className="rb-pill" style={{ marginLeft: 6 }}>principal</span>}
                  {!p.ativo && <span className="rb-pill warn" style={{ marginLeft: 6 }}>inativa</span>}
                </span>
                <button className="rb-btn" type="button" onClick={() => setEditando(p)}>Editar</button>
              </div>
            ))}
          </div>
        )}

        <button className="rb-btn pri" type="button" onClick={() => setEditando("nova")}>+ Nova propriedade</button>
        <div className="rb-drawer-actions" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button className="rb-btn" onClick={onFechar}>Fechar</button>
        </div>
      </aside>
      {editando && <PropriedadeForm propriedade={editando === "nova" ? null : editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); onMudou(); }} />}
    </>
  );
}

function PropriedadeForm({ propriedade, onFechar, onSalvo }: { propriedade: PropriedadeDTO | null; onFechar: () => void; onSalvo: () => void }) {
  const editando = !!propriedade;
  const [f, setF] = useState({
    nome: propriedade?.nome ?? "",
    apelido: propriedade?.apelido ?? "",
    cidade: propriedade?.cidade ?? "",
    uf: propriedade?.uf ?? "",
    principal: propriedade?.principal ?? false,
    ativo: propriedade?.ativo ?? true,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  async function salvar() {
    if (!f.nome.trim()) { setErro("Informe o nome da propriedade."); return; }
    setSalvando(true); setErro(null);
    try {
      const payload: PropriedadeInput = {
        nome: f.nome.trim(),
        apelido: f.apelido.trim() || undefined,
        cidade: f.cidade.trim() || undefined,
        uf: f.uf.trim() || undefined,
        principal: f.principal,
        ativo: f.ativo,
      };
      if (editando) await editarPropriedade(propriedade!.id, payload);
      else await criarPropriedade(payload);
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer">
        <h3>{editando ? `Editar ${propriedade!.nome}` : "Nova propriedade"}</h3>
        <label className="rb-fld">Nome*<input value={f.nome} onChange={(e) => set("nome", e.target.value)} autoFocus placeholder="ex.: Fazenda Recria" /></label>
        <label className="rb-fld">Apelido<input value={f.apelido} onChange={(e) => set("apelido", e.target.value)} placeholder="ex.: Recria (rótulo curto do seletor)" /></label>
        <div style={{ display: "flex", gap: 8 }}>
          <label className="rb-fld" style={{ flex: 2 }}>Cidade<input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} /></label>
          <label className="rb-fld" style={{ flex: 1 }}>UF<input value={f.uf} maxLength={2} onChange={(e) => set("uf", e.target.value.toUpperCase())} placeholder="MG" /></label>
        </div>
        <label className="rb-fld" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={f.principal} onChange={(e) => set("principal", e.target.checked)} style={{ width: "auto" }} />Principal (default quando não há filtro)</label>
        <label className="rb-fld" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} style={{ width: "auto" }} />Ativa</label>
        {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        <div className="rb-drawer-actions" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="rb-btn" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
