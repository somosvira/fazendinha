import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { reqV4 } from "./api";
import type { ConfiguracaoAcompanhamentoV2, RegraAcompanhamentoV2 } from "./acompanhamento-api";
export type { ConfiguracaoAcompanhamentoV2 } from "./acompanhamento-api";
export function EditorRegrasAcompanhamentoModelo({valor,onChange,propriedadeId,disabled=false}:{valor:ConfiguracaoAcompanhamentoV2|null;onChange:(v:ConfiguracaoAcompanhamentoV2|null)=>void;propriedadeId?:number;disabled?:boolean}) {
 const [tipos,setTipos]=useState<Array<{id:string;nome:string;ativo:boolean;contexto?:string}>>([]);
 const [erro,setErro]=useState("");
 useEffect(()=>{let atual=true;setTipos([]);setErro("");void reqV4<typeof tipos>("/reproducao/tipos-exame",undefined,"GET",propriedadeId).then(v=>{if(atual)setTipos(v.filter(t=>t.ativo&&t.contexto!=="SANITARIO"));}).catch(e=>{if(atual)setErro(e.message);});return()=>{atual=false;};},[propriedadeId]);
 const regras=valor?.regras??[];
 const mudar=(r:RegraAcompanhamentoV2[])=>onChange(r.length?{versao:2,efeito:"ALERTA",regras:r}:null);
 const editar=(i:number,p:Partial<RegraAcompanhamentoV2>)=>mudar(regras.map((r,n)=>n===i?{...r,...p}:r));
 function adicionar(reconfirmacao:boolean){const ocorrencia=reconfirmacao?Math.max(0,...regras.filter(r=>r.finalidade==="RECONFIRMACAO").map(r=>r.ocorrencia))+1:1;mudar([...regras,{finalidade:reconfirmacao?"RECONFIRMACAO":"DIAGNOSTICO",publico:reconfirmacao?"GESTACAO":"IA",referencia:reconfirmacao?"PRIMEIRO_DG_POSITIVO":"IA",resolucao:reconfirmacao?"RECONFIRMACAO_CONCLUSIVA":"DIAGNOSTICO_CONCLUSIVO",ocorrencia,unidade:"DIAS",intervalo:NaN,antecedencia:NaN,tolerancia:NaN}]);}
 return <fieldset disabled={disabled} className="min-w-0 space-y-4"><legend className="font-semibold">Prazos de acompanhamento</legend>
 <p className="text-sm text-ink-3">Data individual → modelo → padrão do sítio. Sem regra, o planejamento fica pendente. Prazos e origem são preservados na adoção.</p>
 {erro&&<p role="alert">Não foi possível carregar os tipos de exame: {erro}</p>}
 {!regras.length&&<p className="text-sm">Sem prazo próprio. Usa a regra do sítio, quando configurada.</p>}
 {regras.map((r,i)=><fieldset key={i} className="min-w-0 space-y-3 border-t border-border pt-3"><legend className="font-medium">{r.finalidade==="DIAGNOSTICO"?"Diagnóstico":"Reconfirmação"} {r.finalidade==="RECONFIRMACAO"?r.ocorrencia:""}</legend>
 <div className="grid gap-3 sm:grid-cols-2">
 <label>Público<SelectCampo className={classeInput} value={r.publico} onValueChange={v=>editar(i,{publico:v as RegraAcompanhamentoV2["publico"],referencia:v as RegraAcompanhamentoV2["referencia"]})} disabled={r.finalidade==="RECONFIRMACAO"}><option value="IA">Após IA</option><option value="TE">Após TE</option><option value="COBERTURA">Após cobertura</option>{r.finalidade==="RECONFIRMACAO"&&<option value="GESTACAO">Gestação conhecida</option>}</SelectCampo></label>
 <div><span>Evento de referência</span><p className="mt-2 text-sm">{r.referencia==="PRIMEIRO_DG_POSITIVO"?"Primeiro DG positivo":r.referencia==="TE"?"Transferência (TE)":r.referencia==="COBERTURA"?"Cobertura":"Inseminação (IA)"}</p></div>
 {([['intervalo','Intervalo (dias)'],['antecedencia','Antecedência (dias)'],['tolerancia','Tolerância (dias)']] as const).map(([campo,rotulo])=><label key={campo}>{rotulo}<input className={classeInput} type="number" min={0} max={1000} step={1} required value={Number.isFinite(r[campo])?r[campo]:""} onChange={e=>editar(i,{[campo]:e.target.value===""?NaN:Number(e.target.value)})}/></label>)}
 <label>Tipo de exame<SelectCampo className={classeInput} value={r.tipoExameId??""} onValueChange={v=>editar(i,{tipoExameId:v||undefined,tipoExameVersao:undefined})}><option value="">Não especificado</option>{tipos.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</SelectCampo></label>
 </div><p className="text-sm text-ink-3">Resolução: {r.resolucao==="DIAGNOSTICO_CONCLUSIVO"?"diagnóstico conclusivo":"reconfirmação conclusiva"}. Unidade: dias.</p>
 <Button type="button" variant="outline" onClick={()=>mudar(regras.filter((_,n)=>n!==i))}>Remover acompanhamento {i+1}</Button>
 </fieldset>)}
 <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={disabled||regras.length>=100} onClick={()=>adicionar(false)}>Adicionar diagnóstico</Button><Button type="button" variant="outline" disabled={disabled||regras.length>=100} onClick={()=>adicionar(true)}>Adicionar reconfirmação</Button></div>
 </fieldset>;
}
