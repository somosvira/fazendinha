import { useEffect, useMemo, useState } from "react";
import { criarLote, editarLote, excluirLote, obterLote, useAnimaisDisponiveis, useDietas, useCentrosCusto, type LoteDetalheDTO, type LoteDTO } from "../api";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField, REB_FIELD_BOXED } from "@/components/rb/RebField";
import { RebFieldset, REB_SUB } from "@/components/rb/RebPrimitives";
import { AnimalIdentity } from "./AnimalIdentity";

type Props = {
  lote?: LoteDTO | null;
  onFechar: () => void;
  onSalvo: () => void;
  onExcluido?: () => void;
};

const CAT_LABEL: Record<string, string> = {
  BEZERRA: "Bezerra", NOVILHA: "Novilha", VACA: "Vaca", BEZERRO: "Bezerro", TOURO: "Touro",
  CABRITA: "Cabrita", CABRA: "Cabra", CABRITO: "Cabrito", BODE: "Bode",
};

export function LoteForm({ lote, onFechar, onSalvo, onExcluido }: Props) {
  const { data: dietas } = useDietas();
  const { data: centrosCusto } = useCentrosCusto();
  const { data: animais, loading: carregandoAnimais } = useAnimaisDisponiveis();
  const [detalhe, setDetalhe] = useState<LoteDetalheDTO | null>(null);
  const [nome, setNome] = useState(lote?.nome ?? "");
  const [dietaId, setDietaId] = useState<string>(lote?.dietaId ? String(lote.dietaId) : "");
  const [centroCustoId, setCentroCustoId] = useState<string>(lote?.centroCustoId ? String(lote.centroCustoId) : "");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  useEffect(() => {
    if (!lote) return;
    obterLote(lote.id).then((d) => {
      setDetalhe(d);
      setNome(d.nome);
      setDietaId(d.dietaId ? String(d.dietaId) : "");
      setCentroCustoId(d.centroCustoId ? String(d.centroCustoId) : "");
      setSelecionados(new Set(d.animais.map((a) => a.id)));
    }).catch((e) => setErro(e.message));
  }, [lote]);

  const animaisFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return animais;
    return animais.filter((a) => a.numero.toLowerCase().includes(q) || (a.nome ?? "").toLowerCase().includes(q));
  }, [animais, busca]);

  const toggleAnimal = (id: number) => {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  async function salvar() {
    if (!nome.trim()) { setErro("Informe o nome do lote."); return; }
    setSalvando(true); setErro(null);
    try {
      const payload = { nome: nome.trim(), dietaId: dietaId ? Number(dietaId) : null, animalIds: [...selecionados], centroCustoId: centroCustoId ? Number(centroCustoId) : null };
      if (lote) await editarLote(lote.id, payload);
      else await criarLote(payload);
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  async function confirmarExcluir() {
    if (!lote) return;
    setSalvando(true); setErro(null);
    try {
      await excluirLote(lote.id);
      onExcluido?.();
    } catch (e: any) { setErro(e.message); setConfirmandoExcluir(false); } finally { setSalvando(false); }
  }

  const editando = !!lote;
  const totalSelecionados = selecionados.size;
  const carregandoDetalhe = editando && !detalhe;

  if (confirmandoExcluir && lote) {
    return (
      <RebModal
        title=""
        showClose={false}
        onClose={() => !salvando && setConfirmandoExcluir(false)}
        className="max-w-[460px]"
        actions={
          <div className="flex w-full justify-between">
            <RebButton onClick={() => setConfirmandoExcluir(false)} disabled={salvando}>Cancelar</RebButton>
            <RebButton variant="danger" onClick={confirmarExcluir} disabled={salvando}>{salvando ? "Excluindo…" : "Excluir lote"}</RebButton>
          </div>
        }
      >
        <div className="mt-0.5 flex justify-center [&>svg]:h-11 [&>svg]:w-11 [&>svg]:text-prejuizo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3 style={{ margin: "10px 0 6px", textAlign: "center" }}>Excluir lote {lote.nome}?</h3>
        <p style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 13.5, margin: "0 0 18px" }}>
          Esta ação não pode ser desfeita. Só será permitida se o lote estiver vazio (sem animais, produção ou movimentações).
        </p>
        {erro && <p style={{ color: "var(--neg)", fontSize: 13, marginTop: 10, textAlign: "center" }}>{erro}</p>}
      </RebModal>
    );
  }

  return (
    <RebModal
      title={editando ? `Editar ${lote!.nome}` : "Novo lote"}
      onClose={onFechar}
      className="w-[min(640px,calc(100vw-32px))]"
      actions={
        <div className="flex w-full items-center justify-between">
          {editando ? (
            <RebButton variant="danger" onClick={() => setConfirmandoExcluir(true)} disabled={salvando}>Excluir</RebButton>
          ) : <span />}
          <span style={{ display: "flex", gap: 8 }}>
            <RebButton onClick={onFechar} disabled={salvando}>Cancelar</RebButton>
            <RebButton variant="pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
          </span>
        </div>
      }
    >
      <RebField label="Nome*"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Lactação alta" autoFocus /></RebField>

        <RebField label="Dieta">
          <select className="rb-field-select" value={dietaId} onChange={(e) => setDietaId(e.target.value)}>
            <option value="">— sem dieta —</option>
            {dietas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </RebField>

        <RebField label="Centro de custo">
          <select className="rb-field-select" value={centroCustoId} onChange={(e) => setCentroCustoId(e.target.value)}>
            <option value="">— sem centro de custo —</option>
            {centrosCusto.map((cc) => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
          </select>
        </RebField>
        <p className={REB_SUB} style={{ margin: "-8px 0 14px" }}>As baixas de dieta e sanidade deste lote vão para este centro.</p>

        <RebFieldset style={{ padding: "10px 14px 12px" }}>
          <legend>Animais do lote · {totalSelecionados} selecionado{totalSelecionados === 1 ? "" : "s"}</legend>
          <input
            className={REB_FIELD_BOXED}
            style={{ display: "block", marginBottom: 10, padding: "7px 11px", fontSize: 13.5 }}
            placeholder="Buscar por número ou nome…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {carregandoAnimais || carregandoDetalhe ? (
            <p className={REB_SUB} style={{ margin: "8px 4px" }}>Carregando animais…</p>
          ) : animaisFiltrados.length === 0 ? (
            <p className={REB_SUB} style={{ margin: "8px 4px" }}>Nenhum animal {busca ? "encontrado" : "ativo"}.</p>
          ) : (
            <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--rule-soft)", borderRadius: 8, background: "var(--bg)" }}>
              {animaisFiltrados.map((a) => {
                const checked = selecionados.has(a.id);
                const outroLote = a.grupoId != null && a.grupoId !== lote?.id;
                return (
                  <label
                    key={a.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                      borderBottom: "1px dashed var(--rule-soft)", cursor: "pointer",
                      background: checked ? "color-mix(in srgb, var(--cafe) 8%, transparent)" : "transparent",
                      fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink-2)",
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleAnimal(a.id)} style={{ accentColor: "var(--cafe)" }} />
                    <AnimalIdentity numero={a.numero} nome={a.nome} className="min-w-0 flex-1" />
                    <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{CAT_LABEL[a.categoria] ?? a.categoria}</span>
                    {outroLote && !checked && (
                      <span style={{ fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" }}>em {a.grupoNome}</span>
                    )}
                    {outroLote && checked && (
                      <span style={{ fontSize: 12.5, color: "var(--cafe)", fontStyle: "italic" }}>← virá de {a.grupoNome}</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </RebFieldset>

        {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
