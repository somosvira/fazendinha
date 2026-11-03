import { AjudaCampo } from "@/components/Dica";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { Button as BotaoMenu } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import "./estoque-theme.css";
import { Boxes, Package, Pencil, SlidersHorizontal, MoreHorizontal } from "lucide-react";
import { SubTabs } from "../components/SubTabs";
import { DialogFinanceiro } from "../financeiro/DialogFinanceiro";
import { navegarPara } from "../router";
import { rotuloUnidade } from "../lib/unidades";
import { useEffect, useRef, useState } from "react";
import { listarPropriedades, type PropriedadeDTO } from "../api/propriedades";
import { getPropriedadeAtiva } from "../propriedadeScope";
import { getUsuario } from "../lib/auth";
import { Button, dataBR, brl, ErrorBox, PageHeader, PaginaFinanceira, Panel, TabelaFinanceira, Paginacao, Pill, Empty, type ColunaTabela } from "../financeiro/financeiro-ui";
import { classeInput } from "../financeiro/PainelCadastro";
import { FormProduto } from "../financeiro/FormProduto";
import { ValorizacaoProduto } from "./ValorizacaoProduto";
import { PartidasProduto } from "./PartidasProduto";
import { nomeLoteProduto } from "./SelecaoPartidas";
import { destinoDoMovimento, podeAcessarArea, podeAjustarEstoque, abrirAjusteEstoque } from "./navegacao";
import { ROTULO_ORIGEM } from "./rotulos";
import { obterProdutoEstoque, listarProdutos, listarLotesProduto, listarMovimentosProduto, listarOrigensProduto, renomearLoteProduto, type LoteProdutoDTO, type MovimentoDTO, type OrigemProdutoDTO, type ProdutoDTO, type ProdutoEstoqueDTO, type PaginaLotesProduto, type PaginaMovimentos, type PaginaOrigensProduto } from "./api";

