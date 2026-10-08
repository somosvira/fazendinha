import { useEffect, useState } from "react";
import { ArrowDownRight, CornerUpLeft, ChevronRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SkeletonCategorias } from "./CarregamentoFinanceiro";
import { DialogFinanceiro } from "./DialogFinanceiro";
import { obterAnaliseCategorias, type AnaliseCategorias } from "./novo-api";
import { brl, dataBR } from "./financeiro-ui";
import { SEM_VINCULO } from "../lib/ids";
import { navegarPara } from "../router";
import type { MonetaryChartItem } from "../components/charts";

type Linha = AnaliseCategorias["linhas"][number];
function LancamentoCategoria({ linha, inicio, fim }: { linha: Linha; inicio: string; fim: string }) {
  const estorno = Number(linha.valor) < 0;
  const href = linha.operacaoId ? `/financeiro/operacoes/${linha.operacaoId}` : linha.contaId ? `/financeiro/contas/${linha.contaId}?${new URLSearchParams({ inicio, fim })}#movimento-${linha.movimentoId}` : null;
  const Icon = estorno ? CornerUpLeft : ArrowDownRight;
  const conteudo = <Card data-fin-tom={estorno ? "info" : "saida"} className={`gap-3 rounded-lg border-l-4 bg-white p-4 shadow-none ${estorno ? "border-l-[var(--fin-info)]" : "border-l-[var(--fin-saida)]"}`}>
    <div className="flex items-start gap-3">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg fin-icone`}><Icon className="size-5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><time dateTime={linha.data}>{dataBR(linha.data)}</time><Badge variant="outline" className="fin-selo">{estorno ? "Estorno" : "Pagamento"}</Badge></div><p className="line-clamp-2 break-words text-sm font-semibold leading-6" title={linha.descricao ?? undefined}>{linha.descricao ?? "Movimento financeiro"}</p></div>
      <div className="hidden shrink-0 items-center gap-2 sm:flex"><strong className="fin-valor whitespace-nowrap text-base tabular-nums">{brl(linha.valor)}</strong>{href && <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />}</div>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-sm sm:pl-12">
      <Badge variant="secondary" className="max-w-full whitespace-normal break-words"><Layers className="size-3" aria-hidden="true" />{linha.categoria}</Badge>
      <Badge variant="outline" className={`whitespace-normal ${linha.classificacao === "INVESTIMENTO" ? "border-[var(--leite)] bg-[color-mix(in_srgb,var(--leite)_12%,transparent)]" : linha.classificacao === "CUSTEIO" ? "border-[var(--outros)] bg-[color-mix(in_srgb,var(--outros)_12%,transparent)]" : ""}`}>{linha.classificacao === "CUSTEIO" ? "Custeio" : linha.classificacao === "INVESTIMENTO" ? "Investimento" : "Sem classificação"}</Badge>
      <span className="break-words text-muted-foreground">Centro: {linha.centroCusto}</span>
    </div>
    <div className="flex items-center justify-between border-t border-border pt-2 sm:hidden"><strong className="fin-valor tabular-nums">{brl(linha.valor)}</strong>{href && <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />}</div>
  </Card>;
  return href ? <a href={href} aria-label={`Abrir lançamento: ${linha.descricao ?? "Movimento financeiro"}, ${dataBR(linha.data)}, ${brl(linha.valor)}`} className="block rounded-lg outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navegarPara(href); } }}>{conteudo}</a> : conteudo;
}

export function DetalheCategoriaDespesa({ categorias, inicio, fim, onClose }: {
  categorias: MonetaryChartItem[]; inicio: string; fim: string; onClose: () => void;
}) {
  const [dados, setDados] = useState<AnaliseCategorias | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let vigente = true;
    setDados(null); setErro(null); setPagina(1);
    obterAnaliseCategorias({ inicio, fim, base: "pagamentos", ...(categorias.length === 1 ? { categoriaId: categorias[0].id ?? SEM_VINCULO } : {}) })
      .then(resposta => { if (vigente) setDados(resposta); })
      .catch(falha => { if (vigente) setErro(falha instanceof Error ? falha.message : String(falha)); });
    return () => { vigente = false; };
  }, [inicio, fim, categorias, tentativa]);
  const chaves = new Set(categorias.map(item => JSON.stringify([item.id ?? SEM_VINCULO, item.label])));
  const linhas = dados?.linhas.filter(linha => chaves.has(JSON.stringify([linha.categoriaId ?? SEM_VINCULO, linha.categoria]))) ?? [];
  const total = linhas.reduce((soma, linha) => soma + Math.round(Number(linha.valor) * 100), 0) / 100;
  return <DialogFinanceiro tom="saida" titulo={categorias.length === 1 ? categorias[0].label : "Outras categorias"} eyebrow={`Despesas realizadas · ${dataBR(inicio)} a ${dataBR(fim)}`} onClose={onClose} className="max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
    <div className="min-h-0 min-w-0 overflow-auto p-4 sm:p-5">
      {erro ? <div role="alert" className="text-sm"><p>{erro}</p><Button variant="outline" onClick={() => setTentativa(valor => valor + 1)}>Tentar novamente</Button></div> : !dados ? <SkeletonCategorias /> : <>
        <div data-fin-tom="saida" className="fin-cabecalho fin-painel mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg p-4"><div><p className="text-sm text-muted-foreground">Total líquido</p><strong className="fin-valor font-serif text-2xl tabular-nums">{brl(total)}</strong></div><Badge variant="secondary">{linhas.length} lançamentos</Badge></div>
        <p className="mb-4 text-sm text-muted-foreground">Estornos abatem o total. Clique em um lançamento para consultar seus documentos e detalhes completos.</p>
        {linhas.length ? <ul aria-label="Lançamentos da categoria" className="space-y-3">{linhas.slice((pagina - 1) * 15, pagina * 15).map((linha, indice) => <li key={`${linha.movimentoId ?? linha.operacaoId}-${indice}`}><LancamentoCategoria linha={linha} inicio={inicio} fim={fim} /></li>)}</ul> : <p role="status" className="py-6">Nenhum lançamento nesta categoria no período.</p>}
        {linhas.length > 15 && <nav aria-label="Paginação dos lançamentos" className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm"><span>{(pagina - 1) * 15 + 1}–{Math.min(pagina * 15, linhas.length)} de {linhas.length} lançamentos</span><div className="flex gap-2"><Button variant="outline" disabled={pagina === 1} onClick={() => setPagina(atual => atual - 1)}>Anterior</Button><Button variant="outline" disabled={pagina * 15 >= linhas.length} onClick={() => setPagina(atual => atual + 1)}>Próxima</Button></div></nav>}
      </>}
    </div>
  </DialogFinanceiro>;
}
