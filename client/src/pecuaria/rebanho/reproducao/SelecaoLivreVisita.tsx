import { useEffect, useRef, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { criteriosVazios, EditorSelecaoVisita, enumerados, validarCriterios } from "./EditorSelecaoVisita";
import { PainelCadastro } from "@/financeiro/PainelCadastro";
import { SelectBuscavel } from "@/components/SelectBuscavel";
import { ResumoCondicoes } from "./TemplatesSelecaoProgramacao";
import { FiltrosSelecaoLivre } from "./FiltrosSelecaoLivre";
import { camposNumericos, carregarPreviaCompleta, listarSelecoes, obterOpcoesSelecao, previaGrupo, salvarSelecao, type CriteriosSelecao, type GrupoLivreInput, type GrupoRevisado, type OpcoesSelecao, type PreviaPlanner, type SelecaoVisita, type TipoAtividadeExtra } from "./planner-api";
import type { Visita } from "./visitas-api";
import { Empty } from "@/financeiro/financeiro-ui";

const opcoesVazias: OpcoesSelecao = { lotes: [], categorias: [], racas: [], protocolos: [], tiposExame: [] };
const mensagem = (e: unknown) => e instanceof Error ? e.message : String(e);
const rotulosOrdenacao = { ...camposNumericos, BRINCO: "Brinco", NOME: "Nome" };
export const grupoLivre = (criterios: CriteriosSelecao): GrupoLivreInput => ({ origem:"LIVRE",nome:"Grupo montado por filtros",criterios,tipo:"AVALIACAO_REPRODUTIVA",contexto:{},incluidosManualmente:[] });
export type RascunhoAtividadeLivre = { nome: string; tipo: TipoAtividadeExtra; referencia: string };
export function SelecaoLivreVisita({ visita, sitio, podeLancar, inicial, criterios, onCriterios, onNovoGrupo, onRevisar }: { visita: Visita; sitio: string; podeLancar: boolean; inicial?: GrupoLivreInput; criterios: CriteriosSelecao; onCriterios: (criterios: CriteriosSelecao) => void; onNovoGrupo: () => void; onRevisar: (p: PreviaPlanner) => void }) {
  const [opcoes,setOpcoes] = useState(opcoesVazias), [selecoes,setSelecoes] = useState<SelecaoVisita[]>([]);
  const [previa,setPrevia] = useState<PreviaPlanner|null>(null), [erro,setErro] = useState<string|null>(null), [carregando,setCarregando] = useState(true), [ocupado,setOcupado] = useState(false);
  const [salvas,setSalvas] = useState(false), [editor,setEditor] = useState<SelecaoVisita|"NOVA"|null>(null);
  const [filtroPrevia, setFiltroPrevia] = useState<SelecaoVisita | null>(null);
  const [salvarAtual,setSalvarAtual]=useState(false),[nomeFiltro,setNomeFiltro]=useState(""),[salvando,setSalvando]=useState(false);
  const geracao = useRef(0), bloqueado = useRef(false);
  const data=visita.data.slice(0,10);
  const mudarCriterios = (novos: CriteriosSelecao) => { geracao.current++; setPrevia(null); setCarregando(true); onCriterios(novos); };
  const carregar = () => Promise.all([obterOpcoesSelecao(visita.propriedadeId,data),listarSelecoes(visita.propriedadeId)]).then(([o,s])=>{setOpcoes(o);setSelecoes(s.selecoes);});
  useEffect(()=>{let vivo=true;void Promise.all([obterOpcoesSelecao(visita.propriedadeId,data),listarSelecoes(visita.propriedadeId)]).then(([o,s])=>{if(vivo){setOpcoes(o);setSelecoes(s.selecoes);}}).catch(e=>{if(vivo)setErro(mensagem(e));});return()=>{vivo=false;};},[visita.propriedadeId,data]);
  useEffect(()=>{
    const atual=++geracao.current;setCarregando(true);setPrevia(null);setErro(null);
    const problema=validarCriterios(criterios);if(problema){setErro(problema);setCarregando(false);return;}
    const timer=window.setTimeout(()=>{void previaGrupo(visita.propriedadeId,data,grupoLivre(criterios)).then(p=>{if(atual===geracao.current)setPrevia(p);}).catch(e=>{if(atual===geracao.current)setErro(mensagem(e));}).finally(()=>{if(atual===geracao.current)setCarregando(false);});},350);
    return()=>{window.clearTimeout(timer);geracao.current++;};
  },[criterios,visita.propriedadeId,data]);
  async function revisar(){if(bloqueado.current||carregando||!previa?.total)return;const atual=geracao.current;bloqueado.current=true;setOcupado(true);setErro(null);try {const p=await carregarPreviaCompleta(visita.propriedadeId,data,{...grupoLivre(criterios),incluidosManualmente:inicial?.incluidosManualmente??[]});if(atual===geracao.current)onRevisar(p);}catch(e){if(atual===geracao.current)setErro(mensagem(e));}finally{bloqueado.current=false;setOcupado(false);}}
  const grupos=previa?.animais.reduce<Record<string,number>>((r,a)=>{const nome=enumerados.SITUACAO?.find(o=>o.id===a.situacao)?.nome??"Não informado";r[nome]=(r[nome]??0)+1;return r;},{});
  return <>
    <div className="livre-topo visita-acoes">{podeLancar&&<button className="visita-link" onClick={() => { setErro(null); setSalvarAtual(true); }}>Salvar estes filtros</button>}<button className="visita-botao" onClick={() => { setErro(null); setSalvas(true); }}>Usar filtros salvos</button>{inicial&&<button className="visita-link" onClick={()=>{geracao.current++;onNovoGrupo();}}>Novo grupo</button>}</div>
    {salvas && !editor && <PainelCadastro aberto titulo="Filtros salvos" onFechar={() => { setSalvas(false); setFiltroPrevia(null); }}
      rodape={<>
        {podeLancar && <Button secondary className="sm:mr-auto" onClick={() => setEditor("NOVA")}>Novo filtro</Button>}
        <Button secondary onClick={() => { setSalvas(false); setFiltroPrevia(null); }}>Cancelar</Button>
        <Button disabled={!filtroPrevia?.ativo || !filtroPrevia.versaoAtual} onClick={() => {
          if (!filtroPrevia?.versaoAtual || !filtroPrevia.ativo) return;
          mudarCriterios({ ...structuredClone(filtroPrevia.versaoAtual.criterios), versao: 2 });
          setFiltroPrevia(null); setSalvas(false);
        }}>Usar filtros</Button>
      </>}>
      <ErrorBox erro={erro} />
      {selecoes.length ? <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
        <div className="grid content-start gap-2">{selecoes.map(s => <Button key={s.id} secondary
          aria-pressed={filtroPrevia?.id === s.id} onClick={() => setFiltroPrevia(s)}>{s.nome}{!s.ativo && " · Inativo"}</Button>)}</div>
        {filtroPrevia && <section className="grid content-start gap-3">
          <h3 className="font-semibold">Prévia dos filtros · {filtroPrevia.nome}</h3>
          {filtroPrevia.versaoAtual && <>
            {filtroPrevia.versaoAtual.criterios.todas.length > 0 && <ResumoCondicoes condicoes={filtroPrevia.versaoAtual.criterios.todas} opcoes={opcoes} />}
            {filtroPrevia.versaoAtual.criterios.qualquer.map((grupo, i) => <div key={grupo.id}><h4>Alternativa {i + 1}</h4><ResumoCondicoes condicoes={grupo.todas} opcoes={opcoes} /></div>)}
            {!filtroPrevia.versaoAtual.criterios.todas.length && !filtroPrevia.versaoAtual.criterios.qualquer.length && <p>Todos os animais do sítio na data da visita.</p>}
            <dl className="grid gap-2 text-sm">
              <div><dt className="font-medium">Dados ausentes</dt><dd>{filtroPrevia.versaoAtual.criterios.politicaDesconhecidos === "INCLUIR" ? "Incluir e sinalizar" : "Excluir da seleção"}</dd></div>
              <div><dt className="font-medium">Ordenação</dt><dd>{filtroPrevia.versaoAtual.criterios.ordenacao.map(o => `${rotulosOrdenacao[o.campo]} (${o.direcao === "ASC" ? "crescente" : "decrescente"})`).join(", ")}</dd></div>
            </dl>
          </>}
          {podeLancar && <Button secondary onClick={() => setEditor(filtroPrevia)}>Editar / inativar</Button>}
        </section>}
      </div> : <Empty>Nenhum filtro salvo.</Empty>}
    </PainelCadastro>}
    {editor && <EditorSelecaoVisita key={typeof editor === "string" ? editor : editor.id} propriedadeId={visita.propriedadeId} data={data}
      selecao={editor === "NOVA" ? undefined : editor} onFechar={() => setEditor(null)}
      onSalvo={() => { setEditor(null); setFiltroPrevia(null); void carregar().catch(e => setErro(mensagem(e))); }} />}
    <ErrorBox erro={erro} />
    {salvarAtual && <PainelCadastro aberto compacto titulo="Salvar filtros atuais" bloqueado={salvando}
      onFechar={() => setSalvarAtual(false)} erroRodape={erro}
      rodape={<><Button secondary disabled={salvando} onClick={() => setSalvarAtual(false)}>Cancelar</Button><Button form="salvar-filtros-visita" type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar filtro"}</Button></>}>
      <form id="salvar-filtros-visita" onSubmit={e => {
        e.preventDefault();
        if (salvando) return;
        const problema = validarCriterios(criterios);
        if (problema) { setErro(problema); return; }
        setSalvando(true); setErro(null);
        void salvarSelecao(visita.propriedadeId, nomeFiltro, criterios)
          .then(() => { setSalvarAtual(false); setNomeFiltro(""); return carregar(); })
          .catch(e => setErro(mensagem(e))).finally(() => setSalvando(false));
      }}>
        <label className="grid gap-2">Nome do filtro salvo<input className="rounded-lg border bg-card p-2" required minLength={2} maxLength={120} value={nomeFiltro} onChange={e => setNomeFiltro(e.target.value)} /></label>
      </form>
    </PainelCadastro>}
    <div className="livre-duas-colunas"><fieldset disabled={ocupado} className="min-w-0"><FiltrosSelecaoLivre criterios={criterios} onMudar={mudarCriterios} opcoes={opcoes} data={data} sitio={sitio}/></fieldset><aside className="visita-painel livre-previa" aria-label="Prévia da seleção"><div className="visita-painel-cabecalho"><div><h2>Prévia da seleção </h2><strong className="livre-contador">{carregando?"…":previa?.total??"—"}</strong><p>animais encontrados</p></div></div><div className="livre-corpo" aria-live="polite">{carregando?<p>Atualizando prévia…</p>:previa?.total?<><p>Referência em {data.split("-").reverse().join("/")}</p><dl className="livre-resumo">{(previa.resumoSelecao?.porSituacao.map(r=>[enumerados.SITUACAO?.find(o=>o.id===r.situacao)?.nome??"Não informado",r.animais] as const)??Object.entries(grupos??{})).map(([nome,n])=><div key={nome}><dt>{nome}</dt><dd>{n}</dd></div>)}</dl>{!previa.resumoSelecao && previa.total>previa.animais.length&&<p className="visita-dica">Distribuição dos primeiros {previa.animais.length}. A revisão carregará todos os {previa.total} animais.</p>}</>:<Empty>Nenhum animal encontrado. Ajuste os critérios para montar o grupo.</Empty>}</div></aside></div>
    <div className="visita-rodape"><div><strong>Seleção livre de animais</strong></div><div className="visita-acoes"><button className="visita-link" disabled={ocupado} onClick={()=>mudarCriterios(criteriosVazios())}>Limpar filtros</button><button className="visita-botao primario" disabled={ocupado||carregando||!previa?.total} onClick={()=>void revisar()}>{ocupado?"Carregando grupo…":`Revisar ${previa?.total??0} animais`}</button></div></div>
  </>;
}

export function InclusaoManualLivre({ visita, revisao, onIncluir, onRetirar, bloqueado }: { visita: Visita; revisao: GrupoRevisado; onIncluir: (id: string)=>void; onRetirar: (id: string)=>void; bloqueado: boolean }) {
  const [busca,setBusca]=useState(""),[previa,setPrevia]=useState<PreviaPlanner|null>(null),[erro,setErro]=useState<string|null>(null),[carregando,setCarregando]=useState(false);
  useEffect(()=>{let vivo=true;setPrevia(null);setErro(null);if(busca.trim().length<2){setCarregando(false);return;}setCarregando(true);const timer=window.setTimeout(()=>{const criterios=criteriosVazios();criterios.todas=[{tipo:"VALORES",campo:"BUSCA",valores:[busca.trim()]}];void previaGrupo(visita.propriedadeId,visita.data.slice(0,10),grupoLivre(criterios)).then(p=>{if(vivo)setPrevia(p);}).catch(e=>{if(vivo)setErro(mensagem(e));}).finally(()=>{if(vivo)setCarregando(false);});},300);return()=>{vivo=false;clearTimeout(timer);};},[busca,visita.propriedadeId,visita.data]);
  const [aberto, setAberto] = useState(false);
  const grupo=revisao.previa.grupo.grupo;
  return <div className="p-4"><Button secondary disabled={bloqueado} onClick={() => setAberto(true)}>Incluir animal fora dos filtros</Button>{aberto && <PainelCadastro aberto titulo="Incluir animal fora dos filtros" bloqueado={bloqueado} rascunhoPersistido onFechar={() => setAberto(false)} rodape={<Button secondary disabled={bloqueado} onClick={() => setAberto(false)}>Concluir</Button>}><div className="livre-corpo livre-manual">{grupo.origem === "LIVRE" && grupo.incluidosManualmente.map(id=><div key={id} className="visita-acoes"><span>Inclusão manual · {revisao.previa.animais.find(a=>a.animalId===id)?.brinco??"Animal da seleção anterior"}</span><button type="button" className="visita-link" disabled={bloqueado} onClick={()=>onRetirar(id)}>Retirar inclusão manual</button></div>)}<label>Buscar no sítio<input type="search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Brinco ou nome (mín. 2 caracteres)"/></label><ErrorBox erro={erro}/>{carregando&&<p role="status">Buscando no sítio…</p>}<div className="livre-manual-itens">{previa?.animais.filter(a=>!revisao.previa.animais.some(v=>v.animalId===a.animalId)).map(a=><div key={a.animalId}><span>{a.brinco} · {a.nome??"Sem nome"} · {a.lote?.nome??"Sem lote"}</span><button className="visita-botao pequeno" disabled={bloqueado} onClick={()=>onIncluir(a.animalId)}>Incluir</button></div>)}</div>{previa&&<p className="visita-dica">{previa.total} encontrados; animais já presentes no grupo não são repetidos. Refine a busca se necessário.</p>}</div></PainelCadastro>}</div>;
}

const atividades: [TipoAtividadeExtra,string,string][] = [
  ["AVALIACAO_REPRODUTIVA","Avaliação reprodutiva","Avaliar gestação, reconfirmar ou observar sexo fetal por animal."],
  ["EXAME_SANITARIO","Exame sanitário","Preparar uma coleta ou exame para o grupo."],
  ["APLICACAO_SANITARIA","Aplicação sanitária","Produto e execução serão informados no atendimento."],
  ["INICIAR_IATF","Iniciar protocolo reprodutivo","O início efetivo será registrado no atendimento."],
  ["INICIAR_SANITARIO","Iniciar protocolo sanitário","Escolha o protocolo; execução será registrada no atendimento."],
];
export function DefinirAtividadeLivre({visita,revisao,rascunho,onRascunho,onConfirmar,onVoltar,onReverIncompativeis,bloqueado}:{visita:Visita;revisao:GrupoRevisado;rascunho:RascunhoAtividadeLivre;onRascunho:(r:RascunhoAtividadeLivre)=>void;onConfirmar:(g:GrupoLivreInput)=>Promise<void>;onVoltar:()=>void;onReverIncompativeis:()=>void;bloqueado:boolean}) {
  const g=revisao.previa.grupo.grupo;
  const {nome,tipo,referencia}=rascunho;
  const [erro,setErro]=useState<string|null>(null),[opcoes,setOpcoes]=useState(opcoesVazias),[opcoesCarregadas,setOpcoesCarregadas]=useState(false);
  useEffect(()=>{let vivo=true;setOpcoesCarregadas(false);void obterOpcoesSelecao(visita.propriedadeId,visita.data.slice(0,10)).then(o=>{if(vivo){setOpcoes(o);setOpcoesCarregadas(true);}}).catch(e=>{if(vivo){setErro(mensagem(e));setOpcoesCarregadas(true);}});return()=>{vivo=false;};},[visita.propriedadeId,visita.data]);
  const inicia=tipo==="INICIAR_IATF"||tipo==="INICIAR_SANITARIO",exame=tipo==="EXAME_SANITARIO";
  const referenciasDisponiveis=inicia?opcoes.protocolos.filter(p=>p.ativo&&p.publicadoEm&&p.tipo===(tipo==="INICIAR_IATF"?"REPRODUTIVO":"SANITARIO")):opcoes.tiposExame.filter(t=>t.contexto!=="REPRODUTIVO");
  const referenciaIndisponivel=opcoesCarregadas&&!!referencia&&(inicia||exame)&&!referenciasDisponiveis.some(p=>p.id===referencia);
  const incompativeis=["INICIAR_IATF","AVALIACAO_REPRODUTIVA"].includes(tipo)?revisao.previa.animais.filter(a=>!revisao.excluidos.includes(a.animalId)&&a.sexo!=="F"):[];
  return <div className="livre-duas-colunas"><form id="atividade-livre" onSubmit={e=>{e.preventDefault();if(bloqueado || referenciaIndisponivel || incompativeis.length || ((inicia || exame) && (!referencia || !opcoesCarregadas))) return;setErro(null);void onConfirmar({...((g.origem==="LIVRE"?g:grupoLivre(revisao.previa.grupo.criterios??criteriosVazios()))),nome,tipo,contexto:{...(inicia?{protocoloId:referencia}:{}),...(exame?{tipoExameId:referencia}:{})}}).catch(e=>setErro(mensagem(e)));}}><section className="visita-painel"><div className="visita-painel-cabecalho"><div><h2>O que será feito neste grupo?</h2></div></div><div className="livre-corpo"><ErrorBox erro={erro}/><label>Nome do grupo<input required minLength={2} maxLength={120} value={nome} onChange={e=>onRascunho({...rascunho,nome:e.target.value})}/></label><fieldset className="livre-atividades"><legend>Atividade</legend>{atividades.map(([id,label,descricao])=><label key={id}><input type="radio" name="tipo-atividade" checked={tipo===id} onChange={()=>onRascunho({...rascunho,tipo:id,referencia:id===tipo?referencia:""})}/><span><strong>{label}</strong><small>{descricao}</small></span></label>)}</fieldset>{(inicia || exame) && !opcoesCarregadas && <p role="status">Carregando opções…</p>}
      {(inicia || exame) && opcoesCarregadas && <SelectBuscavel key={tipo} rotulo={inicia ? "Protocolo" : "Tipo de exame"} valor={referencia}
        onChange={valor => onRascunho({ ...rascunho, referencia: valor })}
        buscar={async ({ busca, selecionadoId }) => {
          const termo = busca.trim().toLocaleLowerCase("pt-BR");
          const itens = referenciasDisponiveis.filter(p => selecionadoId ? p.id === selecionadoId : p.nome.toLocaleLowerCase("pt-BR").includes(termo));
          return { itens, total: itens.length };
        }} />}{referenciaIndisponivel&&<p role="alert" className="visita-aviso">A referência anterior não está disponível. Escolha outra antes de incluir o grupo.</p>}{!!incompativeis.length&&<p role="alert" className="visita-aviso"><strong>{incompativeis.length} {incompativeis.length === 1 ? "animal incompatível" : "animais incompatíveis"}</strong> · A atividade exige fêmeas. <Button type="button" secondary onClick={onReverIncompativeis}>Rever incompatíveis</Button></p>}</div></section><section className="visita-painel"><div className="visita-painel-cabecalho"><h2>Visita selecionada</h2></div><div className="livre-corpo"><dl className="livre-resumo"><div><dt>Visita</dt><dd>{visita.nome}</dd></div><div><dt>Data</dt><dd>{visita.data.slice(0,10).split("-").reverse().join("/")}</dd></div><div><dt>Responsável</dt><dd>{visita.responsavel??"Não informado"}</dd></div><div><dt>Origem do grupo</dt><dd>Seleção livre</dd></div></dl></div></section><div className="visita-rodape"><div><strong>{revisao.previa.total-revisao.excluidos.length} animais prontos para inclusão</strong></div><div className="visita-acoes"><button type="button" className="visita-botao" disabled={bloqueado} onClick={onVoltar}>Rever animais</button><button type="submit" className="visita-botao primario" disabled={bloqueado||!!incompativeis.length||referenciaIndisponivel||((inicia||exame)&&(!referencia||!opcoesCarregadas))}>Incluir grupo na visita</button></div></div></form><aside className="visita-painel livre-previa"><div className="visita-painel-cabecalho"><div><h2>Resumo da inclusão</h2><strong className="livre-contador">{revisao.previa.total-revisao.excluidos.length}</strong><p>animais neste grupo</p></div></div><div className="livre-corpo"><p>Origem: seleção livre</p><p>{g.origem==="LIVRE"?g.incluidosManualmente.filter(id=>!revisao.excluidos.includes(id)).length:0} inclusões manuais</p></div></aside></div>;
}
