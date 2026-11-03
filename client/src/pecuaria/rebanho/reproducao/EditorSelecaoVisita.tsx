import { AjudaCampo } from "../../../components/Dica";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";

import { camposNumericos, camposValores, obterOpcoesSelecao, salvarSelecao, type CampoNumerico, type CampoValor, type CondicaoSelecao, type CriteriosSelecao, type SelecaoVisita } from "./planner-api";
const campos = {...camposNumericos, ...camposValores};
function ContenedorEditor({inline,titulo,onFechar,rodape,children}: {inline:boolean;titulo:string;onFechar:()=>void;rodape:ReactNode;children:ReactNode}) {
  if (inline) return <div className="space-y-4 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{titulo}</h3><Button secondary onClick={onFechar}>Fechar</Button></div>{children}<div className="flex justify-end">{rodape}</div></div>;
  return <PainelCadastro aberto titulo={titulo} onFechar={onFechar} rodape={rodape}>{children}</PainelCadastro>;
}
export const criteriosVazios = (): CriteriosSelecao => ({versao: 2, todas: [], qualquer: [], ordenacao: [{campo: "BRINCO", direcao: "ASC"}], politicaDesconhecidos: "EXCLUIR"});
export function validarCriterios(c: CriteriosSelecao): string | null {
  for (const condicao of [...c.todas, ...c.qualquer.flatMap(b => b.todas)]) {
    if (condicao.tipo === "FAIXA") {
      const {min, max} = condicao;
      if (min == null && max == null) return "Informe ao menos um limite em cada faixa.";
      if ([min, max].some(n => n != null && (!Number.isFinite(n) || (condicao.campo !== "PESO_KG" && !Number.isInteger(n)) || n < (condicao.campo === "DIAS_ATE_RETORNO" ? -100000 : 0) || n > 100000))) return "Revise os limites: dias e contadores são inteiros; peso admite casas decimais.";
      if (min != null && max != null && (min > max || (min === max && (!condicao.incluirMin || !condicao.incluirMax)))) return "Cada faixa precisa conter ao menos um valor.";
    }
    if (condicao.tipo === "VALORES" && !condicao.valores.length) return "Escolha ao menos um valor em cada condição.";
  }
  if (c.qualquer.some(b => !b.todas.length)) return "Adicione uma condição a cada bloco alternativo ou remova o bloco.";
  return null;
}
export type Opcao = {id: string; nome: string};
export const enumerados: Partial<Record<CampoValor, Opcao[]>> = {
  APTIDAO: [{id:"LEITE",nome:"Leite"},{id:"CORTE",nome:"Corte"},{id:"REPRODUCAO",nome:"Reprodução"}],
  SEXO: [{id:"F",nome:"Fêmea"},{id:"M",nome:"Macho"}], ORIGEM: [{id:"NASCIDO",nome:"Nascimento na fazenda"},{id:"COMPRADO",nome:"Compra"}],
  NASCIMENTO_ESTIMADO: [{id:"SIM",nome:"Estimado"},{id:"NAO",nome:"Conhecido"}], HISTORICO_PARTO: [{id:"CONHECIDO",nome:"Com parto registrado"},{id:"SEM_REGISTRO",nome:"Sem registro de parto"}],
  PROTOCOLO_ATIVO: [{id:"QUALQUER",nome:"Qualquer domínio"},{id:"REPRODUTIVO",nome:"Reprodutivo"},{id:"SANITARIO",nome:"Sanitário"},{id:"AMBOS",nome:"Ambos os domínios"},{id:"NENHUM",nome:"Sem protocolo ativo"}],
  SITUACAO: [["VAZIA","Vazia"],["GESTANTE","Gestante"],["APTA","Apta"],["AGUARDANDO_DIAGNOSTICO","Aguardando diagnóstico"],["DESCONHECIDA","Desconhecida"]].map(([id,nome]) => ({id,nome})),
  PAPEL_REPRODUTIVO: [["NENHUM","Nenhum"],["DOADORA","Doadora"],["RECEPTORA","Receptora"],["CONFLITO","Conflito"]].map(([id,nome]) => ({id,nome})),
  SITUACAO_PRODUTIVA: [["LACTANTE","Lactante"],["SECA","Seca"],["SEM_LACTACAO","Não informada (sem lactação registrada)"],["NAO_INFORMADA","Não informada"]].map(([id,nome]) => ({id,nome})),
  RETORNO_INFORMADO: [{id:"SIM",nome:"Sim"},{id:"NAO",nome:"Não"}],
  RP: [{id:"SIM",nome:"Sim"},{id:"NAO",nome:"Não"}], DESCARTE: [{id:"SIM",nome:"Sim"},{id:"NAO",nome:"Não"}],
};
function novaCondicao(campo: CondicaoSelecao["campo"]): CondicaoSelecao { return campo in camposNumericos ? {tipo:"FAIXA",campo:campo as CampoNumerico,incluirMin:true,incluirMax:true} : {tipo:"VALORES",campo:campo as CampoValor,valores:[]}; }
export function Condicoes({valor, mudar, opcoes}: {valor: CondicaoSelecao[]; mudar: (v: CondicaoSelecao[]) => void; opcoes: Partial<Record<CampoValor, Opcao[]>>}) {
  const atualizar = (i: number, c: CondicaoSelecao) => mudar(valor.map((v,n) => n === i ? c : v));
  return <div className="space-y-3">{valor.map((c,i) => <div key={i} className="rounded-lg border border-border p-3 space-y-2">
    <div className="flex gap-2 flex-wrap"><label className="flex-1 min-w-40">Medida ou atributo<select aria-label={`Campo da condição ${i+1}`} className={classeInput} value={c.campo} onChange={e => atualizar(i,novaCondicao(e.target.value as CondicaoSelecao["campo"]))}>{Object.entries(campos).map(([id,nome]) => <option key={id} value={id}>{nome}</option>)}</select></label><label className="flex-1 min-w-40">Condição<select className={classeInput} value={c.tipo} onChange={e => atualizar(i,e.target.value === "DESCONHECIDO" ? {tipo:"DESCONHECIDO",campo:c.campo} : novaCondicao(c.campo))}><option value={c.campo in camposNumericos ? "FAIXA" : "VALORES"}>{c.campo in camposNumericos ? "Dentro da faixa" : "Igual a um dos valores"}</option><option value="DESCONHECIDO">Não informado / conflito</option></select></label><Button secondary onClick={() => mudar(valor.filter((_,n) => n !== i))}>Remover condição</Button></div>
    {c.tipo === "FAIXA" && <div className="grid grid-cols-2 gap-3">{(["min","max"] as const).map(limite => <label key={limite}>{limite === "min" ? "Mínimo (opcional)" : "Máximo (opcional)"}<input type="number" min={c.campo === "DIAS_ATE_RETORNO" ? -100000 : 0} max={100000} step={c.campo === "PESO_KG" ? "0.01" : 1} className={classeInput} value={c[limite] ?? ""} onChange={e => atualizar(i,{...c,[limite]:e.target.value === "" ? undefined : Number(e.target.value)})}/><span className="flex items-center gap-2 mt-2"><input type="checkbox" checked={c[limite === "min" ? "incluirMin" : "incluirMax"]} onChange={e => atualizar(i,{...c,[limite === "min" ? "incluirMin" : "incluirMax"]:e.target.checked})}/>Incluir limite</span></label>)}</div>}
    {c.tipo === "VALORES" && c.campo === "BUSCA" && <label>Brinco ou nome contém<input className={classeInput} value={c.valores.join(", ")} onChange={e=>atualizar(i,{...c,valores:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)})}/></label>}
    {c.tipo === "VALORES" && c.campo !== "BUSCA" && <fieldset><legend className="text-sm">Aceitar um ou mais valores</legend><div className="flex flex-wrap gap-3 mt-2">{(opcoes[c.campo] ?? []).map(o => <label key={o.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.valores.includes(o.id)} onChange={e => atualizar(i,{...c,valores:e.target.checked ? [...c.valores,o.id] : c.valores.filter(v => v !== o.id)})}/>{o.nome}</label>)}{!opcoes[c.campo]?.length && <p className="text-sm text-ink-3">Nenhuma opção disponível. Cadastre os valores ou use “Não informado”.</p>}</div></fieldset>}
  </div>)}<Button secondary disabled={valor.length >= 30} onClick={() => mudar([...valor,novaCondicao("DEL")])}>Adicionar condição em E</Button></div>;
}
export function EditorSelecaoVisita({propriedadeId,data,selecao,onFechar,onSalvo,inline=false}: {propriedadeId:number;data:string;selecao?:SelecaoVisita;onFechar:()=>void;onSalvo:()=>void;inline?:boolean}) {
  const [nome,setNome] = useState(selecao?.nome ?? "");
  const [criterios,setCriterios] = useState<CriteriosSelecao>(() => ({...structuredClone(selecao?.versaoAtual?.criterios ?? criteriosVazios()),versao:2}));
  const [ativo,setAtivo] = useState(selecao?.ativo ?? true);
  const [erro,setErro] = useState<string|null>(null); const [ocupado,setOcupado] = useState(false);
  const [opcoes,setOpcoes] = useState(enumerados);
  useEffect(() => { let vigente=true; obterOpcoesSelecao(propriedadeId,data).then(s => {if(vigente)setOpcoes({...enumerados,CATEGORIA:s.categorias ?? [],LOTE:s.lotes ?? [],RACA:s.racas,PROTOCOLO:s.protocolos});}).catch(e => {if(vigente)setErro(String(e.message ?? e));}); return () => {vigente=false;}; },[data,propriedadeId]);
  async function salvar() {setErro(null); const problema=validarCriterios(criterios); if(problema){setErro(problema);return;} setOcupado(true);try {await salvarSelecao(propriedadeId,nome,criterios,selecao,ativo);onSalvo();}catch(e){setErro(e instanceof Error?e.message:String(e));}finally{setOcupado(false);}}
  const titulo=selecao?"Editar seleção habitual":"Nova seleção habitual";
  return <ContenedorEditor inline={inline} titulo={titulo} onFechar={onFechar} rodape={<><Button secondary onClick={onFechar} disabled={ocupado}>Cancelar</Button><Button form="selecao-visita" type="submit" disabled={ocupado}>Salvar seleção</Button></>}><form id="selecao-visita" className="space-y-5" onSubmit={e=>{e.preventDefault();void salvar();}}><ErrorBox erro={erro}/><label className="block">Nome<input className={classeInput} value={nome} required minLength={2} maxLength={120} onChange={e=>setNome(e.target.value)}/></label><p className="text-sm text-ink-3">Os animais são recalculados para a data da visita. Salvar critérios não inicia tratamento nem altera as visitas já preparadas.</p>
  <fieldset className="space-y-3"><legend className="font-semibold">Condições gerais — todas em E</legend><Condicoes valor={criterios.todas} mudar={todas=>setCriterios({...criterios,todas})} opcoes={opcoes}/></fieldset>
  <section className="space-y-3"><h3 className="font-semibold">Alternativas — pelo menos um bloco em OU <AjudaCampo rotulo="Ajuda sobre condições alternativas" texto="As condições gerais continuam obrigatórias. Cada bloco abaixo combina suas condições em E."/></h3>{criterios.qualquer.map((b,i)=><fieldset key={b.id} className="rounded-lg bg-surface-2 p-3 space-y-3"><legend>Bloco alternativo {i+1}</legend><Condicoes valor={b.todas} mudar={todas=>setCriterios({...criterios,qualquer:criterios.qualquer.map(v=>v.id===b.id?{...v,todas}:v)})} opcoes={opcoes}/><Button secondary onClick={()=>setCriterios({...criterios,qualquer:criterios.qualquer.filter(v=>v.id!==b.id)})}>Remover bloco</Button></fieldset>)}<Button secondary disabled={criterios.qualquer.length>=20} onClick={()=>setCriterios({...criterios,qualquer:[...criterios.qualquer,{id:crypto.randomUUID(),todas:[]}]})}>Adicionar bloco em OU</Button></section>
  <label className="block">Quando um dado filtrado não for conhecido<select className={classeInput} value={criterios.politicaDesconhecidos} onChange={e=>setCriterios({...criterios,politicaDesconhecidos:e.target.value as CriteriosSelecao["politicaDesconhecidos"]})}><option value="EXCLUIR">Excluir da seleção</option><option value="INCLUIR">Incluir e sinalizar no motivo</option></select></label>
  <fieldset className="space-y-2"><legend className="font-semibold">Ordenação, em ordem de prioridade</legend>{criterios.ordenacao.map((o,i)=><div key={i} className="flex gap-2"><label className="flex-1">Campo<select className={classeInput} value={o.campo} onChange={e=>setCriterios({...criterios,ordenacao:criterios.ordenacao.map((v,n)=>n===i?{...v,campo:e.target.value as typeof o.campo}:v)})}>{Object.entries({BRINCO:"Brinco",NOME:"Nome",...camposNumericos}).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Direção<select className={classeInput} value={o.direcao} onChange={e=>setCriterios({...criterios,ordenacao:criterios.ordenacao.map((v,n)=>n===i?{...v,direcao:e.target.value as "ASC"|"DESC"}:v)})}><option value="ASC">Crescente</option><option value="DESC">Decrescente</option></select></label><Button secondary disabled={criterios.ordenacao.length===1} onClick={()=>setCriterios({...criterios,ordenacao:criterios.ordenacao.filter((_,n)=>n!==i)})}>Remover</Button></div>)}<Button secondary disabled={criterios.ordenacao.length>=5} onClick={()=>setCriterios({...criterios,ordenacao:[...criterios.ordenacao,{campo:"BRINCO",direcao:"ASC"}]})}>Adicionar ordenação</Button></fieldset>
  {selecao&&<label className="flex gap-2"><input type="checkbox" checked={ativo} onChange={e=>setAtivo(e.target.checked)}/>Seleção ativa</label>}</form></ContenedorEditor>;
}
