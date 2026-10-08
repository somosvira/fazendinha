import { Input } from "@/components/ui/input";
import { normalizarBuscaFinanceira } from "./ListaCadastroFinanceiro";
import { Button as UiButton } from "@/components/ui/button";
import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";
import { isoDate } from "../components/DateRangePicker";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Download, FilePenLine, FilePlus2, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { isNovoRelatorioFinanceiro, parseRelatorioFinanceiroId } from "../router";
import { descartarRascunhoRelatorioFinanceiro, listarRelatoriosFinanceiros, obterConfiguracoesFinanceiras, obterRascunhoRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, type ConfiguracoesFinanceiras, type RascunhoRelatorioFinanceiro, type RelatorioFinanceiro } from "./novo-api";
import { Button, Empty, ErrorBox, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, StatusPill, TabelaFinanceira, Paginacao, type ColunaTabela } from "./financeiro-ui";
import { dataCurta } from "./lib/relatorios";
import { NovoRelatorioFinanceiro } from "./NovoRelatorioFinanceiro";
import { RelatorioFinanceiroDetalhe } from "./RelatorioFinanceiroDetalhe";

type Vista = { tipo: "lista" } | { tipo: "novo" } | { tipo: "detalhe"; id: string };
const vistaDaUrl = (pathname: string): Vista => {
  if (isNovoRelatorioFinanceiro(pathname)) return { tipo: "novo" };
  const id = parseRelatorioFinanceiroId(pathname);
  return id != null ? { tipo: "detalhe", id } : { tipo: "lista" };
};
const mensagem = (falha: unknown) => falha instanceof Error ? falha.message : String(falha);
const dataHora = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
const DESCRICAO = "Central dos relatórios emitidos: cada um preserva o recorte, o autor e o PDF gerado.";

