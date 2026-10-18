import { hojeFazenda } from "../services/pecuaria/rebanho/regras.js";
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getUsuario } from "../middleware/permissao.js";
import { PropriedadeError, resolverEscopoLeitura } from "../services/propriedade.js";
import { obterResumoGerencial, permissoesGerencial } from "../services/gerencial/resumo.js";
const periodo=z.object({inicio:z.string().date(),fim:z.string().date()}).refine(p=>p.inicio<=p.fim&&p.fim<=hojeFazenda()&&(+new Date(p.fim)-+new Date(p.inicio))/86400000<366,{message:"Informe um período de até 366 dias em ordem cronológica, sem datas futuras"});
export const gerencialRouter=new Hono().get("/gerencial/resumo",async(c,next)=>{
  const u=getUsuario(c);if(!u)return c.json({error:"não autenticado"},401);
  if(!permissoesGerencial(u).acesso)return c.json({error:"sem acesso ao painel gerencial"},403);
  return next();
},zValidator("query",periodo,(r,c)=>{if(!r.success)return c.json({error:r.error.issues[0].message},422);}),async c=>{
  try{const p=c.req.valid("query");return c.json(await obterResumoGerencial(getUsuario(c)!,await resolverEscopoLeitura(c),new Date(p.inicio),new Date(p.fim)));}
  catch(e){if(e instanceof PropriedadeError)return c.json({error:e.message},422);if(e instanceof Error&&e.message==="SITIO_NAO_ENCONTRADO")return c.json({error:"Sítio não encontrado"},404);
    console.error("[gerencial]",e);return c.json({error:"Não foi possível consultar o painel gerencial"},500);}
});
