import { prisma } from '../../src/db.js';
import { registrarRetiradaInternaLeite, estornarRetiradaInternaLeite } from '../../src/services/pecuaria/leite/retiradas-internas.js';
import { saldosOrigensLeiteTx } from '../../src/services/estoque/leite.js';
import { hojeFazendaDate } from '../../src/services/pecuaria/rebanho/regras.js';
import { chave, iso, type Contexto } from './contexto.js';
import { ref } from './leite/catalogo.js';

/** Casa e Funcionários retiram leite comercial de hoje (o estoque já tem movimentos até a data-base); uma retirada é estornada. */
export async function retiradasInternas(c: Contexto) {
  const uid = c.usuarioId, propriedadeId = c.sitioIds.principal, produtoId = c.id(ref('produto:comercial')), data = iso(hojeFazendaDate());
  const retiradas = [['casa', 'CASA', 2, 'Leite para a casa da sede.'], ['funcionarios', 'FUNCIONARIOS', 5, 'Cota semanal dos funcionários.'], ['estornada', 'CASA', 1.5, 'Retirada lançada em duplicidade.']] as const;
  for (const [refRetirada, destino, litros, motivo] of retiradas) {
    const nome = `leite-interno:${refRetirada}`;
    await c.acao(nome, async () => !!await prisma.requisicaoPecuaria.findUnique({ where: { chave: chave(nome) } }), async () => {
      const origem = (await prisma.$transaction(tx => saldosOrigensLeiteTx(tx, produtoId, propriedadeId, new Date(`${data}T00:00:00Z`))))
        .filter(o => o.quantidade.gte(litros)).sort((a, b) => b.quantidade.comparedTo(a.quantidade))[0];
      if (!origem) throw new Error('Sem origem comercial com saldo para a retirada interna.');
      const salvo = await registrarRetiradaInternaLeite({ chave: chave(nome), propriedadeId, entradaId: origem.entradaId, data, destino, responsavel: 'Equipe demonstrativa',
        quantidadeLitros: litros, quantidadeDisponivelEsperadaLitros: origem.quantidade.toNumber(), motivo }, uid);
      if (refRetirada === 'estornada') await estornarRetiradaInternaLeite(salvo.id, { chave: chave(`${nome}:estorno`), propriedadeId, versaoEsperada: salvo.versao, motivo: 'Estorno demonstrativo da duplicidade.' }, uid);
    });
  }
}
