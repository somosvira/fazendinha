import { writeFile } from 'node:fs/promises';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/db.js';
import { aplicarPreset } from '../../src/services/auth/papeis.js';
import { verificarSenha } from '../../src/services/auth/hash.js';
import { conferirCarenciaProducaoTx } from '../../src/services/pecuaria/leite/carencia-producao.js';
import { consultarCustosLeiteTx } from '../../src/services/pecuaria/leite/custos.js';
import { type Contexto, diretorio, dia } from './contexto.js';
import { animaisSeed } from './rebanho.js';
import { calendario, intervalo, ref } from './leite/catalogo.js';

function exigir(condicao: unknown, mensagem: string): asserts condicao { if (!condicao) throw new Error(`Conferência da seed: ${mensagem}`); }
const D = (valor: Prisma.Decimal.Value) => new Prisma.Decimal(valor);

type ResultadoQualidadeConferencia = { campo: string; unidade: string | null };
type AmostraQualidadeConferencia = {
  data: Date; sujeito: string; status: string; versao: number; resultados: ResultadoQualidadeConferencia[];
  exameAnimal: { animalId: string; status: string; resultados: ResultadoQualidadeConferencia[] } | null;
};
/** Usa o mesmo envelope de resultado do DTO operacional: individual pelo exame; coletivo pela amostra. */
export function verificarQualidadeSeed(registros: readonly AmostraQualidadeConferencia[]) {
  const amostras = registros.map(a => ({ ...a, resultados: a.exameAnimal?.resultados ?? a.resultados, status: a.exameAnimal?.status ?? a.status }));
  const individuais = amostras.filter(a => a.sujeito === 'ANIMAL' && a.status === 'VALIDO' && a.resultados.length > 0), coletivas = amostras.filter(a => a.sujeito === 'COLETIVO' && a.status === 'VALIDO' && a.resultados.length > 0);
  exigir(new Set(individuais.map(a => a.exameAnimal?.animalId).filter(Boolean)).size >= 12 && new Set(individuais.map(a => a.data.toISOString().slice(0, 10))).size >= 2 && coletivas.length >= 8, 'qualidade individual de 12 animais em datas distintas e oito amostras coletivas com resultados.');
  exigir([...individuais, ...coletivas].every(a => ['CCS', 'CPP', 'GORDURA', 'PROTEINA'].every(campo => a.resultados.some(r => r.campo === campo && r.unidade))), 'campos/unidades dos laudos preservados.');
  exigir(amostras.some(a => a.status === 'ANULADO') && amostras.some(a => a.versao > 1 && a.status === 'VALIDO') && amostras.some(a => a.status === 'VALIDO' && !a.resultados.length), 'qualidade inclui revisão, anulação e resultado pendente.');
  return { individuais: individuais.length, coletivas: coletivas.length };
}

