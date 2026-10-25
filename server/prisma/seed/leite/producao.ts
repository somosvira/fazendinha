import { z } from 'zod';
import { prisma } from '../../../src/db.js';
import type { Contexto } from '../contexto.js';
import { dia } from '../contexto.js';
import { criarProduto } from '../../../src/services/estoque/produtos.js';
import { produtoSchema } from '../../../src/services/estoque/produtos.schemas.js';
import { criarConfiguracao } from '../../../src/services/pecuaria/leite/configuracoes.js';
import { consultarFolha, salvarFolha } from '../../../src/services/pecuaria/leite/producao.js';
import { salvarFolhaSchema } from '../../../src/services/pecuaria/leite/schemas.js';
import { registrarTanque, salvarParcelasOrdenha, consultarOrdenhasGerais } from '../../../src/services/pecuaria/leite/tanques.js';
import { tanqueLeiteSchema, salvarParcelasOrdenhaSchema } from '../../../src/services/pecuaria/leite/tanques.schemas.js';
import { confirmarProducaoGeral, confirmarSessaoProducaoLeite } from '../../../src/services/pecuaria/leite/estoque.js';
import { AVISO, calendario, intervalo, key, nome, ref } from './catalogo.js';
import { ctx, executar, guardar, id, sitio, uid } from './base.js';
import { registrarRetiradaDia } from './comercial.js';

// Cada chamada salva uma parcela; o recibo durável contém o envelope da sessão.
const reciboParcelaOrdenhaSchema = z.object({ sessaoId: z.string().uuid(), parcelas: z.array(z.object({ id: z.string().uuid() })).length(1) });

