import { Hono } from 'hono';
import { getUsuario } from '../middleware/permissao.js';
import { env } from '../env.js';
import { contextoAssistente, falhaAssistente } from '../services/assistente/contexto-http.js';
import { obterRadar } from '../services/assistente/radar/servico.js';
export const assistenteRadarRouter=new Hono()
.use('/assistente/radar*',async(c,next)=>{c.header('Cache-Control','no-store');const u=getUsuario(c);if(!u||u.id<=0||u.status!=='ATIVO')return c.json({error:'Autentique-se para usar o Radar.'},401);if(!env.ASSISTENTE_CONSULTA_ENABLED)return c.json({error:'Radar indisponível neste ambiente.'},503);return next();})
.get('/assistente/radar',async c=>{try{return c.json(await obterRadar(await contextoAssistente(c)));}catch(e){return falhaAssistente(c,e);}})
.post('/assistente/radar/atualizar',async c=>{try{return c.json(await obterRadar(await contextoAssistente(c)));}catch(e){return falhaAssistente(c,e);}});
