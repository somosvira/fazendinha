import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Button, ErrorBox, Panel, Paginacao, TabelaFinanceira, Empty } from '../financeiro/financeiro-ui';
import { SelectBuscavel } from '../components/SelectBuscavel';
import { listarCatalogo, listarCatalogoProdutos, type ItemCatalogo, type ItemCatalogoProduto, type PaginaCatalogoProdutos, type TipoCatalogo } from './catalogos-api';

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

/** Aba "Catálogo" do Estoque: consulta somente leitura dos produtos que o sistema já traz. */
export function CatalogoProdutos() {
  const [busca, setBusca] = useState(''), [pagina, setPagina] = useState(1), [revisao, setRevisao] = useState(0);
  const [dados, setDados] = useState<PaginaCatalogoProdutos | null>(null), [erro, setErro] = useState<string | null>(null), [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro(null);
    const timer = setTimeout(() => { listarCatalogoProdutos({ busca, pagina, porPagina: POR_PAGINA }).then(d => { if (vivo) setDados(d); }).catch(e => { if (vivo) setErro(e.message); }).finally(() => { if (vivo) setCarregando(false); }); }, 200);
    return () => { vivo = false; clearTimeout(timer); };
  }, [busca, pagina, revisao]);
  return <section className="mt-6 grid gap-4" aria-label="Catálogo de produtos">
    <div><h2 className="text-lg font-semibold">Catálogo de produtos</h2><p className="text-sm text-ink-3">Produtos que o sistema já traz. Use-os direto numa compra ou aplicação: eles entram em Produtos ao salvar.</p></div>
    <Panel>
      <div className="grid gap-3 p-4"><label className="text-sm">Buscar por produto ou fabricante<Input type="search" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></label></div>
      <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button>}
      {carregando ? <p role="status" className="p-4">Carregando catálogo…</p> : !erro && (dados?.itens.length
        ? <TabelaFinanceira itens={dados.itens} chaveDe={i => i.id} rotulo="Catálogo de produtos" colunas={[
            { chave: 'produto', titulo: 'Produto', principal: true, celula: i => i.nomeCompleto },
            { chave: 'fabricante', titulo: 'Fabricante', celula: i => i.fabricante?.nome ?? '—' },
            { chave: 'classificacao', titulo: 'Classificação', celula: i => i.classificacaoTecnica?.nome ?? '—' },
            { chave: 'uso', titulo: 'Uso', celula: rotuloUsoCatalogo },
            { chave: 'fazenda', titulo: 'Na fazenda', celula: situacaoNaFazenda },
          ]} />
        : <Empty><strong>Nenhum produto encontrado</strong><p>{busca ? 'Altere a busca.' : 'O catálogo do sistema ainda não tem produtos.'}</p></Empty>)}
      {dados && !carregando && !erro && <Paginacao rotulo="Catálogo de produtos" substantivo="produtos" idSelect="pagina-catalogo" pagina={pagina} totalPaginas={Math.max(1, Math.ceil(dados.total / POR_PAGINA))} total={dados.total} porPagina={POR_PAGINA} onPagina={setPagina} />}
    </Panel>
  </section>;
}