export const posicoes = ['Manhã', 'Tarde', 'Noite'].map((nome, i) => ({ posicaoId: key(`posicao:${i}`), nome, ordem: i + 1, horario: ['05:00', '13:00', '20:00'][i] }));
export async function cadastros(c: Contexto) {
  await prisma.usuario.findUniqueOrThrow({ where: { id: uid(c) } });
  for (const natureza of ['comercial', 'nao-comercial', 'colostro']) {
    const n = `produto:${natureza}`;
    await c.registro(ref(n), i => prisma.produto.findFirst({ where: i ? { id: i } : { nome: nome(`Leite ${natureza}`) } }), () => criarProduto(produtoSchema.parse({
      nome: nome(`Leite ${natureza}`), unidade: 'L', categoriaId: c.id('categoria:Venda de leite'),
      centroCustoIds: [c.id('centro:Pecuária')], fornecedorIds: [], usoNutricional: natureza !== 'colostro',
      ...(natureza === 'colostro' ? {} : { perfilNutricional: { materiaSecaPercentual: null } }),
    }), uid(c)));
  }
  const cal = calendario(c.manifesto.dataBase);
  for (const [tipo, capacidade] of [['principal', 3000], ['separado', 2000]] as const) await executar(c, `tanque:${tipo}`, () => registrarTanque(tanqueLeiteSchema.parse({
    chave: key(`tanque:${tipo}`), propriedadeId: sitio(c), identidadeId: key(`identidade:${tipo}`), versaoEsperada: 0,
    nome: nome(`Tanque ${tipo}`), capacidadeLitros: capacidade, fabricante: 'Demonstração', modelo: 'Sintético', vigenteDesde: cal.inicio,
    tabelaConversao: tipo === 'principal' ? [{ mm: 100, litros: 300 }, { mm: 120, litros: 360 }, { mm: 140, litros: 420 }] : [],
    referenciaTabela: tipo === 'principal' ? `${AVISO} Tabela fictícia; não é transcrição da Plurinox.` : null,
  }), uid(c)));
}
async function configurar(c: Contexto, fonte: 'GERAL' | 'INDIVIDUAL', desde: string) {
  await executar(c, `configuracao:${fonte}`, () => criarConfiguracao({ chave: key(`configuracao:${fonte}`), propriedadeId: sitio(c), vigenteDesde: desde,
    fonteProducao: fonte, intervaloIndividualQuantidade: 1, intervaloIndividualUnidade: 'MESES', criterioColostro: { tipo: 'JANELA_DIAS', dias: 3 }, ordenhas: posicoes }, uid(c)));
}
async function controle(c: Contexto, data: string) {
  const n = `controle:${data}`;
  await executar(c, n, async () => {
    const folha = await consultarFolha(sitio(c), data);
    const elegiveis = folha.animais.filter(a => a.lactacaoId && !a.excluidoEm);
    if (!elegiveis.length) throw new Error(`Sem animais leiteiros lactantes em ${data}; não será criado histórico fictício.`);
    return salvarFolha(salvarFolhaSchema.parse({ chave: key(n), propriedadeId: sitio(c), dataOperacional: data, versaoEsperada: folha.versao,
      medicoes: elegiveis.flatMap((a, i) => posicoes.map((p, j) => ({ animalId: a.animalId, posicaoId: p.posicaoId,
        estado: i === 1 && j === 2 ? 'NAO_ORDENHADO' : i === 2 && j === 2 ? 'PENDENTE' : 'MEDIDO',
        litros: i === 1 && j === 2 || i === 2 && j === 2 ? null : i === 0 && j === 2 ? 0 : 7 + i % 5 + j,
        motivo: i === 1 && j === 2 ? `Não ordenhado no cenário. ${AVISO}` : null }))),
    }), uid(c));
  });
}
export async function producaoIndividual(c: Contexto) {
  const cal = calendario(c.manifesto.dataBase);
  await configurar(c, 'INDIVIDUAL', cal.individual);
  await controle(c, cal.individual);
  // A confirmação individual antecede as entradas da produção geral.
  await controle(c, cal.confirmacaoIndividual);
  await executar(c, 'entrada-individual', async () => {
    const folha = await consultarFolha(sitio(c), cal.confirmacaoIndividual);
    const sessao = folha.sessoes.find(s => s.posicaoId === posicoes[0].posicaoId)!;
    if (!sessao.id) throw new Error('Sessão individual não materializada.');
    const medicaoIds = folha.animais.flatMap(a => a.medicoes.filter(m => m.posicaoId === sessao.posicaoId && m.id && (m.litros ?? 0) > 0).map(m => m.id!));
    return confirmarSessaoProducaoLeite({ chave: key('entrada-individual'), sessaoId: sessao.id, versaoEsperada: sessao.versao,
      motivoParcial: AVISO, grupos: [{ chave: key('entrada-individual:grupo'), produtoId: id(c, 'produto:nao-comercial'), medicaoIds,
        natureza: 'NAO_COMERCIAL', motivoNatureza: AVISO }] }, ctx(c));
  });
}
export async function producaoGeral(c: Contexto, periodo: 'anterior' | 'atual') {
  const cal = calendario(c.manifesto.dataBase);
  await configurar(c, 'GERAL', cal.inicio);
  for (const data of intervalo(periodo === 'anterior' ? cal.inicio : cal.inicioAtual, periodo === 'anterior' ? cal.fimAnterior : cal.hoje)) {
    for (const [j, p] of posicoes.entries()) {
      if (data === cal.hoje && j === 2) continue;
      const geral = await consultarOrdenhasGerais(sitio(c), data);
      const colostroIds = geral.contexto.origensColostro.map(a => a.animalId);
      const carencias = geral.contexto.carencias.find(o => o.posicaoId === p.posicaoId)?.animais ?? [];
      const restritas = carencias.filter(a => a.estado !== 'SEM_RESTRICAO_REGISTRADA').map(a => a.animalId).filter(a => !colostroIds.includes(a));
      const livres = geral.origensAutomaticas.map(a => a.animalId).filter(a => !colostroIds.includes(a) && carencias.some(r => r.animalId === a && r.estado === 'SEM_RESTRICAO_REGISTRADA'));
      if (!livres.length) throw new Error(`Sem origens comerciais comprovadas em ${data}.`);
      const parcelas = [
        { tipo: 'principal', natureza: 'COMERCIAL' as const, litros: [420,360,300][j], reguaMm: [141,121,101][j], animais: livres },
        ...(restritas.length ? [{ tipo: 'separado', natureza: 'NAO_COMERCIAL' as const, litros: 40, reguaMm: null, animais: restritas }] : []),
        ...(colostroIds.length ? [{ tipo: 'colostro', natureza: 'COLOSTRO' as const, litros: 12, reguaMm: null, animais: colostroIds }] : []),
      ];
      for (const parcela of parcelas) {
        const n = `medicao:${data}:${j}:${parcela.tipo}`;
        await executar(c,n, async () => {
          const r = await salvarParcelasOrdenha(salvarParcelasOrdenhaSchema.parse({ chave:key(n), propriedadeId:sitio(c),dataOperacional:data,posicaoId:p.posicaoId,parcelas:[{
            tanqueId: parcela.tipo === 'colostro' ? null : id(c,`tanque:${parcela.tipo}`), recipiente: parcela.tipo === 'colostro' ? 'Recipiente segregado de colostro' : null,
            versaoEsperada:0,litros:parcela.litros,reguaMm:parcela.reguaMm,natureza:parcela.natureza,animaisOrigem:parcela.animais,responsavel:'Equipe demonstrativa',observacao:AVISO,
          }] }),uid(c));
          return r.parcelas[0];
        }, recibo => reciboParcelaOrdenhaSchema.parse(recibo).parcelas[0]);
        if(data===cal.hoje && j===1 && parcela.tipo==='principal')continue;
        const produto=parcela.tipo==='principal'?'comercial':parcela.tipo==='separado'?'nao-comercial':'colostro';
        await executar(c,`entrada:${n}`,async()=>{
          const m=await prisma.medicaoGeralLeite.findUniqueOrThrow({where:{id:id(c,n)}});
          return confirmarProducaoGeral({chave:key(`entrada:${n}`),medicaoId:m.id,versaoEsperada:m.versao,produtoId:id(c,`produto:${produto}`),motivoNatureza:AVISO},ctx(c));
        });
      }
    }
    await registrarRetiradaDia(c, periodo, data);
  }
  for (const data of periodo === 'anterior' ? [cal.anterior] : [cal.controle]) await controle(c,data);
  await guardar(c,'data:controle',cal.controle);
}
