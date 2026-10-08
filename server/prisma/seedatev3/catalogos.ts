import { prisma } from '../../src/db.js';
import { criarPropriedade } from '../../src/services/propriedade.js';
import { hashSenha } from '../../src/services/auth/hash.js';
import { ABAS_IDS, aplicarPreset } from '../../src/services/auth/papeis.js';
import { criarCategoria, criarCentroCusto } from '../../src/services/financeiro/cadastros-gerenciais.js';
import { criarParceiro } from '../../src/services/financeiro/parceiros.js';
import { criarRaca } from '../../src/services/pecuaria/rebanho/racas.js';
import { criarMotivoBaixa } from '../../src/services/pecuaria/rebanho/motivos.js';
import { criarDoenca } from '../../src/services/pecuaria/sanidade/ocorrencias.js';
import { criarTipoExame } from '../../src/services/pecuaria/sanidade/exames.js';
import type { Contexto } from './contexto.js';

export const SENHA = 'SeedateV3!Local2026';
export const CATEGORIAS = [
  'Venda de leite', 'Venda de animais', 'Venda de café', 'Ração', 'Silagem', 'Sal mineral e suplementos', 'Nutrição',
  'Medicamentos veterinários', 'Vacinas', 'Exames veterinários', 'Serviços veterinários', 'Sanidade', 'Reprodução', 'Sêmen e embriões',
  'Combustível', 'Manutenção e serviços', 'Energia elétrica', 'Fretes', 'Higiene de ordenha',
  'Salários', 'Férias', '13º salário', 'FGTS', 'Rescisões', 'Plano de saúde', 'Exames ocupacionais', 'EPI e uniformes',
  'BPO financeiro', 'Contabilidade', 'Internet e telefonia', 'Tarifas bancárias', 'Impostos e taxas', 'Juros e encargos',
  'Fertilizantes e corretivos', 'Defensivos', 'Sementes e mudas', 'Máquinas e equipamentos', 'Instalações e benfeitorias', 'Aquisição de animais',
];
export const RACAS = [
  ['Holandês', 'HO', true], ['Gir Leiteiro', 'GO', true], ['Nelore', 'NE', true], ['Jersey', 'JE', true],
  ['Angus', 'AN', true], ['Guzerá', 'GU', true], ['Pardo Suíço', 'PS', true], ['Girolando', 'GL', false], ['Sindi', 'SD', true], ['Caracu', 'CR', true],
] as const;
export const MOTIVOS = {
  DESCARTE_VOLUNTARIO: ['Baixa produção', 'Idade avançada', 'Excedente de animais', 'Bezerro macho', 'Temperamento / ordenha difícil'],
  DESCARTE_INVOLUNTARIO: ['Infertilidade / repetição de cio', 'Aborto', 'Mastite crônica', 'Casco / locomoção', 'Úbere / tetos', 'Doença crônica', 'Lesão / acidente'],
  MORTE: ['Acidente', 'Anaplasmose', 'Babesia bovis', 'Clostridioses', 'Doenças bacterianas', 'Pneumonia', 'Mastite ambiental', 'Prolapso uterino', 'Complicações pós-parto', 'Intoxicação com ureia', 'Desconhecida/Indefinida', 'Outras', 'Tripanossoma', 'Peritonite', 'Septicemia', 'Intoxicação por plantas tóxicas', 'Botulismo'],
} as const;
export const DOENCAS = ['Anaplasmose', 'Artrite', 'Babesiose', 'Botulismo', 'Brucelose', 'Carcinoma ocular', 'Deslocamento de abomaso', 'Diarreia', 'Distúrbios metabólicos', 'Doenças a vírus', 'Doenças bacterianas', 'Doenças parasitárias', 'Empanzinamento', 'Insuficiência cardíaca', 'Leucose', 'Mastite', 'Metrite', 'Neoplasia', 'Outros', 'Pericardite', 'Peritonite', 'Piroplasmose', 'Pleuropneumonia', 'Pneumonia', 'Pododermatite', 'Raiva', 'Retenção de placenta', 'Rompimento de útero', 'Septicemia', 'Timpanismo', 'Traumatismo', 'Tristeza parasitária', 'Tuberculose', 'Gangrena'];

