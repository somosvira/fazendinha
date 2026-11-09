import { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button, ErrorBox, Panel, Paginacao, TabelaFinanceira, Pill, Empty } from '../financeiro/financeiro-ui';
import { CampoFormulario, classeInput, PainelCadastro } from '../financeiro/PainelCadastro';
import { SelectCampo } from '../financeiro/SelectCampo';
import { SeletorCatalogoProtocolo } from '../pecuaria/rebanho/protocolos/SeletorCatalogoProtocolo';
import { ApiError } from './api';
import { listarCatalogo, salvarCatalogo, type ItemCatalogo, type TipoCatalogo, type UnidadeNutriente, type PaginaCatalogo } from './catalogos-api';
export const ROTULOS_CATALOGOS: Record<TipoCatalogo, { plural: string; singular: string }> = {
  fabricantes: { plural: 'Fabricantes', singular: 'fabricante' }, 'classificacoes-tecnicas': { plural: 'Classificações técnicas', singular: 'classificação técnica' }, 'principios-ativos': { plural: 'Princípios ativos', singular: 'princípio ativo' }, nutrientes: { plural: 'Nutrientes', singular: 'nutriente' },
};
export const ROTULOS_NUTRIENTE = { PERCENTUAL: '%', MG_KG: 'mg/kg', MCAL_KG: 'Mcal/kg' };
export function FormCatalogoProduto({ tipo, item, somenteLeitura = false, onFechar, onSalvo }: { tipo: TipoCatalogo; item: ItemCatalogo | null; somenteLeitura?: boolean; onFechar: () => void; onSalvo: (item: ItemCatalogo) => void }) {
  const [nome, setNome] = useState(item?.nome ?? ''), [ativo, setAtivo] = useState(item?.ativo ?? true), [motivo, setMotivo] = useState('');
  const [nomeCompleto, setNomeCompleto] = useState(item?.nomeCompleto ?? ''), [unidade, setUnidade] = useState<UnidadeNutriente>(item?.unidadeReferencia ?? 'PERCENTUAL');
  const [erro, setErro] = useState<string | null>(null), [salvando, setSalvando] = useState(false);
  const [ativoOriginal, setAtivoOriginal] = useState(item?.ativo ?? true);
  const [revisaoEsperada, setRevisaoEsperada] = useState(item?.revisao);
  const [conflito, setConflito] = useState(false), [atual, setAtual] = useState<ItemCatalogo | null>(null);
  const envio = useRef<{ hash: string; chave: string }>(); const emCurso = useRef(false);
  const rotulo = ROTULOS_CATALOGOS[tipo].singular;
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); e.stopPropagation(); if (somenteLeitura || emCurso.current || conflito) return;
    if (nome.trim().length < 2 || (item && ativo !== ativoOriginal && motivo.trim().length < 5)) { setErro('Informe o nome e, ao mudar a situação, um motivo com pelo menos 5 caracteres.'); return; }
    const dados = { nome: nome.trim(), ...(item ? { ativo, revisaoEsperada, ...(ativo !== ativoOriginal ? { motivoAlteracao: motivo.trim() } : {}) } : {}), ...(tipo === 'nutrientes' ? { nomeCompleto: nomeCompleto.trim() || null, unidadeReferencia: unidade } : {}) };
    const hash = JSON.stringify(dados); if (envio.current?.hash !== hash) envio.current = { hash, chave: crypto.randomUUID() };
    emCurso.current = true; setSalvando(true); setErro(null);
    try { const salvo = await salvarCatalogo(tipo, { ...dados, chaveReenvio: envio.current.chave }, item?.id); onSalvo(salvo); }
    catch (e) { if (e instanceof ApiError && e.status === 409 && item && (!e.campo || e.campo === 'revisaoEsperada')) setConflito(true); setErro(e instanceof Error ? e.message : String(e)); }
    finally { emCurso.current = false; setSalvando(false); }
  };
  return <PainelCadastro compacto aberto titulo={`${somenteLeitura ? 'Consultar' : item ? 'Editar' : 'Cadastrar'} ${rotulo}`} bloqueado={salvando} onFechar={onFechar} rodape={<><Button secondary disabled={salvando} onClick={onFechar}>{somenteLeitura ? 'Fechar' : 'Cancelar'}</Button>{!somenteLeitura && <Button form="form-catalogo-produto" type="submit" disabled={salvando}>Salvar cadastro</Button>}</>}>
    <form id="form-catalogo-produto" onSubmit={salvar} className="grid gap-4"><ErrorBox erro={erro} />{conflito && item && <div className="grid gap-2 text-sm"><p>Seu rascunho foi preservado. Consulte a revisão atual antes de reaplicar.</p><Button secondary type="button" onClick={async () => { try { const resultado = await listarCatalogo(tipo, { selecionadoId: item.id }); setAtual(resultado.itens.find(i => i.id === item.id) ?? null); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } }}>Consultar revisão atual</Button>{atual && <><p>{atual.nome} · {atual.ativo ? 'Ativo' : 'Inativo'} · Revisão {atual.revisao}</p><Button secondary type="button" onClick={() => { setRevisaoEsperada(atual.revisao); setAtivoOriginal(atual.ativo); setConflito(false); setErro('Revisão atual consultada. Confira os campos antes de salvar seu rascunho.'); }}>Manter rascunho sobre a revisão atual</Button></>}</div>}<fieldset disabled={somenteLeitura || salvando} className="grid gap-4">
      <CampoFormulario id="catalogo-nome" rotulo="Nome" obrigatorio>{p => <Input {...p} maxLength={100} value={nome} onChange={e => setNome(e.target.value)} className={classeInput} />}</CampoFormulario>
      {tipo === 'nutrientes' && <><CampoFormulario id="catalogo-nome-completo" rotulo="Nome completo">{p => <Input {...p} maxLength={300} value={nomeCompleto} onChange={e => setNomeCompleto(e.target.value)} className={classeInput} />}</CampoFormulario><CampoFormulario id="catalogo-unidade" rotulo="Unidade de referência">{p => <SelectCampo {...p} value={unidade} onValueChange={v => setUnidade(v as UnidadeNutriente)}>{Object.entries(ROTULOS_NUTRIENTE).map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}</SelectCampo>}</CampoFormulario></>}
      {item && <CampoFormulario id="catalogo-situacao" rotulo="Situação">{p => <SelectCampo {...p} value={String(ativo)} onValueChange={v => setAtivo(v === 'true')}><option value="true">Ativo</option><option value="false">Inativo</option></SelectCampo>}</CampoFormulario>}
      {item && ativo !== ativoOriginal && <CampoFormulario id="catalogo-motivo" rotulo="Motivo da mudança de situação" obrigatorio>{p => <Input {...p} maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} className={classeInput} />}</CampoFormulario>}
      <p className="text-sm text-ink-3">Inativos permanecem nos vínculos existentes e deixam de aparecer para novas associações.</p>
      {!!item?.origens?.length && <div><h3 className="font-semibold">Origem</h3>{item.origens.map((o, i) => <p key={i}>{o.sistema} · {o.catalogo} · {o.codigoOrigem}</p>)}</div>}
    </fieldset></form>
  </PainelCadastro>;
}
export function SeletorCatalogoProduto({ tipo, rotulo, valor, onChange, somenteLeitura, permitirCadastro = true }: { tipo: TipoCatalogo; rotulo: string; valor: string; onChange: (id: string, item?: ItemCatalogo) => void; somenteLeitura?: boolean; permitirCadastro?: boolean }) {
  const [novo, setNovo] = useState(false), [revisao, setRevisao] = useState(0);
  const consultar = useCallback((f: { pagina: number; porPagina: number; busca: string; selecionadoId?: string }) => listarCatalogo(tipo, { ...f, ...(f.selecionadoId ? {} : { ativo: true }) }).then(p => ({ ...p, itens: p.itens.map(i => ({ ...i, nome: i.ativo ? i.nome : `${i.nome} (inativo)` })) })), [tipo, revisao]);
  if (somenteLeitura && !valor) return <p className="text-sm">{rotulo}: Não informado</p>;
  return <div className="grid gap-2"><SeletorCatalogoProtocolo key={revisao} opcao="MATERIAL" origem="SANITARIO" rotulo={rotulo} valor={valor} onChange={(id, opcao) => onChange(id, opcao as ItemCatalogo | undefined)} listarOpcoes={consultar} somenteLeitura={somenteLeitura} />{!somenteLeitura && permitirCadastro && <Button secondary type="button" onClick={() => setNovo(true)}>Cadastrar {ROTULOS_CATALOGOS[tipo].singular}</Button>}{novo && <FormCatalogoProduto tipo={tipo} item={null} onFechar={() => setNovo(false)} onSalvo={item => { setNovo(false); onChange(item.id, item); setRevisao(r => r + 1); }} />}</div>;
}
export function CatalogosProdutos({ tipo, somenteLeitura }: { tipo: TipoCatalogo; somenteLeitura: boolean }) {
  const [busca, setBusca] = useState(''), [ativo, setAtivo] = useState(''), [pagina, setPagina] = useState(1), [revisao, setRevisao] = useState(0);
  const [dados, setDados] = useState<PaginaCatalogo | null>(null), [erro, setErro] = useState<string | null>(null), [carregando, setCarregando] = useState(true);
  const [edicao, setEdicao] = useState<ItemCatalogo | null | undefined>(undefined);
  useEffect(() => { let vivo = true; setCarregando(true); setErro(null); const timer = setTimeout(() => { listarCatalogo(tipo, { busca, ...(ativo ? { ativo: ativo === 'true' } : {}), pagina, porPagina: 10 }).then(d => { if (vivo) setDados(d); }).catch(e => { if (vivo) setErro(e.message); }).finally(() => { if (vivo) setCarregando(false); }); }, 200); return () => { vivo = false; clearTimeout(timer); }; }, [tipo, busca, ativo, pagina, revisao]);
  const rotulo = ROTULOS_CATALOGOS[tipo];
  return <section className="mt-6 grid gap-4" aria-label={rotulo.plural}><div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-lg font-semibold">{rotulo.plural}</h2>{!somenteLeitura && <Button onClick={() => setEdicao(null)}>Cadastrar {rotulo.singular}</Button>}</div><Panel><div className="grid gap-3 p-4 sm:grid-cols-2"><label className="text-sm">Buscar {rotulo.singular}<Input type="search" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></label><label className="text-sm">Situação<SelectCampo value={ativo} onValueChange={v => { setAtivo(v); setPagina(1); }}><option value="">Todos</option><option value="true">Ativos</option><option value="false">Inativos</option></SelectCampo></label></div><ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button>}{carregando ? <p role="status" className="p-4">Carregando cadastros…</p> : !erro && (dados?.itens.length ? <TabelaFinanceira itens={dados.itens} chaveDe={i => i.id} rotulo={rotulo.plural} onAbrir={setEdicao} colunas={[{ chave: 'nome', titulo: 'Nome', principal: true, celula: i => i.nome }, { chave: 'situacao', titulo: 'Situação', celula: i => <Pill tone={i.ativo ? 'green' : 'amber'}>{i.ativo ? 'Ativo' : 'Inativo'}</Pill> }, { chave: 'acoes', titulo: 'Ações', acoes: true, celula: i => <Button secondary onClick={() => setEdicao(i)}>{somenteLeitura ? 'Consultar' : 'Editar'}</Button> }]} /> : <Empty><strong>Nenhum cadastro encontrado</strong><p>{busca || ativo ? 'Altere a busca ou a situação selecionada.' : 'Os cadastros adicionados aparecerão aqui.'}</p></Empty>)}{dados && !carregando && !erro && <Paginacao rotulo={rotulo.plural} substantivo="cadastros" idSelect={`pagina-${tipo}`} pagina={pagina} totalPaginas={Math.max(1, Math.ceil(dados.total / 10))} total={dados.total} porPagina={10} onPagina={setPagina} />}</Panel>{edicao !== undefined && <FormCatalogoProduto key={edicao?.id ?? 'novo'} tipo={tipo} item={edicao} somenteLeitura={somenteLeitura} onFechar={() => setEdicao(undefined)} onSalvo={() => { setEdicao(undefined); setRevisao(r => r + 1); }} />}</section>;
}
