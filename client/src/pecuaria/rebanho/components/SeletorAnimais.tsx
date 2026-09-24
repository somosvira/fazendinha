// Seletor de animais reutilizável — mesmo painel lateral largo dos cadastros
// (PainelCadastro), mas com busca + filtros + tabela paginada com checkboxes.
// Usado por "Movimentar animais" (ListaLotes) e "Trazer animais" (DetalheLote).
// A seleção é mantida em um Map por id, então sobrevive à troca de página e de
// filtros — só é limpa quando o painel é fechado/confirmado.

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { listarAnimais, obterCatalogos } from "../api";
import type { AnimalResumo, Catalogos } from "../types";
import { rotuloCategoria } from "../lib/rotulos";
import { BarraFiltros, Paginacao } from "../ui";
import { Button, type ColunaTabela, Empty, ErrorBox, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";
import { Loader } from "../../../components/Loading";

const ITENS_POR_PAGINA = 20;

export function SeletorAnimais({ excluirLoteId, onConfirmar, onCancelar }: {
  /** oculta este lote do filtro de origem e exclui da lista os animais que estão nele hoje */
  excluirLoteId?: string;
  onConfirmar: (animais: AnimalResumo[]) => void;
  onCancelar: () => void;
}) {
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [itens, setItens] = useState<AnimalResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [textoBusca, setTextoBusca] = useState("");
  const [busca, setBusca] = useState("");
  const [propriedadeId, setPropriedadeId] = useState("");
  const [loteId, setLoteId] = useState("");
  const [pagina, setPagina] = useState(1);

  const [selecionados, setSelecionados] = useState<Map<string, AnimalResumo>>(new Map());

  useEffect(() => { obterCatalogos().then(setCatalogos).catch((e) => setErro(e instanceof Error ? e.message : String(e))); }, []);

  useEffect(() => {
    let vigente = true;
    setCarregando(true); setErro(null);
    listarAnimais({
      busca: busca.trim() || undefined,
      propriedadeId: propriedadeId ? Number(propriedadeId) : undefined,
      loteId: loteId || undefined,
      situacao: "ATIVO",
      page: pagina,
      pageSize: ITENS_POR_PAGINA,
    })
      .then((resultado) => { if (vigente) { setItens(resultado.itens); setTotal(resultado.total); } })
      .catch((e) => { if (vigente) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; };
  }, [busca, propriedadeId, loteId, pagina]);

  // busca só dispara depois de 300 ms sem digitar
  useEffect(() => {
    const t = setTimeout(() => { if (textoBusca !== busca) { setBusca(textoBusca); setPagina(1); } }, 300);
    return () => clearTimeout(t);
  }, [textoBusca, busca]);

  // filtra o lote excluído fora da lista, mesmo quando "Todos os lotes" está selecionado
  const itensExibidos = useMemo(() => itens.filter((a) => !excluirLoteId || a.lote?.id !== excluirLoteId), [itens, excluirLoteId]);
  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
  const lotesDoSitio = useMemo(
    () => (catalogos?.lotes ?? []).filter((lote) => (!propriedadeId || String(lote.propriedadeId) === propriedadeId) && lote.id !== excluirLoteId),
    [catalogos, propriedadeId, excluirLoteId],
  );

  const alternar = (animal: AnimalResumo) => setSelecionados((atual) => {
    const novo = new Map(atual);
    if (novo.has(animal.id)) novo.delete(animal.id);
    else novo.set(animal.id, animal);
    return novo;
  });

  const todosDaPaginaSelecionados = itensExibidos.length > 0 && itensExibidos.every((a) => selecionados.has(a.id));
  const alternarTodosDaPagina = () => setSelecionados((atual) => {
    const novo = new Map(atual);
    if (todosDaPaginaSelecionados) itensExibidos.forEach((a) => novo.delete(a.id));
    else itensExibidos.forEach((a) => novo.set(a.id, a));
    return novo;
  });

  const filtrar = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPagina(1); };

  const COLUNAS: ColunaTabela<AnimalResumo>[] = [
    { chave: "selecionar", titulo: "", larguraMinima: 44, acoes: true, celula: (item) => <label className="flex items-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${item.brinco}`} checked={selecionados.has(item.id)} onChange={() => alternar(item)} /></label> },
    { chave: "brinco", titulo: "Brinco", larguraMinima: 140, principal: true, celula: (item) => <><strong className="break-words">{item.brinco}</strong>{item.nome && <div className="mt-1 text-xs text-ink-3">{item.nome}</div>}</> },
    { chave: "categoria", titulo: "Categoria", larguraMinima: 110, celula: (item) => <Pill>{rotuloCategoria(item.categoria)}</Pill> },
    { chave: "sitio", titulo: "Sítio", larguraMinima: 140, celula: (item) => item.propriedade?.nome ?? "—" },
    { chave: "lote", titulo: "Lote", larguraMinima: 120, celula: (item) => item.lote?.nome ?? "—" },
  ];

  const quantidade = selecionados.size;
  return <PainelCadastro aberto eyebrow="Rebanho" titulo="Selecionar animais" largura="sm:max-w-3xl" onFechar={onCancelar}
    rodape={<><Button secondary onClick={onCancelar}>Cancelar</Button><Button disabled={quantidade === 0} onClick={() => onConfirmar([...selecionados.values()])}>Continuar ({quantidade})</Button></>}>
    <div className="grid gap-4">
      <ErrorBox erro={erro} />
      <div className="overflow-hidden rounded-xl border border-border">
        <BarraFiltros>
          <label className="relative w-full min-w-0 flex-[1_1_200px]"><Search size={16} className="absolute left-3 top-3 text-ink-3" /><input aria-label="Buscar por brinco ou nome" value={textoBusca} onChange={(e) => setTextoBusca(e.target.value)} placeholder="Buscar por brinco ou nome" className="h-[42px] w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm" /></label>
          <select aria-label="Filtrar por sítio" value={propriedadeId} onChange={(e) => { filtrar(setPropriedadeId)(e.target.value); setLoteId(""); }} className="h-[42px] w-full min-w-0 flex-[1_1_150px] rounded-lg border border-border bg-white px-3 text-sm"><option value="">Todos os sítios</option>{catalogos?.propriedades.map((prop) => <option key={prop.id} value={prop.id}>{prop.apelido ?? prop.nome}</option>)}</select>
          <select aria-label="Filtrar por lote de origem" value={loteId} onChange={(e) => filtrar(setLoteId)(e.target.value)} className="h-[42px] w-full min-w-0 flex-[1_1_150px] rounded-lg border border-border bg-white px-3 text-sm"><option value="">Todos os lotes</option>{lotesDoSitio.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</select>
        </BarraFiltros>
        {itensExibidos.length > 0 && <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5 text-sm">
          <label className="flex items-center gap-2 font-medium"><input type="checkbox" aria-label="Selecionar todos da página" checked={todosDaPaginaSelecionados} onChange={alternarTodosDaPagina} /> Selecionar todos da página</label>
          {quantidade > 0 && <span className="text-ink-3">{quantidade} {quantidade === 1 ? "animal selecionado" : "animais selecionados"} no total</span>}
        </div>}
        {carregando && !itensExibidos.length ? <div className="p-6"><Loader label="Carregando animais" /></div>
          : itensExibidos.length ? <>
            <TabelaFinanceira rotulo="Animais" itens={itensExibidos} colunas={COLUNAS} chaveDe={(item) => item.id} onAbrir={(item) => alternar(item)} classeLinha={(item) => selecionados.has(item.id) ? "bg-[#eef1e9]" : ""} />
            <Paginacao paginaAtual={pagina} totalPaginas={totalPaginas} totalItens={total} itensPorPagina={ITENS_POR_PAGINA} onPaginaChange={setPagina} rotulo="animais" idSelect="pagina-seletor-animais" />
          </> : <Empty>Nenhum animal ativo encontrado com os filtros selecionados.</Empty>}
      </div>
    </div>
  </PainelCadastro>;
}
