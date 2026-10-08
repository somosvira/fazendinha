import { createHash } from 'node:crypto';
import { prisma } from '../../src/db.js';
import { env } from '../../src/env.js';
import { getStorage } from '../../src/lib/storage.js';
import { anexarDocumentoOperacao, anexarDocumentoRascunho } from '../../src/services/financeiro/documentos.js';
import { baixarRelatorio, gerarRelatorio, salvarRascunho } from '../../src/services/financeiro/relatorios.js';
import { configuracaoRelatorioFinanceiroSchema } from '../../src/services/financeiro/relatorios.schemas.js';
import { chave, type Contexto } from './contexto.js';

export async function conferirArmazenamento() {
  if (!['dev', 'test'].includes(env.STORAGE_NAMESPACE)) throw new Error('Arquivos demonstrativos exigem namespace dev/test.');
  try { await (await getStorage()).headObject({ key: `${env.STORAGE_NAMESPACE}/seedatev3/conferencia-inexistente` }); }
  catch (e) {
    if (e instanceof Error && ['NotFound', 'NoSuchKey'].includes(e.name)) return;
    throw new Error('Não foi possível conferir o armazenamento de desenvolvimento. Nenhum cenário será iniciado.', { cause: e });
  }
}

export async function arquivos(c: Contexto) {
  const uid = c.numero('usuario:dono');
  for (const sitio of ['Principal', 'Destino']) {
    const propriedadeId = c.numero(`sitio:${sitio}`);
    const nome = `seedatev3 — Financeiro ${sitio}`;
    const idRelatorio = chave(`relatorio:${c.manifesto.identidade}:${sitio}`);
    await c.registro(`relatorio:${sitio}`, id => prisma.relatorioFinanceiro.findFirst({ where: id ? { id } : { id: idRelatorio, propriedadeId, status: 'CONCLUIDO' } }), () => gerarRelatorio(propriedadeId, { id: uid, nome: 'Proprietário — desenvolvimento' }, configuracaoRelatorioFinanceiroSchema.parse({ nome, dataInicio: c.mes(-2, 1), dataFim: c.manifesto.dataBase, regime: 'ambos' }), undefined, idRelatorio));
    const pdf = await baixarRelatorio(c.id(`relatorio:${sitio}`), propriedadeId);
    const operacaoId = c.id(`operacao:${sitio === 'Principal' ? 'compra-racao' : 'servico-destino'}`);
    const nomeDocumento = `Resumo financeiro demonstrativo — ${sitio}.pdf`;
    await c.registro(`documento:${sitio}`, id => prisma.documentoFinanceiro.findFirst({ where: id ? { id } : { operacaoId, nome: nomeDocumento } }), () => anexarDocumentoOperacao({ operacaoId, propriedadeId, tipo: 'OUTRO', nome: nomeDocumento, numero: `DEV-${sitio}`, mimeType: 'application/pdf', buffer: pdf.buffer, usuarioId: uid }));
  }
  // XML bem-formado, explicitamente não fiscal; nenhum CNPJ, nota ou comprovante real.
  const xml = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><orcamento ambiente="desenvolvimento"><cenario>seedatev3</cenario><data>${c.manifesto.dataBase}</data><descricao>Orcamento ficticio de manutencao</descricao><valor moeda="BRL">450.00</valor></orcamento>`, 'utf8');
  await c.registro('documento:rascunho', id => prisma.documentoFinanceiro.findFirst({ where: id ? { id } : { rascunhoId: c.id('rascunho:operacao'), nome: 'Orçamento fictício.xml' } }), () => anexarDocumentoRascunho({ rascunhoId: c.id('rascunho:operacao'), propriedadeId: c.numero('sitio:Principal'), tipo: 'OUTRO', nome: 'Orçamento fictício.xml', mimeType: 'application/xml', buffer: xml, usuarioId: uid }));
  await c.registro('rascunho:relatorio', id => prisma.rascunhoRelatorioFinanceiro.findFirst({ where: id ? { id } : { criadoPorId: uid, propriedadeId: c.numero('sitio:Principal') } }), () => salvarRascunho(c.numero('sitio:Principal'), uid, { nome: 'Relatório em edição — demonstração', dataInicio: c.mes(-1, 1), dataFim: c.manifesto.dataBase, regime: 'ambos' }));
}

export async function verificarArquivos(c: Contexto) {
  const storage = await getStorage();
  for (const ref of ['Principal', 'Destino', 'rascunho']) {
    const doc = await prisma.documentoFinanceiro.findUniqueOrThrow({ where: { id: c.id(`documento:${ref}`) } });
    if (!doc.storageKey?.startsWith(`${env.STORAGE_NAMESPACE}/`)) throw new Error(`Documento fora do namespace de desenvolvimento: ${ref}`);
    const bytes = await storage.getObjectBuffer({ key: doc.storageKey });
    if (bytes.length !== doc.tamanhoBytes || createHash('sha256').update(bytes).digest('hex') !== doc.sha256) throw new Error(`Documento divergente: ${ref}`);
  }
  for (const sitio of ['Principal', 'Destino']) {
    const relatorio = await prisma.relatorioFinanceiro.findUniqueOrThrow({ where: { id: c.id(`relatorio:${sitio}`) } });
    if (!relatorio.storageKey?.startsWith(`${env.STORAGE_NAMESPACE}/`)) throw new Error(`Relatório fora do namespace de desenvolvimento: ${sitio}`);
    const pdf = await baixarRelatorio(c.id(`relatorio:${sitio}`), c.numero(`sitio:${sitio}`));
    if (pdf.buffer.subarray(0, 5).toString() !== '%PDF-' || !pdf.buffer.toString().includes('%%EOF')) throw new Error(`PDF inválido: ${sitio}`);
  }
}
