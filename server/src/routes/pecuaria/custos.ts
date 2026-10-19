import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getUsuario } from "../../middleware/permissao.js";
import { podeConsultarCustosPecuaria, podeVerValoresFinanceiros } from "../../services/pecuaria/custos/permissoes.js";
import { resolverEscopoLeitura, resolverEscopoEscrita } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { falhaV4, usuarioV4, validarV4 } from "./reproducao.js";
import { classificacaoCustoSchema, consultaCustosSchema, vinculoPreparoSchema } from "../../services/pecuaria/custos/custos.schemas.js";
import * as custos from "../../services/pecuaria/custos/custos.js";
const verValores=(c:Context)=>podeConsultarCustosPecuaria(getUsuario(c));
const sitio=async(c:Context)=>{const id=await resolverEscopoLeitura(c);if(id==null)throw new RebanhoError("VALIDACAO","Selecione um sítio");return id;};
const encerramento=z.object({chave:z.string().uuid(),propriedadeId:z.number().int().positive().max(2147483647),motivo:z.string().trim().min(5).max(500)}).strict();
export const custosRouter=new Hono()
 .get("/",zValidator("query",consultaCustosSchema),async c=>{try {return c.json(await custos.consultarCustos(await sitio(c),c.req.valid("query"),verValores(c),podeVerValoresFinanceiros(getUsuario(c))));}catch(e){return falhaV4(c,e);}})
 .get("/tentativas/:id/preparatorios",async c=>{try{return c.json(await custos.candidatosPreparo(z.string().uuid().parse(c.req.param("id")),await sitio(c),verValores(c)));}catch(e){return falhaV4(c,e);}})
 // A classificação completa altera cobertura e prova de valores; todo o editor exige acesso monetário.
 .use("*",async(c,next)=>{if(!podeVerValoresFinanceiros(getUsuario(c)))return c.json({error:"Sem permissão para editar a composição dos custos",code:"SEM_PERMISSAO"},403);return next();})
 .put("/classificacao",validarV4(classificacaoCustoSchema),async c=>{try{const input=c.req.valid("json");return c.json(await custos.classificarCusto({...input,propriedadeId:await resolverEscopoEscrita(c,input.propriedadeId)},usuarioV4(c)));}catch(e){return falhaV4(c,e);}})
 .post("/preparatorios",validarV4(vinculoPreparoSchema),async c=>{try{const input=c.req.valid("json");return c.json(await custos.vincularPreparo({...input,propriedadeId:await resolverEscopoEscrita(c,input.propriedadeId)},usuarioV4(c)),201);}catch(e){return falhaV4(c,e);}})
 .post("/preparatorios/:id/encerramento",validarV4(encerramento),async c=>{try{const input=c.req.valid("json");return c.json(await custos.encerrarVinculoPreparo(z.string().uuid().parse(c.req.param("id")),{...input,propriedadeId:await resolverEscopoEscrita(c,input.propriedadeId)},usuarioV4(c)));}catch(e){return falhaV4(c,e);}});
