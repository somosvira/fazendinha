import { useEffect, useState } from 'react';
import { PainelCadastro } from '@/financeiro/PainelCadastro';
import { SelectCampo } from '@/financeiro/SelectCampo';
import { Button } from '@/components/ui/button';
import { buscarFichaAnimal, listarAnimais } from '../api';
import type { AnimalFicha, AnimalResumo, ListarResultado } from '../types';
import { formatarDataBR } from '../lib/rotulos';
import { PaginacaoBezerreiro, useComando } from './ui';
import type { Configuracao } from './types';

export function RegularizarParticipacao({sitio, config, aoFechar, aoSalvar}: {sitio:number; config:Configuracao; aoFechar:()=>void; aoSalvar:()=>void}) {
  const perfis = config.perfis.filter(p => p.ativo && p.lote.ativo !== false);
  const [perfilId, setPerfil] = useState(perfis.length === 1 ? perfis[0].id : '');
  const perfil = perfis.find(p => p.id === perfilId);
  const [busca, setBusca] = useState(''), [pagina, setPagina] = useState(1);
  const [animal, setAnimal] = useState<AnimalResumo | null>(null), [motivo, setMotivo] = useState('');
  const [lista, setLista] = useState<ListarResultado | null>(null), [ficha, setFicha] = useState<AnimalFicha | null>(null);
  const [erro, setErro] = useState(''), [tentativa, setTentativa] = useState(0);
  const comando = useComando(sitio, aoSalvar, `${perfilId}:${animal?.id ?? ''}`);
  useEffect(() => {
    let vigente = true; setLista(null); setErro('');
    if (perfil) void listarAnimais({loteId:perfil.loteId, situacao:'ATIVO', busca:busca || undefined, page:pagina, pageSize:20}, sitio)
      .then(v => {if(vigente)setLista(v);}).catch(() => {if(vigente)setErro('Não foi possível consultar os animais deste lote.');});
    return () => {vigente = false;};
  }, [perfil?.loteId, sitio, busca, pagina, tentativa]);
  useEffect(() => {
    let vigente = true; setFicha(null);
    if (animal) void buscarFichaAnimal(animal.id, undefined, sitio).then(v => {if(vigente)setFicha(v);})
      .catch(() => {if(vigente)setErro('Não foi possível conferir a localização do animal.');});
    return () => {vigente = false;};
  }, [animal?.id, sitio, tentativa]);
  const local = ficha?.id === animal?.id ? ficha?.historicoLocalizacoes.find(l => !l.ate && l.lote?.id === perfil?.loteId && l.propriedade?.id === sitio) : undefined;
  const opcoes = [...(animal && !lista?.itens.some(a => a.id === animal.id) ? [animal] : []), ...(lista?.itens ?? [])];
  return <PainelCadastro aberto titulo="Regularizar participação" onFechar={aoFechar}
    bloqueado={comando.ocupado} alteracoesExternas={Boolean(animal || motivo.trim())} erroRodape={comando.erro || null}
    rodape={fechar => <>
      <Button type="button" variant="outline" disabled={comando.ocupado} onClick={fechar}>Cancelar</Button>
      <Button type="submit" form="regularizar-participacao" disabled={comando.ocupado}>
        {comando.ocupado ? 'Salvando…' : 'Regularizar participação'}
      </Button>
    </>}>
    <form id="regularizar-participacao" className="bez-regularizacao bezerreiro" onSubmit={e => {e.preventDefault(); if(!animal || !perfil || !local || motivo.trim().length < 5) {comando.setErro('Confira a localização e informe o motivo com pelo menos 5 caracteres.');return;} void comando.salvar('/participantes', {animalId:animal.id, perfilId:perfil.id, desde:local.desde.slice(0,10), motivo:motivo.trim()});}}>
      <fieldset disabled={comando.ocupado} className="bez-campos">
        <p className="bez-ajuda bez-inteiro">Use somente quando o animal já estiver no lote e faltar a participação. A localização é preservada, sem nova movimentação.</p>
        {!perfis.length && <p className="bez-ajuda bez-inteiro">Nenhum lote ativo configurado como Bezerreiro neste sítio. Confira as configurações antes de regularizar.</p>}
        <label>Bezerreiro<SelectCampo required value={perfilId} onValueChange={v => {if(!v)return;setPerfil(v);setAnimal(null);setFicha(null);setPagina(1);}}><option value="">Selecione</option>{perfis.map(p => <option key={p.id} value={p.id}>{p.lote.nome}</option>)}</SelectCampo></label>
        <label>Buscar animal<input disabled={!perfil} value={busca} onChange={e => {setBusca(e.target.value);setPagina(1);}} placeholder="Brinco ou nome"/></label>
        <label>Animal já localizado neste lote<SelectCampo required disabled={!lista} value={animal?.id ?? ''} onValueChange={id => {if(!id)return;setFicha(null);setAnimal(opcoes.find(a => a.id === id) ?? null);}}><option value="">{perfil && !lista ? 'Carregando animais…' : 'Selecione'}</option>{opcoes.map(a => <option key={a.id} value={a.id}>{a.brinco} · {a.nome ?? 'Sem nome'}</option>)}</SelectCampo></label>
        {local && <p className="bez-ajuda">Início comprovado da localização: {formatarDataBR(local.desde)}. A participação começa nessa data, sem programação alimentar.</p>}
        {animal && ficha && !local && <p role="alert" className="bez-erro">A localização atual não comprova este lote. Confira a movimentação do animal antes de regularizar.</p>}
        <label className="bez-inteiro">Motivo da regularização<textarea required minLength={5} maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)}/></label>
      </fieldset>
      {lista && <PaginacaoBezerreiro pagina={pagina} total={lista.total} mudar={setPagina}/>}
      {erro && <p role="alert" className="bez-erro">{erro} <Button type="button" variant="outline" onClick={() => setTentativa(n => n + 1)}>Tentar novamente</Button></p>}
    </form>
  </PainelCadastro>;
}
