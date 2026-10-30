import { useEffect, useState } from "react";
import { GitBranch, ListChecks, ShieldCheck } from "lucide-react";
import { Button, ErrorBox, Modal, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import { type CadastroProtocoloMeta, type PaginaCadastro } from "./cadastros-api";
import { obterEstruturaCadastro, obterProcedimentosEtapaCadastro, type EtapaEstruturaCadastro, type ProcedimentoCadastro } from "./estrutura-cadastro-api";
import { UNIDADES } from "../../../lib/unidades";

export function intervaloProcedimento(intervalo: number, unidade: string) {
  return `${unidade === "HORAS" ? "H" : "D"}${intervalo.toLocaleString("pt-BR", { maximumFractionDigits: 20 })}`;
}
function ProcedimentosEtapa({ origem, etapa }: { origem: CadastroProtocoloMeta; etapa: EtapaEstruturaCadastro }) {
  const [pagina, setPagina] = useState(1), [revisao, setRevisao] = useState(0);
  const [dados, setDados] = useState(etapa.procedimentos);
  const [carregando, setCarregando] = useState(false), [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    if (pagina === 1) { setDados(etapa.procedimentos); setCarregando(false); setErro(null); return; }
    setCarregando(true); setErro(null);
    obterProcedimentosEtapaCadastro(origem, etapa.id, pagina).then(p => { if (vivo) setDados(p); }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [origem.id, origem.atualizadoEm, etapa, pagina, revisao]);
  return <section className="modelo-detalhe-etapa" aria-label={etapa.nome}>
    <header><div><h3>{etapa.nome}</h3>{!etapa.agrupada && <p>Procedimento individual sem agrupamento em etapa</p>}</div><span>{etapa.modoAtendimento === "AUTOMATIZADA" ? "Confirmação do previsto" : etapa.modoAtendimento === "MANUAL" ? "Preenchimento no atendimento" : "Forma de atendimento não informada"}</span></header>
    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao(v=>v+1)}>Tentar carregar procedimentos novamente</Button>}
    {carregando && <p role="status">Carregando procedimentos…</p>}
    {!carregando && !erro && <TabelaFinanceira<ProcedimentoCadastro> rotulo={`Procedimentos de ${etapa.nome}`} itens={dados.itens} chaveDe={p=>p.id} colunas={[
      {chave:"quando",titulo:"Quando",larguraMinima:85,celula:p=>intervaloProcedimento(p.intervalo,p.unidadeIntervalo)},
      {chave:"procedimento",titulo:"Procedimento",larguraMinima:170,principal:true,celula:p=><><strong>{p.procedimento}</strong>{p.nome !== p.procedimento && <small>{p.nome}</small>}</>},
      {chave:"referencia",titulo:"Produto / modelo",larguraMinima:230,larguraFlexivel:true,celula:p=><>{p.definirMaterialNoAtendimento ? "Material genético definido no atendimento, por animal ou grupo" : p.referencia ?? (p.procedimento === "Retirada de dispositivo" ? "Sem produto vinculado" : "Referência não informada")}{p.via && <small>Via: {p.via}</small>}{p.orientacaoUso && <small>Orientação de uso: {p.orientacaoUso}</small>}</>},
      {chave:"quantidade",titulo:"Quantidade por animal",larguraMinima:150,celula:p=>p.quantidade ? `${p.quantidade} ${(Object.entries(UNIDADES).find(([chave])=>chave===p.unidadeQuantidade)?.[1].rotulo ?? p.unidadeQuantidade ?? "(unidade não informada)")}` : p.definirMaterialNoAtendimento ? "Definida no atendimento" : "—"},
    ]}/>}
    {dados.total > 10 && <Paginacao paginaAtual={pagina} totalPaginas={Math.ceil(dados.total/10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo={`procedimentos de ${etapa.nome}`} idSelect={`procedimentos-${etapa.id}`} />}
    {!carregando && !erro && !dados.total && <p>Nenhum procedimento cadastrado nesta etapa.</p>}
    {etapa.instrucoesGerais && <p className="modelo-detalhe-instrucoes"><strong>Instruções:</strong> {etapa.instrucoesGerais}</p>}
  </section>;
}
export function DetalheModeloProtocolo({ origem, onClose }: { origem: CadastroProtocoloMeta; onClose: () => void }) {
  const [pagina,setPagina] = useState(1), [revisao,setRevisao] = useState(0);
  const [dados,setDados] = useState<PaginaCadastro<EtapaEstruturaCadastro> | null>(null);
  const [erro,setErro] = useState<string|null>(null), [carregando,setCarregando] = useState(true);
  useEffect(()=>{
    let vivo=true; setCarregando(true);setErro(null);setDados(null);
    obterEstruturaCadastro(origem,pagina).then(p=>{if(vivo){setDados(p);if(p.pagina!==pagina)setPagina(p.pagina);}}).catch(e=>{if(vivo)setErro(e instanceof Error ? e.message : String(e));}).finally(()=>{if(vivo)setCarregando(false);});
    return ()=>{vivo=false;};
  },[origem.id,origem.atualizadoEm,pagina,revisao]);
  return <Modal titulo={origem.nome} eyebrow="" onClose={onClose} width="max-w-5xl">
    <div className="modelo-detalhe">
      <dl className="modelo-detalhe-identidade"><div><dt><GitBranch size={18} aria-hidden="true" />Versão</dt><dd>{origem.versao}</dd></div><div><dt><ListChecks size={18} aria-hidden="true" />Procedimentos</dt><dd>{origem.totalEtapas}</dd></div><div><dt><ShieldCheck size={18} aria-hidden="true" />Situação</dt><dd>{!origem.ativo ? "Inativo" : origem.publicado || origem.publicadoEm ? "Disponível para uso" : "Cadastro não concluído"}</dd></div></dl>
      {origem.descricao && <p className="modelo-detalhe-descricao">{origem.descricao}</p>}
      {!origem.publicado && !origem.publicadoEm && <p className="modelo-detalhe-aviso">Cadastro antigo não concluído. Os procedimentos e suas configurações originais permanecem preservados.</p>}
      {origem.referenciaTecnica?.fonte && <p><a href={origem.referenciaTecnica.fonte.url} target="_blank" rel="noreferrer">{origem.referenciaTecnica.fonte.titulo}</a>{origem.referenciaTecnica.versaoReferencia && ` · referência ${origem.referenciaTecnica.versaoReferencia}`}</p>}
      <ErrorBox erro={erro}/>{erro && <Button secondary onClick={()=>setRevisao(v=>v+1)}>Tentar carregar detalhes novamente</Button>}
      {carregando && <p role="status">Carregando etapas e procedimentos…</p>}
      {dados?.itens.map(e=><ProcedimentosEtapa key={`${pagina}:${e.id}`} origem={origem} etapa={e}/>)}
      {dados && !dados.total && <p>Nenhuma etapa ou procedimento cadastrado nesta versão.</p>}
      {dados && dados.total>10 && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.ceil(dados.total/10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="etapas e procedimentos individuais" idSelect="estrutura-modelo"/>}
    </div><footer className="modelo-detalhe-rodape"><span>Consulta da versão · até 10 itens por página</span><Button secondary onClick={onClose}>Fechar detalhes</Button></footer>
  </Modal>;
}
