import { z } from 'zod';
import { prisma } from '../../src/db.js';
import { criarVisita, salvarRascunho, confirmarAtividade, encerrarVisita } from '../../src/services/pecuaria/reproducao/visitas.js';
import { previaGrupoPlanner, incluirGrupoPlanner } from '../../src/services/pecuaria/reproducao/planner.js';
import { grupoLivreSchema } from '../../src/services/pecuaria/reproducao/planner.schemas.js';
import { criarSelecao, criarSelecaoSchema } from '../../src/services/pecuaria/reproducao/selecoes.js';
import { chave, type Contexto } from './contexto.js';
import { AVISO, brincoSeed, acaoPecuaria } from './rebanho.js';

const idsAtividadesSchema = z.object({ atividades: z.array(z.object({ id: z.string().uuid() })).length(1) });
export async function visitas(c: Contexto) {
  const uid = c.numero('usuario:dono'), propriedadeId = c.numero('sitio:Principal');
  for (const numero of [3, 4]) await c.registro(`selecao:tentativa:${numero}`, id => prisma.selecaoVisita.findFirst({ where: id ? { id } : { nome: `${numero}ª tentativa no ciclo`, propriedadeId } }), () => criarSelecao(criarSelecaoSchema.parse({ propriedadeId, nome: `${numero}ª tentativa no ciclo`, criterios: { versao: 2, todas: [{ tipo: 'FAIXA', campo: 'TENTATIVAS_CICLO', min: numero, max: numero }], qualquer: [], ordenacao: [{ campo: 'BRINCO', direcao: 'ASC' }], politicaDesconhecidos: 'EXCLUIR' } }), uid));
  for (const [nome, data] of [['prevista', 7], ['em andamento', 0], ['encerrada', 0]] as const) await c.registro(`visita:${nome}`, id => prisma.visitaVeterinaria.findFirst({ where: id ? { id } : { propriedadeId, nome: `Visita ${nome}` } }), () => criarVisita({ chave: chave(`visita:${nome}`), propriedadeId, data: c.dias(data), nome: `Visita ${nome}`, responsavel: 'Equipe demonstrativa' }, uid));
  for (const [nome, numeros] of [['em andamento', [33, 34]], ['encerrada', [36, 58]]] as const) {
    const acao = `visita:grupo:${nome}`, visitaId = c.id(`visita:${nome}`);
    await acaoPecuaria(c, acao, async () => {
      const grupo = grupoLivreSchema.parse({ origem: 'LIVRE', nome: `Avaliações ${nome}`, tipo: 'AVALIACAO_REPRODUTIVA', contexto: {}, criterios: { versao: 2, todas: [{ tipo: 'VALORES', campo: 'BUSCA', valores: numeros.map(brincoSeed) }], qualquer: [], ordenacao: [{ campo: 'BRINCO', direcao: 'ASC' }], politicaDesconhecidos: 'EXCLUIR' } });
      const previa = await previaGrupoPlanner({ propriedadeId, data: c.dias(0), grupo, pagina: 1, tamanhoPagina: 200 });
      if (previa.total !== numeros.length) throw new Error(`Visita ${nome} esperava ${numeros.length} animais, encontrou ${previa.total}.`);
      return incluirGrupoPlanner(visitaId, { chave: chave(acao), propriedadeId, grupo, fingerprint: previa.fingerprint, excluidos: [] }, uid);
    });
    const recibo = await prisma.requisicaoPecuaria.findUniqueOrThrow({ where: { chave: chave(acao) } });
    const atividadeId = idsAtividadesSchema.parse(recibo.resultadoIds).atividades[0].id;
    const participantes: Awaited<ReturnType<typeof prisma.participanteVisita.findUniqueOrThrow>>[] = [];
    for (const n of numeros) {
      const p = await c.registro(`visita:participante:${nome}:${n}`, id => prisma.participanteVisita.findFirst({ where: id ? { id } : { atividadeId, animalId: c.id(`animal:${n}`) } }), async () => { throw new Error('Participante preparado ausente; não recriar.'); });
      participantes.push(await prisma.participanteVisita.findUniqueOrThrow({ where: { id: String(p.id) } }));
    }
    if (nome === 'em andamento') {
      const p = participantes[0];
      await c.acao('visita:rascunho:33', async () => (await prisma.participanteVisita.findUniqueOrThrow({ where: { id: p.id } })).versaoRascunho > 0, () => salvarRascunho(visitaId, p.id, propriedadeId, { resultado: 'NEGATIVO', data: c.dias(0), observacao: AVISO, tipoExameId: c.id('exame:Avaliação completa') }, uid, p.versaoRascunho));
      await acaoPecuaria(c, 'visita:confirmar:33', async () => {
        const atual = await prisma.participanteVisita.findUniqueOrThrow({ where: { id: p.id } });
        if (atual.status !== 'PENDENTE' || atual.versaoRascunho !== 1) throw new Error('Atendimento alterado fora da seed; confirmação interrompida.');
        return confirmarAtividade(visitaId, atividadeId, { chave: chave('visita:confirmar:33'), propriedadeId, itens: [{ participanteId: p.id, versaoRascunho: atual.versaoRascunho, status: 'CONFIRMADO' }] }, uid);
      });
      const pendente = participantes[1];
      await c.acao('visita:rascunho:34', async () => (await prisma.participanteVisita.findUniqueOrThrow({ where: { id: pendente.id } })).versaoRascunho > 0, () => salvarRascunho(visitaId, pendente.id, propriedadeId, { resultado: 'INCONCLUSIVO', data: c.dias(0), tipoExameId: c.id('exame:Avaliação completa'), observacao: AVISO }, uid, pendente.versaoRascunho));
    } else {
      await acaoPecuaria(c, 'visita:ausencia-adiamento', async () => {
        const atuais = await prisma.participanteVisita.findMany({ where: { id: { in: participantes.map(p => p.id) } } });
        if (atuais.some(p => p.status !== 'PENDENTE' || p.versaoRascunho !== 0)) throw new Error('Participantes alterados fora da seed; encerramento interrompido.');
        return confirmarAtividade(visitaId, atividadeId, { chave: chave('visita:ausencia-adiamento'), propriedadeId, itens: participantes.map((p, i) => ({ participanteId: p.id, versaoRascunho: 0, status: i ? 'NAO_ATENDIDO' as const : 'ADIADO' as const, motivo: AVISO })) }, uid);
      });
      await c.acao('visita:encerrar', async () => !!(await prisma.visitaVeterinaria.findUniqueOrThrow({ where: { id: visitaId } })).encerradaEm, () => encerrarVisita(visitaId, propriedadeId, uid));
    }
  }
}
