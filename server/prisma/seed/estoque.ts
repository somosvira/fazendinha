import { prisma } from '../../src/db.js';
import { criarProduto } from '../../src/services/estoque/produtos.js';
import { produtoSchema } from '../../src/services/estoque/produtos.schemas.js';
import { operacao } from './financeiro.js';
import { dia, type ContextoSeed } from './contexto.js';
import { SITIOS } from './catalogos.js';
// Quantidades sintéticas suficientes para os fatos históricos e rotina demonstrativa.
export const PRODUTOS = [
  ['racao', 'Ração lactação demonstrativa', 'KG', 'Ração', 'nutricional', 30000, 2],
  ['mineral', 'Mineral demonstrativo', 'KG', 'Sal mineral e suplementos', 'nutricional', 4000, 4],
  ['silagem', 'Silagem demonstrativa', 'KG', 'Silagem', 'nutricional', 90000, 0.3],
  ['milho', 'Milho moído demonstrativo', 'KG', 'Ração', 'nutricional', 8000, 1.2],
  ['soja', 'Farelo de soja demonstrativo', 'KG', 'Ração', 'nutricional', 5000, 2],
  ['feno', 'Feno demonstrativo', 'KG', 'Silagem', 'nutricional', 3000, 1],
  ['polpa', 'Polpa cítrica demonstrativa', 'KG', 'Ração', 'nutricional', 3000, 1],
  ['nucleo', 'Núcleo mineral demonstrativo', 'KG', 'Sal mineral e suplementos', 'nutricional', 500, 5],
  ['sal', 'Sal comum demonstrativo', 'KG', 'Sal mineral e suplementos', 'nutricional', 500, 1],
  ['bicarbonato', 'Bicarbonato demonstrativo', 'KG', 'Sal mineral e suplementos', 'nutricional', 500, 3],
  ['vacina', 'Vacina sintética de teste', 'ML', 'Vacinas', 'sanitario', 2000, 1],
  ['vermifugo', 'Vermífugo sintético de teste', 'ML', 'Medicamentos veterinários', 'sanitario', 2000, 1.5],
  ['medicamento', 'Medicamento sintético com carência', 'ML', 'Medicamentos veterinários', 'sanitario', 2000, 3],
  ['medicamento-desconhecido', 'Medicamento sintético carência desconhecida', 'ML', 'Medicamentos veterinários', 'sanitario', 500, 3],
  ['direto', 'Medicamento sintético de consumo direto', 'ML', 'Medicamentos veterinários', 'sanitario', 1000, 2],
  ['vacina-reforco', 'Vacina sintética reforço', 'ML', 'Vacinas', 'sanitario', 500, 2],
  ['antisseptico', 'Antisséptico sintético de teste', 'ML', 'Medicamentos veterinários', 'sanitario', 500, 1],
  ['hormonio', 'Insumo hormonal sintético de teste', 'ML', 'Reprodução', 'sanitario', 1000, 3],
  ['luvas', 'Luvas de procedimento demonstrativas', 'UN', 'Reprodução', 'geral', 500, 1],
  ['pipetas', 'Pipetas demonstrativas', 'UN', 'Reprodução', 'geral', 500, 1],
  ['agulhas', 'Agulhas demonstrativas', 'UN', 'Sanidade', 'geral', 500, 1],
  ['seringas', 'Seringas demonstrativas', 'UN', 'Sanidade', 'geral', 500, 2],
  ['predipping', 'Pré dipping demonstrativo', 'L', 'Higiene de ordenha', 'geral', 200, 10],
  ['posdipping', 'Pós dipping demonstrativo', 'L', 'Higiene de ordenha', 'geral', 200, 10],
  ['detergente', 'Detergente de ordenha demonstrativo', 'L', 'Higiene de ordenha', 'geral', 100, 8],
  ['manutencao', 'Filtro de manutenção demonstrativo', 'UN', 'Manutenção e serviços', 'geral', 20, 25],
  ['papel', 'Papel de ordenha demonstrativo', 'UN', 'Higiene de ordenha', 'geral', 20, 5],
  ['baixo', 'Luva demonstrativa com saldo baixo', 'UN', 'Sanidade', 'geral', 2, 1],
  ['proximo', 'Insumo sintético próximo do vencimento', 'ML', 'Sanidade', 'sanitario', 20, 2],
  ['vencido', 'Insumo sintético vencido segregado', 'ML', 'Sanidade', 'sanitario', 20, 2],
] as const;
export async function estoque(c: ContextoSeed) {
  for (const [ref, nome, unidade, categoria, uso] of PRODUTOS) await c.registro(`produto:${ref}`,
    id => prisma.produto.findFirst({ where: id ? { id } : { nome } }), () => criarProduto(produtoSchema.parse({
      nome, unidade, categoriaId: c.id(`categoria:${categoria}`), centroCustoIds: [c.id('centro:Pecuária')], fornecedorIds: [c.id('parceiro:fornecedor')],
      usoNutricional: uso === 'nutricional', usoSanitario: uso === 'sanitario', rastrearPartidas: true, minimoEstoque: 10,
      ...(uso === 'nutricional' ? { perfilNutricional: { materiaSecaPercentual: ref === 'silagem' ? 35 : 90 } } : {}),
      ...(uso === 'sanitario' ? { perfilSanitario: { carenciaLeiteHoras: ref === 'medicamento-desconhecido' ? null : ref === 'medicamento' ? 96 : 0, carenciaCarneHoras: 48, viaPadrao: 'Demonstrativa', referenciaTecnica: 'DADOS SINTÉTICOS DE TESTE — não usar como recomendação clínica.' } } : {}),
    }), c.usuarioId));
  const descritores = [
    ...PRODUTOS.map(([ref, , , , , quantidade, preco]) => ({ ref, quantidade, preco })),
    { ref: 'semen', quantidade: 500, preco: 50 }, { ref: 'embriao', quantidade: 100, preco: 250 },
  ];
  for (const [sitio] of SITIOS) for (const [ordem, { ref, quantidade, preco }] of descritores.entries()) {
    const p = await prisma.produto.findUniqueOrThrow({ where: { id: c.id(`produto:${ref}`) } });
    const validade = c.dias(ref === 'vencido' ? -10 : ref === 'proximo' ? 7 : 730);
    const codigo = `UNIFICADA-${sitio}-${ref}`;
    await operacao(c, `compra:${sitio}:${ref}`, sitio, {
      tipo: 'COMPRA_ESTOQUE', data: c.dias(-700), descricao: `Seed única — compra ${sitio} ${ref}`, parceiroId: c.id('parceiro:fornecedor'),
      centroCustoId: c.id('centro:Pecuária'), itens: [{ produtoId: p.id, descricao: p.nome, quantidade, unidade: p.unidade,
        valorUnitario: preco, estocavel: true, partidas: [{ codigo, nome: `Lote sintético ${sitio} ${ref}`, validade, quantidade }] }],
      financeiro: ordem % 3 === 0 ? { condicao: 'A_VISTA', contaId: c.id(`conta:Banco ${sitio}`), formaPagamento: 'PIX' }
        : { condicao: 'A_PRAZO', parcelas: [{ valor: quantidade * preco, dataVencimento: c.dias(ordem % 2 ? -30 : 30) }] },
    });
    await c.registro(`partida:${sitio}:${ref}`, id => prisma.partidaProduto.findFirst({ where: id ? { id } : { produtoId: p.id, validade: dia(validade), lotePrincipalId: null } }), async () => { throw new Error(`Partida da compra ausente: ${sitio}/${ref}`); });
    if (sitio === 'Principal') await c.guardar(`partida:${ref}`, c.id(`partida:${sitio}:${ref}`));
  }
}
export async function obterPartida(c: ContextoSeed, produto: string, sitio = 'Principal') { return c.id(`partida:${sitio}:${produto}`); }
