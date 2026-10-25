import { createHash } from 'node:crypto';
import { prisma } from '../../../src/db.js';
import type { Contexto } from '../contexto.js';
import { solicitarLaudoQualidade, confirmarLaudoQualidade, baixarLaudoQualidade } from '../../../src/services/pecuaria/leite/qualidade.laudos.js';
import { solicitarComprovanteEntregaLeite, confirmarComprovanteEntregaLeite, baixarComprovanteEntregaLeite } from '../../../src/services/pecuaria/leite/comercial.comprovantes.js';
import { solicitarComprovanteRetiradaOperacaoLeite, confirmarComprovanteRetiradaOperacaoLeite, baixarComprovanteRetiradaOperacaoLeite } from '../../../src/services/pecuaria/leite/comercial.operacoes.comprovantes.js';
import { AVISO, ref } from './catalogo.js';
import { id, sitio, uid } from './base.js';
/** Opcional e explícito: usa upload/confirmar/download reais, nunca inventa storageKey ou URL pública. */
export async function arquivos(c: Contexto) {
  const corpo = `<?xml version="1.0"?><demonstracao><aviso>${AVISO}</aviso><data>${c.manifesto.dataBase}</data><ccs unidade="mil celulas/mL">240</ccs></demonstracao>`;
  const sha256 = createHash('sha256').update(corpo).digest('hex');
  const input = { propriedadeId: sitio(c), nome: 'V5-documento-sintetico.xml', mimeType: 'application/xml' as const, tamanhoBytes: Buffer.byteLength(corpo), sha256 };
  const amostraId = id(c, 'qualidade:atual:coletiva'), entregaId = id(c, 'entrega'), retiradaId = id(c, 'comercial:atual:retirada-id:0');
  const enviar = async (solicitar: () => Promise<{ uploadUrl: string; uploadToken: string; headers: Record<string, string> }>, confirmar: (token: string) => Promise<{ id: string }>) => {
    const u = await solicitar();
    const r = await fetch(u.uploadUrl, { method: 'PUT', headers: u.headers, body: corpo });
    if (!r.ok) throw new Error(`Upload R2 falhou (HTTP ${r.status}); nenhuma conclusão de anexo foi presumida.`);
    return confirmar(u.uploadToken);
  };
  const a = await c.registro(ref('arquivo:qualidade'), i => prisma.laudoQualidadeLeite.findFirst({ where: i ? { id: i } : { amostraId, sha256 } }),
    () => enviar(() => solicitarLaudoQualidade(amostraId, sitio(c), input, uid(c)), t => confirmarLaudoQualidade(amostraId, sitio(c), t, uid(c))));
  const e = await c.registro(ref('arquivo:entrega'), i => prisma.comprovanteEntregaLeite.findFirst({ where: i ? { id: i } : { entregaId, sha256 } }),
    () => enviar(() => solicitarComprovanteEntregaLeite(entregaId, sitio(c), input, uid(c)), t => confirmarComprovanteEntregaLeite(entregaId, sitio(c), t, uid(c))));
  const r = await c.registro(ref('arquivo:retirada'), i => prisma.comprovanteRetiradaOperacaoLeite.findFirst({ where: i ? { id: i } : { retiradaId, sha256 } }),
    () => enviar(() => solicitarComprovanteRetiradaOperacaoLeite(retiradaId, sitio(c), input, uid(c)), t => confirmarComprovanteRetiradaOperacaoLeite(retiradaId, sitio(c), t, uid(c))));
  for (const link of [await baixarLaudoQualidade(amostraId, String(a.id), sitio(c)), await baixarComprovanteEntregaLeite(entregaId, String(e.id), sitio(c)), await baixarComprovanteRetiradaOperacaoLeite(retiradaId, String(r.id), sitio(c))]) {
    const resposta = await fetch(link.url);
    if (!resposta.ok || createHash('sha256').update(Buffer.from(await resposta.arrayBuffer())).digest('hex') !== sha256) throw new Error('Download R2 não reproduziu o documento enviado.');
  }
  await c.acao(ref('arquivos:verificados'), async () => true, async () => undefined);
}
