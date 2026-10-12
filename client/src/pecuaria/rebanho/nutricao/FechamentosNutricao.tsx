import { useCallback } from "react";
import { Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { listarLotes } from "../api";
import { formatarDataBR } from "../lib/rotulos";
import { listarFechamentos, type Fechamento } from "./api";
import { useConsulta } from "./consulta";
import { custoTexto, EstadoConsulta, LinkNutricional, rotaNutricao, SituacaoFechamento } from "./componentes";
import { rotaFechamento, useFiltrosNutricionais } from "./navegacao";
import { PaginacaoNutricao } from "./PaginacaoNutricao";

export function FechamentosNutricao({ loteId }: { loteId?: string }) {
  const { params, atualizar } = useFiltrosNutricionais();
  const filtroLote = params.get("filtroLoteId") ?? "";
  const situacao = params.get("statusFechamento");
  const status = situacao === "CONFIRMADO" || situacao === "ESTORNADO" ? situacao : "";
  const numeroPagina = Number(params.get("paginaFechamentos") ?? 1);
  const pagina = Number.isInteger(numeroPagina) && numeroPagina >= 1 && numeroPagina <= 100000 ? numeroPagina : 1;
  const lista = useConsulta(useCallback(() => listarFechamentos(loteId || filtroLote || undefined, pagina, status || undefined), [loteId, filtroLote, pagina, status]));
  const lotes = useConsulta(useCallback(() => loteId ? Promise.resolve([]) : listarLotes(), [loteId]));
  return <Panel className="nutricao-conteudo"><div className="nutricao-card-cabecalho"><div><h2 className="h3">Histórico de fechamentos</h2><p>Consumo confirmado e estornos preservados para consulta.</p></div></div>
    <div className="nutricao-filtros">{!loteId && <label>Lote<select className={classeInput} value={filtroLote} onChange={(e) => { atualizar({ filtroLoteId: e.target.value, paginaFechamentos: "" }); }}><option value="">Todos os lotes</option>{lotes.dados?.map((l) => <option key={l.id} value={l.id}>{l.nome} · {l.propriedade.nome}</option>)}</select>{lotes.erro && <span role="alert">{lotes.erro}</span>}</label>}<label>Situação<select className={classeInput} value={status} onChange={(e) => { atualizar({ statusFechamento: e.target.value, paginaFechamentos: "" }); }}><option value="">Todas as situações</option><option value="CONFIRMADO">Confirmados</option><option value="ESTORNADO">Estornados</option></select></label></div>
    <div className="px-5"><EstadoConsulta erro={lista.erro} carregando={lista.carregando} recarregar={lista.carregar} /></div>
    {lista.dados && <>{!lista.dados.itens.length ? <p className="nutricao-vazio">Nenhum fechamento encontrado neste contexto.</p> : <TabelaFinanceira rotulo="Fechamentos de nutrição" itens={lista.dados.itens} chaveDe={(f) => f.id} colunas={[
      { chave: "periodo", titulo: "Período", principal: true, larguraMinima: 190, celula: (f) => <LinkNutricional href={rotaFechamento(f.id, loteId)}>{formatarDataBR(f.inicio)} – {formatarDataBR(f.fim)}</LinkNutricional> },
      ...(!loteId ? [{ chave: "lote", titulo: "Lote / sítio", celula: (f: Fechamento) => <><LinkNutricional href={rotaNutricao({ loteId: f.lote.id })}>{f.lote.nome}</LinkNutricional><p className="nutricao-secundario">{f.propriedade.nome}</p></> }] : []),
      { chave: "dieta", titulo: "Receita", larguraMinima: 200, celula: (f) => <>{f.vigencia.dieta.nome}<p className="nutricao-secundario">v{f.vigencia.dieta.versao} · {f.animalDias} animal-dias</p></> },
      { chave: "situacao", titulo: "Situação", celula: (f) => <SituacaoFechamento status={f.status} /> },
      ...(lista.dados.itens.some((f) => f.verValores) ? [{ chave: "custo", titulo: "Custo conhecido", celula: (f: Fechamento) => f.verValores ? <>{custoTexto(f.custoConhecido)}{!f.coberturaCustoCompleta && f.custoConhecido != null && <p className="nutricao-secundario">Parcial</p>}</> : "—" }] : []),
      { chave: "abrir", titulo: "", acoes: true, celula: (f) => <LinkNutricional href={rotaFechamento(f.id, loteId)}>Ver fechamento →</LinkNutricional> },
    ]} />}
      <PaginacaoNutricao pagina={pagina} total={lista.dados.total} limite={lista.dados.limite} onPagina={(p) => atualizar({ paginaFechamentos: String(p) })} nome="fechamentos" />
    </>}
  </Panel>;
}
