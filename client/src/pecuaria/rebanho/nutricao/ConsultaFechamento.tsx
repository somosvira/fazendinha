import { ClipboardCheck, Undo2 } from "lucide-react";
import { formatarLitros } from "../leite/modelo";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ErrorBox, Panel } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { formatarDataBR } from "../lib/rotulos";
import { DetalhesFechamento } from "./DetalhesFechamento";
import { estornarConsumo, obterFechamento, type Fechamento } from "./api";
import { retornoFichaNutricional, rotaFechamento } from "./navegacao";
import { useConsulta } from "./consulta";
import { EstadoConsulta, LinkNutricional } from "./componentes";

export function ConsultaFechamento({ id, onVoltar, podeLancar = false, estorno = false }: { id: string; onVoltar: () => void; podeLancar?: boolean; estorno?: boolean }) {
  const [ocupado, setOcupado] = useState(false);
  const consulta = useConsulta(useCallback(() => obterFechamento(id), [id]));
  const f = consulta.dados;
  const origem = retornoFichaNutricional();
  const rotuloVoltar = estorno ? "Voltar ao fechamento" : origem ? origem.includes("/animais/") ? "Voltar ao animal" : "Voltar ao lote" : "Voltar aos fechamentos";
  return <PainelCadastro aberto titulo={estorno && podeLancar ? "Conferir estorno" : "Detalhes do fechamento"} icon={estorno ? Undo2 : ClipboardCheck} onFechar={onVoltar} bloqueado={ocupado} largura="sm:max-w-6xl" rodape={fechar => <Button secondary disabled={ocupado} onClick={fechar}>{estorno ? "Cancelar" : rotuloVoltar}</Button>}><div className="nutricao-conteudo">{f && podeLancar && f.status === "CONFIRMADO" && !estorno && <div className="nutricao-acoes justify-end"><LinkNutricional className="nutricao-botao-secundario" href={rotaFechamento(f.id, undefined, "estorno")}><Undo2 size={18} aria-hidden />Conferir estorno</LinkNutricional></div>}<EstadoConsulta erro={consulta.erro} carregando={consulta.carregando} recarregar={consulta.carregar} estrutura="detalhe" label="Carregando detalhes do fechamento…" />{f && (estorno && podeLancar && f.status === "CONFIRMADO" ? <FormEstorno fechamento={f} onOcupado={setOcupado} onSalvo={async () => { await consulta.carregar(); }} /> : <DetalhesFechamento fechamento={f} podeLancar={podeLancar} onRecarregar={consulta.carregar} />)}</div></PainelCadastro>;
}
function FormEstorno({ fechamento: f, onOcupado, onSalvo }: { fechamento: Fechamento; onOcupado: (valor: boolean) => void; onSalvo: () => Promise<void> }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  useEffect(() => { onOcupado(ocupado); return () => onOcupado(false); }, [ocupado, onOcupado]);
  async function confirmar() {
    if (enviando.current || motivo.trim().length < 5) return; enviando.current = true; setOcupado(true); setErro(null);
    try { await estornarConsumo(f.id, { propriedadeId: f.propriedadeId, motivo: motivo.trim() }); await onSalvo(); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { enviando.current = false; setOcupado(false); }
  }
  return <div className="nutricao-formulario"><Panel><div className="nutricao-card-cabecalho"><div><p>{f.lote.nome} · {f.propriedade.nome} · {formatarDataBR(f.inicio)} – {formatarDataBR(f.fim)}</p></div></div><form onSubmit={(e) => { e.preventDefault(); void confirmar(); }}><fieldset disabled={ocupado} className="nutricao-card-corpo grid gap-4"><ErrorBox erro={erro} /><h3 className="font-semibold">Devolução ao estoque</h3><p className="nutricao-nota">As quantidades com baixa voltarão aos lotes de estoque originais. Consumos sem baixa não geram entrada.</p><ul className="nutricao-ingredientes">{f.itens.map((i) => <li key={i.produtoId}><strong>{i.produto.nome}</strong><span>{i.leite ? <>{formatarLitros(Number(i.leite.quantidadeLitros))} a devolver às origens leiteiras</> : i.movimentoEstoque ? <>{i.movimentoEstoque.quantidade} {i.unidade} a devolver{i.movimentoEstoque.alocacaoPartidaEstoques.map((a, n) => <small key={n}>{a.partida.nome || a.partida.codigo}: {a.quantidade} {i.unidade}</small>)}</> : "Sem devolução — não houve baixa"}</span></li>)}</ul><label>Motivo do estorno<textarea className={classeInput} value={motivo} required minLength={5} maxLength={500} onChange={(e) => setMotivo(e.target.value)} /></label></fieldset><div className="nutricao-form-rodape"><Button type="submit" danger disabled={ocupado || motivo.trim().length < 5}>{ocupado ? "Estornando…" : "Confirmar estorno com motivo"}</Button></div></form></Panel><p className="nutricao-nota">O fechamento será marcado como estornado e excluído dos custos atuais do lote. O consumo original, o motivo e os movimentos de reversão permanecerão no histórico.</p></div>;
}
