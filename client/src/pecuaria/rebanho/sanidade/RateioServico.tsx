import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { reqSanidade, type ServicoSanitario } from "./api";
type Rateios = { valorConfirmado: string; totalAtribuido: string; disponivel: string; itens: Array<{ id: string; tipo: "APLICACAO" | "EXAME" | "PROTOCOLO"; animalId: string; nome: string; valor: string | null }> };
export function RateioServico({ propriedadeId, servicos, onFechar }: { propriedadeId: number; servicos: ServicoSanitario[]; onFechar: () => void }) {
  const [servicoId, setServicoId] = useState("");
  const [dados, setDados] = useState<Rateios | null>(null);
  const [itemId, setItemId] = useState("");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const item = dados?.itens.find((i) => i.id === itemId);
  useEffect(() => { let vivo = true; setDados(null); if (servicoId) reqSanidade<Rateios>(`/rateios?servicoId=${servicoId}&propriedadeId=${propriedadeId}`).then((d) => { if (vivo) { setDados(d); setErro(null); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [servicoId, propriedadeId, revisao]);
  async function salvar() {
    if (!item || ocupado) return; setOcupado(true); setErro(null);
    try { await reqSanidade("/rateios", { method: "POST", body: JSON.stringify({ servicoId, propriedadeId, id: item.id, tipo: item.tipo, valor: valor.trim() === "" ? null : valor, motivo }) }); setRevisao((v) => v + 1); setItemId(""); setMotivo(""); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  return <PainelCadastro aberto titulo="Rateio manual de Serviço" onFechar={() => { if (!ocupado) onFechar(); }} rodape={<Button type="submit" form="rateio-servico" disabled={ocupado || !item}>Salvar atribuição</Button>}><form id="rateio-servico" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void salvar(); }}><ErrorBox erro={erro} /><p className="text-sm">Atribuição analítica opcional: não cria outra despesa nem movimento de estoque. O total é limitado ao Serviço confirmado. Não rateie ao mesmo tempo no protocolo e nos fatos dele.</p><label>Serviço confirmado<select required className={classeInput} value={servicoId} onChange={(e) => { setServicoId(e.target.value); setItemId(""); }}><option value="">Selecione</option>{servicos.map((s) => <option key={s.id} value={s.id}>#{s.numero} · {s.descricao ?? "Serviço"} · R$ {s.valorTotal}</option>)}</select></label>{dados && <><p>Confirmado R$ {dados.valorConfirmado} · atribuído R$ {dados.totalAtribuido} · disponível R$ {dados.disponivel}</p><label>Fato vinculado<select required className={classeInput} value={itemId} onChange={(e) => { setItemId(e.target.value); setValor(dados.itens.find((i) => i.id === e.target.value)?.valor ?? ""); }}><option value="">Selecione</option>{dados.itens.map((i) => <option key={i.id} value={i.id}>{i.tipo} · {i.nome} · animal {i.animalId} · {i.valor == null ? "sem rateio" : `R$ ${i.valor}`}</option>)}</select></label>{!dados.itens.length && <p className="text-sm">Sem fatos válidos vinculados. Associe o Serviço na aplicação, exame ou execução primeiro.</p>}</>}{item && <><label>Valor atribuído (R$) — vazio retira o rateio<input type="number" min="0" step="0.01" className={classeInput} value={valor} onChange={(e) => setValor(e.target.value)} /></label><label>Motivo<textarea required minLength={5} maxLength={500} className={classeInput} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label></>}</form></PainelCadastro>;
}
