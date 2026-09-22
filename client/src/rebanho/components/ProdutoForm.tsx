import { useEffect, useState } from "react";
import { criarProduto, editarProduto, listarCategorias, listarCentrosCusto, type ProdutoDTO, type RefDTO, type TipoInsumoPlantio, type TipoProduto } from "../api";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";

/* Reuso do FormProduto do financeiro foi avaliado e descartado aqui: ele usa o
 * PainelCadastro (painel lateral fixo) sem suporte a `stacked` (modal aninhado
 * sobre outro modal, usado pelo MovimentoForm) e depende de uma lista de
 * parceiros/fornecedores que o rebanho não carrega neste fluxo. Replicar os
 * mesmos campos aqui, incluindo o fieldset de centros de custo, evita essa
 * adaptação sem duplicar a regra de negócio (que vive no server). */

const TIPOS: { id: TipoProduto; label: string }[] = [
  { id: "MEDICAMENTO", label: "Medicamento" },
  { id: "RACAO", label: "Ração" },
  { id: "INSUMO", label: "Insumo" },
  { id: "MINERAL", label: "Mineral" },
  { id: "OUTRO", label: "Outro" },
];

const SUBTIPOS_PLANTIO: { id: TipoInsumoPlantio; label: string }[] = [
  { id: "FERTILIZANTE", label: "Fertilizante" }, { id: "DEFENSIVO", label: "Defensivo" },
  { id: "HERBICIDA", label: "Herbicida" }, { id: "CORRETIVO", label: "Corretivo" },
  { id: "BIOLOGICO", label: "Biológico" }, { id: "FOLIAR", label: "Foliar" },
  { id: "MUDA", label: "Muda" }, { id: "OUTRO", label: "Outro" },
];

export function ProdutoForm({ produto, onFechar, onSalvo, stacked = false }: { produto?: ProdutoDTO; onFechar: () => void; onSalvo: (criado?: ProdutoDTO) => void; stacked?: boolean }) {
  const [f, setF] = useState({
    nome: produto?.nome ?? "",
    tipo: (produto?.tipo ?? "INSUMO") as TipoProduto,
    subtipoPlantio: (produto?.subtipoPlantio ?? "") as TipoInsumoPlantio | "",
    unidade: produto?.unidade ?? "un",
    custoUnitario: produto?.custoUnitario != null ? String(produto.custoUnitario) : "",
    estocavel: produto?.estocavel ?? true,
    minimoEstoque: produto?.minimoEstoque != null ? String(produto.minimoEstoque) : "",
    carencia: produto?.carencia != null ? String(produto.carencia) : "",
    percentualMS: produto?.percentualMS != null ? String(produto.percentualMS) : "",
    categoriaId: produto?.categoriaId != null ? String(produto.categoriaId) : "",
  });
  const [centroCustoIds, setCentroCustoIds] = useState(() => new Set(produto?.centroCustoIds ?? []));
  const [categorias, setCategorias] = useState<RefDTO[]>([]);
  const [centros, setCentros] = useState<RefDTO[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const alternarCentro = (id: number) => setCentroCustoIds((atuais) => {
    const proximos = new Set(atuais); if (proximos.has(id)) proximos.delete(id); else proximos.add(id); return proximos;
  });

  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {});
    listarCentrosCusto().then(setCentros).catch(() => {});
  }, []);

  async function salvar() {
    if (f.estocavel && !f.categoriaId) { setErro("Produto estocável precisa de uma categoria"); return; }
    setSalvando(true); setErro(null);
    try {
      const payload = {
        nome: f.nome,
        tipo: f.tipo,
        subtipoPlantio: f.subtipoPlantio || null,
        unidade: f.unidade || "un",
        custoUnitario: f.custoUnitario ? Number(f.custoUnitario) : null,
        estocavel: f.estocavel,
        minimoEstoque: f.minimoEstoque ? Number(f.minimoEstoque) : null,
        carencia: f.carencia ? Number(f.carencia) : null,
        percentualMS: f.percentualMS ? Number(f.percentualMS) : null,
        categoriaId: f.categoriaId ? Number(f.categoriaId) : null,
        centroCustoIds: [...centroCustoIds],
      };
      if (produto) { await editarProduto(produto.id, payload); onSalvo(); }
      else { const criado = await criarProduto(payload); onSalvo(criado); }
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <RebModal
      title={produto ? `Editar ${produto.nome}` : "Novo produto"}
      onClose={onFechar}
      stacked={stacked}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <RebField label="Nome*"><input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></RebField>
      <RebField label="Tipo"><select className="rb-field-select" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></RebField>
      <RebField label="Unidade"><input value={f.unidade} onChange={(e) => set("unidade", e.target.value)} placeholder="un, kg, dose…" /></RebField>
      <RebField label="Tipo agrícola">
        <select className="rb-field-select" value={f.subtipoPlantio} onChange={(e) => set("subtipoPlantio", e.target.value)}>
          <option value="">Não se aplica</option>
          {SUBTIPOS_PLANTIO.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </RebField>
      <RebField label="Custo unitário (R$)"><input type="number" value={f.custoUnitario} onChange={(e) => set("custoUnitario", e.target.value)} /></RebField>
      <RebField label="Categoria padrão">
        <select className="rb-field-select" value={f.categoriaId} onChange={(e) => set("categoriaId", e.target.value)}>
          <option value="">—</option>
          {categorias.map((cat) => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
        </select>
      </RebField>
      <RebField label="Centros de custo">
        <div className="grid max-h-40 gap-1 overflow-y-auto text-sm">
          {centros.length === 0 ? <p className="text-ink-3">Nenhum centro de custo cadastrado.</p> : centros.map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input type="checkbox" checked={centroCustoIds.has(c.id)} onChange={() => alternarCentro(c.id)} /> <span>{c.nome}</span>
            </label>
          ))}
        </div>
      </RebField>
      <RebField label="Carência (dias)"><input type="number" min={0} step="1" value={f.carencia} onChange={(e) => set("carencia", e.target.value)} /></RebField>
      <RebField label="% de matéria seca"><input type="number" min={0} step="0.01" value={f.percentualMS} onChange={(e) => set("percentualMS", e.target.value)} /></RebField>
      <RebField label="Estoque mínimo"><input type="number" step="0.01" min={0} value={f.minimoEstoque} onChange={(e) => set("minimoEstoque", e.target.value)} placeholder="dispara alerta abaixo desse valor" /></RebField>
      <RebField style={{ flexDirection: "row", alignItems: "center", gap: 8, fontStyle: "normal", marginTop: 4 }}>
        <input type="checkbox" checked={f.estocavel} onChange={(e) => set("estocavel", e.target.checked)} style={{ width: "auto" }} />Estocável
      </RebField>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
