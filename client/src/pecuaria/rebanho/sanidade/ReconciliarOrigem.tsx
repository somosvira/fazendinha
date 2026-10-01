import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { listarPartidasNutricionais, type PartidaNutricional } from "../nutricao/api";
import { listarComprasDiretas, listarServicos, reqSanidade, type AplicacaoSanitaria, type CompraDireta, type ServicoSanitario } from "./api";

export function ReconciliarOrigem({ aplicacao, propriedadeId, onFechar, onSalvo }: { aplicacao: AplicacaoSanitaria; propriedadeId: number; onFechar: () => void; onSalvo: () => void }) {
  const [origem, setOrigem] = useState("INCLUSO_SERVICO");
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [servicos, setServicos] = useState<ServicoSanitario[]>([]);
  const [compras, setCompras] = useState<CompraDireta[]>([]);
  const [partidas, setPartidas] = useState<PartidaNutricional[]>([]);
  const [produtoId, setProdutoId] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [compraId, setCompraId] = useState("");
  const [partidaId, setPartidaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const produto = produtos.find((p) => p.id === produtoId);
  useEffect(() => { let vivo = true; setCarregando(true); Promise.all([listarProdutos({ ativo: true }), listarServicos(propriedadeId), listarComprasDiretas()]).then(([p, s, c]) => { if (vivo) { setProdutos(p); setServicos(s); setCompras(c); setErro(null); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); }); return () => { vivo = false; }; }, [propriedadeId, tentativa]);
  useEffect(() => { let vivo = true; setPartidaId(""); setPartidas([]); if (produto?.rastrearPartidas) listarPartidasNutricionais(produto.id).then((p) => { if (vivo) setPartidas(p); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [produto?.id, produto?.rastrearPartidas]);
  async function confirmar() {
    if (ocupado) return; setOcupado(true); setErro(null);
    try { await reqSanidade(`/aplicacoes/${aplicacao.id}/origem`, { method: "POST", body: JSON.stringify({ propriedadeId, motivo, origemInsumo: origem, produtoId: produtoId || undefined, operacaoServicoId: servicoId || undefined, itemCompraDiretaId: origem === "COMPRA_CONSUMO_DIRETO" ? compraId : undefined, partidaId: origem === "BAIXA_ESTOQUE" ? partidaId || undefined : undefined }) }); onSalvo(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  return <PainelCadastro aberto titulo="Reconciliar origem da aplicação" onFechar={() => { if (!ocupado) onFechar(); }} rodape={<Button type="submit" form="reconciliar-origem" disabled={ocupado || carregando}>Confirmar vínculo de origem</Button>}><form id="reconciliar-origem" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void confirmar(); }}><ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setTentativa((v) => v + 1)}>Recarregar opções</Button>}<p>{aplicacao.nomeProdutoAplicado} · {aplicacao.dose} {aplicacao.unidadeDose}. Medicamento, quantidade, data e carência permanecem iguais. A justificativa original será preservada.</p><label>Origem localizada<select className={classeInput} value={origem} onChange={(e) => { setOrigem(e.target.value); setProdutoId(""); setCompraId(""); setServicoId(""); }}><option value="INCLUSO_SERVICO">Incluído em Serviço</option><option value="BAIXA_ESTOQUE">Estoque da fazenda</option><option value="COMPRA_CONSUMO_DIRETO">Compra para consumo direto</option></select></label>{origem !== "COMPRA_CONSUMO_DIRETO" && <label>Produto correspondente {origem === "BAIXA_ESTOQUE" ? "*" : "(opcional)"}<select required={origem === "BAIXA_ESTOQUE"} className={classeInput} value={produtoId} onChange={(e) => setProdutoId(e.target.value)}><option value="">Selecione</option>{produtos.filter((p) => p.nome.trim().toLocaleLowerCase() === aplicacao.nomeProdutoAplicado.trim().toLocaleLowerCase()).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>}{origem === "COMPRA_CONSUMO_DIRETO" && <label>Item confirmado<select required className={classeInput} value={compraId} onChange={(e) => { setCompraId(e.target.value); setProdutoId(compras.find((c) => c.id === e.target.value)?.produtoId ?? ""); }}><option value="">Selecione</option>{compras.filter((c) => c.produto.nome.trim().toLocaleLowerCase() === aplicacao.nomeProdutoAplicado.trim().toLocaleLowerCase()).map((c) => <option key={c.id} value={c.id}>#{c.operacao.numero} · {c.produto.nome} · {c.disponivel} {c.unidade}</option>)}</select></label>}<label>Serviço {origem === "INCLUSO_SERVICO" ? "*" : "(opcional)"}<select required={origem === "INCLUSO_SERVICO"} className={classeInput} value={servicoId} onChange={(e) => setServicoId(e.target.value)}><option value="">Sem Serviço</option>{servicos.map((s) => <option key={s.id} value={s.id}>#{s.numero} · {s.descricao ?? "Serviço"}</option>)}</select></label>{origem === "BAIXA_ESTOQUE" && produto?.rastrearPartidas && <label>Partida<select required className={classeInput} value={partidaId} onChange={(e) => setPartidaId(e.target.value)}><option value="">Selecione</option>{partidas.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.saldo} · {p.validade?.slice(0, 10) ?? "validade desconhecida"}</option>)}</select></label>}<label>Motivo e evidência da reconciliação<textarea required minLength={5} maxLength={500} className={classeInput} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label></form></PainelCadastro>;
}
