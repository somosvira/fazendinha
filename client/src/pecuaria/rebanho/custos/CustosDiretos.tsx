import { useCallback, useEffect, useRef, useState } from "react";
import { LinkInterno } from "../../../components/LinkInterno";
import { linkOperacaoFinanceira } from "../../../financeiro/navegacao";
import { Button, brl } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { getUsuario } from "../../../lib/auth";
import { temAcessoArea } from "../../../lib/areas";
import { obterCustos, escreverCustos, obterPreparatorios, type CustosDTO, type EscopoCustos, type Classificacao, type TipoFonte, type ResumoCustos, type Componente } from "./api";
const rotulos:Record<string,string>={COMPLETO:"Completo",PARCIAL:"Parcial",DESCONHECIDO:"Desconhecido",OCULTO:"Valores ocultos",CONHECIDO:"Conhecido",NAO_APLICAVEL:"Não aplicável",INCLUIDO_PACOTE:"Incluído no pacote",REPRODUCAO:"Reprodução",SANIDADE:"Sanidade",ROTINA:"Rotina/manutenção"};
function linkFato(c:Componente,propriedadeId:number){
 if(c.tipoFonte==="NUTRICAO")return `/pecuaria/rebanho/animais/${encodeURIComponent(c.animalId)}#nutricao`;
 const query=new URLSearchParams({animalId:c.animalId,propriedadeId:String(propriedadeId)});
 if(c.tipoFonte==="TENTATIVA"){query.set("fatoId",c.fonteId);return `/pecuaria/reproducao?${query}`;}
 query.set("detalheTipo",c.tipoFonte==="APLICACAO"?"aplicacao":c.tipoFonte==="EXAME"?"exame":"execucao");query.set("detalheId",c.fonteId);
 return `/pecuaria/sanidade?${query}`;
}
const inicial:Classificacao={finalidade:null,materialNaoAplicavel:false,servicoNaoAplicavel:false,coberturaServico:"PROCEDIMENTO",valorMaterialDocumentado:null};
export function CustosDiretos({propriedadeId,podeLancar,...escopo}:{propriedadeId:number;podeLancar:boolean}&EscopoCustos){
 const [resposta,setResposta]=useState<CustosDTO|null>(null),[respostaIdentidade,setRespostaIdentidade]=useState(""),[erro,setErro]=useState(""),[ocupado,setOcupado]=useState(false),[carregando,setCarregando]=useState(true);
 const [inicio,setInicio]=useState(""),[fim,setFim]=useState(""),[finalidade,setFinalidade]=useState(""),[pagina,setPagina]=useState(1),[atualizacao,setAtualizacao]=useState(0);
 const [fonte,setFonte]=useState(""),[c,setC]=useState<Classificacao>(inicial),[valor,setValor]=useState(""),[referencia,setReferencia]=useState(""),[evidencia,setEvidencia]=useState(""),[motivo,setMotivo]=useState("");
 const [chave,setChave]=useState(()=>crypto.randomUUID()),[candidatos,setCandidatos]=useState<Array<{id:string;tipo:TipoFonte;descricao:string;data:string}&ResumoCustos>>([]),[preparo,setPreparo]=useState(""),[modo,setModo]=useState("INTEGRAL"),[material,setMaterial]=useState(""),[servico,setServico]=useState("");
 const usuario=getUsuario();const podeEditar=podeLancar&&!!usuario&&temAcessoArea(usuario.areas,"financeiro",!!usuario.dono)&&(!!usuario.dono||usuario.flags.includes("verValores"));
 const {animalId,tentativaId,participacaoId,aplicacaoId,exameId,programacaoId}=escopo;
 const identidade=JSON.stringify([propriedadeId,animalId,tentativaId,participacaoId,aplicacaoId,exameId,programacaoId]);
 const contextoAtual=useRef({identidade});
 if(contextoAtual.current.identidade!==identidade)contextoAtual.current={identidade};
 const contexto=contextoAtual.current;
 const sequencia=useRef(0),sequenciaPreparo=useRef(0);
 const dados=respostaIdentidade===identidade?resposta:null;
 const carregar=useCallback(async()=>{
  const pedido=++sequencia.current;setCarregando(true);setResposta(null);
  try{const r=await obterCustos({animalId,tentativaId,participacaoId,aplicacaoId,exameId,programacaoId},propriedadeId,inicio,fim,pagina,finalidade);
   if(contexto===contextoAtual.current&&pedido===sequencia.current){setResposta(r);setRespostaIdentidade(identidade);setErro("");}
  }catch(e){if(contexto===contextoAtual.current&&pedido===sequencia.current){setResposta(null);setErro(e instanceof Error?e.message:String(e));}}
  finally{if(contexto===contextoAtual.current&&pedido===sequencia.current)setCarregando(false);}
 },[animalId,tentativaId,participacaoId,aplicacaoId,exameId,programacaoId,propriedadeId,inicio,fim,pagina,finalidade,contexto,identidade]);
 useEffect(()=>{void carregar();},[carregar,atualizacao]);
 useEffect(()=>{setFonte("");setC(inicial);setValor("");setReferencia("");setEvidencia("");setMotivo("");setCandidatos([]);setPreparo("");setModo("INTEGRAL");setMaterial("");setServico("");setErro("");setOcupado(false);setPagina(1);setChave(crypto.randomUUID());sequenciaPreparo.current++;},[identidade]);
 async function carregarPreparos(){
  if(!tentativaId)return;const pedido=++sequenciaPreparo.current;
  try{const r=await obterPreparatorios(tentativaId,propriedadeId);if(contexto===contextoAtual.current&&pedido===sequenciaPreparo.current)setCandidatos(r.itens);}
  catch(e){if(contexto===contextoAtual.current&&pedido===sequenciaPreparo.current)setErro(e instanceof Error?e.message:String(e));}
 }
 const alterar=()=>setChave(crypto.randomUUID());
 const selecionar=(v:string)=>{setFonte(v);alterar();const f=dados?.fontes.find(f=>`${f.tipo}:${f.id}`===v);setC(f?.classificacao??inicial);setValor(f?.classificacao?.valorMaterialDocumentado??"");setReferencia(f?.documentoMaterial?.referencia??"");setEvidencia(f?.documentoMaterial?.evidencia??"");};
 async function gravar(acao:()=>Promise<unknown>){setOcupado(true);setErro("");try{await acao();if(contexto===contextoAtual.current){setAtualizacao(v=>v+1);setChave(crypto.randomUUID());}}catch(e){if(contexto===contextoAtual.current)setErro(e instanceof Error?e.message:String(e));}finally{if(contexto===contextoAtual.current)setOcupado(false);}}
 const atual=dados?.fontes.find(f=>`${f.tipo}:${f.id}`===fonte);
 return <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Composição dos custos diretos"><h3 className="font-semibold">Custo direto registrado</h3>
 {<div className="flex flex-wrap gap-3"><label>Início do período<input type="date" className={classeInput} value={inicio} onChange={e=>{setInicio(e.target.value);setPagina(1);}}/></label><label>Fim do período<input type="date" className={classeInput} value={fim} onChange={e=>{setFim(e.target.value);setPagina(1);}}/></label><label>Finalidade do custo<select className={classeInput} value={finalidade} onChange={e=>{setFinalidade(e.target.value);setPagina(1);}}><option value="">Todas as finalidades</option><option value="REPRODUCAO">Reprodução</option><option value="SANIDADE">Sanidade</option><option value="ROTINA">Rotina/manutenção</option><option value="SEM_CLASSIFICACAO">Sem classificação</option></select></label></div>}
 {carregando&&<p role="status">Consultando custos…</p>}{erro&&<p role="alert" className="text-destructive">{erro}</p>}
 {dados&&!carregando&&<><p><strong>{rotulos[dados.situacao]??dados.situacao}</strong>{dados.situacao!=="OCULTO"&&<> · {dados.totalConhecido==null?"Valor ainda não comprovado":`${brl(Number(dados.totalConhecido))}${dados.cobertura!=="COMPLETO"?" de parcelas conhecidas":""}`}</>}</p>
 <p className="text-sm text-ink-3">{animalId?"Recorte pela data do fato operacional.":"Total da tentativa ou protocolo. Estas visões consultam os mesmos fatos e não devem ser somadas."} {dados.componentesPendentes>0?`${dados.componentesPendentes} componente(s) com valor pendente.`:""}</p>
 {dados.totalIntegral&&(inicio||fim||finalidade)&&<p className="text-sm">Tentativa/protocolo inteiro, sem recorte: {dados.totalIntegral.situacao==="OCULTO"?"Valores ocultos":dados.totalIntegral.totalConhecido==null?"Valor ainda não comprovado":brl(Number(dados.totalIntegral.totalConhecido))}. O valor acima é o recorte consultado.</p>}
 <ul className="divide-y divide-border">{dados.componentes.map(i=><li key={i.chave} className="py-2 text-sm"><strong>{i.descricao} · {i.natureza==="MATERIAL"?"Material":"Serviço/procedimento"}</strong><p>{i.data.split("-").reverse().join("/")} · {i.finalidade?rotulos[i.finalidade]:"Finalidade a classificar"} · {i.estadoFato}</p><p>{dados.situacao==="OCULTO"?"Valores ocultos":i.valor!=null?brl(Number(i.valor)):rotulos[i.estado]??i.estado}</p><div className="flex gap-3"><LinkInterno area="pecuaria" href={linkFato(i,propriedadeId)}>Ver fato de origem</LinkInterno>{i.origemId&&dados.situacao!=="OCULTO"&&<LinkInterno area={i.natureza==="SERVICO"?"financeiro":"estoque"} href={i.natureza==="SERVICO"?linkOperacaoFinanceira(i.origemId):`/estoque?movimentoId=${encodeURIComponent(i.origemId)}&propriedadeId=${propriedadeId}`}>{i.natureza==="SERVICO"?"Ver Serviço":"Ver movimento"}</LinkInterno>}</div></li>)}</ul>
 {!dados.componentes.length&&<p>Nenhum componente registrado neste recorte.</p>}
 <nav className="flex items-center gap-3" aria-label="Páginas dos componentes"><Button secondary disabled={pagina===1||carregando} onClick={()=>setPagina(p=>p-1)}>Anterior</Button><span>Página {pagina} · {dados.totalComponentes} componentes</span><Button secondary disabled={pagina*dados.limite>=dados.totalComponentes||carregando} onClick={()=>setPagina(p=>p+1)}>Próxima</Button></nav>
 {dados.atribuicoesPreparos.some(a=>a.aAtribuir)&&!tentativaId&&<div><h4 className="font-semibold">Preparatórios a atribuir</h4>{dados.atribuicoesPreparos.filter(a=>a.aAtribuir).map(a=><p key={`${a.tipo}:${a.fonteId}`} className="text-sm">{a.descricao} · o custo permanece nesta visão do protocolo/animal{dados.situacao!=="OCULTO"?a.parcelas.filter(p=>p.restante!=null&&Number(p.restante)>0).map(p=>` · ${p.natureza==="MATERIAL"?"material":"Serviço"}: ${brl(Number(p.restante))} a atribuir`).join(""):""}.</p>)}</div>}
 <p className="text-xs text-ink-3">{dados.limitacoes.join(". ")}</p>
 {podeEditar&&<details><summary className="cursor-pointer font-semibold">Classificar finalidade e composição</summary><form className="mt-3 grid gap-3" onChange={alterar} onSubmit={e=>{e.preventDefault();if(!atual)return;void gravar(()=>escreverCustos("/classificacao",{chave,propriedadeId,tipo:atual.tipo,fonteId:atual.id,versao:atual.versaoClassificacao,motivo,...c,valorMaterialDocumentado:undefined,materialDocumentado:valor!==""?{valor,referencia,evidencia}:null},propriedadeId,"PUT"));}}><fieldset disabled={ocupado} className="grid gap-3">
 <label>Fato a classificar<select className={classeInput} required value={fonte} onChange={e=>selecionar(e.target.value)}><option value="">Selecione</option>{dados.fontes.map(f=><option key={`${f.tipo}:${f.id}`} value={`${f.tipo}:${f.id}`}>{f.data} · {f.descricao}</option>)}</select></label>
 {atual&&<><label>Finalidade gerencial<select className={classeInput} value={c.finalidade??""} onChange={e=>setC({...c,finalidade:(e.target.value||null) as Classificacao["finalidade"]})}><option value="">Sem classificação</option><option value="REPRODUCAO">Reprodução</option><option value="SANIDADE">Sanidade</option><option value="ROTINA">Rotina/manutenção</option></select></label><p className="text-xs">A finalidade independe do protocolo ou tentativa a que o fato está vinculado.</p>
 {atual.tipo!=="NUTRICAO"&&<><label><input type="checkbox" checked={c.materialNaoAplicavel} onChange={e=>setC({...c,materialNaoAplicavel:e.target.checked})}/> Material não aplicável</label><label><input type="checkbox" checked={c.servicoNaoAplicavel} onChange={e=>setC({...c,servicoNaoAplicavel:e.target.checked})}/> Serviço/procedimento não aplicável</label>
 <label>O Serviço atribuído cobre<select className={classeInput} value={c.coberturaServico} onChange={e=>setC({...c,coberturaServico:e.target.value as Classificacao["coberturaServico"]})}><option value="PROCEDIMENTO">Procedimento</option><option value="MATERIAL">Apenas material</option><option value="AMBOS">Material e procedimento</option></select></label></>}
 {atual.origemMaterial==="DOCUMENTADA"&&<><label>Valor comprovado do material documentado (R$)<input className={classeInput} type="number" min="0" step="0.01" value={valor} onChange={e=>setValor(e.target.value)}/></label><p className="text-xs">Vazio mantém custo desconhecido. Zero exige a mesma comprovação.</p>{valor!==""&&<><label>Referência da comprovação<input className={classeInput} required minLength={2} maxLength={200} value={referencia} onChange={e=>setReferencia(e.target.value)}/></label><label>Evidência do valor<textarea className={classeInput} required minLength={5} maxLength={2000} value={evidencia} onChange={e=>setEvidencia(e.target.value)}/></label></>}</>}
 <label>Motivo da classificação<textarea className={classeInput} required minLength={5} maxLength={500} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label><Button type="submit" disabled={ocupado}>Salvar classificação</Button></>}
 </fieldset></form></details>}
 {podeEditar&&tentativaId&&<details onToggle={e=>{if(e.currentTarget.open&&!candidatos.length)void carregarPreparos();}}><summary className="cursor-pointer font-semibold">Vincular preparatório à tentativa</summary><form className="mt-3 grid gap-3" onChange={alterar} onSubmit={e=>{e.preventDefault();const f=candidatos.find(f=>`${f.tipo}:${f.id}`===preparo);if(!f)return;void gravar(()=>escreverCustos("/preparatorios",{chave,propriedadeId,tentativaId,tipo:f.tipo,fonteId:f.id,modo,...modo==="PARCELA"?{valorMaterial:material||null,valorServico:servico||null}:{},motivo},propriedadeId));}}><fieldset className="grid gap-3" disabled={ocupado}>
 <label>Preparatório<select required className={classeInput} value={preparo} onChange={e=>setPreparo(e.target.value)}><option value="">Selecione um fato realizado</option>{candidatos.map(f=><option key={`${f.tipo}:${f.id}`} value={`${f.tipo}:${f.id}`}>{f.data} · {f.descricao}</option>)}</select></label><label>Atribuição<select className={classeInput} value={modo} onChange={e=>setModo(e.target.value)}><option value="INTEGRAL">Integral, exclusiva desta tentativa</option><option value="PARCELA">Parcelas explícitas compartilhadas</option></select></label>
 {modo==="PARCELA"&&<><label>Parcela do material (R$)<input className={classeInput} type="number" min="0" step="0.01" value={material} onChange={e=>setMaterial(e.target.value)}/></label><label>Parcela do Serviço (R$)<input className={classeInput} type="number" min="0" step="0.01" value={servico} onChange={e=>setServico(e.target.value)}/></label><p className="text-xs">O restante fica a atribuir no protocolo. Nenhuma despesa ou consumo é criado.</p></>}
 <label>Motivo do vínculo<textarea className={classeInput} required minLength={5} maxLength={500} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label><Button type="submit">Confirmar vínculo</Button></fieldset></form>
 {dados.atribuicoesPreparos.flatMap(a=>a.vinculos.filter(v=>v.tentativaId===tentativaId).map(v=><div key={v.id} className="mt-2"><span>{a.descricao} · {v.modo}</span><Button secondary disabled={ocupado} onClick={()=>{if(motivo.trim().length<5){setErro("Informe o motivo do encerramento no campo Motivo do vínculo.");return;}void gravar(()=>escreverCustos(`/preparatorios/${v.id}/encerramento`,{chave,propriedadeId,motivo},propriedadeId));}}>Encerrar vínculo com motivo</Button></div>))}</details>}
 </>}
 </section>;
}
