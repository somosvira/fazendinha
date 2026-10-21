import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import { obterAcoesCadastro, type CadastroProtocoloMeta, type PaginaCadastro } from "./cadastros-api";

export function AcoesCadastroPersistidas<T>({ origem, renderizar }: { origem: CadastroProtocoloMeta; renderizar: (item: T, indice: number) => ReactNode }) {
  const [pagina, setPagina] = useState(1);
  const [revisao, setRevisao] = useState(0);
  const [dados, setDados] = useState<PaginaCadastro<T> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro(null); setDados(null);
    obterAcoesCadastro<T>(origem, pagina).then(p => { if (vivo) setDados(p); }).catch(e => { if (vivo) setErro(e.message); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [origem.id, origem.atualizadoEm, pagina, revisao]);
  return <div className="grid gap-3"><ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao(v => v + 1)}>Tentar carregar ações novamente</Button>}{carregando && <p role="status">Carregando ações…</p>}{dados?.itens.map((item, i) => renderizar(item, (dados.pagina - 1) * dados.porPagina + i))}{dados && dados.total > 10 && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.ceil(dados.total / 10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="ações da versão" idSelect={`acoes-${origem.id}`} />}</div>;
}

/** Navegação explícita carrega cada página uma vez; nenhuma página substitui edições já feitas. */
export function EditorAcoesCadastro<T extends { ordem?: number }>({ origem, itens, onChange, converter, onCompletoChange, renderizar }: {
  origem: CadastroProtocoloMeta | null; itens: T[]; onChange: (itens: T[]) => void;
  converter: (item: T) => T; onCompletoChange: (completo: boolean) => void;
  renderizar: (item: T, indiceOriginal: number) => ReactNode;
}) {
  const [pagina, setPagina] = useState(1);
  const [paginasCarregadas, setPaginasCarregadas] = useState<number[]>([]);
  const ordensPorPagina = useRef(new Map<number, number[]>());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);
  const itensRef = useRef(itens); itensRef.current = itens;
  const mudarRef = useRef(onChange); mudarRef.current = onChange;
  const converterRef = useRef(converter); converterRef.current = converter;
  const completo = !origem || paginasCarregadas.length >= Math.ceil(origem.totalEtapas / 10);
  useEffect(() => { onCompletoChange(completo && itensRef.current.length <= 100); }, [completo, onCompletoChange]);
  useEffect(() => {
    if (!origem || paginasCarregadas.includes(pagina) || completo) return;
    let vivo = true; setCarregando(true); setErro(null);
    obterAcoesCadastro<T>(origem, pagina).then(p => {
      if (!vivo) return;
      const novos = p.itens.map(item => converterRef.current(item));
      ordensPorPagina.current.set(p.pagina, novos.flatMap(item => item.ordem == null ? [] : [item.ordem]));
      mudarRef.current([...itensRef.current, ...novos].sort((a, b) => (a.ordem ?? Infinity) - (b.ordem ?? Infinity)));
      setPaginasCarregadas(ps => [...ps, p.pagina]);
    }).catch(e => { if (vivo) setErro(e.message); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [origem?.id, origem?.atualizadoEm, pagina, completo, paginasCarregadas, revisao]);
  const total = completo ? itens.length : origem?.totalEtapas ?? itens.length;
  const atual = Math.min(pagina, Math.max(1, Math.ceil(total / 10)));
  const visiveis = completo ? itens.map((item, indice) => ({ item, indice })).slice((atual - 1) * 10, atual * 10) : itens.map((item, indice) => ({ item, indice })).filter(({ item }) => item.ordem != null && ordensPorPagina.current.get(atual)?.includes(item.ordem));
  return <div className="grid gap-3">
    {!completo && <p role="status" className="text-sm">{itens.length} de {origem?.totalEtapas} ações carregadas. Visite todas as páginas para salvar ou derivar esta versão sem perder ações. Adicionar e remover ficam disponíveis após o carregamento completo.</p>}
    {origem && origem.totalEtapas > 100 && <p role="alert">Esta versão excede o limite de 100 ações deste editor.</p>}
    <ErrorBox erro={erro} />{erro && <Button secondary type="button" onClick={() => setRevisao(v => v + 1)}>Tentar carregar ações novamente</Button>}
    {carregando && <p role="status">Carregando ações…</p>}
    {visiveis.map(({ item, indice }) => renderizar(item, indice))}
    {total > 10 && <Paginacao paginaAtual={atual} totalPaginas={Math.ceil(total / 10)} totalItens={total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="ações do rascunho" idSelect="pagina-acoes-cadastro" />}
  </div>;
}
