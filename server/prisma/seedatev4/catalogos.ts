import { prisma } from '../../src/db.js';
import { criarPropriedade } from '../../src/services/propriedade.js';
import { criarMaterialGenetico } from '../../src/services/pecuaria/rebanho/materialGenetico.js';
import { criarProduto } from '../../src/services/estoque/produtos.js';
import { produtoSchema } from '../../src/services/estoque/produtos.schemas.js';
import { ativarRastreio } from '../../src/services/estoque/partidas.js';
import { criarOperacao } from '../../src/services/financeiro/operacoes.js';
import { operacaoSchema } from '../../src/services/financeiro/schemas.js';
import { criarTipoExame } from '../../src/services/pecuaria/sanidade/exames.js';
import { criarDoenca } from '../../src/services/pecuaria/sanidade/ocorrencias.js';
import { criarPoliticaElegibilidade } from '../../src/services/pecuaria/reproducao/elegibilidade.js';
import { criarPoliticaAcompanhamento } from '../../src/services/pecuaria/reproducao/acompanhamento.js';
import { parametrosElegibilidadeSchema } from '../../src/services/pecuaria/reproducao/elegibilidade.schemas.js';
import { copiarReferenciaReprodutiva } from '../../src/services/pecuaria/reproducao/biblioteca.js';
import type { Contexto } from '../seedatev3/contexto.js';
import { AVISO, nomeV4 } from './catalogo.js';
import { acao, id, key, ref, sitio, uid } from './base.js';

