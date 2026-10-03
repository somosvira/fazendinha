import { useEffect, useState } from "react";
import { Button, ErrorBox, hoje } from "../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../financeiro/PainelCadastro";
import { DatePicker } from "../components/DatePicker";
import { listarPropriedades, type PropriedadeDTO } from "../api/propriedades";
import { getPropriedadeAtiva, comPropriedade } from "../propriedadeScope";
import { listarProdutos, type ProdutoDTO } from "./api";
import { SelecaoPartidas, type DistribuicaoPartida } from "./SelecaoPartidas";
export function TransferirEstoque({ onFechar, onSalvo, perda = false }: { perda?: boolean; onFechar: () => void; onSalvo: () => void }) {
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [sitios, setSitios] = useState<PropriedadeDTO[]>([]);
  const [origemId, setOrigemId] = useState(getPropriedadeAtiva()?.toString() ?? "");
  const [destinoId, setDestinoId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [data, setData] = useState(hoje());
  const [motivo, setMotivo] = useState("");
  const [partidas, setPartidas] = useState<DistribuicaoPartida[]>([]);
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const produto = produtos.find((p) => p.id === produtoId);
  useEffect(() => { let vivo = true; Promise.all([listarProdutos({ ativo: true }), listarPropriedades()]).then(([p, s]) => { if (vivo) { setProdutos(p); setSitios(s); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, []);
  async function confirmar() {
    if (ocupado) return;
    setOcupado(true); setErro(null);
    try {
      const r = await fetch(perda ? "/api/estoque/perdas" : "/api/estoque/transferencias", { method: "POST", headers: comPropriedade({ "content-type": "application/json" }), body: JSON.stringify({ chave, produtoId, origemId: Number(origemId), ...(perda ? {} : { destinoId: Number(destinoId) }), quantidade, data, motivo, ...(produto?.rastrearPartidas ? { partidas: partidas.map((p) => ({ partidaId: p.partidaId, quantidade: Number(p.quantidade) })) } : {}) }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Transferência não confirmada"); onSalvo();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  return <PainelCadastro aberto titulo={perda ? "Registrar perda de estoque" : "Transferir estoque entre sítios"} onFechar={() => { if (!ocupado) onFechar(); }} rodape={<Button type="submit" form="transferir-estoque" disabled={ocupado}>{perda ? "Confirmar perda" : "Confirmar transferência"}</Button>}><form id="transferir-estoque" className="grid gap-4" onChange={() => setChave(crypto.randomUUID())} onSubmit={(e) => { e.preventDefault(); void confirmar(); }}><ErrorBox erro={erro} /><p className="text-sm">{perda ? "Baixa somente a quantidade perdida, com justificativa e lotes selecionados. Não cria nova despesa." : "Movimenta a mesma quantidade/unidade e conserva os lotes originais e seu valor. Não cria despesa financeira."} Para estornar, abra a operação pelo Histórico do estoque no sítio de origem.</p><label>Sítio de origem<select required className={classeInput} value={origemId} onChange={(e) => { setOrigemId(e.target.value); setPartidas([]); }}><option value="">Selecione</option>{sitios.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>{!perda && <label>Sítio de destino<select required className={classeInput} value={destinoId} onChange={(e) => setDestinoId(e.target.value)}><option value="">Selecione</option>{sitios.filter((s) => s.id !== Number(origemId)).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>}<label>Produto<select required className={classeInput} value={produtoId} onChange={(e) => { setProdutoId(e.target.value); setPartidas([]); }}><option value="">Selecione</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><label>Quantidade ({produto?.unidade ?? "unidade do Produto"})<input required type="number" min="0.001" step="0.001" className={classeInput} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></label>{produto?.rastrearPartidas && <SelecaoPartidas produtoId={produto.id} propriedadeId={Number(origemId) || undefined} dataFato={data} quantidade={quantidade} unidade={produto.unidade} saida valor={partidas} onChange={(p) => { setPartidas(p); setChave(crypto.randomUUID()); }} />}<label>Data<DatePicker required value={data} onChange={(v) => { setData(v); setChave(crypto.randomUUID()); }} /></label><label>Motivo<textarea required minLength={5} maxLength={200} className={classeInput} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label></form></PainelCadastro>;
}
