import { useEffect, useState } from "react";
import { movimentoSchema } from "@rionovo/shared";
import { useProdutos, useRegistrarMovimento, listarFornecedores, listarGrupos, type FornecedorDTO, type GrupoDTO, type MovimentoInput, type ProdutoDTO } from "../api";
import { HOJE } from "../HOJE";
import { ProdutoForm } from "./ProdutoForm";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { fmtMoneyExact } from "@/components/charts";
import { useToast } from "@/components/Toast";
import { useSalvarOffline } from "@/lib/offline/useSalvarOffline";

const TIPOS: { id: MovimentoInput["tipo"]; label: string }[] = [
  { id: "ENTRADA", label: "Entrada (compra)" },
  { id: "SAIDA", label: "Saída (consumo)" },
  { id: "AJUSTE", label: "Ajuste (inventário)" },
];

const money = fmtMoneyExact;

export function MovimentoForm({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const produtosQuery = useProdutos({ ativo: true });
  const produtos = produtosQuery.data.filter((p) => p.estocavel);
  const [fornecedores, setFornecedores] = useState<FornecedorDTO[]>([]);
  const [grupos, setGrupos] = useState<GrupoDTO[]>([]);
  const [f, setF] = useState({ tipo: "ENTRADA" as MovimentoInput["tipo"], produtoId: "", data: HOJE, quantidade: "", fornecedorId: "", grupoId: "", observacao: "", gerarLancamento: true });
  const [erro, setErro] = useState<string | null>(null);
  const [novoProduto, setNovoProduto] = useState(false);
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const registrar = useRegistrarMovimento();
  const { salvando, salvar: enviar } = useSalvarOffline();
  const toast = useToast();

  useEffect(() => {
    listarFornecedores().then(setFornecedores).catch(() => {});
    listarGrupos().then(setGrupos).catch(() => {});
  }, []);

  async function aoCriarProduto(criado?: ProdutoDTO) {
    setNovoProduto(false);
    await produtosQuery.recarregar();
    if (criado) set("produtoId", String(criado.id));
  }

  const produtoSel = produtos.find((p) => String(p.id) === f.produtoId) || null;
  const semContabil = produtoSel && f.tipo === "ENTRADA" && (produtoSel.categoriaId == null || produtoSel.centroCustoId == null);

  function salvar() {
    if (!f.produtoId) { setErro("Selecione um produto."); return; }
    const ehEntrada = f.tipo === "ENTRADA";
    const payload = {
      produtoId: Number(f.produtoId),
      tipo: f.tipo,
      data: f.data,
      quantidade: Number(f.quantidade),
      fornecedorId: ehEntrada && f.fornecedorId ? Number(f.fornecedorId) : undefined,
      grupoId: f.tipo === "SAIDA" && f.grupoId ? Number(f.grupoId) : undefined,
      observacao: f.observacao || undefined,
      gerarLancamento: ehEntrada ? f.gerarLancamento : undefined,
      produtoInfo: { nome: produtoSel!.nome, unidade: produtoSel!.unidade, setor: produtoSel!.setor, custoUnitario: produtoSel!.custoUnitario },
    };
    // Mesmo schema que o server valida (zValidator) — pega erro de input antes
    // de enfileirar, em vez de só descobrir no sync (convenção obrigatória,
    // ver "pré-validar antes de enfileirar" em OFFLINE_STRATEGY.md).
    const valido = movimentoSchema.safeParse(payload);
    if (!valido.success) { setErro(valido.error.issues[0]?.message ?? "Dado inválido."); return; }
    setErro(null);
    enviar(registrar.mutate, payload, {
      onSalvo: () => { toast.success("Movimento registrado"); onSalvo(); },
      onErroInline: (msg) => setErro(msg),
      onErroTardio: (msg) => toast.error("Erro ao sincronizar o movimento", msg),
    });
  }

  return (
    <>
      <RebModal
        title="Registrar movimento"
        onClose={onFechar}
        actions={
          <>
            <RebButton onClick={onFechar}>Cancelar</RebButton>
            <RebButton variant="pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
          </>
        }
      >
        <RebField label="Tipo"><select className="rb-field-select" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></RebField>

        <RebField>
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            Produto*
            <button type="button" onClick={() => setNovoProduto(true)} style={{ background: "transparent", border: 0, color: "var(--cafe)", fontSize: 12.5, fontFamily: "var(--sans)", fontStyle: "normal", cursor: "pointer", padding: 0 }}>+ novo produto</button>
          </span>
          <select className="rb-field-select" value={f.produtoId} onChange={(e) => set("produtoId", e.target.value)}>
            <option value="">Selecione…</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}
          </select>
        </RebField>

        {produtoSel && (
          <div style={{ marginTop: -6, marginBottom: 14, fontSize: 12.5, color: "var(--ink-3)", fontFamily: "var(--sans)" }}>
            {produtoSel.custoUnitario != null
              ? <>Custo cadastrado: <b style={{ color: "var(--ink-2)" }}>{money(Number(produtoSel.custoUnitario))}</b> / {produtoSel.unidade}</>
              : <span style={{ color: "var(--neg)" }}>Sem custo cadastrado — edite o produto pra definir.</span>}
            {semContabil && <span style={{ display: "block", color: "var(--neg)", marginTop: 4 }}>Falta categoria ou centro de custo no produto — o lançamento financeiro pode não ser gerado.</span>}
          </div>
        )}

        <RebField label="Data*"><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} /></RebField>
        <RebField label={<>Quantidade*{f.tipo === "AJUSTE" && <small style={{ color: "var(--ink-3)", fontStyle: "normal", marginLeft: 4 }}>— negativo subtrai</small>}</>}><input type="number" step="0.01" value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} /></RebField>
        {f.tipo === "ENTRADA" && (
          <RebField label="Fornecedor">
            <select className="rb-field-select" value={f.fornecedorId} onChange={(e) => set("fornecedorId", e.target.value)}>
              <option value="">—</option>
              {fornecedores.map((fr) => <option key={fr.id} value={fr.id}>{fr.nome}</option>)}
            </select>
          </RebField>
        )}
        {f.tipo === "SAIDA" && (
          <RebField label="Lote">
            <select className="rb-field-select" value={f.grupoId} onChange={(e) => set("grupoId", e.target.value)}>
              <option value="">—</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </RebField>
        )}
        {f.tipo === "ENTRADA" && (
          <RebField style={{ flexDirection: "row", alignItems: "center", gap: 8, fontStyle: "normal" }}>
            <input type="checkbox" checked={f.gerarLancamento} onChange={(e) => set("gerarLancamento", e.target.checked)} style={{ width: "auto" }} />Gerar lançamento financeiro
          </RebField>
        )}
        <RebField label="Observação"><input value={f.observacao} onChange={(e) => set("observacao", e.target.value)} maxLength={200} /></RebField>
        {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      </RebModal>
      {novoProduto && (
        <ProdutoForm
          stacked
          onFechar={() => setNovoProduto(false)}
          onSalvo={(criado) => { aoCriarProduto(criado).catch(() => {}); }}
        />
      )}
    </>
  );
}
