import { TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import type { CabecalhoProtocolo } from "../protocolos/api";
import { horarioIatf } from "./CampoDataIatf";
import { LinkReproducao } from "./ConsultaReproducaoUI";
import "./ListaProtocolosReprodutivos.css";
import { ICONES_TABELA } from "../../../components/iconesTabela";

const secoes = ["Em execução", "Aguardando resultados", "Programados", "Histórico", "A conferir"] as const;
type Secao = typeof secoes[number];
/** A classificação usa evidências operacionais, sem inferir execução pela data prevista. */
export function secaoProtocolo(p: CabecalhoProtocolo): Secao {
  if (p.status === "ENCERRADA") return "Histórico";
  if (p.status !== "ABERTA") return "A conferir";
  const c = p.contagens;
  if ((c.acompanhamentosPendentes ?? 0) > 0 && (c.pendenciasOperacionais ?? c.pendentes + c.previstos + c.regularizacoes) === 0) return "Aguardando resultados";
  if (c.total > 0 && c.previstos === c.total && c.atendidos === 0 && c.semRegistro === 0 && c.adiados === 0) return "Programados";
  return "Em execução";
}

export function ListaProtocolosReprodutivos({ itens, sitio, aoAbrir }: { itens: CabecalhoProtocolo[]; sitio?: number; aoAbrir: (id: string) => void }) {
  const href = (p: CabecalhoProtocolo) => `/pecuaria/reproducao/programacoes/${encodeURIComponent(p.id)}?retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  const inicio = (p: CabecalhoProtocolo) => horarioIatf(p.inicioReferencia, p.precisaoTemporal).replace(" · horário não informado", "");
  return <div className="repro-protocolos-grupos">{secoes.map(secao => {
    const registros = itens.filter(p => secaoProtocolo(p) === secao);
    if (!registros.length) return null;
    return <section key={secao} className="repro-protocolos-grupo" aria-label={secao}>
      <header><h3>{secao}</h3><span>{registros.length} {registros.length === 1 ? "protocolo" : "protocolos"} nesta página</span></header>
      {<TabelaFinanceira icone={ICONES_TABELA.protocolo} rotulo={secao} itens={registros} chaveDe={p => p.id} onAbrir={p => aoAbrir(p.id)} colunas={[
        { chave: "nome", titulo: "Programação", principal: true, larguraMinima: 200, larguraFlexivel: true, celula: p => <LinkReproducao href={href(p)} sitio={sitio} aoAbrir={() => aoAbrir(p.id)}>{p.nome}</LinkReproducao> },
        { chave: "inicio", titulo: "Início programado", larguraMinima: 160, celula: inicio },
        { chave: "participantes", titulo: "Animais", larguraMinima: 90, celula: p => p.participantesTotal ?? "—" },
        { chave: "acao", titulo: "Ações", acoes: true, larguraMinima: 130, celula: p => <LinkReproducao botao href={href(p)} sitio={sitio} aoAbrir={() => aoAbrir(p.id)}>Ver execução</LinkReproducao> },
      ]} />}
    </section>;
  })}</div>;
}
