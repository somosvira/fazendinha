import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { useCallback } from "react";
import { LinkInterno } from "@/components/LinkInterno";
import { Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { EsqueletoLista } from "../../../components/Esqueleto";
import { consultarVisaoNutricional, type ResumoNutricional } from "./api";
import { useConsulta } from "./consulta";
import { quantidadeNutricional, un } from "./quantidades";
import { consultarCobertura, DIAS_ATENCAO, hrefProdutoEstoque, textoCobertura, type CoberturaIngrediente } from "./coberturaEstoque";
import { formatarDataBR } from "../lib/rotulos";

const qtd = (n: number) => quantidadeNutricional(String(Math.round(n * 1000) / 1000));

/** Ingredientes da dieta vigente com o saldo do sítio e por quantos dias ele cobre todos os lotes que usam o produto. */
export function EstoqueDieta({ resumo }: { resumo: ResumoNutricional }) {
  const visual = useVisualizacaoConsulta("visualEstoqueDieta", "nutricao", "visual");
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
    <div className="nutricao-card-cabecalho">
      <div>
        <h2 className="h3">Estoque para esta dieta</h2>
        {c?.dias != null && <p><strong className={c.dias < DIAS_ATENCAO ? "nutricao-alerta-texto" : undefined}>
          {c.dias > 0 ? `Cobre ${textoCobertura(c.dias)}` : textoCobertura(c.dias)}
        </strong></p>}
      </div>
      <AlternarVisualizacaoConsulta {...visual} rotulo="Visualização do estoque da dieta" />
    </div>
    {consulta.carregando ? <div className="px-5 pb-5"><EsqueletoLista label="Carregando estoque da dieta" itens={3} /></div>
      : consulta.erro ? <p role="alert" className="nutricao-aviso mx-5 mb-5">{consulta.erro}</p>
      : !c?.ingredientes.length ? <p className="nutricao-nota px-5 pb-5">A receita não tem ingredientes cadastrados.</p>
      : visual.modo === "tabela" ? <TabelaFinanceira visualizacao="tabela" compacta rotulo="Estoque dos ingredientes da dieta" itens={c.ingredientes} chaveDe={i => i.produtoId} colunas={[
        { chave: "produto", titulo: "Ingrediente", principal: true, celula: (i: CoberturaIngrediente) => <LinkInterno area="estoque" href={hrefProdutoEstoque(i.produtoId)}>{i.nome}</LinkInterno> },
        { chave: "lote", titulo: "Consumo do lote", alinhamento: "direita", celula: (i: CoberturaIngrediente) => `${qtd(i.consumoLoteDia)} ${un(i.unidade)}/dia` },
        ...(compartilhado ? [{ chave: "sitio", titulo: "Todos os lotes", alinhamento: "direita" as const, celula: (i: CoberturaIngrediente) => `${qtd(i.consumoSitioDia)} ${un(i.unidade)}/dia` }] : []),
        { chave: "saldo", titulo: "Saldo no sítio", alinhamento: "direita", celula: (i: CoberturaIngrediente) => `${qtd(i.saldo)} ${un(i.unidade)}` },
        { chave: "dias", titulo: "Cobre", alinhamento: "direita", celula: (i: CoberturaIngrediente) => <><span className={i.dias != null && i.dias < DIAS_ATENCAO ? "nutricao-alerta-texto" : undefined}>{textoCobertura(i.dias)}</span>{i.vencendo > 0 && <p className="nutricao-secundario nutricao-alerta-texto">{qtd(i.vencendo)} {un(i.unidade)} vencem antes do uso</p>}{i.proximaValidade && <p className="nutricao-secundario">Validade mais próxima {formatarDataBR(i.proximaValidade)}</p>}</> },
      ]} />
      : <ul className="nutricao-estoque-ingredientes" aria-label="Estoque dos ingredientes da dieta">
        {c.ingredientes.map(i => (
          <li key={i.produtoId}>
            <header>
              <h3><LinkInterno area="estoque" href={hrefProdutoEstoque(i.produtoId)}>{i.nome}</LinkInterno></h3>
              <strong className={i.dias != null && i.dias < DIAS_ATENCAO ? "nutricao-alerta-texto" : undefined}>
                {textoCobertura(i.dias)}
              </strong>
            </header>
            <dl>
              <div><dt>Consumo do lote</dt><dd>{qtd(i.consumoLoteDia)} {un(i.unidade)}/dia</dd></div>
              {compartilhado && <div><dt>Todos os lotes</dt><dd>{qtd(i.consumoSitioDia)} {un(i.unidade)}/dia</dd></div>}
              <div><dt>Saldo no sítio</dt><dd>{qtd(i.saldo)} {un(i.unidade)}</dd></div>
            </dl>
            {i.proximaValidade && <p className="nutricao-secundario">Validade mais próxima {formatarDataBR(i.proximaValidade)}</p>}
            {i.vencendo > 0 && <p className="nutricao-secundario nutricao-alerta-texto">{qtd(i.vencendo)} {un(i.unidade)} vencem antes do uso</p>}
          </li>
        ))}
      </ul>}
  </Panel>;
}
