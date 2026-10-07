import { useEffect, useRef, useState } from "react";
import { Button } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { listarPartidasNutricionais, type PartidaNutricional } from "../nutricao/api";
import { SanidadeApiError, listarComprasDiretas, listarServicos, reqSanidade, type AplicacaoSanitaria, type CompraDireta, type ServicoSanitario } from "./api";
import { UNIDADES, UNIDADES_ORDENADAS, mesmaBase } from "../../../lib/unidades";
import { nomeLoteProduto } from "../../../estoque/SelecaoPartidas";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { dataSanitaria, unidadeSanitaria } from "./rotulos";

export function ReconciliarOrigem({ aplicacao, propriedadeId, onFechar, onSalvo }: { aplicacao: AplicacaoSanitaria; propriedadeId: number; onFechar: () => void; onSalvo: () => void }) {
  const [origem, setOrigem] = useState("INCLUSO_SERVICO");
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [servicos, setServicos] = useState<ServicoSanitario[]>([]);
  const [compras, setCompras] = useState<CompraDireta[]>([]);
  const [partidas, setPartidas] = useState<PartidaNutricional[]>([]);
  const [produtoId, setProdutoId] = useState(aplicacao.produtoId ?? "");
  const [servicoId, setServicoId] = useState("");
  const [compraId, setCompraId] = useState("");
  const [partidaId, setPartidaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const emCurso = useRef(false);
  const [erroOpcoes, setErroOpcoes] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const [equivalencia, setEquivalencia] = useState(false);
  const [errosCampos, setErrosCampos] = useState<Record<string, string>>({});
  const [cienciaValidade, setCienciaValidade] = useState(false);
  const normalizar = (v: string) => v.trim().toLocaleLowerCase("pt-BR");
  const unidadeCompativel = (v: string) => {
    const resolver = (valor: string) => UNIDADES_ORDENADAS.find((u) => normalizar(u) === normalizar(valor) || normalizar(UNIDADES[u].rotulo) === normalizar(valor));
    const produto = resolver(v), dose = resolver(aplicacao.unidadeDose ?? "");
    return produto && dose ? mesmaBase(produto, dose) : false;
  };
  const produto = produtos.find((p) => p.id === produtoId);
  const produtoCompra = compras.find((c) => c.id === compraId)?.produto.nome;
  const nomeCorrespondente = origem === "COMPRA_CONSUMO_DIRETO" ? produtoCompra : produto?.nome;
  const requerEquivalencia = !aplicacao.produtoId && !!nomeCorrespondente && normalizar(nomeCorrespondente) !== normalizar(aplicacao.nomeProdutoAplicado);
  useEffect(() => { setEquivalencia(false); }, [produtoId, compraId, origem]);
  useEffect(() => { setCienciaValidade(false); }, [partidaId, produtoId, origem]);
  useEffect(() => { let vivo = true; setCarregando(true); setErroOpcoes(null); Promise.all([listarProdutos({ ativo: true }), listarServicos(propriedadeId), listarComprasDiretas(propriedadeId)]).then(([p, s, c]) => { if (vivo) { setProdutos(p); setServicos(s); setCompras(c); } }).catch((e: unknown) => { if (vivo) setErroOpcoes(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); }); return () => { vivo = false; }; }, [propriedadeId, tentativa]);
  useEffect(() => { let vivo = true; setPartidaId(""); setPartidas([]); if (produto?.rastrearPartidas) listarPartidasNutricionais(produto.id, propriedadeId).then((p) => { if (vivo) setPartidas(p); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [produto?.id, produto?.rastrearPartidas, propriedadeId]);
  useEffect(() => {
    const campo = Object.keys(errosCampos)[0];
    const ids: Record<string, string> = { cienciaValidadeDesconhecida: "recon-ciencia", motivo: "recon-motivo", confirmarEquivalencia: "recon-equivalencia", produtoId: "recon-produto", itemCompraDiretaId: "recon-compra", operacaoServicoId: "recon-servico", partidaId: "recon-lote" };
    if (!campo) return;
    const controle = document.getElementById(ids[campo]);
    controle?.focus(); controle?.scrollIntoView?.({ block: "center" });
  }, [errosCampos]);
  async function confirmar() {
    if (emCurso.current) return;
    const falhas: Record<string, string> = {};
    if (origem === "BAIXA_ESTOQUE" && !produto) falhas.produtoId = "Selecione o Produto correspondente.";
    if (origem === "INCLUSO_SERVICO" && !servicos.some((s) => s.id === servicoId)) falhas.operacaoServicoId = "Selecione o Serviço localizado.";
    if (origem === "COMPRA_CONSUMO_DIRETO" && !compras.some((c) => c.id === compraId)) falhas.itemCompraDiretaId = "Selecione o item confirmado.";
    if (origem === "BAIXA_ESTOQUE" && produto?.rastrearPartidas && !partidas.some((p) => p.id === partidaId)) falhas.partidaId = "Selecione o lote do Produto.";
    if (motivo.trim().length < 5) falhas.motivo = "Informe ao menos cinco caracteres para o motivo.";
    if (requerEquivalencia && !equivalencia) falhas.confirmarEquivalencia = "Confirme a equivalência do medicamento.";
    if (origem === "BAIXA_ESTOQUE" && partidas.some((p) => p.id === partidaId && !p.validade) && !cienciaValidade) falhas.cienciaValidadeDesconhecida = "Confirme a ciência da validade não informada.";
    setErrosCampos(falhas);
    if (Object.keys(falhas).length) { setErro("Confira os campos indicados para confirmar."); return; }
    emCurso.current = true; setOcupado(true); setErro(null);
    try { await reqSanidade(`/aplicacoes/${aplicacao.id}/origem`, { method: "POST", body: JSON.stringify({ propriedadeId, motivo: motivo.trim(), cienciaValidadeDesconhecida: cienciaValidade, confirmarEquivalencia: requerEquivalencia ? equivalencia : undefined, origemInsumo: origem, produtoId: produtoId || undefined, operacaoServicoId: servicoId || undefined, itemCompraDiretaId: origem === "COMPRA_CONSUMO_DIRETO" ? compraId : undefined, partidaId: origem === "BAIXA_ESTOQUE" ? partidaId || undefined : undefined }) }); onSalvo(); } catch (e) { setErro(e instanceof SanidadeApiError && e.campo ? "Confira o campo indicado para confirmar." : e instanceof Error ? e.message : String(e)); if (e instanceof SanidadeApiError && e.campo) setErrosCampos({ [e.campo]: e.message }); } finally { emCurso.current = false; setOcupado(false); }
  }
  return <PainelCadastro aberto titulo="Reconciliar origem da aplicação" onFechar={() => { if (!ocupado) onFechar(); }} rodape={<div>{erro && <p role="alert" className="mb-2 text-sm text-red-700">{erro}</p>}<Button type="submit" form="reconciliar-origem" disabled={ocupado || carregando || !!erroOpcoes}>{ocupado ? "Confirmando…" : "Confirmar vínculo de origem"}</Button></div>}><form noValidate id="reconciliar-origem" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void confirmar(); }}>{erroOpcoes && <div><p role="alert">{erroOpcoes}</p><Button secondary onClick={() => setTentativa((v) => v + 1)}>Recarregar opções</Button></div>}<p>{aplicacao.nomeProdutoAplicado} · {aplicacao.dose} {unidadeSanitaria(aplicacao.unidadeDose)}. Medicamento, quantidade, data e carência permanecem iguais. A justificativa original será preservada.</p><label>Origem localizada<select className={classeInput} value={origem} onChange={(e) => { setOrigem(e.target.value); setProdutoId(aplicacao.produtoId ?? ""); setCompraId(""); setServicoId(""); }}><option value="INCLUSO_SERVICO">Incluído em Serviço</option><option value="BAIXA_ESTOQUE">Estoque da fazenda</option><option value="COMPRA_CONSUMO_DIRETO">Compra para consumo direto</option></select></label>{origem !== "COMPRA_CONSUMO_DIRETO" && <CampoFormulario id="recon-produto" rotulo="Produto correspondente" erro={errosCampos.produtoId}>{(p) => <select {...p} required={origem === "BAIXA_ESTOQUE"} disabled={!!aplicacao.produtoId} className={classeInput} value={produtoId} onChange={(e) => setProdutoId(e.target.value)}><option value="">Selecione</option>{produtos.filter((p) => p.usoSanitario && unidadeCompativel(p.unidade) && (!aplicacao.produtoId || p.id === aplicacao.produtoId)).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>}</CampoFormulario>}{origem === "COMPRA_CONSUMO_DIRETO" && <CampoFormulario id="recon-compra" rotulo="Item confirmado" erro={errosCampos.itemCompraDiretaId}>{(p) => <select {...p} required className={classeInput} value={compraId} onChange={(e) => { setCompraId(e.target.value); setProdutoId(compras.find((c) => c.id === e.target.value)?.produtoId ?? ""); }}><option value="">Selecione</option>{compras.filter((c) => unidadeCompativel(c.unidade) && (!aplicacao.produtoId || c.produtoId === aplicacao.produtoId)).map((c) => <option key={c.id} value={c.id}>#{c.operacao.numero} · {c.produto.nome} · {c.disponivel} {c.unidade}</option>)}</select>}</CampoFormulario>}<CampoFormulario id="recon-servico" rotulo="Serviço" erro={errosCampos.operacaoServicoId}>{(p) => <select {...p} required={origem === "INCLUSO_SERVICO"} className={classeInput} value={servicoId} onChange={(e) => setServicoId(e.target.value)}><option value="">Sem Serviço</option>{servicos.map((s) => <option key={s.id} value={s.id}>#{s.numero} · {s.descricao ?? "Serviço"}</option>)}</select>}</CampoFormulario>{origem === "BAIXA_ESTOQUE" && produto?.rastrearPartidas && <CampoFormulario id="recon-lote" rotulo="Lote do Produto" erro={errosCampos.partidaId}>{(p) => <select {...p} required className={classeInput} value={partidaId} onChange={(e) => setPartidaId(e.target.value)}><option value="">Selecione</option>{partidas.map((p) => <option key={p.id} value={p.id}>{nomeLoteProduto(p)} · saldo {Number(p.saldo).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {unidadeSanitaria(produto.unidade)} · validade {p.validade ? dataSanitaria(p.validade) : "não informada"}</option>)}</select>}</CampoFormulario>}{origem === "BAIXA_ESTOQUE" && partidas.some((p) => p.id === partidaId && !p.validade) && <ConfirmacaoCiencia id="recon-ciencia" obrigatorio erro={errosCampos.cienciaValidadeDesconhecida} checked={cienciaValidade} onChange={setCienciaValidade}>Estou ciente de que a validade deste lote não foi informada.</ConfirmacaoCiencia>}{requerEquivalencia && <ConfirmacaoCiencia id="recon-equivalencia" obrigatorio erro={errosCampos.confirmarEquivalencia} checked={equivalencia} onChange={setEquivalencia}>{`Confirmo que “${nomeCorrespondente}” corresponde ao medicamento “${aplicacao.nomeProdutoAplicado}” utilizado.`}</ConfirmacaoCiencia>}
<CampoFormulario id="recon-motivo" rotulo="Motivo e evidência da reconciliação" obrigatorio erro={errosCampos.motivo}>{(p) => <textarea {...p} required minLength={5} maxLength={500} className={classeInput} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}</CampoFormulario></form></PainelCadastro>;
}
