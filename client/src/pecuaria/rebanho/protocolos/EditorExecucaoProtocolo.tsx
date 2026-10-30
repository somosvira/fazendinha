import { Syringe } from "lucide-react";
import { CampoDataIatf, inputHorarioIatf } from "../reproducao/CampoDataIatf";
import { useEffect, useRef, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import { FormAplicacaoServico, type TarefaAplicacao } from "../sanidade/FormAplicacaoServico";
import type { AplicacaoInput } from "../sanidade/api";
import { ConferenciaExecucao, type PreviaExecucao } from "../sanidade/PreviaExecucao";
import { usePreviaInicioExecucao } from "./PreviaInicioExecucao";
import { reqProtocolo, ProtocoloApiError, type TarefaOperacional } from "./api";
import type { PaginaProtocolo } from "./EtapasProtocolo";

type Item = AplicacaoInput & { tarefaId: string; tipo: "APLICACAO"; desvio?: { motivo: string }; cienciaSanitaria?: boolean; cienciaRecalendarioLegado?: boolean };
type Entrada = { versao: 1; propriedadeId: number; itens: Item[] };
type Previa = { fingerprint: string; temDesvios: boolean; tarefas: PaginaProtocolo<PreviaExecucao["itens"][number] & { inicioLegado: { exigeCiencia: boolean; total: number } }>; consumos: PaginaProtocolo<PreviaExecucao["consumos"][number]> };
type Recibo = PaginaProtocolo<{ tarefaId: string; animalId: string; tipo: "APLICACAO"; id: string }> & { chave: string; versao: 1 };
export function planoAplicacaoTarefa(t: TarefaOperacional): TarefaAplicacao {
  const bruto = t.tarefaOrigem.planejadoSnapshot as { etapa?: { planoAplicacao?: { produtoId: string; dose: string; unidadeDose: string; via?: string; tipoAplicacaoId?: string | null } } } | null;
  const plano = bruto?.etapa?.planoAplicacao;
  const p = t.tarefaOrigem.parametros;
  return { id: t.id, animalId: t.animal.id, produtoId: plano?.produtoId ?? p?.produtoId ?? "", tipoAplicacaoId: plano?.tipoAplicacaoId ?? p?.tipoAplicacaoId ?? "",
    dose: plano?.dose ?? p?.dose ?? "", unidade: plano?.unidadeDose ?? p?.unidade ?? "ML", via: plano?.via ?? p?.via,
    previstaPara: t.previstaPara ?? undefined, protocoloNome: t.tarefaOrigem.execucao.protocolo.nome, protocoloVersao: t.tarefaOrigem.execucao.protocolo.versao };
}

/** Individual é o mesmo contrato com um item; o coletivo confirma todos em uma operação. */
export function EditorExecucaoProtocolo({ tarefas, reprodutivo, onFechar, onSalvo }: { tarefas: TarefaOperacional[]; reprodutivo: boolean; onFechar: () => void; onSalvo: () => void }) {
  const primeira = tarefas[0];
  const [realizacao, setRealizacao] = useState(()=>primeira?.previstaPara?inputHorarioIatf(primeira.previstaPara,primeira.precisaoTemporal):"");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [recibo, setRecibo] = useState<Recibo | null>(null);
  const [entrada, setEntrada] = useState<Entrada | null>(null);
  const [cienciaSanitaria, setCienciaSanitaria] = useState(false);
  const [ciencias, setCiencias] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const chave = useRef(crypto.randomUUID());
  const invalidar = () => { setPrevia(null); setEntrada(null); chave.current = crypto.randomUUID(); };
  if (!primeira || tarefas.length > 100 || tarefas.some(t => t.etapaId !== primeira.etapaId || t.propriedadeId !== primeira.propriedadeId))
    return <PainelCadastro icon={Syringe} aberto titulo="Executar ação" onFechar={onFechar} rodape={<Button secondary onClick={onFechar}>Fechar</Button>}><ErrorBox erro="Selecione de um a cem animais da mesma ação e sítio." /></PainelCadastro>;
  const animais = tarefas.map(t => ({ id: t.animal.id, brinco: t.animal.brinco, propriedadeId: t.propriedadeId }));
  const planos = tarefas.map(planoAplicacaoTarefa);
  async function conferir(itens: Array<AplicacaoInput & { desvio?: { motivo: string } }>) {
    const execucao: Entrada = { versao: 1, propriedadeId: itens[0].propriedadeId, itens: itens.map(i => ({ ...i, tarefaId: i.tarefaId!, tipo: "APLICACAO", ...(reprodutivo ? { cienciaSanitaria, cienciaRecalendarioLegado: ciencias[i.tarefaId!] === true } : {}) })) };
    setErro(null);
    if (!previa || JSON.stringify(execucao) !== JSON.stringify(entrada)) {
      const dados = await reqProtocolo<Previa>("/execucoes/previa", execucao.propriedadeId, execucao);
      setEntrada(execucao); setPrevia(dados); return;
    }
    if (previa.tarefas.itens.some(i => i.motivoObrigatorio && !i.motivo)) throw new Error("Registre os motivos dos desvios e confira novamente.");
    try { setRecibo(await reqProtocolo<Recibo>("/execucoes/confirmar", execucao.propriedadeId, { execucao, chave: chave.current, fingerprint: previa.fingerprint })); }
    catch(e) { if(e instanceof ProtocoloApiError&&e.status===409)invalidar(); throw e; }
  }
  async function paginarPrevia(pagina: number) {
    if (!entrada || ocupado) return;
    setOcupado(true); setErro(null);
    try {
      const nova=await reqProtocolo<Previa>(`/execucoes/previa?pagina=${pagina}&porPagina=10`,entrada.propriedadeId,entrada);
      if (nova.fingerprint!==previa?.fingerprint) { invalidar(); throw new Error("Os dados mudaram. Confira o conjunto novamente."); }
      setPrevia(nova);
    } catch(e) { setErro(e instanceof Error?e.message:String(e)); } finally { setOcupado(false); }
  }
  async function paginarRecibo(pagina:number) {
    if(!recibo||!entrada||ocupado)return;
    setOcupado(true);setErro(null);
    try{setRecibo(await reqProtocolo<Recibo>(`/execucoes/${recibo.chave}/itens?pagina=${pagina}&porPagina=10`,entrada.propriedadeId));}
    catch(e){setErro(e instanceof Error?e.message:String(e));}finally{setOcupado(false);}
  }
  if (recibo) return <PainelCadastro icon={Syringe} aberto titulo="Aplicações registradas" onFechar={onSalvo} rodape={<Button onClick={onSalvo}>Concluir</Button>}><ErrorBox erro={erro}/><p role="status">{recibo.total} aplicações confirmadas em uma única operação.</p><ul>{recibo.itens.map(i=><li key={i.tarefaId}>{animais.find(a=>a.id===i.animalId)?.brinco??"Animal"} · <a href={`/pecuaria/sanidade?animalId=${i.animalId}&detalheTipo=aplicacao&detalheId=${i.id}&propriedadeId=${entrada?.propriedadeId}`}>Abrir aplicação</a></li>)}</ul>{recibo.total>10&&<Paginacao paginaAtual={recibo.pagina} totalPaginas={Math.ceil(recibo.total/10)} totalItens={recibo.total} itensPorPagina={10} onPaginaChange={p=>{void paginarRecibo(p);}} rotulo="aplicações confirmadas" idSelect="recibo-protocolo"/>}</PainelCadastro>;
  const extras = <div onChange={e=>e.stopPropagation()}>{reprodutivo&&<CampoDataIatf rotulo="Data da aplicação" valor={realizacao} onChange={v=>{invalidar();setCiencias({});setRealizacao(v);}}/>}<ErrorBox erro={erro}/><p>{tarefas.length} {tarefas.length===1?"animal selecionado":"animais selecionados"}. A confirmação salva o conjunto inteiro.</p>{reprodutivo&&<label className="flex gap-2"><input type="checkbox" checked={cienciaSanitaria} onChange={e=>{invalidar();setCienciaSanitaria(e.target.checked);}}/>Confirmo ciência dos alertas sanitários aplicáveis a este atendimento.</label>}{previa&&<><ConferenciaExecucao paginadaNoServidor previa={{fingerprint:previa.fingerprint,temDesvios:previa.temDesvios,itens:previa.tarefas.itens,consumos:previa.consumos.itens}} animais={animais}/>{previa.tarefas.total>10&&<Paginacao paginaAtual={previa.tarefas.pagina} totalPaginas={Math.ceil(previa.tarefas.total/10)} totalItens={previa.tarefas.total} itensPorPagina={10} onPaginaChange={p=>{void paginarPrevia(p);}} rotulo="atendimentos em conferência" idSelect="previa-comum-protocolo"/>}{previa.consumos.total>10&&<Paginacao paginaAtual={previa.consumos.pagina} totalPaginas={Math.ceil(previa.consumos.total/10)} totalItens={previa.consumos.total} itensPorPagina={10} onPaginaChange={p=>{void paginarPrevia(p);}} rotulo="consumos previstos" idSelect="previa-consumos-protocolo"/>}{previa.tarefas.itens.filter(i=>i.inicioLegado.exigeCiencia).map(i=><CienciaCalendario key={i.tarefaId} tarefaId={i.tarefaId} propriedadeId={entrada!.propriedadeId} ciencia={ciencias[i.tarefaId]===true} realizadaEm={entrada!.itens.find(t=>t.tarefaId===i.tarefaId)!.aplicadaEm??entrada!.itens.find(t=>t.tarefaId===i.tarefaId)!.data} onChange={valor=>setCiencias(v=>({...v,[i.tarefaId]:valor}))}/>)}</>}{ocupado&&<p role="status">Atualizando conferência…</p>}</div>;
  return <FormAplicacaoServico momentoIatf={reprodutivo?realizacao:undefined} dataInicial={reprodutivo?realizacao.slice(0,10):undefined} animalId={primeira.animal.id} propriedadeId={primeira.propriedadeId} tarefa={planos[0]} tarefas={planos} animais={tarefas.length>1?animais:undefined} onFechar={onFechar} onSalvo={onSalvo} onConferirConjunto={conferir} aoEditarExecucao={invalidar} rotuloSubmeter={previa?"Confirmar conjunto":"Conferir execução"} conteudoExtra={extras}/>;
}
function CienciaCalendario({tarefaId,propriedadeId,realizadaEm,ciencia,onChange}:{tarefaId:string;propriedadeId:number;realizadaEm:string;ciencia:boolean;onChange:(valor:boolean)=>void}) {
  const previa=usePreviaInicioExecucao(tarefaId,propriedadeId,realizadaEm,ciencia);
  useEffect(()=>{onChange(previa.ciencia);},[previa.ciencia]);
  return <div>{previa.conteudo}</div>;
}
