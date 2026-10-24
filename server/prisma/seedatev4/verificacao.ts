import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { prisma } from '../../src/db.js';
import { consultarCustos } from '../../src/services/pecuaria/custos/custos.js';
import { criarEmissaoReprodutiva, criarEmissaoReprodutivaSchema } from '../../src/services/pecuaria/reproducao/emissoes-relatorios.js';
import { consultarIndicadoresReprodutivos } from '../../src/services/pecuaria/reproducao/indicadores.js';
import type { Contexto } from '../seedatev3/contexto.js';
import { animaisV4, brincoV4 } from './catalogo.js';
import { acao, animal, id, key, ref, sitio, uid } from './base.js';
import { idsDoManifesto } from './seguranca.js';

export async function relatorios(c: Contexto) {
  for (const tipo of ['PARTOS', 'INDICADORES'] as const) await acao(c, `emissao:${tipo}`, () => criarEmissaoReprodutiva(criarEmissaoReprodutivaSchema.parse({
    chave: key(`emissao:${tipo}`), propriedadeId: sitio(c), tipo,
    filtros: tipo === 'PARTOS' ? { inicio: c.dias(-365), fim: c.dias(0) }
      : { inicio: c.dias(-210), fim: c.dias(0), corte: c.dias(0), concepcaoEstimada: 50, deslocamentoTeDias: 7, janelaPerdaDias: 120 },
  }), uid(c)));
}
export async function verificarInicial(c: Contexto) {
  for (const n of [1, 2, 3]) {
    const tentativas = await prisma.tentativaReprodutiva.findMany({ where: { animalId: animal(c, n), status: 'VALIDO' }, orderBy: { data: 'asc' } });
    assert.equal(tentativas.length, n, `V4-${n}: número de tentativas`);
    assert.equal(new Set(tentativas.map(t => t.ciclo)).size, 1, 'Tentativas devem pertencer ao mesmo ciclo');
    assert.deepEqual(tentativas.map(t => t.ordem), Array.from({ length: n }, (_, i) => i + 1));
  }
  assert.equal(await prisma.partoAnimal.count({ where: { animalId: animal(c, 7), desfecho: 'ABORTO', status: 'VALIDO' } }), 1);
  const aposAborto = await prisma.tentativaReprodutiva.findUniqueOrThrow({ where: { id: id(c, 'tentativa:7:2') } });
  assert.equal(aposAborto.ordem, 1, 'Aborto deve reiniciar a contagem do ciclo seguinte');
  const perda = await prisma.gestacaoAnimal.findUniqueOrThrow({ where: { id: id(c, 'gestacao:8') } });
  assert.equal(perda.tipoEncerramento, 'PERDA'); assert.ok(perda.motivoEncerramento);
  assert.equal(await prisma.criaParto.count({ where: { partoId: id(c, 'parto:11') } }), 2, 'Gêmeos precisam de duas crias no mesmo parto');
  assert.ok(await prisma.fornecimentoColostro.count({ where: { propriedadeId: sitio(c) } }) >= 8);
  const agenda = await prisma.atividadeVisita.findMany({ where: { visitaId: id(c, 'visita:Agenda — 120 diagnósticos') }, select: { id: true } });
  assert.equal(await prisma.participanteVisita.count({ where: { atividadeId: { in: agenda.map(a => a.id) }, status: 'PENDENTE' } }), 120);
  const completo = await consultarCustos(sitio(c), { tentativaId: id(c, 'tentativa:1:1'), pagina: 1, limite: 10 }, true);
  assert.equal(completo.situacao, 'COMPLETO');
  const preparo = await consultarCustos(sitio(c), { tentativaId: id(c, 'tentativa:3:3'), pagina: 1, limite: 10 }, true);
  assert.equal(Number(preparo.totalConhecido), 60, 'Material documentado 50 + parcela explícita 10');
  const indicadores = await consultarIndicadoresReprodutivos({ propriedadeId: sitio(c), inicio: c.dias(-210), fim: c.dias(0), corte: c.dias(0), deslocamentoTeDias: 7, concepcaoEstimada: 50, janelaPerdaDias: 120 });
  assert.ok(indicadores.acompanhamento?.iep.pares.some(p => p.animalId === animal(c, 65) && p.dias === 410), 'IEP de 410 dias precisa vir de dois partos factuais');
}
export async function verificarV4(c: Contexto) {
  const ids = animaisV4.map(a => animal(c, a.numero));
  assert.equal(await prisma.animal.count({ where: { id: { in: ids } } }), animaisV4.length, 'Animal do cenário foi removido; não será recriado');
  for (const nome of ['dias', 'horas', 'te', 'diagnostico', 'rascunho', 'biblioteca', 'sanitario'])
    await prisma.protocolo.findUniqueOrThrow({ where: { id: id(c, `protocolo:${nome}`) } });
  const partos = await prisma.partoAnimal.findMany({ where: { animalId: { in: ids } }, select: { id: true } });
  const resumo = {
    dataBase: c.manifesto.dataBase, sitio: sitio(c), destino: sitio(c, 'Destino'), animaisBase: ids.length,
    criasVivas: await prisma.criaParto.count({ where: { partoId: { in: partos.map(p => p.id) }, viva: true, animalId: { not: null } } }),
    protocolos: await prisma.protocolo.count({ where: { id: { in: idsDoManifesto(c.manifesto.ids, ref('protocolo:')) } } }),
    programacoes: await prisma.programacaoProtocolo.count({ where: { id: { in: idsDoManifesto(c.manifesto.ids, ref('programacao:')) } } }),
    tentativas: await prisma.tentativaReprodutiva.count({ where: { animalId: { in: ids } } }),
    gestacoes: await prisma.gestacaoAnimal.count({ where: { animalId: { in: ids } } }),
    partos: partos.length,
    demandas: await prisma.demandaAcompanhamentoReprodutivo.groupBy({ by: ['estado'], where: { animalId: { in: ids } }, _count: true }),
    visitas: await prisma.visitaVeterinaria.count({ where: { propriedadeId: sitio(c) } }),
    emissoes: await prisma.snapshotRelatorioReprodutivo.count({ where: { propriedadeId: sitio(c) } }),
  };
  console.log('[seedatev4]', JSON.stringify(resumo));
  return resumo;
}
const escapar = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export async function gerarGuia(c: Contexto, pasta: string) {
  const linhas = animaisV4.map(a => `<tr><td><a href="http://localhost:41875/pecuaria/rebanho/animais/${animal(c, a.numero)}#reproducao">${brincoV4(a.numero)}</a></td><td>${escapar(a.cenario)}</td><td>${escapar(a.lote)}</td></tr>`).join('');
  const visitas = Object.entries(c.manifesto.ids).filter(([k]) => k.startsWith(ref('visita:'))).map(([k, v]) => `<li><a href="http://localhost:41875/pecuaria/visitas/${v}">${escapar(k.slice(ref('visita:').length))}</a></li>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seed V4 · Guia de simulação</title><style>body{font:16px/1.6 system-ui;color:#203730;background:#f3f2ec;max-width:1080px;margin:auto;padding:28px}a{color:#23634c}h1,h2{line-height:1.2}section{background:#fffef9;border:1px solid #d0d9ce;border-radius:12px;padding:22px;margin:24px 0}table{border-collapse:collapse;width:100%;min-width:500px}th,td{padding:10px;border-bottom:1px solid #d0d9ce;text-align:left}.tabela{overflow:auto}input{font:inherit;width:100%;box-sizing:border-box;padding:12px}code{overflow-wrap:anywhere}@media print{input,button{display:none}body{background:white;padding:0}.tabela{overflow:visible}table{min-width:0;font-size:10pt}tr{break-inside:avoid}}</style><h1>V4 pronta para simular a rotina</h1><p>Data-base: <strong>${c.manifesto.dataBase}</strong>. Use o sítio <strong>V4 · Fazenda Escola (${sitio(c)})</strong>; a matriz V4-028 está em <strong>V4 · Fazenda Destino (${sitio(c, 'Destino')})</strong>. Acessos existentes da V3 são preservados. Os dados V3 e V4 compartilham somente estes dois sítios; os cadastros antigos e as fixtures QA foram retirados.</p><p><a href="http://localhost:41875">Abrir o projeto</a> · <button onclick="print()">Imprimir guia</button></p><section><h2>Comece por estes percursos</h2><ol><li>Abra V4-001, V4-002 e V4-003: ciclos com uma, duas e três tentativas; faça o DG pela ficha ou Seleção livre.</li><li>Compare V4-004 a V4-006: gestações e reconfirmações; a V4-006 tem Serviço em pacote.</li><li>Veja aborto e novo ciclo em V4-007, perda explicada em V4-008, natimorto em V4-009 e partos/crias de V4-010 a V4-012.</li><li>Continue as aplicações/retiradas dos animais 031–042, resolva a precisão temporal dos 043–048 ou execute TE nas receptoras 049–054.</li><li>Na visita de início, confirme somente os animais que deseja iniciar. Na agenda de DG, teste busca, páginas, rascunhos e confirmação de 120 participantes em blocos.</li><li>Consulte custos: V4-001 completo, V4-002 com zero comprovado e Serviço pendente, V4-003 com preparo dividido sem duplicação, V4-027 com baixa real de estoque.</li><li>Consulte Partos e pós-parto, Indicadores e as emissões salvas. Na V4-065 há dois partos factuais com intervalo de 410 dias. Confira filtros de data usando a data-base deste guia.</li></ol><p>Produtos e intervalos são fictícios para testar software. Anexos e arquivos/R2 continuam pendentes. Os snapshots e impressões locais não comprovam armazenamento R2.</p></section><section><h2>Visitas prontas</h2><ul>${visitas}</ul><p>A visita encerrada conserva adiamento/ausência; a nova visita está vazia para você planejar. Na Seleção livre há dois rascunhos ainda sem confirmação clínica.</p></section><section><h2>Mapa dos animais</h2><label>Buscar por brinco, cenário ou lote<input id="busca" type="search" placeholder="Ex.: aborto, três, V4-007, diagnóstico"></label><div class="tabela"><table><thead><tr><th>Brinco / abrir ficha</th><th>Cenário na preparação</th><th>Lote inicial</th></tr></thead><tbody>${linhas}</tbody></table></div><p>O mapa descreve a preparação inicial. Suas alterações na aplicação permanecem e não são restauradas ao reexecutar o seed.</p></section><section><h2>Retomada e conferência</h2><p><code>pnpm --filter rionovo-server run seedatev4</code> retoma etapas incompletas. <code>pnpm --filter rionovo-server run seedatev4 --verificar</code> só consulta; não recupera animais removidos nem desfaz simulações.</p><p>Manifesto próprio em <code>server/.seedatev3/v4/manifesto.json</code>. O banco continua sendo <code>fazendinha_seedatev3</code>; sem outro banco, backup, reset ou nova carga V3.</p></section><script>document.querySelector('#busca').addEventListener('input',e=>{const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const q=normal(e.target.value);for(const tr of document.querySelectorAll('tbody tr'))tr.hidden=!normal(tr.textContent).includes(q)});</script></html>`;
  await mkdir(pasta, { recursive: true });
  await writeFile(`${pasta}/guia.html`, html);
}
