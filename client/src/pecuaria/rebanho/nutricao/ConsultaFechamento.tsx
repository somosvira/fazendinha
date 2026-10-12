import { useCallback, useState } from "react";
import { Button, ErrorBox, Panel } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { formatarDataBR } from "../lib/rotulos";
import { DetalhesFechamento } from "./DetalhesFechamento";
import { estornarConsumo, obterFechamento, type Fechamento } from "./api";
import { rotaFechamento } from "./navegacao";
import { useConsulta } from "./consulta";
import { EstadoConsulta, LinkNutricional } from "./componentes";

export function ConsultaFechamento({ id, onVoltar, podeLancar = false, estorno = false }: { id: string; onVoltar: () => void; podeLancar?: boolean; estorno?: boolean }) {
  const consulta = useConsulta(useCallback(() => obterFechamento(id), [id]));
  const f = consulta.dados;
  return <div className="nutricao-conteudo"><div className="nutricao-acoes justify-between"><Button secondary onClick={onVoltar}>← Voltar aos fechamentos</Button>{f && podeLancar && f.status === "CONFIRMADO" && !estorno && <LinkNutricional className="nutricao-botao-secundario" href={rotaFechamento(f.id, undefined, "estorno")}>Conferir estorno</LinkNutricional>}</div><EstadoConsulta erro={consulta.erro} carregando={consulta.carregando} recarregar={consulta.carregar} />{f && (estorno && podeLancar && f.status === "CONFIRMADO" ? <FormEstorno fechamento={f} onVoltar={onVoltar} onSalvo={async () => { await consulta.carregar(); }} /> : <><h2 className="font-serif text-2xl">Detalhes do fechamento</h2><DetalhesFechamento fechamento={f} /></>)}</div>;
}
function FormEstorno({ fechamento: f, onVoltar, onSalvo }: { fechamento: Fechamento; onVoltar: () => void; onSalvo: () => Promise<void> }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function confirmar() {
    if (ocupado || motivo.trim().length < 5) return; setOcupado(true); setErro(null);
    try { await estornarConsumo(f.id, { propriedadeId: f.propriedadeId, motivo: motivo.trim() }); await onSalvo(); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  return <div className="nutricao-formulario"><Panel><div className="nutricao-card-cabecalho"><div><h2 className="h3">Conferir estorno</h2><p>{f.lote.nome} · {f.propriedade.nome} · {formatarDataBR(f.inicio)} – {formatarDataBR(f.fim)}</p></div></div><form onSubmit={(e) => { e.preventDefault(); void confirmar(); }}><fieldset disabled={ocupado} className="nutricao-card-corpo grid gap-4"><ErrorBox erro={erro} /><h3 className="font-semibold">Devolução ao estoque</h3><p className="nutricao-nota">As quantidades com baixa voltarão aos lotes de estoque originais. Consumos sem baixa não geram entrada.</p><ul className="nutricao-ingredientes">{f.itens.map((i) => <li key={i.produtoId}><strong>{i.produto.nome}</strong><span>{i.movimentoEstoque ? <>{i.movimentoEstoque.quantidade} {i.unidade} a devolver{i.movimentoEstoque.alocacaoPartidaEstoques.map((a, n) => <small key={n}>{a.partida.nome || a.partida.codigo}: {a.quantidade} {i.unidade}</small>)}</> : "Sem devolução — não houve baixa"}</span></li>)}</ul><label>Motivo do estorno<textarea className={classeInput} value={motivo} required minLength={5} maxLength={500} onChange={(e) => setMotivo(e.target.value)} /></label></fieldset><div className="nutricao-form-rodape"><Button secondary disabled={ocupado} onClick={onVoltar}>Cancelar</Button><Button type="submit" danger disabled={ocupado || motivo.trim().length < 5}>{ocupado ? "Estornando…" : "Confirmar estorno com motivo"}</Button></div></form></Panel><Panel className="nutricao-ajuda"><h3 className="h3">O que será atualizado</h3><p>O fechamento será marcado como estornado e excluído dos custos atuais do lote. O consumo original, o motivo e os movimentos de reversão permanecerão no histórico.</p></Panel></div>;
}