export async function catalogos(c: Contexto) {
  for (const [perfil, nome] of [['dono', 'Proprietário'], ['consulta', 'Consulta'], ['operador', 'Operador sem valores']] as const) {
    const email = `seedatev3.${perfil}@example.test`;
    await c.registro(`usuario:${perfil}`, id => prisma.usuario.findFirst({ where: id ? { id: Number(id) } : { email } }), () => prisma.usuario.create({ data: {
      email, nome: `${nome} — desenvolvimento`, senhaHash: hashSenha(SENHA), papel: perfil === 'dono' ? 'proprietario' : perfil,
      status: 'ATIVO', dono: perfil === 'dono', areas: ['financeiro', 'pecuaria'], abas: [...ABAS_IDS],
      flags: perfil === 'dono' ? aplicarPreset('proprietario').flags : perfil === 'consulta' ? ['verValores', 'verInvestimento', 'verSalarios', 'exportar'] : ['lancar'],
    } }));
  }
  const uid = c.numero('usuario:dono');
  // Uma migration histórica pode criar a propriedade neutra; só a renomeamos antes de qualquer fato.
  for (const [i, nome] of ['Principal', 'Destino'].entries()) {
    await c.registro(`sitio:${nome}`, id => prisma.propriedade.findFirst({ where: id ? { id: Number(id) } : { nome } }), async () => {
      const neutra = i === 0 ? await prisma.propriedade.findFirst({ where: { nome: { in: ['Propriedade principal', 'Principal'] } } }) : null;
      if (neutra) return prisma.propriedade.update({ where: { id: neutra.id }, data: { nome, principal: true } });
      return criarPropriedade({ nome, principal: i === 0, cidade: 'Cidade demonstrativa', uf: 'MG', ordem: i });
    });
  }
  if (await prisma.propriedade.count() !== 2) throw new Error('O cenário exige exatamente duas propriedades; nenhuma será apagada pelo seed.');
  for (const [ordem, nome] of ['Pecuária', 'Agronomia', 'Equipe', 'Gestão'].entries()) {
    await c.registro(`centro:${nome}`, id => prisma.centroCusto.findFirst({ where: id ? { id } : { nome } }), () => criarCentroCusto({ nome, ordem }, uid));
  }
  for (const [ordem, nome] of CATEGORIAS.entries()) {
    await c.registro(`categoria:${nome}`, id => prisma.categoria.findFirst({ where: id ? { id } : { nome } }), () => criarCategoria({ nome, ordem,
      classificacao: nome.startsWith('Venda') || nome === 'Aquisição de animais' ? null : ['Máquinas e equipamentos', 'Instalações e benfeitorias'].includes(nome) ? 'INVESTIMENTO' : 'CUSTEIO',
    }, uid));
  }
  for (const [nome, sigla, base] of RACAS) await c.registro(`raca:${sigla}`, id => prisma.raca.findFirst({ where: id ? { id } : { nome } }), () => criarRaca({ nome, sigla, base }, uid));
  for (const classe of Object.keys(MOTIVOS) as Array<keyof typeof MOTIVOS>) {
    for (const nome of MOTIVOS[classe]) await c.registro(`motivo:${nome}`, id => prisma.motivoBaixa.findFirst({ where: id ? { id } : { nome } }), () => criarMotivoBaixa({ nome, classe }, uid));
  }
  for (const nome of DOENCAS) await c.registro(`doenca:${nome}`, id => prisma.doenca.findFirst({ where: id ? { id } : { nome } }), () => criarDoenca(nome, null, uid));
  for (const nome of ['Tratamento', 'Vacina', 'Vermífugo']) {
    await c.registro(`aplicacao:${nome}`, id => prisma.tipoAplicacaoSanitaria.findFirst({ where: id ? { id } : { nome } }), async () => { throw new Error(`Migration não instalou ${nome}.`); });
  }
  for (const nome of ['Cetose subclínica', 'Hipocalcemia', 'Brucelose', 'Tuberculose', 'Triagem demonstrativa']) {
    const numero = ['Cetose subclínica', 'Hipocalcemia'].includes(nome);
    await c.registro(`exame:${nome}`, id => prisma.tipoExame.findFirst({ where: id ? { id } : { nome } }), () => criarTipoExame({ nome,
      tipoResultado: numero ? 'NUMERO' : nome === 'Triagem demonstrativa' ? 'OPCAO' : 'TEXTO',
      ...(numero ? { unidade: 'mmol/L' } : nome === 'Triagem demonstrativa' ? { opcoes: ['Negativo', 'Positivo', 'Inconclusivo'] } : {}),
    }, uid));
  }
  for (const [apelido, nome, papeis] of [
    ['fornecedor', 'Cooperativa demonstrativa', ['FORNECEDOR']], ['cliente', 'Cliente demonstrativo', ['CLIENTE']],
    ['veterinario', 'Veterinário demonstrativo', ['PRESTADOR_SERVICO']], ['manutencao', 'Oficina demonstrativa', ['PRESTADOR_SERVICO', 'FORNECEDOR']],
    ['proprietario', 'Proprietário demonstrativo', ['PROPRIETARIO']],
  ] as const) await c.registro(`parceiro:${apelido}`, id => prisma.parceiro.findFirst({ where: id ? { id } : { nome } }), () => criarParceiro({ nome, papeis: [...papeis], usuarioId: uid }));
}