type Aba = "resumo" | "lotes" | "movimentos" | "origens";
export function ProdutoEstoqueDetalhe({ produtoId, onSelecionarSitio }: { produtoId: string; onSelecionarSitio?: (id: number) => void }) {
  const [sitioId, setSitioId] = useState<number | undefined>(() => getPropriedadeAtiva() ?? undefined);
  const [sitios, setSitios] = useState<PropriedadeDTO[]>([]);
  const [dados, setDados] = useState<ProdutoEstoqueDTO | null>(null);
  const [aba, setAba] = useState<Aba>(() => new URLSearchParams(location.search).has("partidaId") ? "movimentos" : "resumo");
  const [pagina, setPagina] = useState(1);
  const [partidaId, setPartidaId] = useState(() => new URLSearchParams(location.search).get("partidaId") ?? "");
  useEffect(() => {
    const restaurar = () => { const id = new URLSearchParams(location.search).get("partidaId") ?? ""; setPartidaId(id); setPagina(1); if (id) setAba("movimentos"); };
    window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar);
  }, []);
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
  const enviandoNome = useRef(false);
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
    if (!podeEditar || !renomeando || enviandoNome.current || !nome.trim()) return; enviandoNome.current = true; setSalvando(true); setErro(null);
    try { await renomearLoteProduto(renomeando, nome.trim()); setRenomeando(null); setRevisao((r) => r + 1); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { enviandoNome.current = false; setSalvando(false); }
  }
  const produto = dados;
  const total = lotes?.total ?? movimentos?.total ?? origens?.total ?? 0;
  const vazio = !carregando && !erro && aba !== "resumo" && total === 0;

  const unidade = produto ? rotuloUnidade(produto.unidade) : "";
  const colunasLotes: ColunaTabela<LoteProdutoDTO>[] = [
    { chave: "lote", titulo: "Lote", principal: true, celula: l => <strong>{nomeLoteProduto(l)}</strong> },
    { chave: "validade", titulo: "Validade", celula: l => l.validade ? dataBR(l.validade) : <Pill tone="amber">Não informada</Pill> },
    { chave: "saldo", titulo: "Saldo", alinhamento: "direita", celula: l => <strong className="tabular-nums">{Number(l.saldo).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {unidade}</strong> },
    { chave: "acoes", titulo: "Ações", alinhamento: "direita", acoes: true, celula: l => <DropdownMenu><DropdownMenuTrigger asChild><BotaoMenu variant="outline" aria-label={`Ações do lote ${nomeLoteProduto(l)}`} className="gap-2 bg-card text-sm font-semibold"><MoreHorizontal size={16} />Ações</BotaoMenu></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => abrirAba("movimentos", l.id)}>Ver movimentos</DropdownMenuItem><DropdownMenuItem onSelect={() => abrirAba("origens", l.id)}>Ver origens</DropdownMenuItem>{podeEditar && <DropdownMenuItem onSelect={() => { setRenomeando(l.id); setNome(l.nome || ""); }}>Renomear lote</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu> },
  ];
  const colunasMovimentos: ColunaTabela<MovimentoDTO>[] = [
    { chave: "data", titulo: "Data", celula: m => dataBR(m.data) },
    { chave: "origem", titulo: "Origem", principal: true, celula: m => <strong>{ROTULO_ORIGEM[m.origem] ?? m.origem}</strong> },
    { chave: "tipo", titulo: "Tipo", celula: m => <Pill tone={m.tipo === "ENTRADA" ? "green" : m.tipo === "SAIDA" ? "amber" : "neutral"}>{m.tipo === "ENTRADA" ? "Entrada" : m.tipo === "SAIDA" ? "Saída" : "Ajuste"}</Pill> },
    { chave: "quantidade", titulo: "Quantidade", alinhamento: "direita", celula: m => <span className="tabular-nums">{Number(m.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {unidade}</span> },
    { chave: "situacao", titulo: "Situação", celula: m => <Pill tone={m.status === "REVERTIDO" || m.reversaoDeId ? "red" : "green"}>{m.status === "REVERTIDO" ? "Estornado" : m.reversaoDeId ? "Estorno" : "Confirmado"}</Pill> },
    { chave: "vinculo", titulo: "Origem / destino", celula: m => { const destino = destinoDoMovimento(m); return destino && podeAcessarArea(destino.area) ? <a href={destino.href} className="font-medium text-primary underline underline-offset-4 hover:decoration-2">{destino.rotulo}</a> : "—"; } },
  ];
  const colunasOrigens: ColunaTabela<OrigemProdutoDTO>[] = [
    { chave: "data", titulo: "Data", celula: o => dataBR(o.data) },
    { chave: "fornecedor", titulo: "Fornecedor", principal: true, celula: o => <strong>{o.fornecedor ?? "Sem fornecedor"}</strong> },
    { chave: "quantidade", titulo: "Quantidade", alinhamento: "direita", celula: o => <span className="tabular-nums">{Number(o.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {unidade}</span> },
    { chave: "vinculos", titulo: "Documentos de origem", celula: o => <div className="flex flex-wrap gap-x-4 gap-y-2">{o.operacaoId && podeAcessarArea("financeiro") && <a href={`/financeiro/operacoes/${o.operacaoId}`} className="font-medium text-primary underline underline-offset-4 hover:decoration-2">Compra {o.operacaoNumero ? `OP-${String(o.operacaoNumero).padStart(4, "0")}` : "de origem"}</a>}{o.fornecedorId && podeAcessarArea("financeiro") && <a href={`/financeiro/configuracoes?aba=parceiros&parceiroId=${o.fornecedorId}`} className="font-medium text-primary underline underline-offset-4 hover:decoration-2">Consultar fornecedor</a>}</div> },
  ];
  return <PaginaFinanceira><div className="produto-ficha estoque-content">
    <nav className="fin-breadcrumb" aria-label="Navegação estrutural"><a href="/estoque" onClick={e => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarPara("/estoque"); } }}>Estoque</a><span aria-hidden="true">/</span><span aria-current="page">{produto?.nome ?? "Ficha do produto"}</span></nav>
    <PageHeader eyebrow="" titulo={<span className="rotina-titulo"><span><Package/></span>{produto?.nome ?? "Ficha do produto"}</span>} acao={produto && podeEditar ? <Button secondary disabled={salvando} onClick={() => { void abrirEdicao(); }}><Pencil size={16} />Editar produto</Button> : undefined} />
    <div className="estoque-filtro-ficha"><div className="grid min-w-0 w-full gap-1 text-sm sm:w-[280px]"><div className="flex items-center"><label htmlFor="sitio-ficha-produto">Sítio</label><AjudaCampo rotulo="Ajuda: sítio da ficha" texto="O sítio selecionado nesta ficha filtra somente esta consulta. A seleção geral da fazenda não é alterada." /></div><SelectCampo id="sitio-ficha-produto" aria-label="Sítio da ficha" className={classeInput} value={sitioId ?? ""} onValueChange={(valorSelecionado) => { setSitioId(Number(valorSelecionado) || undefined); setPagina(1); setPartidaId(""); }}><option value="">Consolidado</option>{sitios.map(s => <option key={s.id} value={s.id}>{s.nome}{s.ativo ? "" : " (inativo)"}</option>)}</SelectCampo></div>{partidaId && <p className="text-sm text-ink-3">Consulta filtrada por lote. <Button secondary onClick={() => { setPartidaId(""); setPagina(1); }}>Ver todos</Button></p>}</div>
    <SubTabs variant="financeiro" ariaLabel="Ficha do produto" tabs={[{ id: "resumo", label: "Resumo" }, { id: "lotes", label: "Lotes" }, { id: "movimentos", label: "Movimentos" }, { id: "origens", label: "Origens das entradas" }]} active={aba} onSelect={abrirAba} className="mt-5" />

    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button>}
    {carregando ? <p role="status" className="mt-5">Carregando produto…</p> : produto && dados && <>
      {aba === "resumo" && <Panel className="mt-5 overflow-hidden">
        <div className="estoque-secao-cabecalho"><span className="fin-section-icon"><Package aria-hidden="true" /></span><h2 className="h2">Saldo {sitioId ? `em ${sitios.find(s => s.id === sitioId)?.nome ?? "sítio selecionado"}` : "consolidado"}</h2></div>
        <div className="estoque-ficha-resumo">
          <div className="produto-ficha-disponivel"><span className="text-sm text-muted-foreground">Disponível</span><p className="estoque-ficha-saldo tabular-nums">{Number(dados.saldo).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {unidade}</p><p className="mt-2 text-sm text-ink-3">{produto.rastrearPartidas ? "Controle de lotes por validade ativo" : "Sem controle de lotes por validade"}</p>{!podeEditar && <p className="mt-3 text-sm text-ink-3">Você tem acesso de consulta.</p>}</div>
          <dl className="estoque-ficha-dados"><div><dt>Lotes com saldo</dt><dd>{dados.lotesComSaldo} <small>de {dados.totalLotes} cadastrados</small></dd></div><div><dt>Categoria</dt><dd>{produto.categoria?.nome ?? produto.categoriaNome ?? "Sem categoria"}</dd></div>{dados.custoMedio != null && <><div><dt>Custo médio</dt><dd>{brl(dados.custoMedio)}</dd></div><div><dt>Valor em estoque</dt><dd>{brl(dados.valor ?? 0)}</dd></div></>}</dl>
        </div>
        <div className="produto-ficha-rastreio"><h3>Consultar rastreabilidade</h3><div><Button secondary onClick={() => abrirAba("lotes")}><Boxes size={17} aria-hidden="true" />Lotes e validades</Button><Button secondary onClick={() => abrirAba("movimentos")}>Movimentos do produto</Button><Button secondary onClick={() => abrirAba("origens")}>Origens das entradas</Button></div></div>
        {podeAjustarEstoque() && <div className="estoque-ficha-opcoes">{sitioId ? <Button secondary onClick={() => { onSelecionarSitio?.(sitioId); abrirAjusteEstoque(produto.id); }}><SlidersHorizontal size={16} />Ajustar quantidade</Button> : <p className="text-sm text-ink-3">Selecione um sítio acima para registrar movimentos.</p>}</div>}
        {podeEditar && sitioId && <details className="estoque-ficha-opcoes"><summary className="cursor-pointer text-sm font-medium">Opções avançadas</summary><div className="mt-3"><PartidasProduto key={`${produto.id}-${sitioId}`} produtoId={produto.id} propriedadeId={sitioId} rastreado={!!produto.rastrearPartidas} configuracao onMudou={() => setRevisao(r => r + 1)} /></div></details>}
      </Panel>}
      {aba !== "resumo" && <Panel className="mt-5 overflow-hidden">

        {vazio ? <Empty><p>Nenhum {aba === "lotes" ? "lote" : aba === "origens" ? "recebimento" : "movimento"} neste escopo.</p><div className="mt-3 flex flex-wrap justify-center gap-3">{podeAjustarEstoque() && <a href="/financeiro/operacoes/nova?tipo=COMPRA_ESTOQUE" className="font-medium text-primary underline underline-offset-4 hover:decoration-2">Registrar primeira entrada</a>}<a href="/estoque" className="font-medium text-primary underline underline-offset-4 hover:decoration-2">Consultar Estoque</a></div></Empty>
          : aba === "lotes" && lotes ? <TabelaFinanceira rotulo="Lotes do produto" itens={lotes.itens} colunas={colunasLotes} chaveDe={l => l.id} />
          : aba === "movimentos" && movimentos ? <TabelaFinanceira rotulo="Movimentos do produto" itens={movimentos.itens} colunas={colunasMovimentos} chaveDe={m => m.id} />
          : aba === "origens" && origens ? <TabelaFinanceira rotulo="Origens das entradas" itens={origens.itens} colunas={colunasOrigens} chaveDe={o => o.id} /> : null}
        {total > 0 && <Paginacao pagina={pagina} totalPaginas={Math.max(1, Math.ceil(total / 15))} total={total} porPagina={15} rotulo="Paginação da ficha" substantivo="itens" idSelect="pagina-ficha-produto" onPagina={setPagina} />}
      </Panel>}
    </>}
    {produto && sitioId && podeAcessarArea("financeiro") && (!!usuario?.dono || !!usuario?.flags.includes("verValores")) && <ValorizacaoProduto produtoId={produtoId} propriedadeId={sitioId} podeEditar={podeEditar} onSalvo={() => setRevisao(r => r+1)} />}
    {renomeando && <DialogFinanceiro titulo="Renomear lote" eyebrow="Estoque" icon={Pencil} onClose={() => { if (!salvando) setRenomeando(null); }} rodape={<><Button secondary disabled={salvando} onClick={() => setRenomeando(null)}>Cancelar</Button><Button type="submit" form="renomear-lote" carregando={salvando} disabled={!nome.trim()}>Salvar nome</Button></>}>
      <form id="renomear-lote" className="grid gap-3 p-5" onSubmit={e => { e.preventDefault(); void salvarNome(); }}><ErrorBox erro={erro} /><div className="flex items-start gap-2"><label className="flex-1 text-sm">Novo nome<input required maxLength={160} className={classeInput} value={nome} onChange={e => setNome(e.target.value)} /></label><AjudaCampo rotulo="Ajuda: renomear lote" texto="A alteração ficará no histórico de auditoria." /></div></form>
    </DialogFinanceiro>}
    {editando && produtoEdicao && <FormProduto produto={produtoEdicao} onSalvo={() => { setEditando(false); setRevisao(r => r + 1); }} onFechar={() => setEditando(false)} />}
  </div></PaginaFinanceira>;
}
