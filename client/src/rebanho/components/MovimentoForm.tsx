import { useEffect, useState } from "react";
import { movimentoSchema, preverLancamentoDaEntrada } from "@rionovo/shared";
import { useProdutos, useRegistrarMovimento, listarFornecedores, listarGrupos, type FornecedorDTO, type GrupoDTO, type MovimentoInput, type MovimentoResult, type ProdutoDTO } from "../api";
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
  // previsto: true quando a resposta não veio do servidor (offline — a mutation
  // só foi enfileirada). incerto: true quando "deve gerar lançamento" foi
  // assumido sem saber se o mês está fechado (único dado que o client não tem
  // offline) — só confirma de verdade quando a fila sincronizar.
  const [resultado, setResultado] = useState<{ lancamentoCriado: boolean; motivo?: string; previsto: boolean; incerto: boolean } | null>(null);
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const registrar = useRegistrarMovimento();
  const { salvando, salvar: enviar } = useSalvarOffline<MovimentoResult>();
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
      // resp só existe online (servidor já decidiu de verdade). Offline, a
      // fila ainda não rodou — prevê com a mesma regra do servidor
      // (preverLancamentoDaEntrada), assumindo mês aberto.
      onSalvo: (resp) => {
        if (resp) {
          setResultado({ lancamentoCriado: resp.lancamentoCriado, motivo: resp.motivo, previsto: false, incerto: false });
        } else {
          const p = preverLancamentoDaEntrada({
            tipo: f.tipo,
            gerarLancamento: f.gerarLancamento,
            produtoCategoriaId: produtoSel!.categoriaId,
            produtoCentroCustoId: produtoSel!.centroCustoId,
          });
          setResultado({ lancamentoCriado: p.deveCriar, motivo: p.motivo, previsto: true, incerto: p.incerto });
        }
      },
      onErroInline: (msg) => setErro(msg),
      onErroTardio: (msg) => toast.error("Erro ao sincronizar o movimento", msg),
    });
  }

  // Após salvar, mostra um recibo claro do que aconteceu — confirmado (online)
  // ou previsto (offline, com a mesma regra do servidor, mas sem saber se o
  // mês está fechado).
  if (resultado) {
    const tipoLabel = TIPOS.find((t) => t.id === f.tipo)?.label.split(" ")[0] ?? f.tipo;
    const qtdNum = Number(f.quantidade);
    const valorTotal = produtoSel?.custoUnitario != null ? Number(produtoSel.custoUnitario) * Math.abs(qtdNum) : null;
    return (
      <RebModal
        title=""
        showClose={false}
        onClose={onSalvo}
        className="max-w-[440px]"
        actions={
          <div className="flex w-full justify-center">
            <RebButton variant="pri" onClick={onSalvo} style={{ minWidth: 140 }}>Fechar</RebButton>
          </div>
        }
      >
        <div className="mt-1 flex justify-center animate-[rb-check-pop_0.3s_cubic-bezier(0.34,1.56,0.64,1)] [&>svg]:h-16 [&>svg]:w-16 [&>svg]:text-lucro [&_circle]:[stroke-dasharray:132] [&_circle]:[stroke-dashoffset:0] [&_circle]:animate-[rb-check-circle_0.4s_ease-out_backwards] [&_path]:[stroke-dasharray:30] [&_path]:[stroke-dashoffset:0] [&_path]:animate-[rb-check-path_0.25s_ease-out_0.25s_backwards]">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="24" cy="24" r="21" />
            <path d="M15 24l7 7 12-14" />
          </svg>
        </div>
        <h3 style={{ textAlign: "center", margin: "14px 0 6px" }}>Movimento registrado</h3>
        {resultado.previsto && (
          <p style={{ textAlign: "center", color: "var(--atencao)", fontSize: 12.5, margin: "0 0 6px" }}>
            Offline — vai sincronizar quando reconectar
          </p>
        )}
        <p style={{ textAlign: "center", color: "var(--ink-2)", fontSize: 14, margin: "0 0 18px" }}>
          <b style={{ color: "var(--ink)" }}>{tipoLabel}</b> de <b style={{ color: "var(--ink)" }}>{Math.abs(qtdNum).toLocaleString("pt-BR")} {produtoSel?.unidade}</b> de <b style={{ color: "var(--ink)" }}>{produtoSel?.nome}</b>
          {valorTotal != null && f.tipo === "ENTRADA" && <> · {money(valorTotal)}</>}
        </p>
        <div className="flex items-start gap-3 rounded-[10px] border border-[color:var(--rule-soft)] bg-card px-4 py-3.5 text-sm [&_b]:font-semibold [&_b]:text-foreground">
          {resultado.lancamentoCriado ? (
            <>
              <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-sm font-bold bg-[color-mix(in_srgb,var(--lucro)_14%,transparent)] text-lucro">✓</span>
              <div>
                <b>{resultado.previsto ? "Lançamento financeiro deve ser gerado" : "Lançamento financeiro gerado"}</b>
                <div style={{ color: "var(--ink-3)", fontSize: 12.5 }}>
                  {resultado.incerto
                    ? "Previsto pelo cadastro do produto — confirma se o mês ainda estiver aberto quando sincronizar."
                    : "O custo foi registrado no fluxo de caixa."}
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-sm font-bold bg-[color:var(--rule-soft)] text-ink-3">—</span>
              <div>
                <b>Sem lançamento financeiro</b>
                <div style={{ color: "var(--ink-3)", fontSize: 12.5 }}>{resultado.motivo ?? "não aplicável pra esse tipo de movimento"}</div>
              </div>
            </>
          )}
        </div>
      </RebModal>
    );
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
