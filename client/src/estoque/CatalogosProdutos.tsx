import { navegarPara } from "../router";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConteudoReferenciaMedicamento, PendenciasMedicamento } from "./ReferenciaMedicamento";
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BuscaLista } from '@/components/BuscaLista';
import { BarraConsulta, type CriterioConsulta } from '../financeiro/BarraConsulta';
import { CampoFiltro } from '../financeiro/PainelFiltros';
import { Button, ErrorBox, Panel, Paginacao, TabelaFinanceira, Empty, SelectFiltro } from '../financeiro/financeiro-ui';
import { SelectBuscavel } from '../components/SelectBuscavel';
import { listarCatalogo, listarCatalogoProdutos, obterReferenciaCatalogo, type ItemCatalogo, type ItemCatalogoProduto, type NaFazendaCatalogo, type PaginaCatalogoProdutos, type TipoCatalogo, type UsoCatalogo } from './catalogos-api';
import { ICONES_TABELA } from "../components/iconesTabela";

/** Dropdown buscável de fabricante, classificação técnica ou princípio ativo (cadastros do catálogo do sistema, só leitura). */
export function SeletorCatalogoProduto({ tipo, rotulo, valor, onChange, somenteLeitura }: { tipo: TipoCatalogo; rotulo: string; valor: string; onChange: (id: string, item?: ItemCatalogo) => void; somenteLeitura?: boolean }) {
  const buscar = useCallback(({ busca, selecionadoId }: { busca: string; selecionadoId?: string }) => listarCatalogo(tipo, { busca, pagina: 1, porPagina: 50, selecionadoId, ...(selecionadoId ? {} : { ativo: true }) }), [tipo]);
  if (somenteLeitura && !valor) return <p className="text-sm">{rotulo}: Não informado</p>;
  return <SelectBuscavel<ItemCatalogo> rotulo={rotulo} valor={valor} onChange={onChange} buscar={buscar} somenteLeitura={somenteLeitura} />;
}

export const rotuloUsoCatalogo = (i: Pick<ItemCatalogoProduto, 'usoSanitario' | 'usoNutricional' | 'usoGenetico'>) =>
  [i.usoSanitario && 'Sanitário', i.usoNutricional && 'Nutricional', i.usoGenetico && 'Genético'].filter(Boolean).join(' · ') || '—';

/** Situação do item na fazenda: já adotado (produto da fazenda existe) ou ainda só no catálogo. */
export function situacaoNaFazenda(item: ItemCatalogoProduto): ReactNode {
  return item.produtoId
    ? <a href={`/estoque/produtos/${item.produtoId}`} className="text-primary hover:underline">Em Produtos</a>
    : <span className="text-ink-3">Só no catálogo</span>;
}

const POR_PAGINA = 10;
const ROTULO_USO: Record<UsoCatalogo, string> = { sanitario: 'Sanitário', nutricional: 'Nutricional', genetico: 'Genético' };
const ROTULO_NA_FAZENDA: Record<NaFazendaCatalogo, string> = { sim: 'Em Produtos', nao: 'Só no catálogo' };
const lerUso = (p: URLSearchParams): UsoCatalogo | '' => { const v = p.get('usoCatalogo'); return v && v in ROTULO_USO ? v as UsoCatalogo : ''; };
const lerNaFazenda = (p: URLSearchParams): NaFazendaCatalogo | '' => { const v = p.get('naFazendaCatalogo'); return v === 'sim' || v === 'nao' ? v : ''; };