/** Confere fatos atuais por leitura; manifesto e roteiro de homologação não são alterados. */
export async function verificar(c: Contexto) {
  const data = dia(c.dataBase), principal = c.numero('sitio:Principal'), cal = calendario(c.dataBase);
  const sitios = await prisma.propriedade.findMany({ orderBy: { id: 'asc' } });
  exigir(sitios.length === 3, 'devem existir exatamente três sítios.');
  const distribuicao: Array<{ propriedadeId: number; nome: string; ativos: number }> = [];
  const todosAtivos = new Set<string>();
  let principais: string[] = [];
  for (const [nome, rotulo, quantidade] of [['Principal', 'Sítio principal', 72], ['Arrendado', 'Sítio arrendado', 36], ['Test', 'Sítio test', 24]] as const) {
    const propriedadeId = c.numero(`sitio:${nome}`), sitio = sitios.find(s => s.id === propriedadeId);
    exigir(sitio?.nome === rotulo && sitio.ativo && sitio.principal === (nome === 'Principal'), `nome/estado do ${rotulo}.`);
    const locais = await prisma.localizacaoAnimal.findMany({ where: { propriedadeId, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] }, include: { animal: { include: {
      baixas: { where: { estornadaEm: null, data: { lte: data } } }, composicao: true,
      destinos: { where: { desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] } },
      categoriasManuais: { where: { desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] }, include: { categoria: true } },
    } } } });
    const ativos = locais.filter(l => !l.animal.baixas.length);
    exigir(ativos.length === quantidade && new Set(ativos.map(a => a.animalId)).size === quantidade, `${nome}: esperado ${quantidade} animais ativos únicos, encontrado ${ativos.length}.`);
    for (const a of ativos) { exigir(!todosAtivos.has(a.animalId), `Animal ${a.animalId} ocupa dois sítios na data-base.`); todosAtivos.add(a.animalId); }
    for (const a of animaisSeed.filter(a => a.sitio === nome)) exigir(ativos.some(l => l.animalId === c.id(`animal:${a.numero}`)), `Animal ${a.numero} fora do sítio esperado.`);
    if (nome === 'Principal') principais = ativos.map(a => a.animalId);
    if (nome === 'Test') exigir(ativos.every(({ animal }) => animal.composicao.length === 1 && animal.composicao[0].racaId === c.id('raca:NE') && animal.composicao[0].fracao64 === 64 && animal.destinos.length === 1 && animal.destinos[0].aptidao === 'CORTE'), 'Sítio test exclusivamente Nelore de corte.');
    if (nome === 'Arrendado') {
      const machos = ativos.filter(a => a.animal.sexo === 'M');
      exigir(machos.length === 1 && machos[0].animalId === c.id('animal:127') && machos[0].animal.categoriasManuais.some(a => a.categoria.chavePadrao === 'M_REPRODUTOR'), 'Arrendado deve ter exatamente o touro reprodutor previsto.');
    }
    distribuicao.push({ propriedadeId, nome: rotulo, ativos: ativos.length });
  }
  const usuarios = await prisma.usuario.findMany({ select: { email: true, dono: true, papel: true, status: true, senhaHash: true, areas: true, abas: true, flags: true } });
  const preset = aplicarPreset('proprietario');
  exigir(usuarios.length === 2 && ['fellipe@test.com', 'rafael@test.com'].every(email => usuarios.some(u => u.email === email && u.dono && u.papel === 'proprietario' && u.status === 'ATIVO' && u.senhaHash && verificarSenha('test1234', u.senhaHash) && preset.areas.every(a => u.areas.includes(a)) && preset.abas.every(a => u.abas.includes(a)) && preset.flags.every(f => u.flags.includes(f)))), 'dois proprietários ativos, senha de desenvolvimento válida e todas as áreas/abas/flags.');
  const contas = await prisma.contaFinanceira.findMany({ where: { tipo: 'BANCO', ativo: true }, select: { instituicao: true, propriedadeId: true } });
  exigir(contas.length >= 4 && new Set(contas.map(b => b.instituicao?.trim().toLowerCase()).filter(Boolean)).size >= 4, 'quatro contas de instituições bancárias distintas.');
  for (const [nome, minimo] of [['Principal', 2], ['Arrendado', 1], ['Test', 1]] as const) exigir(contas.filter(b => b.propriedadeId === c.numero(`sitio:${nome}`)).length >= minimo, `distribuição de bancos no ${nome}.`);
  const operacoes = await prisma.operacao.count();
  const operacoesNegocio = await prisma.operacao.count({ where: { tipo: { in: ['COMPRA_ESTOQUE', 'COMPRA_CONSUMO_DIRETO', 'SERVICO', 'VENDA'] } } });
  exigir(operacoesNegocio >= 80, 'pelo menos 80 operações de negócio, sem contar aportes/parcelas/liquidações.');
  const idsCompras = Object.entries(c.manifesto.ids).filter(([nome]) => nome.startsWith('operacao:compra:')).map(([, id]) => id);
  const compras = await prisma.operacao.findMany({ where: { id: { in: idsCompras } }, include: { itens: { include: { movimentosEstoque: { include: { alocacaoPartidaEstoques: true } } } } } });
  exigir(compras.length >= 96 && compras.length === new Set(idsCompras).size, '96 compras demonstrativas presentes sem IDs duplicados.');
  for (const compra of compras) {
    exigir(compra.tipo === 'COMPRA_ESTOQUE' && compra.status === 'CONFIRMADA' && compra.parceiroId && compra.itens.length > 0, `Compra ${compra.numero} confirmada com fornecedor e itens.`);
    for (const item of compra.itens) {
      const entradas = item.movimentosEstoque.filter(m => m.tipo === 'ENTRADA' && m.status === 'CONFIRMADO' && !m.reversaoDeId);
      exigir(item.estocavel && item.produtoId && item.categoriaId && item.centroCustoId && entradas.length > 0 && entradas.every(m => m.operacaoId === compra.id && m.propriedadeId === compra.propriedadeId && m.produtoId === item.produtoId), `Compra ${compra.numero}: item sem lastro/categoria/centro/sítio.`);
      exigir(entradas.reduce((s, m) => s.plus(m.quantidade), D(0)).eq(item.quantidade) && entradas.reduce((s, m) => s.plus(m.valorTotal ?? 0), D(0)).eq(item.valorTotal), `Compra ${compra.numero}: quantidade/valor do estoque não concilia com o item.`);
      exigir(entradas.every(m => m.alocacaoPartidaEstoques.reduce((s, a) => s.plus(a.quantidade), D(0)).eq(m.quantidade)), `Compra ${compra.numero}: distribuição de lotes incompleta.`);
    }
  }
  const categoriasUsadas = await prisma.categoria.findMany({ where: { OR: [{ operacoes: { some: {} } }, { itens: { some: {} } }] }, select: { nome: true, grupoId: true } });
  exigir(categoriasUsadas.every(categoria => categoria.grupoId), `categorias utilizadas sem grupo: ${categoriasUsadas.filter(categoria => !categoria.grupoId).map(categoria => categoria.nome).join(', ')}.`);
  const produtos = await prisma.produto.count(), parceiros = await prisma.parceiro.count();
  exigir(produtos >= 30 && parceiros >= 12, 'pelo menos 30 produtos e 12 parceiros.');
  const lactacoes = await prisma.lactacaoAnimal.findMany({ where: { animalId: { in: principais }, inicio: { lte: data }, OR: [{ encerradaEm: null }, { encerradaEm: { gt: data } }] }, select: { animalId: true } });
  exigir(lactacoes.length === 36 && new Set(lactacoes.map(l => l.animalId)).size === 36, '36 lactantes atuais distintas no Principal.');
  const crias = await prisma.criaParto.findMany({ where: { animalId: { in: Array.from({ length: 8 }, (_, i) => c.id(`animal:${65 + i}`)) } }, include: { PartoAnimal: true } });
  exigir(crias.length === 8 && crias.every(a => a.viva && a.PartoAnimal.status === 'VALIDO' && a.PartoAnimal.propriedadeId === principal && a.PartoAnimal.data <= data), 'oito crias vivas vinculadas aos partos reais do Principal.');
  for (const n of [15, 16, 17, 18, 19, 20]) {
    const esperado = n < 18 ? 3 : 4;
    const tentativas = await prisma.tentativaReprodutiva.findMany({ where: { animalId: c.id(`animal:${n}`), status: 'VALIDO' }, orderBy: { data: 'asc' }, select: { data: true, ordem: true } });
    exigir(tentativas.length === esperado && tentativas.every((t, i) => t.ordem === i + 1 && (!i || t.data > tentativas[i - 1].data)), `histórico cronológico de ${esperado} tentativas de ${n}.`);
  }
  const carencia = await conferirCarenciaProducaoTx(prisma, { data, horario: '13:00', animalIds: lactacoes.map(l => l.animalId) });
  const emCarencia = carencia.animais.filter(a => String(a.estado) === 'EM_CARENCIA'), desconhecida = carencia.animais.filter(a => String(a.estado) === 'NAO_AFERIVEL');
  exigir(emCarencia.length === 4 && desconhecida.length === 1 && desconhecida[0].animalId === c.id('animal:13'), 'quatro lactantes em carência e uma carência desconhecida, conforme o serviço operacional.');
  const vacinacoes = await prisma.aplicacaoProduto.findMany({ where: { tipoAplicacaoId: c.id('aplicacao:Vacina'), status: 'VALIDO' }, select: { propriedadeId: true, movimentoEstoqueId: true } });
  exigir(vacinacoes.length >= 36 && vacinacoes.every(v => v.movimentoEstoqueId) && distribuicao.every(s => vacinacoes.filter(v => v.propriedadeId === s.propriedadeId).length >= 12), '36 vacinações documentadas com consumo nos três sítios.');

  const dias = await prisma.diaProducaoLeite.findMany({ where: { propriedadeId: principal, dataOperacional: { gte: dia(cal.inicio), lte: data } }, include: { configuracao: true, sessoes: { include: { medicoesGerais: { include: { entradasEstoque: { include: { movimento: true, vinculosMedicoes: { where: { ativo: true } } } } } } } } }, orderBy: { dataOperacional: 'asc' } });
  const esperados = intervalo(cal.inicio, c.dataBase);
  exigir(dias.length === esperados.length && dias.every((d, i) => d.dataOperacional.toISOString().slice(0, 10) === esperados[i] && d.configuracao.fonteProducao === 'GERAL'), 'produção geral em todos os dias do mês anterior e atual.');
  let litrosComerciais = D(0), turnosConfirmados = 0;
  for (const d of dias) {
    const hoje = d.dataOperacional.getTime() === data.getTime();
    exigir(d.sessoes.length === 3, `Três ordenhas configuradas em ${d.dataOperacional.toISOString().slice(0, 10)}.`);
    for (const sessao of d.sessoes) {
      const parcelas = sessao.medicoesGerais.filter(m => m.tanqueId === c.id(ref('tanque:principal')));
      if (hoje && sessao.ordem === 3) { exigir(!parcelas.length, 'ordenha da noite de hoje ainda não executada.'); continue; }
      exigir(parcelas.length === 1, 'uma parcela comercial do tanque principal por ordenha executada.');
      const parcela = parcelas[0], entradas = parcela.entradasEstoque.filter(e => e.status === 'CONFIRMADA');
      exigir(parcela.natureza === 'COMERCIAL' && parcela.litros.gt(0) && parcela.reguaMm !== null, 'litros e régua manuais na parcela comercial.');
      if (hoje && sessao.ordem === 2) { exigir(!entradas.length, 'a tarde de hoje permanece salva sem estoque.'); continue; }
      exigir(entradas.length === 1 && entradas[0].movimento.status === 'CONFIRMADO' && entradas[0].movimento.quantidade.eq(parcela.litros) && entradas[0].movimento.propriedadeId === principal && entradas[0].vinculosMedicoes.length === 0, 'entrada geral única concilia parcela/sítio sem somar controles individuais.');
      litrosComerciais = litrosComerciais.plus(entradas[0].movimento.quantidade); turnosConfirmados++;
    }
  }
  const duplicacoesIndividuais = await prisma.entradaProducaoLeite.count({ where: { medicaoGeralId: null, status: 'CONFIRMADA', sessao: { dia: { propriedadeId: principal, dataOperacional: { gte: dia(cal.inicio), lte: data } } } } });
  exigir(duplicacoesIndividuais === 0, 'controles individuais no período geral não podem criar entradas adicionais.');
  const amostras = await prisma.amostraQualidadeLeite.findMany({ where: { propriedadeId: principal }, include: { exameAnimal: { select: { animalId: true, status: true, resultados: { where: { vigente: true }, select: { campo: true, unidade: true } } } }, resultados: { where: { vigente: true } } } });
  const qualidade = verificarQualidadeSeed(amostras);
  const comerciais = [];
  for (const periodo of ['anterior', 'atual'] as const) {
    const comercial = await prisma.operacaoComercialLeite.findUniqueOrThrow({ where: { id: c.id(ref(`comercial:${periodo}`)) }, include: { retiradas: { include: { movimento: true } }, fechamentos: { include: { operacao: { include: { compromissos: { include: { liquidacoes: true } } } }, detalhes: true }, orderBy: { versao: 'desc' } } } });
    const inicio = periodo === 'anterior' ? cal.inicio : cal.inicioAtual, fim = periodo === 'anterior' ? cal.fimAnterior : c.dataBase;
    const coletasEsperadas = intervalo(inicio, fim), fechamento = comercial.fechamentos[0];
    exigir(comercial.status === 'FECHADA' && comercial.parceiroId === c.id('parceiro:leolac') && comercial.retiradas.length === coletasEsperadas.length && fechamento && fechamento.precoUnitario.gt(0), `período ${periodo} fechado com preço e coletas diárias reais.`);
    exigir(coletasEsperadas.every(d => comercial.retiradas.some(r => r.movimento.data.getTime() === dia(d).getTime() && r.movimento.status === 'CONFIRMADO' && r.movimento.quantidade.gt(0))), `datas/lastro das coletas ${periodo}.`);
    exigir(fechamento.detalhes.length === comercial.retiradas.length && fechamento.detalhes.reduce((s, r) => s.plus(r.quantidadeReconhecida), D(0)).eq(fechamento.volumeReconhecido) && fechamento.volumeReconhecido.mul(fechamento.precoUnitario).plus(fechamento.ajuste).toDecimalPlaces(2).eq(fechamento.operacao.valorTotal), `fechamento ${periodo} concilia litros reconhecidos, preço e única receita.`);
    const reconhecido = comercial.retiradas.reduce((s, r) => s.plus(r.movimento.quantidade), D(0));
    exigir(reconhecido.minus(fechamento.volumeReconhecido).eq(2) && fechamento.detalhes.some(d => d.motivoDiferenca), `diferença de aceite de 2 L documentada em ${periodo}.`);
    exigir(fechamento.operacao.compromissos.some(p => p.liquidacoes.length > 0), `recebimento vinculado ao fechamento ${periodo}.`);
    comerciais.push({ periodo, coletas: comercial.retiradas.length, litrosRetirados: reconhecido.toString(), litrosReconhecidos: fechamento.volumeReconhecido.toString(), preco: fechamento.precoUnitario.toString() });
  }
  const aberta = await prisma.operacaoComercialLeite.findUniqueOrThrow({ where: { id: c.id(ref('comercial:aberta')) }, include: { retiradas: true, fechamentos: true } });
  exigir(aberta.status === 'ABERTA' && aberta.retiradas.length > 0 && !aberta.fechamentos.length, 'operação aberta com coleta física e sem preço/fechamento presumido.');
  const fornecimento = await prisma.fornecimentoNutricionalLeite.findUniqueOrThrow({ where: { id: c.id(ref('nutricao:fornecimento')) }, include: { movimentos: true, referencias: { orderBy: { versao: 'asc' } } } });
  exigir(fornecimento.status === 'CONFIRMADO' && fornecimento.quantidadeLitros.eq(60) && fornecimento.movimentos.some(m => m.natureza === 'NAO_COMERCIAL') && fornecimento.movimentos.some(m => m.natureza === 'COMERCIAL') && fornecimento.movimentos.reduce((s, m) => s.plus(m.quantidadeLitros), D(0)).eq(fornecimento.quantidadeLitros), 'fornecimento misto de 60 L conserva suas origens físicas.');
  exigir(fornecimento.referencias.some(r => r.provisoria) && fornecimento.referencias.some(r => !r.provisoria) && fornecimento.referencias.every(r => r.parceiroId === c.id('parceiro:leolac') && r.precoUnitario.mul(fornecimento.quantidadeLitros).toDecimalPlaces(2).eq(r.valorTotal)), 'R07 provisória e revisada usa o mesmo comprador/preço para comercial e não comercial, sem nova baixa física.');
  const custos = await consultarCustosLeiteTx(prisma, principal, { inicio: cal.inicioAtual, fim: c.dataBase }, true);
  exigir(new Set(custos.consolidado.custos.componentes.map(componente => componente.chave)).size === custos.consolidado.custos.componentes.length, 'componentes de custos deduplicados pela origem.');
  exigir(custos.porNatureza.every(n => n.custoTotal === null && n.custoPorLitro === null && n.motivos.includes('NATUREZA_SEM_VINCULO')), 'custos por natureza conservam valor a apurar sem rateio presumido.');
  if (custos.consolidado.motivos.length > 0) exigir(custos.consolidado.custoPorLitro === null, 'custo/L deve permanecer a apurar quando a cobertura é parcial.');
  const negativos = await prisma.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM (SELECT "produtoId","propriedadeId",sum(CASE WHEN tipo='SAIDA' THEN -quantidade ELSE quantidade END) AS saldo FROM public."MovimentoEstoque" WHERE status IN ('CONFIRMADO','REVERTIDO') GROUP BY "produtoId","propriedadeId" HAVING sum(CASE WHEN tipo='SAIDA' THEN -quantidade ELSE quantidade END)<0) s`;
  exigir(Number(negativos[0].total) === 0, 'nenhum saldo de estoque negativo.');
  const { verificarCoberturaParcelas } = await import('./leite/cobertura-parcelas.js');
  const coberturaParcelas = await verificarCoberturaParcelas(c);
  const entradas = await prisma.entradaProducaoLeite.count(), pendentes = await prisma.medicaoGeralLeite.count({ where: { entradasEstoque: { none: { status: 'CONFIRMADA' } } } }), relatorios = await prisma.emissaoRelatorioLeite.count();
  return { dataBase: c.dataBase, sitios: sitios.map(s => ({ id: s.id, nome: s.nome })), distribuicao, animaisAtivos: todosAtivos.size, lactantesAtuais: lactacoes.length, criasVivas: crias.length, bancos: contas.length, operacoes, operacoesNegocio, comprasComLastro: compras.length, produtos, parceiros, vacinas: vacinacoes.length, carencias: { conhecidas: emCarencia.length, desconhecidas: desconhecida.length }, amostras: amostras.length, qualidade, entradas, producaoGeral: { dias: dias.length, turnosConfirmados, litrosComerciaisConfirmados: litrosComerciais.toString(), entradasIndividuaisDuplicadas: duplicacoesIndividuais }, comerciais, nutricaoLeite: { fornecimentoId: fornecimento.id, litros: fornecimento.quantidadeLitros.toString(), referenciasR07: fornecimento.referencias.length }, custos: { situacao: custos.consolidado.situacao, custoPorLitro: custos.consolidado.custoPorLitro, motivos: custos.consolidado.motivos }, parcelasSemEntrada: pendentes, coberturaParcelas, relatorios, arquivosR2: c.manifesto.acoes.includes(ref('arquivos:verificados')) ? 'Verificados' : 'Pendentes: etapa opcional não executada' };
}
export async function gerarGuia(c: Contexto, resumo: Awaited<ReturnType<typeof verificar>>) {
  const escape=(s:string)=>s.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
  const links=animaisSeed.map(a=>`<tr><td>${a.numero}</td><td>${escape(a.sitio)}</td><td>${escape(a.grupo)}</td><td><a href="http://127.0.0.1:41875/pecuaria/rebanho/animais/${c.id(`animal:${a.numero}`)}">Abrir ficha</a></td></tr>`).join('');
  await writeFile(`${diretorio}/verificacao.json`,JSON.stringify(resumo,null,2),{mode:0o600});
  await writeFile(`${diretorio}/guia.html`,`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Seed unificada — guia</title><style>body{font:16px system-ui;max-width:1100px;margin:40px auto;color:#163d3a}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd9d7;padding:10px;text-align:left}a{color:#087e75}pre{white-space:pre-wrap;background:#eef5f3;padding:20px}</style><h1>Base de desenvolvimento unificada</h1><p>Dados sintéticos. Data-base ${escape(c.dataBase)}. Não representa homologação da fazenda.</p><nav><a href="http://127.0.0.1:41875/pecuaria/leite">Leite</a> · <a href="http://127.0.0.1:41875/pecuaria/reproducao">Reprodução</a> · <a href="http://127.0.0.1:41875/pecuaria/nutricao">Nutrição</a> · <a href="http://127.0.0.1:41875/financeiro">Financeiro</a></nav><pre>${escape(JSON.stringify(resumo,null,2))}</pre><table><thead><tr><th>Animal</th><th>Sítio</th><th>Grupo</th><th>Ficha</th></tr></thead><tbody>${links}</tbody></table></html>`,{mode:0o600});
}
