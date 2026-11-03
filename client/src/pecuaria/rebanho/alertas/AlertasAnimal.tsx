import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { BuscaLista } from "@/components/BuscaLista";
import { useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { Button, ErrorBox, Paginacao, Pill, TabelaFinanceira, dataBR, type ColunaTabela } from "@/financeiro/financeiro-ui";
import { DialogFinanceiro } from "@/financeiro/DialogFinanceiro";
import { SecaoGeralAnimal } from "../components/SecaoGeralAnimal";
import { consultarAlertas, consultarParticipantes, type ConsultaAlertas, type DisposicaoAlertas, type GrupoAlerta, type ParticipanteAlerta, type ParticipantesAlertas } from "./api";
import { rotuloSituacao, situacoesDoGrupo } from "./consulta";
import { CoberturaAlertas } from "./ResumoAlertas";
import { DetalheAlerta } from "./DetalheAlerta";
import "./alertas-animal.css";

const disposicoes: { valor: DisposicaoAlertas; texto: string }[] = [
  { valor: "ATENCAO", texto: "Demandam atenção" }, { valor: "PROXIMOS", texto: "Próximos" },
  { valor: "PROGRAMADOS", texto: "Programados" }, { valor: "HISTORICO", texto: "Histórico" },
];
const data = (valor: string | null) => valor ? dataBR(valor) : "Não informada";
const situacao = (grupo: GrupoAlerta) => grupo.necessidades === 1 && Object.keys(grupo.situacoes).length === 1
  ? rotuloSituacao(Object.keys(grupo.situacoes)[0]) : situacoesDoGrupo(grupo);

export function AlertasAnimal({ animalId, propriedadeId, revisao = 0 }: {
  animalId: string; propriedadeId?: number; podeLancar?: boolean; revisao?: number;
}) {
  const [consulta, setConsulta] = useState({ disposicao: "ATENCAO" as DisposicaoAlertas, busca: "", pagina: 1 });
  const [dados, setDados] = useState<ConsultaAlertas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [grupo, setGrupo] = useState<GrupoAlerta | null>(null);
  const [paginaGrupo, setPaginaGrupo] = useState(1);
  const [participantes, setParticipantes] = useState<ParticipantesAlertas | null>(null);
  const [erroGrupo, setErroGrupo] = useState<string | null>(null);
  const [tentativaGrupo, setTentativaGrupo] = useState(0);
  const [detalhe, setDetalhe] = useState<ParticipanteAlerta | null>(null);
  const visual = useVisualizacaoConsulta("visualAlertasAnimal");

  useEffect(() => {
    const atualizar = () => setVersao(v => v + 1);
    window.addEventListener("pecuaria:alertas-atualizados", atualizar);
    return () => window.removeEventListener("pecuaria:alertas-atualizados", atualizar);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setDados(null); setErro(null);
    consultarAlertas({ ...consulta, animalId, propriedadeId, tamanho: 10 }, controller.signal)
      .then(v => {
        if (controller.signal.aborted) return;
        const ultimaPagina = Math.max(1, Math.ceil(v.total / v.tamanho));
        if (consulta.pagina > ultimaPagina) { setConsulta(c => ({ ...c, pagina: ultimaPagina })); return; }
        setDados(v);
      })
      .catch(e => { if (!controller.signal.aborted) setErro(e instanceof Error ? e.message : "Não foi possível consultar os alertas"); });
    return () => controller.abort();
  }, [animalId, propriedadeId, consulta, revisao, versao]);
  useEffect(() => { setGrupo(null); setDetalhe(null); }, [animalId, propriedadeId]);
  useEffect(() => {
    if (!grupo) return;
    const controller = new AbortController();
    setParticipantes(null); setErroGrupo(null);
    consultarParticipantes(grupo.chave, { disposicao: consulta.disposicao, animalId, propriedadeId, pagina: paginaGrupo, tamanho: 10 }, controller.signal)
      .then(v => {
        if (controller.signal.aborted) return;
        const ultimaPagina = Math.max(1, Math.ceil(v.total / v.tamanho));
        if (paginaGrupo > ultimaPagina) { setPaginaGrupo(ultimaPagina); return; }
        if (v.total === 1 && v.itens.length === 1) { setDetalhe(v.itens[0]); setGrupo(null); }
        else setParticipantes(v);
      })
      .catch(e => { if (!controller.signal.aborted) setErroGrupo(e instanceof Error ? e.message : "Não foi possível consultar este cuidado"); });
    return () => controller.abort();
  }, [grupo, animalId, propriedadeId, paginaGrupo, consulta, tentativaGrupo, versao]);

  const abrir = (item: GrupoAlerta) => { setParticipantes(null); setErroGrupo(null); setPaginaGrupo(1); setGrupo(item); };
  const colunas: ColunaTabela<GrupoAlerta>[] = [
    { chave: "cuidado", titulo: "Cuidado / motivo", principal: true, larguraMinima: 240, larguraFlexivel: true, celula: g => <><strong>{g.titulo}</strong><p className="alertas-animal-motivo">{g.motivo}</p></> },
    { chave: "situacao", titulo: "Situação", larguraMinima: 140, celula: g => <Pill>{situacao(g)}</Pill> },
    { chave: "referencia", titulo: "Referência", larguraMinima: 140, celula: g => <>{g.necessidades > 1 && <span className="alertas-animal-motivo">Primeira referência<br /></span>}{data(g.primeiraData)}</> },
    { chave: "acoes", titulo: "Ações", larguraMinima: 130, acoes: true, celula: g => <Button onClick={() => abrir(g)}>Ver cuidado</Button> },
  ];
  return <SecaoGeralAnimal id="animal-alertas" titulo="Alertas do animal" icon={TriangleAlert} className="alertas-animal">
    <div className="alertas-animal-disposicoes" role="group" aria-label="Situação dos alertas">{disposicoes.map(d => <Button key={d.valor} secondary={consulta.disposicao !== d.valor} aria-pressed={consulta.disposicao === d.valor} onClick={() => setConsulta(c => ({ ...c, disposicao: d.valor, pagina: 1 }))}>{d.texto}</Button>)}</div>
    <div className="alertas-animal-filtros"><BuscaLista rotulo="Buscar alertas deste animal" placeholder="Buscar cuidado ou motivo" valor={consulta.busca} onChange={busca => setConsulta(c => ({ ...c, busca, pagina: 1 }))} /><div role="group" aria-label="Visualização dos alertas" className="alertas-animal-visual"><Button secondary={visual.modo !== "visual"} aria-pressed={visual.modo === "visual"} onClick={() => visual.mudar("visual")}>Lista</Button><Button secondary={visual.modo !== "tabela"} aria-pressed={visual.modo === "tabela"} onClick={() => visual.mudar("tabela")}>Tabela</Button></div></div>
    {erro ? <div className="alertas-animal-estado"><ErrorBox erro={erro} /><Button secondary onClick={() => setVersao(v => v + 1)}>Tentar novamente</Button></div> : !dados ? <p role="status" className="alertas-animal-estado">Consultando alertas…</p> : <>
      <CoberturaAlertas cobertura={dados.cobertura} />
      {dados.itens.length ? <><p className="alertas-animal-total">{dados.total} {dados.total === 1 ? "cuidado" : "cuidados"} neste recorte</p>{visual.modo === "tabela" ? <TabelaFinanceira colunas={colunas} itens={dados.itens} chaveDe={g => g.chave} rotulo="Alertas deste animal" /> : <div className="alertas-animal-lista">{dados.itens.map(g => <article className="alertas-animal-linha" key={g.chave}><TriangleAlert size={22} aria-hidden /><div><strong>{g.titulo}</strong><p className="alertas-animal-motivo">{g.motivo}</p></div><Pill tone={g.situacoes.ATRASADO ? "red" : consulta.disposicao === "HISTORICO" ? "neutral" : "amber"}>{situacao(g)}</Pill><div className="alertas-animal-data"><span>{g.necessidades > 1 ? "Primeira referência" : "Referência"}</span>{data(g.primeiraData)}</div><Button onClick={() => abrir(g)}>Ver cuidado</Button></article>)}</div>}</> : <div className="alertas-animal-vazio" role="status"><TriangleAlert size={28} aria-hidden /><strong>{dados.cobertura.estado === "ATUALIZADA" ? "Nenhum cuidado encontrado nesta consulta." : "Nenhum cuidado disponível neste recorte."}</strong></div>}
      <Paginacao pagina={dados.pagina} totalPaginas={Math.max(1, Math.ceil(dados.total / dados.tamanho))} total={dados.total} porPagina={dados.tamanho} substantivo="cuidados" rotulo="Paginação dos alertas do animal" idSelect="pagina-alertas-animal" onPagina={pagina => setConsulta(c => ({ ...c, pagina }))} />
    </>}
    {grupo && <DialogFinanceiro titulo={grupo.titulo} eyebrow="" onClose={() => setGrupo(null)}><div className="p-4">{erroGrupo ? <><ErrorBox erro={erroGrupo} /><Button secondary onClick={() => setTentativaGrupo(v => v + 1)}>Tentar novamente</Button></> : !participantes ? <p role="status">Consultando os registros deste cuidado…</p> : <>{participantes.itens.length ? <ul className="alertas-animal-registros">{participantes.itens.map(p => <li key={p.id}><div><strong>{p.titulo}</strong><p>{p.motivo}</p><p>{rotuloSituacao(p.situacao)} · Referência: {data(p.dataReferencia)}{p.dataAtencao && p.dataAtencao !== p.dataReferencia ? ` · Atenção: ${data(p.dataAtencao)}` : ""}</p></div><Button onClick={() => { setDetalhe(p); setGrupo(null); }}>Ver cuidado</Button></li>)}</ul> : <p>Este cuidado não tem registros neste recorte.</p>}<Paginacao pagina={participantes.pagina} totalPaginas={Math.max(1, Math.ceil(participantes.total / participantes.tamanho))} total={participantes.total} porPagina={participantes.tamanho} substantivo="registros" rotulo="Paginação dos registros do cuidado" idSelect="pagina-registros-cuidado-animal" onPagina={setPaginaGrupo} /></>}</div></DialogFinanceiro>}
    {detalhe && <DetalheAlerta animalIdAtual={animalId} id={detalhe.id} propriedadeId={detalhe.propriedadeId ?? propriedadeId} onFechar={() => setDetalhe(null)} onAtualizado={() => setVersao(v => v + 1)} />}
  </SecaoGeralAnimal>;
}
