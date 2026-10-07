import { useEffect, useState } from "react";
import { listarPropriedades, type PropriedadeDTO } from "../api/propriedades";
import { getPropriedadeAtiva } from "../propriedadeScope";
import { getUsuario } from "../lib/auth";
import { Button, dataBR, brl, ErrorBox, PageHeader, PaginaFinanceira, Panel } from "../financeiro/financeiro-ui";
import { classeInput } from "../financeiro/PainelCadastro";
import { FormProduto } from "../financeiro/FormProduto";
import { PartidasProduto } from "./PartidasProduto";
import { nomeLoteProduto } from "./SelecaoPartidas";
import { destinoDoMovimento, podeAcessarArea, podeAjustarEstoque, abrirAjusteEstoque } from "./navegacao";
import { ROTULO_ORIGEM } from "./rotulos";
import { obterProdutoEstoque, listarProdutos, listarLotesProduto, listarMovimentosProduto, listarOrigensProduto, renomearLoteProduto, type ProdutoDTO, type ProdutoEstoqueDTO, type PaginaLotesProduto, type PaginaMovimentos, type PaginaOrigensProduto } from "./api";

type Aba = "resumo" | "lotes" | "movimentos" | "origens";
export function ProdutoEstoqueDetalhe({ produtoId, onSelecionarSitio }: { produtoId: string; onSelecionarSitio?: (id: number) => void }) {
  const [sitioId, setSitioId] = useState<number | undefined>(() => getPropriedadeAtiva() ?? undefined);
  const [sitios, setSitios] = useState<PropriedadeDTO[]>([]);
  const [dados, setDados] = useState<ProdutoEstoqueDTO | null>(null);
  const [aba, setAba] = useState<Aba>("resumo");
  const [pagina, setPagina] = useState(1);
  const [partidaId, setPartidaId] = useState("");
  const [lotes, setLotes] = useState<PaginaLotesProduto | null>(null);
  const [movimentos, setMovimentos] = useState<PaginaMovimentos | null>(null);
  const [origens, setOrigens] = useState<PaginaOrigensProduto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  const [editando, setEditando] = useState(false);
  const [produtoEdicao, setProdutoEdicao] = useState<ProdutoDTO | null>(null);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const usuario = getUsuario();
  const podeEditar = !usuario || !!usuario.dono || usuario.flags.includes("lancar");
  useEffect(() => { let vivo = true; listarPropriedades({ incluirInativos: true }).then((s) => { if (vivo) setSitios(s); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, []);
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro(null); setDados(null); setLotes(null); setMovimentos(null); setOrigens(null);
    const filtros = { propriedadeId: sitioId, partidaId: partidaId || undefined, pagina, porPagina: 15 };
    Promise.all([obterProdutoEstoque(produtoId, sitioId), aba === "lotes" ? listarLotesProduto(produtoId, filtros) : null, aba === "movimentos" ? listarMovimentosProduto(produtoId, filtros) : null, aba === "origens" ? listarOrigensProduto(produtoId, filtros) : null])
      .then(([d, l, m, o]) => { if (vivo) { setDados(d); setLotes(l); setMovimentos(m); setOrigens(o); } })
      .catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [produtoId, sitioId, aba, pagina, partidaId, revisao]);
  function abrirAba(a: Aba, lote = "") { setAba(a); setPagina(1); setPartidaId(lote); }
  async function abrirEdicao() {
    setErro(null); setSalvando(true);
    try {
      const p = (await listarProdutos()).find((p) => p.id === produtoId);
      if (!p) throw new Error("Produto não encontrado. Atualize a ficha.");
      setProdutoEdicao(p); setEditando(true);
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setSalvando(false); }
  }
  async function salvarNome() {
    if (!renomeando || salvando) return; setSalvando(true); setErro(null);
    try { await renomearLoteProduto(renomeando, nome.trim()); setRenomeando(null); setRevisao((r) => r + 1); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setSalvando(false); }
  }
  const produto = dados;
  const total = lotes?.total ?? movimentos?.total ?? origens?.total ?? 0;
  const vazio = !carregando && !erro && aba !== "resumo" && total === 0;
  return <PaginaFinanceira>
    <a href="/estoque" className="text-sm underline">Voltar ao Estoque</a>
    <PageHeader eyebrow="Estoque" titulo={produto?.nome ?? "Ficha do produto"} descricao="Saldo, lotes por validade e origem das entradas do mesmo produto." acao={produto && podeEditar ? <Button secondary disabled={salvando} onClick={() => { void abrirEdicao(); }}>Editar produto</Button> : undefined} />
    <label className="mt-5 grid max-w-sm gap-1 text-sm">Sítio<select aria-label="Sítio da ficha" className={classeInput} value={sitioId ?? ""} onChange={(e) => { setSitioId(Number(e.target.value) || undefined); setPagina(1); setPartidaId(""); }}><option value="">Consolidado</option>{sitios.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.ativo ? "" : " (inativo)"}</option>)}</select></label>
    <div role="tablist" aria-label="Ficha do produto" className="mt-5 flex flex-wrap gap-2">{([["resumo", "Resumo"], ["lotes", "Lotes"], ["movimentos", "Movimentos"], ["origens", "Origens das entradas"]] as const).map(([a, texto]) => <button key={a} role="tab" aria-selected={aba === a} type="button" className={`rounded-lg border border-border px-4 py-2 text-sm ${aba === a ? "bg-mast text-white" : "bg-white"}`} onClick={() => abrirAba(a)}>{texto}</button>)}</div>
    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao((r) => r + 1)}>Tentar novamente</Button>}
    {carregando ? <p className="mt-5">Carregando produto…</p> : produto && dados && <>
      {aba === "resumo" && <Panel className="mt-5 grid gap-4 p-5"><h2 className="h2">Saldo {sitioId ? `em ${sitios.find((s) => s.id === sitioId)?.nome ?? "sítio selecionado"}` : "consolidado"}</h2><p className="body">{Number(dados.saldo).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {produto.unidade}</p><p className="text-sm">Categoria: {produto.categoria?.nome ?? produto.categoriaNome ?? "Sem categoria"} · {produto.rastrearPartidas ? "Controle de lotes por validade ativo" : "Sem controle de lotes por validade"}</p>{dados.custoMedio != null && <p className="text-sm">Custo médio: {brl(dados.custoMedio)} · Valor: {brl(dados.valor ?? 0)}</p>}{!podeEditar && <p className="text-sm text-ink-3">Você tem acesso de consulta.</p>}{podeAjustarEstoque() && (sitioId ? <Button secondary onClick={() => { onSelecionarSitio?.(sitioId); abrirAjusteEstoque(produto.id); }}>Ajustar quantidade</Button> : <p className="text-sm">Selecione um sítio acima para registrar movimentos.</p>)}{podeEditar && sitioId && <details><summary className="cursor-pointer text-sm">Opções avançadas</summary><div className="mt-3"><PartidasProduto key={`${produto.id}-${sitioId}`} produtoId={produto.id} propriedadeId={sitioId} rastreado={!!produto.rastrearPartidas} configuracao onMudou={() => setRevisao((r) => r + 1)} /></div></details>}</Panel>}
      {partidaId && <p className="mt-4 text-sm">Consulta filtrada por lote. <button type="button" className="underline" onClick={() => { setPartidaId(""); setPagina(1); }}>Ver todos</button></p>}
      {aba === "lotes" && lotes?.itens.map((l) => <Panel key={l.id} className="mt-3 grid gap-2 p-4"><h2 className="h3">{nomeLoteProduto(l)}</h2><p className="text-sm">Validade: {l.validade ? dataBR(l.validade) : "não informada"} · Saldo: {Number(l.saldo).toLocaleString("pt-BR")} {produto.unidade}</p><div className="flex flex-wrap gap-2"><Button secondary onClick={() => abrirAba("movimentos", l.id)}>Ver movimentos</Button><Button secondary onClick={() => abrirAba("origens", l.id)}>Ver origens</Button>{podeEditar && <Button secondary onClick={() => { setRenomeando(l.id); setNome(l.nome || ""); }}>Renomear lote</Button>}</div>{renomeando === l.id && <form onSubmit={(e) => { e.preventDefault(); void salvarNome(); }} className="grid gap-2"><label className="text-sm">Novo nome<input required maxLength={160} className={classeInput} value={nome} onChange={(e) => setNome(e.target.value)} /></label><p className="text-sm">A alteração ficará no histórico de auditoria.</p><div className="flex gap-2"><Button type="submit" disabled={salvando || !nome.trim()}>Salvar nome</Button><Button secondary disabled={salvando} onClick={() => setRenomeando(null)}>Cancelar</Button></div></form>}</Panel>)}
      {aba === "movimentos" && movimentos?.itens.map((m) => { const destino = destinoDoMovimento(m); return <Panel key={m.id} className="mt-3 p-4"><p className="text-sm">{dataBR(m.data)} · {ROTULO_ORIGEM[m.origem]} · {m.tipo} · {m.quantidade} {produto.unidade}{m.status === "REVERTIDO" ? " · revertido" : ""}</p>{destino && podeAcessarArea(destino.area) && <a href={destino.href} className="text-sm underline">{destino.rotulo}</a>}</Panel>; })}
      {aba === "origens" && origens?.itens.map((o) => <Panel key={o.id} className="mt-3 grid gap-2 p-4"><p className="text-sm">{dataBR(o.data)} · {o.quantidade} {produto.unidade} · {o.fornecedor ?? "Sem fornecedor"}</p>{o.operacaoId && podeAcessarArea("financeiro") && <a href={`/financeiro/operacoes/${o.operacaoId}`} className="text-sm underline">Compra {o.operacaoNumero ? `OP-${String(o.operacaoNumero).padStart(4, "0")}` : "de origem"}</a>}{o.fornecedorId && podeAcessarArea("financeiro") && <a href={`/financeiro/configuracoes?aba=parceiros&parceiroId=${o.fornecedorId}`} className="text-sm underline">Consultar fornecedor</a>}</Panel>)}
      {vazio && <Panel className="mt-5 grid gap-3 p-5"><p>Nenhum {aba === "lotes" ? "lote" : aba === "origens" ? "recebimento" : "movimento"} neste escopo.</p>{podeAjustarEstoque() && <a href="/financeiro/operacoes/nova?tipo=COMPRA_ESTOQUE" className="text-sm underline">Registrar primeira entrada</a>}<a href="/estoque" className="text-sm underline">Consultar Estoque</a></Panel>}
      {aba !== "resumo" && total > 0 && <div className="mt-5 flex flex-wrap items-center gap-3"><span className="text-sm">Página {pagina} · {total} itens</span><Button secondary disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button><Button secondary disabled={pagina * 15 >= total} onClick={() => setPagina((p) => p + 1)}>Próxima</Button></div>}
    </>}
    {editando && produtoEdicao && <FormProduto produto={produtoEdicao} onSalvo={() => { setEditando(false); setRevisao((r) => r + 1); }} onFechar={() => setEditando(false)} />}
  </PaginaFinanceira>;
}
