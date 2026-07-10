import { useState } from "react";
import { usePropriedades, criarPropriedade, editarPropriedade, type PropriedadeDTO, type PropriedadeInput } from "../api";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { RebPill } from "@/components/rb/RebPrimitives";

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
          <RebButton type="button" onClick={() => setGerenciar(true)}>Gerenciar</RebButton>
        </>
      ) : (
        <RebButton type="button" onClick={() => setGerenciar(true)} className="text-xs opacity-65">＋ Propriedade</RebButton>
      )}
      {gerenciar && <GerenciarPropriedades propriedades={props} onFechar={() => setGerenciar(false)} onMudou={recarregar} />}
    </div>
  );
}

function GerenciarPropriedades({ propriedades, onFechar, onMudou }: { propriedades: PropriedadeDTO[]; onFechar: () => void; onMudou: () => void }) {
  const [editando, setEditando] = useState<PropriedadeDTO | "nova" | null>(null);

  return (
    <>
      <RebModal
        title="Propriedades"
        onClose={onFechar}
        actions={<RebButton onClick={onFechar}>Fechar</RebButton>}
      >
        <p className="mb-3 mt-0 text-[12.5px] text-ink-3">Sítios da fazenda. Cada animal e lote pertence a um sítio; a principal é o default.</p>

        {propriedades.length === 0 ? <p className="text-sm italic text-ink-3">Nenhuma propriedade.</p> : (
          <div className="mb-3 flex flex-col gap-1.5">
            {propriedades.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-[13.5px]">
                <span>
                  {p.apelido ? <b>{p.apelido}</b> : <b>{p.nome}</b>}
                  {p.apelido && <span className="text-ink-3"> · {p.nome}</span>}
                  {p.principal && <RebPill style={{ marginLeft: 6 }}>principal</RebPill>}
                  {!p.ativo && <RebPill tone="warn" style={{ marginLeft: 6 }}>inativa</RebPill>}
                </span>
                <RebButton type="button" onClick={() => setEditando(p)}>Editar</RebButton>
              </div>
            ))}
          </div>
        )}

        <RebButton variant="pri" type="button" onClick={() => setEditando("nova")}>+ Nova propriedade</RebButton>
      </RebModal>
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
    <RebModal
      stacked
      title={editando ? `Editar ${propriedade!.nome}` : "Nova propriedade"}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar} disabled={salvando}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <RebField label="Nome*"><input value={f.nome} onChange={(e) => set("nome", e.target.value)} autoFocus placeholder="ex.: Fazenda Recria" /></RebField>
      <RebField label="Apelido"><input value={f.apelido} onChange={(e) => set("apelido", e.target.value)} placeholder="ex.: Recria (rótulo curto do seletor)" /></RebField>
      <div style={{ display: "flex", gap: 8 }}>
        <RebField label="Cidade" style={{ flex: 2 }}><input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} /></RebField>
        <RebField label="UF" style={{ flex: 1 }}><input value={f.uf} maxLength={2} onChange={(e) => set("uf", e.target.value.toUpperCase())} placeholder="MG" /></RebField>
      </div>
      <RebField style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={f.principal} onChange={(e) => set("principal", e.target.checked)} style={{ width: "auto" }} />Principal (default quando não há filtro)</RebField>
      <RebField style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} style={{ width: "auto" }} />Ativa</RebField>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
