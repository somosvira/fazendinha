import { useEffect, useRef, useState } from "react";
import { ajustarContagem, listarSaldos, listarPropriedades, type SaldoDTO } from "../api";
import { getPropriedadeAtiva } from "../../propriedadeScope";
import { ProdutoForm } from "./ProdutoForm";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";

const quantidade = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function MovimentoForm({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [precisaFazenda, setPrecisaFazenda] = useState(false);
  const [saldos, setSaldos] = useState<SaldoDTO[]>([]);
  const [produtoId, setProdutoId] = useState("");
  const [contada, setContada] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novoProduto, setNovoProduto] = useState(false);
  const [resultado, setResultado] = useState<{ quantidadeContada: number; diferenca: number } | null>(null);
  const enviando = useRef(false);
  const alive = useRef(true);
  const escopoConsultado = useRef<number | null>(getPropriedadeAtiva());

  async function carregar(selecionarId?: number) {
    setCarregando(true); setErro(null);
    try {
      const escopo = getPropriedadeAtiva();
      if (escopo == null && (await listarPropriedades()).length > 1) {
        if (alive.current) { setPrecisaFazenda(true); setSaldos([]); }
        return;
      }
      if (alive.current) setPrecisaFazenda(false);
      const lista = await listarSaldos();
      if (getPropriedadeAtiva() !== escopo) throw new Error("A propriedade mudou. Atualize o saldo antes de continuar.");
      escopoConsultado.current = escopo;
      if (!alive.current) return;
      setSaldos(lista);
      if (selecionarId) { setProdutoId(String(selecionarId)); setContada(""); }
    } catch (e) { if (alive.current) setErro(e instanceof Error ? e.message : String(e)); }
    finally { if (alive.current) setCarregando(false); }
  }
  useEffect(() => { alive.current = true; void carregar(); return () => { alive.current = false; }; }, []);
  const produto = saldos.find(p => String(p.produtoId) === produtoId);
  const valor = contada.trim() === "" ? NaN : Number(contada);
  const diferenca = produto ? Math.round((valor - produto.saldo) * 100) / 100 : NaN;
  const valido = !!produto && Number.isFinite(valor) && valor >= 0 && valor <= 9_999_999_999.99 && Math.abs(valor * 100 - Math.round(valor * 100)) < 0.00001 && diferenca !== 0 && motivo.trim().length >= 5;
  async function salvar() {
    if (!valido || !produto || enviando.current || carregando) return;
    if (getPropriedadeAtiva() !== escopoConsultado.current) { setErro("A propriedade mudou. Atualize o saldo antes de confirmar."); return; }
    enviando.current = true; setSalvando(true); setErro(null);
    try {
      const r = await ajustarContagem({ produtoId: produto.produtoId, quantidadeContada: valor, saldoEsperado: produto.saldo, observacao: motivo.trim() });
      if (alive.current) setResultado(r);
    } catch (e) { if (alive.current) setErro(e instanceof Error ? e.message : String(e)); }
    finally { enviando.current = false; if (alive.current) setSalvando(false); }
  }
  if (precisaFazenda) return <RebModal title="Ajustar quantidade" onClose={onFechar} actions={<RebButton onClick={onFechar}>Fechar</RebButton>}>
    <p role="alert">Selecione uma fazenda no menu lateral para ajustar o estoque. O Consolidado reúne saldos de fazendas diferentes.</p>
  </RebModal>;
  if (resultado) return <RebModal title="Quantidade ajustada" onClose={onSalvo} actions={<RebButton variant="pri" onClick={onSalvo}>Fechar</RebButton>}>
    <p><strong>{produto?.nome}</strong>: estoque atualizado para <strong>{quantidade(resultado.quantidadeContada)} {produto?.unidade}</strong>.</p>
    <p>Ajuste registrado: {resultado.diferenca > 0 ? "+" : ""}{quantidade(resultado.diferenca)} {produto?.unidade}.</p>
    <p>Sem pagamento ou compromisso financeiro. A justificativa e o histórico foram preservados.</p>
  </RebModal>;
  return <>
    <RebModal title="Ajustar quantidade" onClose={() => { if (!enviando.current) onFechar(); }} actions={<>
      <RebButton disabled={salvando} onClick={onFechar}>Cancelar</RebButton>
      <RebButton variant="pri" disabled={!valido || carregando || salvando} onClick={salvar}>{salvando ? "Salvando…" : "Confirmar ajuste"}</RebButton>
    </>}>
      <p className="mb-4 text-sm text-ink-3">Informe a quantidade encontrada na contagem. O ajuste corrige somente o estoque, sem gerar pagamento ou compromisso.</p>
      <RebField label="Produto">
        <select aria-label="Produto" disabled={carregando || salvando} value={produtoId} onChange={e => { setProdutoId(e.target.value); setContada(""); }}>
          <option value="">{carregando ? "Carregando estoque…" : "Selecione…"}</option>
          {saldos.map(p => <option key={p.produtoId} value={p.produtoId}>{p.nome} ({p.unidade})</option>)}
        </select>
      </RebField>
      <RebButton disabled={salvando} onClick={() => setNovoProduto(true)}>Novo produto</RebButton>
      {produto && <p className="my-4">Quantidade no sistema: <strong>{quantidade(produto.saldo)} {produto.unidade}</strong></p>}
      <RebField label="Quantidade encontrada na contagem">
        <input aria-label="Quantidade encontrada na contagem" type="number" min="0" max="9999999999.99" step="0.01" disabled={salvando} value={contada} onChange={e => setContada(e.target.value)} />
      </RebField>
      <RebField label="Justificativa">
        <textarea aria-label="Justificativa" minLength={5} maxLength={200} disabled={salvando} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Explique o motivo da correção de contagem" />
      </RebField>
      {produto && Number.isFinite(diferenca) && valor >= 0 && <div className="my-4 rounded-lg bg-stone-100 p-4" aria-live="polite">
        <strong>{diferenca === 0 ? "Nenhum ajuste necessário" : `Diferença: ${diferenca > 0 ? "+" : ""}${quantidade(diferenca)} ${produto.unidade}`}</strong>
        <p>Estoque após confirmar: {quantidade(valor)} {produto.unidade}.</p>
      </div>}
      {erro && <div role="alert" className="mt-3 text-sm text-prejuizo"><p>{erro}</p><RebButton disabled={carregando || salvando} onClick={() => { void carregar(); }}>Atualizar saldo</RebButton></div>}
    </RebModal>
    {novoProduto && <ProdutoForm stacked onFechar={() => setNovoProduto(false)} onSalvo={p => { setNovoProduto(false); void carregar(p?.id); }} />}
  </>;
}