export async function catalogos(c: Contexto) {
  for (const nome of ['Escola', 'Destino']) await c.registro(ref(`sitio:${nome}`), i => prisma.propriedade.findFirst({ where: i ? { id: Number(i) } : { nome: nomeV4(`Fazenda ${nome}`) } }),
    () => criarPropriedade({ nome: nomeV4(`Fazenda ${nome}`), principal: false, cidade: 'Demonstração', uf: 'MG', ordem: nome === 'Escola' ? 3 : 4 }));
  for (const tipo of ['semen', 'embriao'] as const) {
    await c.registro(ref(`material:${tipo}`), i => prisma.materialGenetico.findFirst({ where: i ? { id: i } : { produto: { nome: nomeV4(tipo) } } }), () => criarMaterialGenetico({
      tipo: tipo === 'semen' ? 'SEMEN' : 'EMBRIAO', touro: { tipo: 'EXTERNO', id: c.id('genitor:touro') },
      ...(tipo === 'semen' ? { tipoSemen: 'CONVENCIONAL' as const } : { doadora: { tipo: 'EXTERNO' as const, id: c.id('genitor:matriz') } }),
      produto: { nome: nomeV4(tipo), categoriaId: c.id('categoria:Sêmen e embriões'), centroCustoIds: [c.id('centro:Pecuária')], fornecedorIds: [] }, observacao: AVISO,
    }, uid(c)));
    const material = await prisma.materialGenetico.findUniqueOrThrow({ where: { id: id(c, `material:${tipo}`) } });
    c.manifesto.ids[ref(`produto:${tipo}`)] = material.produtoId; await c.salvar();
    await c.acao(ref(`rastreio:${tipo}`), async () => (await prisma.produto.findUniqueOrThrow({ where: { id: material.produtoId } })).rastrearPartidas,
      () => ativarRastreio(material.produtoId, uid(c)));
  }
  for (const tipo of ['sanitario', 'racao'] as const) await c.registro(ref(`produto:${tipo}`), i => prisma.produto.findFirst({ where: i ? { id: i } : { nome: nomeV4(tipo) } }),
    () => criarProduto(produtoSchema.parse({ nome: nomeV4(tipo), unidade: tipo === 'racao' ? 'KG' : 'ML',
      categoriaId: c.id(tipo === 'racao' ? 'categoria:Ração' : 'categoria:Medicamentos veterinários'),
      usoSanitario: tipo === 'sanitario', usoNutricional: tipo === 'racao', centroCustoIds: [c.id('centro:Pecuária')], fornecedorIds: [],
      ...(tipo === 'sanitario' ? { perfilSanitario: { carenciaLeiteHoras: 0, carenciaCarneHoras: 0, viaPadrao: 'Demonstrativa', referenciaTecnica: AVISO } }
        : { perfilNutricional: { materiaSecaPercentual: 90 } }),
    }), uid(c)));
  for (const s of ['Escola', 'Destino']) for (const tipo of ['semen', 'embriao', 'sanitario', 'racao']) {
    const nome = `compra:${s}:${tipo}`, quantidade = tipo === 'racao' ? 10000 : 1000;
    await c.registro(ref(nome), i => prisma.operacao.findFirst({ where: i ? { id: i } : { descricao: nomeV4(nome) } }), () => criarOperacao({
      ...operacaoSchema.parse({ tipo: 'COMPRA_ESTOQUE', data: c.dias(-550), descricao: nomeV4(nome), parceiroId: c.id('parceiro:fornecedor'),
        categoriaId: c.id(tipo === 'racao' ? 'categoria:Ração' : 'categoria:Sêmen e embriões'), centroCustoId: c.id('centro:Pecuária'),
        itens: [{ produtoId: id(c, `produto:${tipo}`), descricao: nomeV4(tipo), quantidade, unidade: tipo === 'racao' ? 'KG' : tipo === 'sanitario' ? 'ML' : tipo === 'semen' ? 'DOSE' : 'UN',
          valorTotal: quantidade * (tipo === 'embriao' ? 250 : tipo === 'semen' ? 50 : 2), estocavel: true,
          ...(['semen', 'embriao'].includes(tipo) ? { partidas: [{ quantidade, validade: c.dias(720), nome: nomeV4('Lote válido'), codigo: `V4-${tipo}` }] } : {}),
        }], financeiro: { condicao: 'SEM_EFEITO_FINANCEIRO' },
      }), chave: key(nome), propriedadeId: sitio(c, s), usuarioId: uid(c),
    }));
  }
  for (const tipo of ['semen', 'embriao']) await c.registro(ref(`partida:${tipo}`), i => prisma.partidaProduto.findFirst({ where: i ? { id: i } : { produtoId: id(c, `produto:${tipo}`), validade: new Date(c.dias(720)) } }), async () => { throw new Error(`Partida ${tipo} não encontrada após compra`); });
  for (const [nome, contexto] of [['Triagem', 'SANITARIO'], ['Avaliação completa', 'REPRODUTIVO']] as const)
    await c.registro(ref(`exame:${nome}`), i => prisma.tipoExame.findFirst({ where: i ? { id: i } : { nome: nomeV4(nome) } }), () => criarTipoExame({ nome: nomeV4(nome), tipoResultado: nome === 'Triagem' ? 'TEXTO' : 'MULTIPLO',
      ...(nome === 'Triagem' ? {} : { campos: [
        { codigo: 'CONCLUSAO_GESTACIONAL', rotulo: 'Conclusão', tipo: 'OPCAO' as const, obrigatorio: false, opcoes: ['POSITIVO', 'NEGATIVO', 'INCONCLUSIVO'] },
        { codigo: 'SEXO_FETAL', rotulo: 'Sexo fetal', tipo: 'OPCAO' as const, obrigatorio: false, opcoes: ['M', 'F'] },
        { codigo: 'ANOTACAO', rotulo: 'Observação complementar', tipo: 'TEXTO' as const, obrigatorio: false },
        { codigo: 'MEDIDA', rotulo: 'Medida demonstrativa', tipo: 'NUMERO' as const, obrigatorio: false, unidade: 'mm' },
      ] }),
    }, uid(c), contexto));
  for (const nome of ['Alerta demonstrativo', 'Bloqueio demonstrativo', 'Retenção de placenta']) await c.registro(ref(`doenca:${nome}`), i => prisma.doenca.findFirst({ where: i ? { id: i } : { nome: nomeV4(nome) } }), () => criarDoenca(nomeV4(nome), null, uid(c)));
  for (const s of ['Escola', 'Destino']) {
    await acao(c, `politica:${s}`, () => criarPoliticaElegibilidade({ chave: key(`politica:${s}`), propriedadeId: sitio(c, s), vigenteDesde: c.dias(-600), parametros: parametrosElegibilidadeSchema.parse({
      versao: 1, metodologia: 'IDEAGRI_IILB_BASE_V1', pevPrimiparasDias: 30, pevMultiparasDias: 30,
      aborto: 'PEV_CONFIGURADO', pevAposAbortoDias: 15, descarte: 'EXCLUIR', restricoes: 'EXCLUIR', perdaGestacional: 'RETOMAR_CICLO', papeisIncluidos: ['NENHUM', 'DOADORA', 'RECEPTORA'],
    }) }, uid(c)));
    await acao(c, `acompanhamento:${s}`, () => criarPoliticaAcompanhamento({ chave: key(`acompanhamento:${s}`), propriedadeId: sitio(c, s), vigenteDesde: c.dias(-600), parametros: {
      versao: 1, efeito: 'ALERTA', diagnostico: { diasAposTentativa: 30 }, reconfirmacoes: [
        { ocorrencia: 1, diasAposPrimeiroPositivo: 30 }, { ocorrencia: 2, diasAposPrimeiroPositivo: 60 },
      ],
    } }, uid(c)));
  }
  await c.registro(ref('servico'), i => prisma.operacao.findFirst({ where: i ? { id: i } : { descricao: nomeV4('Serviço veterinário') } }), () => criarOperacao({
    ...operacaoSchema.parse({ tipo: 'SERVICO', data: c.dias(-550), descricao: nomeV4('Serviço veterinário'), parceiroId: c.id('parceiro:veterinario'),
      categoriaId: c.id('categoria:Serviços veterinários'), centroCustoId: c.id('centro:Pecuária'), valorTotal: 5000, financeiro: { condicao: 'SEM_EFEITO_FINANCEIRO' },
    }), chave: key('servico'), propriedadeId: sitio(c), usuarioId: uid(c),
  }));
  await c.registro(ref('protocolo:biblioteca'), i => prisma.protocolo.findFirst({ where: i ? { id: i } : { nome: nomeV4('Referência copiada para editar') } }),
    () => copiarReferenciaReprodutiva('ovsynch56-wisconsin-2021', { chave: key('biblioteca'), propriedadeId: sitio(c), nome: nomeV4('Referência copiada para editar'), versao: 1 }, uid(c)));
}