/** Aba "Catálogo" do Estoque: consulta somente leitura dos produtos que o sistema já traz. */
export function CatalogoProdutos() {
  const [referenciaId, setReferenciaId] = useState(() => new URLSearchParams(location.search).get("referenciaCatalogo"));
  const [referencia, setReferencia] = useState<ItemCatalogoProduto | null>(null);
  const [busca, setBusca] = useState(() => new URLSearchParams(location.search).get('buscaCatalogo') ?? ''), [pagina, setPagina] = useState(1), [revisao, setRevisao] = useState(0);
  const [uso, setUso] = useState<UsoCatalogo | ''>(() => lerUso(new URLSearchParams(location.search)));
  const [naFazenda, setNaFazenda] = useState<NaFazendaCatalogo | ''>(() => lerNaFazenda(new URLSearchParams(location.search)));
  const [dados, setDados] = useState<PaginaCatalogoProdutos | null>(null), [erro, setErro] = useState<string | null>(null), [carregando, setCarregando] = useState(true);
  useEffect(() => {
    const atualizar = () => {
      const params = new URLSearchParams(location.search);
      setReferenciaId(params.get("referenciaCatalogo"));
      setBusca(params.get("buscaCatalogo") ?? "");
      setUso(lerUso(params));
      setNaFazenda(lerNaFazenda(params));
    };
    window.addEventListener("popstate", atualizar);
    return () => window.removeEventListener("popstate", atualizar);
  }, []);
  // A consulta fica no endereço: recarregar a página ou compartilhar o link mantém busca e filtros.
  useEffect(() => {
    const url = new URL(location.href);
    const definir = (chave: string, valor: string) => { if (valor) url.searchParams.set(chave, valor); else url.searchParams.delete(chave); };
    definir("buscaCatalogo", busca); definir("usoCatalogo", uso); definir("naFazendaCatalogo", naFazenda);
    const destino = url.pathname + url.search + url.hash;
    if (destino !== location.pathname + location.search + location.hash) history.replaceState(history.state, "", destino);
  }, [busca, uso, naFazenda]);
  const criterios: CriterioConsulta[] = [
    ...(uso ? [{ id: "uso", rotulo: `Uso: ${ROTULO_USO[uso]}`, limpar: () => { setUso(""); setPagina(1); } }] : []),
    ...(naFazenda ? [{ id: "naFazenda", rotulo: ROTULO_NA_FAZENDA[naFazenda], limpar: () => { setNaFazenda(""); setPagina(1); } }] : []),
  ];
  useEffect(() => {
    if (!referenciaId) { setReferencia(null); return; }
    let vivo = true;
    obterReferenciaCatalogo(referenciaId).then(item => {
      if (vivo) {
        if (item.orientacaoBula || item.conferenciaBula) setReferencia(item);
        else setErro("Este item ainda não possui referência oficial conferida.");
      }
    }).catch(e => { if (vivo) setErro(e.message); });
    return () => { vivo = false; };
  }, [referenciaId]);
  function abrirReferencia(item: ItemCatalogoProduto) {
    setReferencia(item);
    const url = new URL(location.href);
    url.searchParams.set("referenciaCatalogo", item.id);
    url.searchParams.set("buscaCatalogo", busca);
    navegarPara(url.pathname + url.search);
  }
  function fecharReferencia() {
    setReferencia(null);
    const url = new URL(location.href);
    url.searchParams.delete("referenciaCatalogo");
    navegarPara(url.pathname + url.search);
  }
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro(null);
    const timer = setTimeout(() => { listarCatalogoProdutos({ busca, pagina, porPagina: POR_PAGINA, uso: uso || undefined, naFazenda: naFazenda || undefined }).then(d => { if (vivo) setDados(d); }).catch(e => { if (vivo) setErro(e.message); }).finally(() => { if (vivo) setCarregando(false); }); }, 200);
    return () => { vivo = false; clearTimeout(timer); };
  }, [busca, uso, naFazenda, pagina, revisao]);
  const filtrado = !!busca || criterios.length > 0;
  return <section className="mt-6 grid gap-4" aria-label="Catálogo de produtos">
    <Panel>
      <BarraConsulta
        criterios={criterios}
        onLimpar={() => { setUso(""); setNaFazenda(""); setPagina(1); }}
        adicionais={<>
          <CampoFiltro rotulo="Uso"><SelectFiltro rotulo="Filtrar por uso" valor={uso} onChange={v => { setUso(v as UsoCatalogo | ''); setPagina(1); }} opcoes={[{ valor: "", texto: "Todos os usos" }, ...(Object.keys(ROTULO_USO) as UsoCatalogo[]).map(valor => ({ valor, texto: ROTULO_USO[valor] }))]} className="w-full sm:!w-full" /></CampoFiltro>
          <CampoFiltro rotulo="Na fazenda"><SelectFiltro rotulo="Filtrar pela situação na fazenda" valor={naFazenda} onChange={v => { setNaFazenda(v as NaFazendaCatalogo | ''); setPagina(1); }} opcoes={[{ valor: "", texto: "Todos" }, { valor: "sim", texto: ROTULO_NA_FAZENDA.sim }, { valor: "nao", texto: ROTULO_NA_FAZENDA.nao }]} className="w-full sm:!w-full" /></CampoFiltro>
        </>}
      ><BuscaLista rotulo="Buscar por produto ou fabricante" placeholder="Buscar por produto ou fabricante" valor={busca} onChange={valor => { setBusca(valor); setPagina(1); }} /></BarraConsulta>
      <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button>}
      {carregando ? <p role="status" className="p-4 text-sm text-ink-3">Carregando catálogo…</p> : !erro && (dados?.itens.length
        ? <TabelaFinanceira icone={ICONES_TABELA.produto} itens={dados.itens} chaveDe={i => i.id} rotulo="Catálogo de produtos" colunas={[
            { chave: 'produto', titulo: 'Produto', principal: true, celula: i => i.orientacaoBula || i.conferenciaBula ? <button type="button" className="text-left text-primary underline underline-offset-2" onClick={() => abrirReferencia(i)} aria-label={`Consultar informações de ${i.nomeCompleto}`}>{i.nomeCompleto}</button> : i.nomeCompleto },
            { chave: 'fabricante', titulo: 'Fabricante', celula: i => i.fabricante?.nome ?? '—' },
            { chave: 'classificacao', titulo: 'Classificação', celula: i => i.classificacaoTecnica?.nome ?? '—' },
            { chave: 'uso', titulo: 'Uso', celula: rotuloUsoCatalogo },
            { chave: 'fazenda', titulo: 'Na fazenda', celula: situacaoNaFazenda },
          ]} />
        : <Empty><strong>Nenhum produto encontrado</strong><p>{filtrado ? 'Altere a busca ou os filtros.' : 'O catálogo do sistema ainda não tem produtos.'}</p></Empty>)}
      {dados && !carregando && !erro && <Paginacao rotulo="Catálogo de produtos" substantivo="produtos" idSelect="pagina-catalogo" pagina={pagina} totalPaginas={Math.max(1, Math.ceil(dados.total / POR_PAGINA))} total={dados.total} porPagina={POR_PAGINA} onPagina={setPagina} />}
    </Panel>
    <Dialog open={!!referencia} onOpenChange={aberto => { if (!aberto) fecharReferencia(); }}>
      <DialogContent className="max-h-[calc(100dvh-32px)] overflow-y-auto p-6 gap-5" aria-describedby={undefined}>
        <DialogTitle>{referencia?.nomeCompleto}</DialogTitle>
        
        {referencia?.orientacaoBula ? <ConteudoReferenciaMedicamento referencia={referencia.orientacaoBula} /> : referencia?.conferenciaBula && <PendenciasMedicamento pendencias={referencia.conferenciaBula.pendencias} fontes={referencia.conferenciaBula.fontesParaConferencia} />}
      </DialogContent>
    </Dialog>
  </section>;
}
