import { useCallback } from "react";
import { Empty, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { EsqueletoTabela } from "../../../components/Esqueleto";
import { formatarDataBR } from "../lib/rotulos";
import { consultarVisaoNutricional, listarFechamentos, type Fechamento, type ResumoNutricional } from "./api";
import { useConsulta } from "./consulta";
import { LinkNutricional, rotaNutricao } from "./componentes";
import { rotaFechamento, rotaOperacaoNutricional } from "./navegacao";
import { quantidadeNutricional } from "./quantidades";
import { consultarSituacaoFechamentos, type SituacaoLote } from "./situacaoFechamento";
import { LinkInterno } from "@/components/LinkInterno";
import { consultarCobertura, DIAS_ATENCAO, hrefProdutoEstoque, ingredientesEmFalta, textoCobertura } from "./coberturaEstoque";

type Falta = ReturnType<typeof ingredientesEmFalta>[number];

/** Diferença entre conferido e previsto acima da qual o fechamento merece revisão. */
export const LIMITE_DIVERGENCIA = 0.2;

type Revisao = { fechamento: Fechamento; motivos: string[] };
/** Fechamentos confirmados com consumo muito diferente do previsto ou sem custo apurado. */
export function fechamentosParaRevisar(fechamentos: Fechamento[]): Revisao[] {
  return fechamentos.filter(f => f.status === "CONFIRMADO").map(f => {
    const motivos = (f.itens ?? []).flatMap(i => {
      const previsto = Number(i.quantidadePrevista), conferido = Number(i.quantidadeConfirmada);
      if (!(previsto > 0)) return [];
      const variacao = (conferido - previsto) / previsto;
      return Math.abs(variacao) > LIMITE_DIVERGENCIA ? [`${i.produto.nome}: conferido ${quantidadeNutricional(i.quantidadeConfirmada)} ${i.unidade} para ${quantidadeNutricional(i.quantidadePrevista)} previstos (${variacao > 0 ? "+" : "−"}${Math.round(Math.abs(variacao) * 100)}%)`] : [];
    });
    if (f.verValores && f.custoConhecido == null) motivos.push("Custo não apurado");
    return { fechamento: f, motivos };
  }).filter(r => r.motivos.length);
}

export function AlertasNutricao({ podeLancar }: { podeLancar: boolean }) {
  const consulta = useConsulta(useCallback(async () => {
    const [situacoes, visao, recentes] = await Promise.all([consultarSituacaoFechamentos(), consultarVisaoNutricional(), listarFechamentos(undefined, 1, "CONFIRMADO")]);
    // Estoque é complemento: se a consulta falhar, os demais alertas continuam.
    const cobertura = await consultarCobertura(visao.lotes).catch(() => null);
    return { aFechar: situacoes.filter(s => s.dias > 0), semDieta: visao.lotes.filter(l => !l.vigente && l.lote.ativo !== false), revisar: fechamentosParaRevisar(recentes.itens), estoque: cobertura ? ingredientesEmFalta(cobertura, visao.lotes) : [], estoqueIndisponivel: !cobertura };
  }, []));
  if (consulta.carregando) return <EsqueletoTabela label="Carregando alertas da nutrição" colunas={3} linhas={4} />;
  if (consulta.erro) return <p role="alert" className="nutricao-aviso">{consulta.erro}</p>;
  const d = consulta.dados!;
  const nada = !d.aFechar.length && !d.semDieta.length && !d.revisar.length && !d.estoque.length;
  return <div className="nutricao-alertas">
    {nada && <Panel><Empty>Nada precisa de atenção na nutrição agora.</Empty></Panel>}
    {d.aFechar.length > 0 && <Secao titulo="Consumo a fechar" descricao={`${d.aFechar.length} ${d.aFechar.length === 1 ? "lote tem" : "lotes têm"} dias de consumo sem fechamento até ontem.`}>
      <TabelaFinanceira rotulo="Lotes com consumo a fechar" itens={d.aFechar} chaveDe={s => s.resumo.lote.id} colunas={[
        { chave: "lote", titulo: "Lote", principal: true, celula: (s: SituacaoLote) => <><LinkNutricional href={rotaNutricao({ aba: "lotes", loteId: s.resumo.lote.id })}>{s.resumo.lote.nome}</LinkNutricional><p className="nutricao-secundario">{s.resumo.lote.propriedade.nome}</p></> },
        { chave: "dias", titulo: "A fechar", celula: (s: SituacaoLote) => <><strong>{s.dias} {s.dias === 1 ? "dia" : "dias"}</strong><p className="nutricao-secundario">{formatarDataBR(s.inicio)} a {formatarDataBR(s.fim)}</p></> },
        ...(podeLancar ? [{ chave: "acao", titulo: "Ação", acoes: true, celula: (s: SituacaoLote) => <LinkNutricional className="nutricao-botao-secundario" href={rotaOperacaoNutricional("consumo", s.resumo.lote.id)}>Fechar período</LinkNutricional> }] : []),
      ]} />
    </Secao>}
    {d.estoque.length > 0 && <Secao titulo="Estoque acabando ou vencendo" descricao={`Ingredientes das dietas vigentes que cobrem menos de ${DIAS_ATENCAO} dias com o efetivo de hoje, somando todos os lotes de animais do sítio, ou que têm lotes de estoque vencendo antes do uso.`}>
      <TabelaFinanceira rotulo="Ingredientes com estoque acabando ou vencendo" itens={d.estoque} chaveDe={i => `${i.propriedadeId}:${i.produtoId}`} colunas={[
        { chave: "produto", titulo: "Ingrediente", principal: true, celula: (i: Falta) => <LinkInterno area="estoque" href={hrefProdutoEstoque(i.produtoId)}>{i.nome}</LinkInterno> },
        { chave: "cobre", titulo: "Cobre", celula: (i: Falta) => <><strong className={i.dias != null && i.dias < DIAS_ATENCAO ? "nutricao-alerta-texto" : undefined}>{textoCobertura(i.dias)}</strong>{i.vencendo > 0 && <p className="nutricao-secundario nutricao-alerta-texto">{quantidadeNutricional(String(Math.round(i.vencendo * 1000) / 1000))} {i.unidade} vencem antes do uso</p>}</> },
        { chave: "saldo", titulo: "Saldo e consumo", celula: (i: Falta) => <>{quantidadeNutricional(String(i.saldo))} {i.unidade}<p className="nutricao-secundario">{quantidadeNutricional(String(Math.round(i.consumoSitioDia * 1000) / 1000))} {i.unidade}/dia</p></> },
        { chave: "lotes", titulo: "Lotes", larguraFlexivel: true, celula: (i: Falta) => i.lotes.join(", ") },
        { chave: "acao", titulo: "Ação", acoes: true, celula: (i: Falta) => <LinkInterno area="estoque" aparencia="botao-secundario" href={hrefProdutoEstoque(i.produtoId)}>Ver no Estoque</LinkInterno> },
      ]} />
    </Secao>}
    {d.estoqueIndisponivel && <p className="nutricao-nota">Não foi possível consultar o estoque das dietas agora.</p>}
    {d.semDieta.length > 0 && <Secao titulo="Lotes sem dieta vigente" descricao="Sem dieta, o consumo desses animais não entra nos custos da nutrição.">
      <TabelaFinanceira rotulo="Lotes sem dieta vigente" itens={d.semDieta} chaveDe={r => r.lote.id} colunas={[
        { chave: "lote", titulo: "Lote", principal: true, celula: (r: ResumoNutricional) => <><LinkNutricional href={rotaNutricao({ aba: "lotes", loteId: r.lote.id })}>{r.lote.nome}</LinkNutricional><p className="nutricao-secundario">{r.lote.propriedade.nome}</p></> },
        { chave: "animais", titulo: "Animais", alinhamento: "direita", celula: (r: ResumoNutricional) => r.lote.animaisAtivos },
        { chave: "programada", titulo: "Dieta programada", celula: (r: ResumoNutricional) => r.programada ? `${r.programada.dieta.nome} em ${formatarDataBR(r.programada.desde)}` : <span className="nutricao-secundario">Nenhuma</span> },
        ...(podeLancar ? [{ chave: "acao", titulo: "Ação", acoes: true, celula: (r: ResumoNutricional) => <LinkNutricional className="nutricao-botao-secundario" href={rotaOperacaoNutricional("atribuir", r.lote.id)}>Atribuir dieta</LinkNutricional> }] : []),
      ]} />
    </Secao>}
    {d.revisar.length > 0 && <Secao titulo="Fechamentos para revisar" descricao={`Entre os fechamentos confirmados mais recentes: consumo mais de ${Math.round(LIMITE_DIVERGENCIA * 100)}% diferente do previsto ou sem custo apurado.`}>
      <TabelaFinanceira rotulo="Fechamentos para revisar" itens={d.revisar} chaveDe={r => r.fechamento.id} colunas={[
        { chave: "lote", titulo: "Lote e período", principal: true, larguraMinima: 200, celula: (r: Revisao) => <><LinkNutricional href={rotaFechamento(r.fechamento.id)}>{r.fechamento.lote.nome}</LinkNutricional><p className="nutricao-secundario">{r.fechamento.inicio.slice(0, 10) === r.fechamento.fim.slice(0, 10) ? formatarDataBR(r.fechamento.inicio) : `${formatarDataBR(r.fechamento.inicio)} a ${formatarDataBR(r.fechamento.fim)}`}</p></> },
        { chave: "motivo", titulo: "O que revisar", larguraFlexivel: true, celula: (r: Revisao) => <ul className="nutricao-motivos">{r.motivos.map(m => <li key={m}>{m}</li>)}</ul> },
        { chave: "acao", titulo: "Ação", acoes: true, celula: (r: Revisao) => <LinkNutricional className="nutricao-botao-secundario" href={rotaFechamento(r.fechamento.id)}>Ver fechamento</LinkNutricional> },
      ]} />
    </Secao>}
  </div>;
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactNode }) {
  return <section className="nutricao-alerta-secao"><header><h2>{titulo}</h2><p>{descricao}</p></header><Panel className="overflow-hidden">{children}</Panel></section>;
}
