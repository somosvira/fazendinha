import { prisma } from '../../src/db.js';
import { criarPropriedade } from '../../src/services/propriedade.js';
import { hashSenha } from '../../src/services/auth/hash.js';
import { aplicarPreset } from '../../src/services/auth/papeis.js';
import { criarCategoria, criarCentroCusto, criarGrupoCategoria, atualizarCategoria } from '../../src/services/financeiro/cadastros-gerenciais.js';
import { criarParceiro } from '../../src/services/financeiro/parceiros.js';
import { criarRaca } from '../../src/services/pecuaria/rebanho/racas.js';
import { criarMotivoBaixa } from '../../src/services/pecuaria/rebanho/motivos.js';
import { criarDoenca } from '../../src/services/pecuaria/sanidade/ocorrencias.js';
import { criarTipoExame } from '../../src/services/pecuaria/sanidade/exames.js';
import { criarGenitor } from '../../src/services/pecuaria/rebanho/genitores.js';
import { criarMaterialGenetico } from '../../src/services/pecuaria/rebanho/materialGenetico.js';
import { ativarRastreio } from '../../src/services/estoque/partidas.js';
import type { ContextoSeed } from './contexto.js';
export const SITIOS = [['Principal', 'Sítio principal'], ['Arrendado', 'Sítio arrendado'], ['Test', 'Sítio test']] as const;
export const USUARIOS = [['dono', 'fellipe@test.com', 'Fellipe'], ['rafael', 'rafael@test.com', 'Rafael']] as const;
export const PARCEIROS = [
  ['leolac', 'Leolac — cenário fictício', 'CLIENTE'], ['cliente-avulso', 'Laticínio demonstrativo avulso', 'CLIENTE'],
  ['cliente-animais', 'Comprador de animais demonstrativo', 'CLIENTE'], ['cliente-corte', 'Frigorífico demonstrativo', 'CLIENTE'],
  ['fornecedor', 'Cooperativa demonstrativa', 'FORNECEDOR'], ['volumosos', 'Fornecedor de volumosos demonstrativo', 'FORNECEDOR'],
  ['sanidade', 'Insumos sanitários demonstrativos', 'FORNECEDOR'], ['genetica', 'Genética demonstrativa', 'FORNECEDOR'],
  ['higiene', 'Higiene rural demonstrativa', 'FORNECEDOR'], ['equipamentos', 'Equipamentos demonstrativos', 'FORNECEDOR'],
  ['proprietario', 'Proprietário demonstrativo', 'PROPRIETARIO'],
  ['veterinario', 'Veterinário demonstrativo', 'PRESTADOR_SERVICO'], ['manutencao', 'Oficina demonstrativa', 'PRESTADOR_SERVICO'],
] as const;
export const CATEGORIAS = [
  ['Venda de leite', 'Receitas'], ['Venda de animais', 'Receitas'], ['Ração', 'Nutrição'], ['Silagem', 'Nutrição'],
  ['Sal mineral e suplementos', 'Nutrição'], ['Nutrição', 'Nutrição'], ['Medicamentos veterinários', 'Sanidade'],
  ['Vacinas', 'Sanidade'], ['Exames veterinários', 'Sanidade'], ['Serviços veterinários', 'Sanidade'], ['Sanidade', 'Sanidade'],
  ['Reprodução', 'Reprodução'], ['Sêmen e embriões', 'Reprodução'], ['Combustível', 'Administração'],
  ['Manutenção e serviços', 'Administração'], ['Energia elétrica', 'Administração'], ['Fretes', 'Administração'],
  ['Higiene de ordenha', 'Leite'], ['BPO financeiro', 'Administração'], ['Contabilidade', 'Administração'],
  ['Internet e telefonia', 'Administração'], ['Tarifas bancárias', 'Administração'], ['Impostos e taxas', 'Administração'],
  ['Máquinas e equipamentos', 'Investimento'], ['Instalações e benfeitorias', 'Investimento'], ['Aquisição de animais', 'Investimento'],
] as const;
export async function catalogos(c: ContextoSeed) {
  // Fixture administrativa: não há comando de domínio para criar um usuário já ativo com senha.
  for (const [perfil, email, nome] of USUARIOS) await c.registro(`usuario:${perfil}`,
    id => prisma.usuario.findFirst({ where: id ? { id: Number(id) } : { email } }),
    () => prisma.usuario.create({ data: { email, nome, senhaHash: hashSenha('test1234'), papel: 'proprietario', status: 'ATIVO', dono: true, ...aplicarPreset('proprietario') } }));
  if (await prisma.usuario.count() !== 2) throw new Error('A seed única exige somente os dois usuários demonstrativos.');
  const uid = c.usuarioId;
  for (const [ordem, [ref, nome]] of SITIOS.entries()) await c.registro(`sitio:${ref}`,
    id => prisma.propriedade.findFirst({ where: id ? { id: Number(id) } : { nome } }), async () => {
      // A baseline contém uma fundação neutra, ainda sem fatos, que vira o sítio principal.
      const neutra = ordem === 0 ? await prisma.propriedade.findFirst({ where: { nome: 'Propriedade principal' } }) : null;
      if (neutra) return prisma.propriedade.update({ where: { id: neutra.id }, data: { nome, principal: true } });
      return criarPropriedade({ nome, principal: ordem === 0, cidade: 'Cidade demonstrativa', uf: 'MG', ordem });
    });
  if (await prisma.propriedade.count() !== 3) throw new Error('A seed única exige exatamente os três sítios; nenhum será apagado.');
  for (const [ordem, nome] of ['Produção leiteira', 'Recria', 'Reprodução', 'Corte', 'Gestão'].entries()) await c.registro(`centro:${nome}`,
    id => prisma.centroCusto.findFirst({ where: id ? { id } : { nome } }), () => criarCentroCusto({ nome, ordem }, uid));
  await c.guardar('centro:Pecuária', c.id('centro:Produção leiteira'));
  for (const nome of new Set(CATEGORIAS.map(([, grupo]) => grupo))) await c.registro(`grupo:${nome}`,
    id => prisma.grupoCategoria.findFirst({ where: id ? { id } : { nome } }), () => criarGrupoCategoria({ nome, ordem: 0 }, uid));
  for (const [ordem, [nome, grupo]] of CATEGORIAS.entries()) await c.registro(`categoria:${nome}`,
    id => prisma.categoria.findFirst({ where: id ? { id } : { nome } }), () => criarCategoria({ nome, ordem, grupoId: c.id(`grupo:${grupo}`), classificacao: grupo === 'Receitas' ? null : grupo === 'Investimento' ? 'INVESTIMENTO' : 'CUSTEIO' }, uid));
  if (!c.manifesto.etapas.includes('catalogos')) await regularizarCategoriasEstruturais(c);
  for (const [ref, nome, papel] of PARCEIROS) await c.registro(`parceiro:${ref}`,
    id => prisma.parceiro.findFirst({ where: id ? { id } : { nome } }), () => criarParceiro({ nome, papeis: [papel], usuarioId: uid }));
  await c.guardar('parceiro:cliente', c.id('parceiro:leolac'));
  for (const [nome, sigla] of [['Holandês', 'HO'], ['Gir Leiteiro', 'GO'], ['Nelore', 'NE'], ['Jersey', 'JE'], ['Pardo Suíço', 'PS'], ['Guzerá', 'GU']] as const)
    await c.registro(`raca:${sigla}`, id => prisma.raca.findFirst({ where: id ? { id } : { nome } }), () => criarRaca({ nome, sigla, base: true }, uid));
  for (const [nome, classe] of [['Excedente de animais', 'DESCARTE_VOLUNTARIO'], ['Acidente', 'MORTE'], ['Aborto', 'DESCARTE_INVOLUNTARIO']] as const)
    await c.registro(`motivo:${nome}`, id => prisma.motivoBaixa.findFirst({ where: id ? { id } : { nome } }), () => criarMotivoBaixa({ nome, classe }, uid));
  for (const nome of ['Mastite', 'Retenção de placenta', 'Metrite', 'Pneumonia']) await c.registro(`doenca:${nome}`,
    id => prisma.doenca.findFirst({ where: id ? { id } : { nome } }), () => criarDoenca(nome, null, uid));
  for (const nome of ['Tratamento', 'Vacina', 'Vermífugo']) await c.registro(`aplicacao:${nome}`,
    id => prisma.tipoAplicacaoSanitaria.findFirst({ where: id ? { id } : { nome } }), async () => { throw new Error(`Baseline não instalou ${nome}.`); });
  for (const nome of ['Cetose subclínica', 'Hipocalcemia', 'Brucelose', 'Tuberculose', 'Triagem demonstrativa']) await c.registro(`exame:${nome}`,
    id => prisma.tipoExame.findFirst({ where: id ? { id } : { nome } }), () => criarTipoExame({ nome, tipoResultado: 'TEXTO' }, uid));
  for (const [ref, nome, sexo, raca] of [['touro', 'Atlas externo sintético', 'M', 'HO'], ['matriz', 'Matriz externa sintética', 'F', 'GO']] as const)
    await c.registro(`genitor:${ref}`, id => prisma.genitorExterno.findFirst({ where: id ? { id } : { nome, sexo } }), () => criarGenitor({ nome, sexo, codigo: `UNIFICADA-${ref}`, fornecedorId: c.id('parceiro:genetica'), composicao: [{ racaId: c.id(`raca:${raca}`), fracao64: 64 }] }, uid));
  for (const tipo of ['semen', 'embriao'] as const) {
    const nome = `${tipo === 'semen' ? 'Sêmen' : 'Embrião'} sintético — seed única`;
    const material = await c.registro(`material:${tipo}`, id => prisma.materialGenetico.findFirst({ where: id ? { id } : { produto: { nome } } }), () => criarMaterialGenetico({
      tipo: tipo === 'semen' ? 'SEMEN' : 'EMBRIAO', touro: { tipo: 'EXTERNO', id: c.id('genitor:touro') },
      ...(tipo === 'semen' ? { tipoSemen: 'CONVENCIONAL' as const } : { doadora: { tipo: 'EXTERNO' as const, id: c.id('genitor:matriz') } }),
      produto: { nome, categoriaId: c.id('categoria:Sêmen e embriões'), centroCustoIds: [c.id('centro:Reprodução')], fornecedorIds: [c.id('parceiro:genetica')] }, observacao: 'Dado sintético de desenvolvimento.',
    }, uid));
    const produtoId = (await prisma.materialGenetico.findUniqueOrThrow({ where: { id: String(material.id) } })).produtoId;
    await c.guardar(`produto:${tipo}`, produtoId);
    await c.acao(`rastreio:${tipo}`, async () => (await prisma.produto.findUniqueOrThrow({ where: { id: produtoId } })).rastrearPartidas, () => ativarRastreio(produtoId, uid));
  }
}


/** Completa somente os dois registros estruturais da baseline; nunca reaplica preset sobre edição posterior. */
export async function regularizarCategoriasEstruturais(c: ContextoSeed) {
  for (const [nome, idEstrutural] of [['Sanidade', '81939a31-d31b-4e1c-885e-681468621bc1'], ['Nutrição', '81939a31-d31b-4e1c-885e-681468621bc2']] as const) {
    const id = c.id(`categoria:${nome}`), grupoId = c.id(`grupo:${nome}`);
    await c.acao(`categoria:baseline:${nome}`, async () => {
      const atual = await prisma.categoria.findUniqueOrThrow({ where: { id } });
      return atual.grupoId === grupoId && atual.classificacao === 'CUSTEIO';
    }, async () => {
      const atual = await prisma.categoria.findUniqueOrThrow({ where: { id } });
      if (id !== idEstrutural || atual.nome !== nome || atual.grupoId !== null || atual.classificacao !== 'CUSTEIO') throw new Error(`Categoria estrutural ${nome} divergiu do estado inicial da baseline. Não será reconfigurada automaticamente.`);
      await atualizarCategoria(id, { grupoId, classificacao: 'CUSTEIO' }, c.usuarioId);
    });
  }
}
