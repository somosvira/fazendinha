import { useCallback } from "react";
import { LinkInterno } from "@/components/LinkInterno";
import { Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { EsqueletoTabela } from "../../../components/Esqueleto";
import { consultarVisaoNutricional, type ResumoNutricional } from "./api";
import { useConsulta } from "./consulta";
import { quantidadeNutricional } from "./quantidades";
import { consultarCobertura, DIAS_ATENCAO, hrefProdutoEstoque, textoCobertura, type CoberturaIngrediente } from "./coberturaEstoque";
import { formatarDataBR } from "../lib/rotulos";

const qtd = (n: number) => quantidadeNutricional(String(Math.round(n * 1000) / 1000));

/** Ingredientes da dieta vigente com o saldo do sítio e por quantos dias ele cobre todos os lotes que usam o produto. */
export function EstoqueDieta({ resumo }: { resumo: ResumoNutricional }) {
  const consulta = useConsulta(useCallback(async () => {
    // A demanda de cada produto soma todos os lotes do sítio, não só este.
    const visao = await consultarVisaoNutricional();
    const doSitio = visao.lotes.filter(l => l.lote.propriedadeId === resumo.lote.propriedadeId);
    return (await consultarCobertura(doSitio.some(l => l.lote.id === resumo.lote.id) ? doSitio : [...doSitio, resumo])).get(resumo.lote.id) ?? null;
  }, [resumo]));
  if (!resumo.vigente) return null;
  const c = consulta.dados;
  const compartilhado = c?.ingredientes.some(i => i.consumoSitioDia > i.consumoLoteDia);
  return <Panel className="nutricao-estoque-dieta">
    <div className="nutricao-card-cabecalho"><div><h2 className="h3">Estoque para esta dieta</h2><p>{c?.dias != null ? <>Os ingredientes cobrem <strong className={c.dias < DIAS_ATENCAO ? "nutricao-alerta-texto" : undefined}>{textoCobertura(c.dias)}</strong> com o efetivo de hoje, sem contar o que vence antes do uso{c.limitante ? `; o primeiro a acabar é ${c.limitante.nome}` : ""}.</> : "Saldo no sítio e consumo diário de cada ingrediente."}</p></div></div>
    {consulta.carregando ? <div className="px-5 pb-5"><EsqueletoTabela label="Carregando estoque da dieta" colunas={4} linhas={3} /></div>
      : consulta.erro ? <p role="alert" className="nutricao-aviso mx-5 mb-5">{consulta.erro}</p>
      : !c?.ingredientes.length ? <p className="nutricao-nota px-5 pb-5">A receita não tem ingredientes cadastrados.</p>
      : <TabelaFinanceira rotulo="Estoque dos ingredientes da dieta" itens={c.ingredientes} chaveDe={i => i.produtoId} colunas={[
        { chave: "produto", titulo: "Ingrediente", principal: true, celula: (i: CoberturaIngrediente) => <LinkInterno area="estoque" href={hrefProdutoEstoque(i.produtoId)}>{i.nome}</LinkInterno> },
        { chave: "lote", titulo: "Consumo do lote", alinhamento: "direita", celula: (i: CoberturaIngrediente) => `${qtd(i.consumoLoteDia)} ${i.unidade}/dia` },
        ...(compartilhado ? [{ chave: "sitio", titulo: "Todos os lotes", alinhamento: "direita" as const, celula: (i: CoberturaIngrediente) => `${qtd(i.consumoSitioDia)} ${i.unidade}/dia` }] : []),
        { chave: "saldo", titulo: "Saldo no sítio", alinhamento: "direita", celula: (i: CoberturaIngrediente) => `${qtd(i.saldo)} ${i.unidade}` },
        { chave: "dias", titulo: "Cobre", alinhamento: "direita", celula: (i: CoberturaIngrediente) => <><span className={i.dias != null && i.dias < DIAS_ATENCAO ? "nutricao-alerta-texto" : undefined}>{textoCobertura(i.dias)}</span>{i.vencendo > 0 && <p className="nutricao-secundario nutricao-alerta-texto">{qtd(i.vencendo)} {i.unidade} vencem antes do uso</p>}{i.proximaValidade && <p className="nutricao-secundario">Validade mais próxima {formatarDataBR(i.proximaValidade)}</p>}</> },
      ]} />}
  </Panel>;
}
