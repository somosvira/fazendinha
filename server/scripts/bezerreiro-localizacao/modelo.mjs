import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

export const VERSAO_REGRA = 'BEZERREIRO_LOCALIZACAO_PREVIA_V1';
const camposSnapshot = ['lotes', 'animais', 'localizacoes', 'perfis', 'participacoes', 'fases', 'ofertas', 'baixas'];
const canonico = valor => Array.isArray(valor) ? valor.map(canonico)
  : valor && typeof valor === 'object' ? Object.fromEntries(Object.keys(valor).sort().map(k => [k, canonico(valor[k])])) : valor;
export const sha256 = valor => createHash('sha256').update(typeof valor === 'string' ? valor : JSON.stringify(canonico(valor))).digest('hex');
// UUID v5 com namespace próprio: a API exige UUID na chave de idempotência.
function chaveReenvio(valor) {
  const namespace = Buffer.from('febbb020aabf5039a67d69ac092b4135', 'hex');
  const bytes = createHash('sha1').update(namespace).update(JSON.stringify(canonico(valor))).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function dataCivil(valor, campo) {
  assert.equal(typeof valor, 'string', `${campo}: informe data civil comprovada`);
  const dia = valor.slice(0, 10);
  assert.match(dia, /^\d{4}-\d{2}-\d{2}$/, `${campo}: data inválida`);
  assert.equal(new Date(`${dia}T00:00:00Z`).toISOString().slice(0, 10), dia, `${campo}: data inválida`);
  assert.ok(valor === dia || /^T00:00:00(?:\.000)?Z$/.test(valor.slice(10)), `${campo}: não converter horário em data presumida`);
  return dia;
}
const fim = valor => valor ?? '9999-12-31';
const sobrepoe = (a, b) => a.desde < fim(b.ate) && b.desde < fim(a.ate);
const contem = (a, b) => a.desde <= b.desde && fim(a.ate) >= fim(b.ate);
const ordenar = itens => [...itens].sort((a, b) => a.id.localeCompare(b.id));
function unicos(itens, campo) {
  assert.equal(new Set(itens.map(i => i.id)).size, itens.length, `${campo}: IDs duplicados`);
  for (const item of itens) assert.ok(typeof item.id === 'string' && item.id.length, `${campo}: ID ausente`);
}
function intervalos(itens, campo) {
  return itens.map(i => {
    const desde = dataCivil(i.desde, `${campo}.${i.id}.desde`);
    assert.ok(Object.hasOwn(i, 'ate'), `${campo}.${i.id}: fim ausente não significa intervalo aberto`);
    const ate = i.ate === null ? null : dataCivil(i.ate, `${campo}.${i.id}.ate`);
    // Localização pode conservar um intervalo vazio legado. Não o converte em participação.
    assert.ok(ate === null || ate >= desde, `${campo}.${i.id}: intervalo invertido`);
    return { ...i, desde, ate };
  });
}

/** Função pura: nenhum acesso a banco, rede, credenciais ou serviços de escrita. */
export function prepararManifesto({ configuracao, analise, animaisAnteriores, snapshot, evidencias, agora = new Date().toISOString() }) {
  assert.equal(configuracao.versao, 1, 'Versão da identificação de lotes não suportada');
  unicos(configuracao.lotes, 'configuracao.lotes');
  unicos(analise, 'analise');
  unicos(animaisAnteriores, 'animaisAnteriores');
  const analisePorId = new Map(analise.map(a => [a.id, a]));
  assert.equal(analise.length, animaisAnteriores.length, 'Evidências anteriores possuem coortes diferentes');
  for (const a of animaisAnteriores) {
    const comparado = analisePorId.get(a.id);
    assert.ok(comparado, `Animal ${a.id} ausente da análise anterior`);
    for (const campo of ['ideagriId', 'propriedadeId', 'desde']) assert.equal(comparado[campo], a[campo], `Evidências divergentes: ${a.id}.${campo}`);
  }
  const bloqueios = [];
  let atual = null;
  if (!snapshot) bloqueios.push('SNAPSHOT_ATUAL_AUSENTE');
  else {
    assert.equal(snapshot.versaoFormato, 1, 'Formato de snapshot não suportado');
    assert.deepEqual(snapshot.fonte, configuracao.fonte, 'Snapshot de outro ambiente/projeto/branch/banco');
    const idadeMs = Date.parse(agora) - Date.parse(snapshot.capturadoEm);
    assert.ok(Number.isFinite(idadeMs), 'Instante de captura/revisão inválido');
    if (idadeMs < 0 || idadeMs > 24 * 60 * 60 * 1000) bloqueios.push('SNAPSHOT_FORA_DA_JANELA_DE_REVISAO_24H');
    assert.ok(typeof snapshot.snapshotTransacao === 'string' && snapshot.snapshotTransacao.length, 'Snapshot sem identidade transacional');
    for (const campo of camposSnapshot) {
      assert.ok(Array.isArray(snapshot[campo]), `Snapshot incompleto: ${campo}`);
      // Ofertas têm uma linha por grupo; a identidade nessa coleção é grupoId.
      if (campo !== 'ofertas') unicos(snapshot[campo], campo);
    }
    atual = {
      ...snapshot,
      localizacoes: intervalos(snapshot.localizacoes, 'localizacoes'),
      participacoes: intervalos(snapshot.participacoes, 'participacoes'),
      fases: intervalos(snapshot.fases, 'fases'),
    };
    dataCivil(atual.dataReferencia, 'dataReferencia');
  }
  const lotesIds = new Set(configuracao.lotes.map(l => l.id));
  const ids = new Set(animaisAnteriores.map(a => a.id));
  for (const l of atual?.localizacoes ?? []) if (l.ate === null && lotesIds.has(l.loteId)) ids.add(l.animalId);
  const animaisPorId = new Map((atual?.animais ?? []).map(a => [a.id, a]));
  const lotes = configuracao.lotes.map(lote => {
    const encontrado = atual?.lotes.find(l => l.id === lote.id);
    const perfis = atual?.perfis.filter(p => p.loteId === lote.id) ?? [];
    const conflitos = [];
    if (!encontrado) conflitos.push('LOTE_NAO_REVALIDADO');
    else {
      if (encontrado.propriedadeId !== lote.propriedadeId) conflitos.push('SITIO_DO_LOTE_DIVERGENTE');
      if (!encontrado.ativo) conflitos.push('LOTE_INATIVO');
    }
    if (perfis.length > 1) conflitos.push('PERFIS_DUPLICADOS');
    if (perfis.some(p => p.propriedadeId !== lote.propriedadeId || !p.ativo)) conflitos.push('PERFIL_INATIVO_OU_SITIO_DIVERGENTE');
    return { ...lote, loteAtual: encontrado ?? null, perfisExistentes: perfis,
      acaoPerfil: conflitos.length ? 'PENDENTE' : perfis.length ? 'REUTILIZAR' : 'PROPOR_CRIACAO', conflitos };
  });
  const propostas = [...ids].sort().map(animalId => {
    const anterior = analisePorId.get(animalId) ?? null;
    const animal = animaisPorId.get(animalId);
    const localizacoes = atual?.localizacoes.filter(l => l.animalId === animalId) ?? [];
    const abertas = localizacoes.filter(l => l.ate === null);
    const local = abertas.length === 1 && lotesIds.has(abertas[0].loteId) ? abertas[0] : null;
    const lote = lotes.find(l => l.id === local?.loteId);
    const participacoes = atual?.participacoes.filter(p => p.animalId === animalId) ?? [];
    const fases = atual?.fases.filter(f => participacoes.some(p => p.id === f.participacaoId)) ?? [];
    const ofertas = atual?.ofertas.filter(o => Array.isArray(o.participantesSnapshot) && o.participantesSnapshot.some(p => p.animalId === animalId)) ?? [];
    const baixas = atual?.baixas.filter(b => b.animalId === animalId && b.estornadaEm === null) ?? [];
    const conflitos = [...bloqueios];
    if (!animal) conflitos.push('ANIMAL_NAO_REVALIDADO');
    if (!local) conflitos.push(abertas.length > 1 ? 'LOCALIZACOES_ABERTAS_DUPLICADAS' : 'SEM_LOCALIZACAO_ATUAL_NOS_LOTES_AUTORIZADOS');
    if (local && lote) {
      conflitos.push(...lote.conflitos);
      if (local.propriedadeId !== lote.propriedadeId) conflitos.push('SITIO_DA_LOCALIZACAO_DIVERGENTE');
      if (animal && local.desde < dataCivil(animal.dataNascimento, 'dataNascimento')) conflitos.push('LOCALIZACAO_ANTERIOR_AO_NASCIMENTO');
      if (animal && local.desde < dataCivil(animal.dataEntrada, 'dataEntrada')) conflitos.push('LOCALIZACAO_ANTERIOR_A_ENTRADA');
      if (local.desde > atual.dataReferencia) conflitos.push('LOCALIZACAO_FUTURA');
      if (localizacoes.some(l => l.id !== local.id && sobrepoe(l, local))) conflitos.push('LOCALIZACOES_SOBREPOSTAS');
      if (baixas.some(b => dataCivil(b.data, 'baixa.data') >= local.desde)) conflitos.push('BAIXA_ATIVA_INCOMPATIVEL');
    }
    const coincidentes = local ? participacoes.filter(p => lote?.perfisExistentes.some(b => b.id === p.perfilId) && contem(p, local)) : [];
    const sobrepostas = local ? participacoes.filter(p => sobrepoe(p, local)) : [];
    if (sobrepostas.length && !(coincidentes.length === 1 && sobrepostas.length === 1)) conflitos.push('PARTICIPACAO_EXISTENTE_EXIGE_CONCILIACAO');
    if (participacoes.some(p => p.ate !== null && p.ate === p.desde) || fases.some(f => f.ate !== null && f.ate === f.desde)) conflitos.push('INTERVALO_BEZERREIRO_VAZIO_EXISTENTE');
    const jaConciliado = coincidentes.length === 1 && !conflitos.length;
    // Fatos existentes são preservados. A prévia não alarga permanências para acomodá-los.
    if (!jaConciliado && (fases.length || ofertas.some(o => o.status !== 'ESTORNADO'))) conflitos.push('FATOS_DEPENDENTES_EXIGEM_CONFERENCIA');
    const dataGrupo = anterior?.entradaGrupoFDB ? dataCivil(anterior.entradaGrupoFDB, 'entradaGrupoFDB') : null;
    const dataLocalAnterior = anterior?.desde ? dataCivil(anterior.desde, 'anterior.desde') : null;
    const historico = dataGrupo && local?.desde === dataGrupo ? 'DATAS_COINCIDENTES'
      : dataGrupo && local?.desde > dataGrupo ? 'ANTECEDENTE_IDEAGRI_PENDENTE'
        : 'HISTORICO_PENDENTE';
    return {
      animalId, brinco: animal?.brinco ?? anterior?.brinco ?? null,
      propriedadeId: lote?.propriedadeId ?? anterior?.propriedadeId ?? null, loteId: local?.loteId ?? null,
      situacao: conflitos.length ? 'PENDENTE' : jaConciliado ? 'JA_CONCILIADO' : 'COMPROVADO',
      acao: conflitos.length ? 'NAO_EXECUTAR' : jaConciliado ? 'PRESERVAR_EXISTENTE' : 'PROPOR_PARTICIPACAO',
      intervaloProposto: conflitos.length || jaConciliado ? null : { desde: local.desde, ate: null, localizacaoId: local.id },
      motivo: jaConciliado ? 'A participação existente cobre a permanência atual comprovada; conservar ID, versão e fatos.'
        : conflitos.length ? 'Conferência obrigatória; não criar ou alterar participação com estes conflitos.'
          : 'Regularizar somente a permanência atual comprovada no lote/sítio, sem retroagir ao grupo IDEAGRI ou ao nascimento.',
      conflitos: [...new Set(conflitos)],
      historico: { situacao: historico, entradaGrupoIDEAGRI: dataGrupo, inicioLocalizacaoAnterior: dataLocalAnterior,
        inicioLocalizacaoAtual: local?.desde ?? null,
        pendencia: historico === 'DATAS_COINCIDENTES' ? null : 'Reconciliar os intervalos anteriores por localização/movimentação. Diferença de datas não comprova erro.' },
      alimentacao: { acao: 'NAO_ATRIBUIR_FASE', faseVersaoId: null, coleiraId: null,
        motivo: 'Participação não comprova programação, ingestão, desmama ou aptidão clínica; preservar fases existentes.' },
      evidencia: { animalAtual: animal ?? null, localizacaoAtual: local, localizacoes,
        analiseAnterior: anterior, participacoesExistentes: participacoes, fasesExistentes: fases, ofertasExistentes: ofertas, baixasAtivas: baixas },
      versaoRegra: VERSAO_REGRA,
    };
  });
  const snapshotHash = snapshot ? sha256(snapshot) : null;
  const comandos = lotes.map(lote => {
    const locais = ordenar(atual?.localizacoes.filter(l => l.loteId === lote.id && l.ate === null) ?? []);
    const impedidos = propostas.filter(p => locais.some(l => l.animalId === p.animalId) && p.situacao === 'PENDENTE');
    const habilitado = Boolean(atual) && !bloqueios.length && !lote.conflitos.length && !impedidos.length && locais.length > 0;
    const regularizacao = { motivo: `Regularização revisada da permanência atual; regra ${VERSAO_REGRA}; snapshot SHA-256 ${snapshotHash}. Sem programação presumida.`,
      localizacoes: locais.map(l => ({ id: l.id, animalId: l.animalId, desde: l.desde })) };
    return { loteId: lote.id, propriedadeId: lote.propriedadeId, situacao: habilitado ? 'PROPOSTO_PARA_REVISAO' : 'BLOQUEADO',
      metodo: 'POST', caminho: '/api/pecuaria/rebanho/bezerreiro/perfis',
      cabecalhos: { 'X-Propriedade-Id': String(lote.propriedadeId) },
      corpo: habilitado ? { chave: chaveReenvio({ loteId: lote.id, snapshotHash, regularizacao }),
        loteId: lote.id, regularizacao } : null,
      impedimentos: [...bloqueios, ...lote.conflitos, ...impedidos.map(p => `${p.animalId}: ${p.conflitos.join(', ')}`)],
      observacao: 'Executor: API autenticada após publicação e revisão. Nenhum comando foi enviado por esta ferramenta.' };
  });
  const resumo = { animais: propostas.length, comprovados: propostas.filter(p => p.situacao === 'COMPROVADO').length,
    jaConciliados: propostas.filter(p => p.situacao === 'JA_CONCILIADO').length, pendentes: propostas.filter(p => p.situacao === 'PENDENTE').length,
    datasCoincidentes: propostas.filter(p => p.historico.situacao === 'DATAS_COINCIDENTES').length,
    antecedentesIDEAGRIPendentes: propostas.filter(p => p.historico.situacao === 'ANTECEDENTE_IDEAGRI_PENDENTE').length,
    porSitio: lotes.map(l => ({ propriedadeId: l.propriedadeId, sitio: l.sitio,
      atuais: propostas.filter(p => p.loteId === l.id).length, acaoPerfil: l.acaoPerfil })) };
  return { versaoFormato: 1, versaoRegra: VERSAO_REGRA, modo: 'SOMENTE_LEITURA', executavelAutomaticamente: false,
    requerNovaPreviaAntesDaExecucao: true, geradoEm: agora, fonte: configuracao.fonte,
    snapshot: snapshot ? { capturadoEm: snapshot.capturadoEm, dataReferencia: snapshot.dataReferencia,
      snapshotTransacao: snapshot.snapshotTransacao, sha256: snapshotHash } : null,
    evidencias, bloqueios, resumo, lotes, propostas, comandos,
    limites: ['Somente permanência atual: não reconstrói participações históricas encerradas.',
      'Não altera animal, lote, localização, parto, pesagem, sanidade, estoque, custo, auditoria ou fatos realizados.',
      'Não atribui fase/coleira por cor, idade, peso, categoria ou nome; não cria colostragem, desmama ou alimentação.',
      'Manifesto não autoriza escrita nem substitui nova revalidação e aprovação no chat de dados.'] };
}
