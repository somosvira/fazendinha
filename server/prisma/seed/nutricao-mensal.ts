import { prisma } from '../../src/db.js';
import { salvarConfiguracao } from '../../src/services/pecuaria/nutricao/mensal.js';
import { proximoMes, somarDias, textoData, type ConfiguracaoInput } from '../../src/services/pecuaria/nutricao/mensal.calc.js';
import { hojeFazendaDate } from '../../src/services/pecuaria/rebanho/regras.js';
import type { Contexto } from './contexto.js';

/** Baixas diárias e conferência mensal. O serviço só aceita ativação futura, então os dias e
 * meses passam a ser processados pelo calendário real a partir de amanhã — a seed não fabrica dias. */
export async function nutricaoMensal(c: Contexto) {
  const hoje = textoData(hojeFazendaDate()), amanha = somarDias(hoje, 1), proximo = proximoMes(hoje);
  const s = c.sitioIds;
  const configuracoes: [string, ConfiguracaoInput][] = [
    ['principal', { propriedadeId: s.principal, loteId: null, modelo: 'AUTOMATICO', diaConferencia: 5, autorizaValidade: false, desde: amanha }],
    // Exceção por lote: só pode começar no primeiro dia do próximo mês, depois da regra do sítio.
    ['secas', { propriedadeId: s.principal, loteId: c.id('lote:Secas'), modelo: 'MANUAL', diaConferencia: 5, autorizaValidade: false, desde: proximo }],
    ['arrendado', { propriedadeId: s.arrendado, loteId: null, modelo: 'PROVISORIO', diaConferencia: 10, autorizaValidade: true, desde: amanha }],
  ];
  for (const [ref, input] of configuracoes) {
    const escopo = input.loteId ? `lote:${input.loteId}` : `sitio:${input.propriedadeId}`;
    await c.acao(`nutricao-mensal:${ref}`, async () => !!await prisma.configuracaoNutricao.findFirst({ where: { propriedadeId: input.propriedadeId, escopo } }), () => salvarConfiguracao(input, c.usuarioId));
  }
}