function recorte(r: RelatorioFinanceiro) {
  const p = r.parametros;
  const partes = [
    p.tipos?.length ? `${p.tipos.length} tipo${p.tipos.length > 1 ? "s" : ""}` : null,
    p.centroCustoIds?.length ? `${p.centroCustoIds.length} centro${p.centroCustoIds.length > 1 ? "s" : ""}` : null,
    p.categoriaIds?.length ? `${p.categoriaIds.length} categoria${p.categoriaIds.length > 1 ? "s" : ""}` : null,
    p.classificacoes?.length ? p.classificacoes.map((c) => c === "CUSTEIO" ? "custeio" : c === "INVESTIMENTO" ? "investimento" : "não classificadas").join(" + ") : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Sem filtros";
}

export function RelatoriosFinanceiros({ podeExportar = true }: { podeExportar?: boolean }) {
  const [vista, setVista] = useState<Vista>(() => typeof window === "undefined" ? { tipo: "lista" } : vistaDaUrl(window.location.pathname));
  const [relatorios, setRelatorios] = useState<RelatorioFinanceiro[] | null>(null);
  const [cadastros, setCadastros] = useState<ConfiguracoesFinanceiras | null>(null);
  const [rascunho, setRascunho] = useState<RascunhoRelatorioFinanceiro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [recente, setRecente] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [periodoEmissao, setPeriodoEmissao] = useState({ inicio: "", fim: "" });
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [confirmarNovo, setConfirmarNovo] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [lista, dados, draft] = await Promise.all([
        listarRelatoriosFinanceiros(), obterConfiguracoesFinanceiras(),
        podeExportar ? obterRascunhoRelatorioFinanceiro() : Promise.resolve(null),
      ]);
      setRelatorios(lista); setCadastros(dados); setRascunho(draft);
    } catch (falha) { setErro(mensagem(falha)); }
  }, [podeExportar]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const onPop = () => setVista(vistaDaUrl(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const ir = (caminho: string, destino: Vista) => { window.history.pushState(null, "", caminho); setVista(destino); };
  const voltar = () => { ir("/financeiro/relatorios", { tipo: "lista" }); void carregar(); };
  const abrirNovo = async (continuar: boolean) => {
    setErro(null); setAviso(null);
    if (!continuar && rascunho) {
      setIniciando(true);
      try { await descartarRascunhoRelatorioFinanceiro(); setRascunho(null); }
      catch (falha) { setErro(mensagem(falha)); return; }
      finally { setIniciando(false); }
    }
    ir("/financeiro/relatorios/novo", { tipo: "novo" });
  };
  const pedirNovo = () => {
    if (rascunho) setConfirmarNovo(true);
    else void abrirNovo(false);
  };
  const aoGerar = (relatorio: RelatorioFinanceiro, avisoDownload: string | null) => {
    setRascunho(null); setRecente(relatorio.id);
    setAviso(avisoDownload ?? `“${relatorio.nome}” foi gerado e o download do PDF começou.`);
    voltar();
  };
  const baixar = (relatorio: RelatorioFinanceiro) => salvarPdfRelatorioFinanceiro(relatorio).catch((falha) => setErro(mensagem(falha)));
  const abrir = (relatorio: RelatorioFinanceiro) => ir(`/financeiro/relatorios/${relatorio.id}`, { tipo: "detalhe", id: relatorio.id });

  if (vista.tipo === "detalhe") return <RelatorioFinanceiroDetalhe id={vista.id} podeExportar={podeExportar} onVoltar={voltar} />;
  if (vista.tipo === "novo" && podeExportar) {
    if (!cadastros) return <PaginaSemDados titulo="Novo relatório" descricao={DESCRICAO} label="Preparando relatório" erro={erro} />;
    return <NovoRelatorioFinanceiro cadastros={cadastros} rascunho={rascunho} onVoltar={voltar} onGerado={aoGerar} />;
  }
  if (!relatorios) return <PaginaSemDados titulo="Relatórios financeiros" descricao={DESCRICAO} label="Carregando relatórios" erro={erro} />;

  const relatoriosFiltrados = relatorios.filter(r => { const dia = isoDate(new Date(r.geradoEm)); return normalizarBuscaFinanceira(`${r.nome} ${r.autor}`).includes(normalizarBuscaFinanceira(busca)) && (!periodoEmissao.inicio || dia >= periodoEmissao.inicio) && (!periodoEmissao.fim || dia <= periodoEmissao.fim); });
  const variasPropriedades = new Set(relatorios.map((r) => r.propriedadeId)).size > 1;
  const totalPaginas = Math.max(1, Math.ceil(relatoriosFiltrados.length / 15));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const colunas: ColunaTabela<RelatorioFinanceiro>[] = [
    { chave: "nome", titulo: "Relatório", principal: true, larguraMinima: 240, celula: (r) => <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="break-words">{r.nome}</strong>{r.status !== "CONCLUIDO" && <StatusPill status={r.status} />}{r.id === recente && <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-green-800">Novo</span>}</div><div className="mt-0.5 text-xs text-ink-3">{recorte(r)}</div>{r.erro && <div className="mt-1 text-xs text-red-700">{r.erro}</div>}</div> },
    { chave: "periodo", titulo: "Período", larguraMinima: 190, celula: (r) => <span className="whitespace-nowrap">{dataCurta(r.parametros.dataInicio)} a {dataCurta(r.parametros.dataFim)}</span> },
    ...(variasPropriedades ? [{ chave: "propriedade", titulo: "Propriedade", larguraMinima: 150, celula: (r: RelatorioFinanceiro) => r.propriedade }] : []),
    { chave: "gerado", titulo: "Gerado em", larguraMinima: 140, celula: (r) => <span className="whitespace-nowrap">{dataHora(r.geradoEm)}</span> },
    { chave: "autor", titulo: "Autor", larguraMinima: 140, celula: (r) => r.autor },
    { chave: "acoes", titulo: "", alinhamento: "direita", larguraMinima: podeExportar ? 170 : 60, acoes: true, celula: (r) => <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>{podeExportar && r.status === "CONCLUIDO" && <Button secondary onClick={() => void baixar(r)}><Download size={15} /> Baixar PDF</Button>}<ChevronRight size={16} className="hidden text-ink-3 md:inline" aria-hidden /></div> },
  ];
  const acoes = podeExportar ? <div className="flex flex-wrap gap-2">
    {rascunho && <Button secondary onClick={() => void abrirNovo(true)}><FilePenLine size={16} /> Continuar rascunho</Button>}
    <Button disabled={iniciando} onClick={pedirNovo}><FilePlus2 size={16} /> {iniciando ? "Iniciando…" : "Novo relatório"}</Button>
  </div> : undefined;

  return <PaginaFinanceira colorida>
    <PageHeader titulo="Relatórios financeiros" descricao={DESCRICAO} acao={acoes} />
    <ErrorBox erro={erro} />
    {aviso && <div role="status" className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{aviso}</div>}
    <Panel className="mt-6">
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-3">
        <label className="min-w-0 flex-[1_1_240px] text-sm font-medium">Buscar relatório<Input aria-label="Buscar relatório" placeholder="Nome ou autor…" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} className="mt-1" /></label>
        <PeriodoFinanceiroControl inicio={periodoEmissao.inicio} fim={periodoEmissao.fim} allowAll label="Período de emissão" onChange={periodo => { setPeriodoEmissao(periodo); setPagina(1); }} />
        <UiButton variant="outline" onClick={() => void carregar()} aria-label="Atualizar histórico"><RotateCcw size={17} /> Atualizar</UiButton>
      </div>
      <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} total={relatoriosFiltrados.length} porPagina={15} rotulo="Paginação de relatórios" substantivo="relatórios" idSelect="pagina-relatorios" onPagina={setPagina} />
      {relatoriosFiltrados.length === 0
        ? <Empty>{relatorios.length ? "Nenhum relatório emitido no período selecionado." : "Nenhum relatório foi gerado ainda."}</Empty>
        : <TabelaFinanceira rotulo="Relatórios gerados" colunas={colunas} compacta itens={relatoriosFiltrados.slice((paginaAtual - 1) * 15, paginaAtual * 15)} chaveDe={(r) => r.id} onAbrir={abrir} classeLinha={(r) => r.id === recente ? "bg-[#f6f9f2]" : ""} />}
    </Panel>
    <ConfirmDialog
      open={confirmarNovo}
      title="Criar um novo relatório?"
      message="Você já tem um rascunho de relatório em andamento. Para começar outro, o rascunho atual será apagado."
      confirmLabel="Descartar e criar"
      cancelLabel="Continuar rascunho"
      cancelTone="safe"
      tone="danger"
      processando={iniciando}
      onCancel={() => { setConfirmarNovo(false); void abrirNovo(true); }}
      onDismiss={() => setConfirmarNovo(false)}
      onConfirm={() => { setConfirmarNovo(false); void abrirNovo(false); }}
    />
  </PaginaFinanceira>;
}
