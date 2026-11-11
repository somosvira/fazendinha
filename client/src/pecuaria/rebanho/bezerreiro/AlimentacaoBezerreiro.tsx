import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/DatePicker';
import { SelectCampo } from '@/financeiro/SelectCampo';
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from '@/components/VisualizacaoConsulta';
import { TabelaFinanceira, type ColunaTabela } from '@/financeiro/financeiro-ui';
import { navegarPara } from '../../../router';
import { hojeOperacional } from '../leite/modelo';
import { consultaBezerreiro, consultarBezerreiro } from './api';
import { dinheiro, horarioRealizado, litros, numero, idOfertaDaPrevisao, ofertaJaRealizada, ofertasDaPrevisao, ofertasConfiguracao, volumePrevisto } from './modelo';
import { ColeiraBadge, EstadoConsulta, ModalBezerreiro, PaginacaoBezerreiro, useComando, useConsultaBezerreiro, RecuperacaoConflito, useRecuperacaoConflito } from './ui';
import type { Configuracao, Oferta, Pagina, Previsao } from './types';
function CartoesAlimentacao<T>({ rotulo, itens, chaveDe, titulo, campos, situacao, acao }: {
  rotulo: string;
  itens: T[];
  chaveDe: (item: T) => string;
  titulo: (item: T) => ReactNode;
  campos: ColunaTabela<T>[];
  situacao?: (item: T) => ReactNode;
  acao?: (item: T) => ReactNode;
}) {
  return <ul className="bez-alimentacao-cartoes" aria-label={rotulo}>
    {itens.map(item => <li key={chaveDe(item)} className="bez-alimentacao-cartao">
      <div className="bez-alimentacao-cartao-topo"><strong>{titulo(item)}</strong>{situacao?.(item)}</div>
      <div className="bez-alimentacao-cartao-corpo">
        <dl>{campos.map(campo => <div key={campo.chave}><dt>{campo.titulo}</dt><dd>{campo.celula(item)}</dd></div>)}</dl>
        {acao?.(item)}
      </div>
    </li>)}
  </ul>;
}

export function AlimentacaoBezerreiro({sitio,config,podeLancar,revisao,aoSalvar,params,mudar}: {sitio:number;config:Configuracao;podeLancar:boolean;revisao:number;aoSalvar:()=>void;params:URLSearchParams;mudar:(v:Record<string,string>)=>void}) {
  const data=params.get('data')??hojeOperacional(),perfil=params.get('perfil')??(config.perfis.filter(p=>p.ativo).length===1?config.perfis.find(p=>p.ativo)!.id:''),pagina=Math.max(1,Number(params.get('pagina'))||1);
  const [fornecer,setFornecer]=useState<{sitio:number;perfilId:string;data:string;previsao:Previsao}|null>(null),[estornar,setEstornar]=useState<Oferta|null>(null);
  const consulta=useConsultaBezerreiro<Previsao>(`/previsao${consultaBezerreiro({data,perfilId:perfil})}`,sitio,revisao);
  const ofertas=useConsultaBezerreiro<Pagina<Oferta>>(`/ofertas${consultaBezerreiro({de:data,ate:data,perfilId:perfil,animalId:params.get('animalId'),pagina})}`,sitio,revisao);
  const visual = useVisualizacaoConsulta('visualAlimentacaoBezerreiro', 'bezerreiro', 'visual');
  type Grupo = Previsao['grupos'][number];
  const chaveColeira = (g: Grupo) => g.coleiraId ?? 'sem-coleira';
  const tituloColeira = (g: Grupo) => <ColeiraBadge nome={g.nome} cor={g.cor} />;
  const camposPrevisao: ColunaTabela<Grupo>[] = [
      {chave:'fase',titulo:'Fase',celula:g=>[...new Set(g.participantes.map(p=>config.fases.find(f=>f.id===p.faseVersaoId)?.nome??'Fase anterior'))].join(' · ')},
      {chave:'animais',titulo:'Animais',celula:g=>g.participantes.length},
      {chave:'porAnimal',titulo:'L/animal/dia',celula:g=>[...new Set(g.participantes.map(p=>numero(p.litrosDia)))].join(' / ')},
      {chave:'previsto',titulo:'Previsto no dia',alinhamento:'direita',celula:g=>litros(g.litrosDia)},
  ];
  const chaveOferta = (o: Oferta) => o.id;
  function tituloOferta(o: Oferta) {
    if (!o.ofertaProgramadaId) return 'Avulsa';
    const identidade = consulta.dados?.grupos
      .flatMap(g => g.participantes.flatMap(p => p.ofertas))
      .find(p => p.id === o.ofertaProgramadaId)?.identidadeId;
    const ordem = ofertasConfiguracao(config).findIndex(p => p.id === o.ofertaProgramadaId || p.identidadeId === identidade);
    return `Oferta ${ordem + 1 || 'anterior'}`;
  }
  const camposOferta: ColunaTabela<Oferta>[] = [
      {chave:'horario',titulo:'Horário realizado',celula:o=>o.ocorridoEm?new Date(o.ocorridoEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Não informado'},
      {chave:'volume',titulo:'Fornecido',alinhamento:'direita',celula:o=>litros(o.grupos.reduce((n,g)=>n+Number(g.quantidadeLitros),0))},
      {chave:'custo',titulo:'Custo',alinhamento:'direita',celula:o=>o.grupos.every(g=>g.custoProducao!=null)?dinheiro(o.grupos.reduce((n,g)=>n+Number(g.custoProducao),0)):'A apurar / oculto'},
  ];
  const situacaoOferta = (o: Oferta) => o.status === 'CONFIRMADO' ? 'Confirmado' : 'Estornado';
  const acaoEstorno = (o: Oferta) => podeLancar && o.status === 'CONFIRMADO'
    ? <Button variant="outline" size="sm" onClick={() => setEstornar(o)}>Estornar</Button> : null;
  const previsao = consulta.dados;
  const previsto = Number(previsao?.totalPrevistoLitros);
  const percentual = previsao?.previsaoCompleta && previsto > 0
    ? Math.round(Number(previsao.totalFornecidoLitros) / previsto * 100)
    : null;

  return <div className="bez-painel-operacional">
    <header className="bez-painel-cabecalho">
      <h2>Alimentação</h2>
      <AlternarVisualizacaoConsulta {...visual} rotulo="Visualização da alimentação" />
      <div className="bez-contexto">
        <label>Data<DatePicker value={data} onChange={v => mudar({data:v,pagina:''})} /></label>
        <label>Bezerreiro<SelectCampo value={perfil} onValueChange={v => mudar({perfil:v,pagina:''})}>
          <option value="">Todos os bezerreiros</option>
          {config.perfis.map(p => <option key={p.id} value={p.id}>{p.lote.nome}</option>)}
        </SelectCampo></label>
        <Button variant="outline" onClick={() => navegarPara('/configuracoes/pecuaria/producao/bezerreiro')}>Configurar rotina</Button>
        {podeLancar && <Button disabled={!previsao || !perfil} onClick={() => previsao && setFornecer({sitio,perfilId:perfil,data,previsao})}>
          Registrar fornecimento
        </Button>}
      </div>
    </header>
    <EstadoConsulta {...consulta} carregando={!previsao}>
      {previsao && <>
        <dl className="bez-indicadores">
          <div><dt>Previsto no dia</dt><dd>{litros(previsao.totalPrevistoLitros)}</dd></div>
          <div>
            <dt>Fornecido</dt>
            <dd>{litros(previsao.totalFornecidoLitros)}
              {percentual !== null && <>
                <progress aria-label="Progresso do fornecimento" aria-valuetext={`${percentual}% da previsão`} max={100} value={Math.min(percentual, 100)} />
                <small className="bez-subtexto">{percentual}% da previsão</small>
              </>}
            </dd>
          </div>
          <div><dt>Restante previsto</dt><dd>{litros(previsao.grupos.reduce((n,g) => n + Number(g.restanteLitros), 0))}</dd></div>
        </dl>
        {!previsao.previsaoCompleta && <p className="bez-aviso">Previsão parcial: {previsao.pendentes.length} animal(is) sem fase publicada ou localização comprovada.</p>}
        <div className="bez-painel-alimentacao">
          <section aria-label="Previsão diária por coleira">
            <h3>Previsão diária por coleira</h3>
            {visual.modo === 'visual' ?
              <CartoesAlimentacao rotulo="Previsão diária por coleira" itens={previsao.grupos}
                chaveDe={chaveColeira} titulo={tituloColeira} campos={camposPrevisao} />
              : <TabelaFinanceira visualizacao="tabela" rotulo="Previsão diária por coleira" itens={previsao.grupos}
                chaveDe={chaveColeira} colunas={[{chave:'coleira',titulo:'Coleira',principal:true,celula:tituloColeira}, ...camposPrevisao]} />}
          </section>
          <section className="bez-disponibilidade">
            <h3>Disponibilidade para as próximas ofertas</h3>
            <dl>{(['NAO_COMERCIAL', 'COMERCIAL'] as const).map(natureza => <div key={natureza}>
              <dt>{natureza === 'COMERCIAL' ? 'Leite comercial' : 'Leite de descarte'}</dt>
              <dd>{litros(previsao.origens.filter(o => o.natureza === natureza).reduce((s,o) => s + Number(o.quantidadeDisponivelLitros), 0))}</dd>
            </div>)}</dl>
          </section>
        </div>
      </>}
    </EstadoConsulta>
    <section className="bez-painel-secao"><div className="bez-sectionhead"><h3>Fornecimentos do dia</h3><Button variant="outline" onClick={()=>mudar({aba:'custos'})}>Consultar custos</Button></div><EstadoConsulta {...ofertas} carregando={!ofertas.dados}>{ofertas.dados&&(ofertas.dados.itens.length?<>{visual.modo === 'visual' ?
      <CartoesAlimentacao rotulo="Fornecimentos do dia" itens={ofertas.dados.itens} chaveDe={chaveOferta}
        titulo={tituloOferta} campos={camposOferta}
        situacao={o => <span className="bez-selo" data-confirmado={o.status === 'CONFIRMADO'}>{situacaoOferta(o)}</span>}
        acao={acaoEstorno} />
      : <TabelaFinanceira visualizacao="tabela" rotulo="Fornecimentos do dia" itens={ofertas.dados.itens} chaveDe={chaveOferta}
        colunas={[{chave:'oferta',titulo:'Oferta',principal:true,celula:tituloOferta}, ...camposOferta,
          {chave:'status',titulo:'Situação',celula:situacaoOferta},
          {chave:'acao',titulo:'Ação',acoes:true,celula:o=>acaoEstorno(o)??'—'}]} />}<PaginacaoBezerreiro pagina={pagina} total={ofertas.dados.total} mudar={v=>mudar({pagina:String(v)})}/></>:<p className="bez-estado">Nenhum fornecimento registrado nesta data.</p>)}</EstadoConsulta></section>
    {fornecer&&<FormFornecimento {...fornecer} contextoAtivo={fornecer.sitio===sitio&&fornecer.perfilId===perfil&&fornecer.data===data} aoFechar={()=>setFornecer(null)} aoSalvar={()=>{setFornecer(null);aoSalvar();}}/>}
    {estornar&&<EstornoOferta sitio={sitio} oferta={estornar} aoFechar={()=>setEstornar(null)} aoSalvar={()=>{setEstornar(null);aoSalvar();}}/>}
  </div>;
}
function FormFornecimento({sitio,perfilId,data,previsao:previsaoInicial,contextoAtivo,aoFechar,aoSalvar}: {sitio:number;perfilId:string;data:string;previsao:Previsao;contextoAtivo:boolean;aoFechar:()=>void;aoSalvar:()=>void}) {
  const [previsao,setPrevisao]=useState(previsaoInicial);
  const programadas=ofertasDaPrevisao(previsao),primeira=programadas.find(p=>!ofertaJaRealizada(previsao,p.identidadeId));
  const [oferta,setOferta]=useState(primeira?.identidadeId??''),[horario,setHorario]=useState(''),[responsavel,setResponsavel]=useState(''),[observacao,setObservacao]=useState(''),[adicional,setAdicional]=useState(false);
  const [quantidades,setQuantidades]=useState<Record<string,string>>(()=>Object.fromEntries(previsao.grupos.map(g=>[g.coleiraId??'',String(volumePrevisto(g,primeira?.identidadeId??''))])));
  const alvo=JSON.stringify([sitio,perfilId,data]),comando=useComando(sitio,aoSalvar,alvo);
  const recuperacao=useRecuperacaoConflito<Previsao>(alvo,()=>consultarBezerreiro(`/previsao${consultaBezerreiro({data,perfilId})}`,sitio));
  const grupos=previsao.grupos.map(g=>({...g,chave:g.coleiraId??''}));
  const total=grupos.reduce((n,g)=>n+Number(quantidades[g.chave]||0),0),disponivel=previsao.origens.reduce((n,o)=>n+Number(o.quantidadeDisponivelLitros),0);
  function trocar(id:string){setOferta(id);setQuantidades(atual=>({...atual,...Object.fromEntries(grupos.map(g=>[g.chave,String(volumePrevisto(g,id))]))}));}
  function conferir(){if(recuperacao.atual){recuperacao.conferir();setPrevisao(recuperacao.atual);comando.limparErro();}}
  return <ModalBezerreiro titulo="Registrar fornecimento" form="fornecimento-bezerreiro" aoFechar={aoFechar} textoSalvar="Confirmar fornecimento" {...comando}>
    {!contextoAtivo&&<p role="alert">O sítio, bezerreiro ou data da consulta mudou. O rascunho permanece no alvo original. Volte a esse contexto para confirmar.</p>}
    <RecuperacaoConflito conflito={comando.conflito} carregando={recuperacao.carregando} erro={recuperacao.erro} atualizado={!!recuperacao.atual} conferido={recuperacao.conferido} aoAtualizar={()=>{recuperacao.invalidar();void recuperacao.atualizar();}} aoConferir={conferir}>
      {recuperacao.atual&&<><p>Participantes e doses precisam ser conferidos; as quantidades digitadas serão preservadas.</p><ul>{recuperacao.atual.grupos.map(g=><li key={g.coleiraId??''}>{g.nome}: {g.participantes.length} animal(is), {litros(g.litrosDia)} por dia. Participantes: {g.participantes.map(p=>p.brinco??'Identificação pendente').join(', ')}.</li>)}</ul><p>Antes: {previsao.grupos.flatMap(g=>g.participantes.map(p=>p.brinco??'Identificação pendente')).join(', ')||'Sem participantes'}. Agora: {recuperacao.atual.grupos.flatMap(g=>g.participantes.map(p=>p.brinco??'Identificação pendente')).join(', ')||'Sem participantes'}.</p></>}
    </RecuperacaoConflito>
    <form id="fornecimento-bezerreiro" onSubmit={e=>{
      e.preventDefault();
      if(!contextoAtivo){comando.setErro('Volte ao sítio, bezerreiro e data originais para confirmar este rascunho.');return;}
      if(comando.conflito||recuperacao.carregando||(recuperacao.atual&&!recuperacao.conferido))return;
      if(!previsao.contextoToken){comando.setErro('Atualize a página para obter uma previsão conferível.');return;}
      if(grupos.some(g=>quantidades[g.chave]==null||quantidades[g.chave]==='')){comando.setErro('Confira a quantidade de cada coleira no contexto atualizado.');return;}
      if(total<=0){comando.setErro('Informe uma quantidade positiva para pelo menos uma coleira.');return;}
      if(total>disponivel){comando.setErro('O volume fornecido excede o leite disponível. Atualize as origens antes de confirmar.');return;}
      const divergentes=grupos.some(g=>Number(quantidades[g.chave])!==volumePrevisto(g,oferta));
      if((!oferta||divergentes||adicional)&&observacao.trim().length<5){comando.setErro(adicional?'Justifique o consumo adicional explicitamente conferido.':!oferta?'Informe um motivo de pelo menos cinco caracteres para o fornecimento avulso.':'Informe o motivo das diferenças em relação à oferta prevista.');return;}
      const ofertaVersionadaId=oferta?idOfertaDaPrevisao(previsao,oferta):null;
      if(oferta&&!ofertaVersionadaId){comando.setErro('A oferta prevista mudou. Atualize a previsão antes de confirmar.');return;}
      void comando.salvar('/ofertas',{perfilId,data,contextoToken:previsao.contextoToken,ocorridoEm:horarioRealizado(data,horario),horarioEstimado:false,ofertaProgramadaId:ofertaVersionadaId,responsavel,observacao:observacao||null,grupos:grupos.filter(g=>Number(quantidades[g.chave])>0).map(g=>({coleiraId:g.coleiraId,quantidadeLitros:quantidades[g.chave],...(adicional?{consumoAdicional:true}:{}),...(!oferta||adicional||Number(quantidades[g.chave])!==volumePrevisto(g,oferta)?{justificativa:observacao}:{})}))});
    }}>
      <fieldset disabled={comando.ocupado}>
        <div className="bez-campos"><label>Data<input readOnly value={data}/></label><label>Oferta prevista<SelectCampo value={oferta} onValueChange={trocar}><option value="">Sem oferta prevista · avulsa</option>{programadas.map((o,i)=><option key={o.identidadeId} value={o.identidadeId}>Oferta {i+1} · {numero(o.percentual)}%{o.horarioPrevisto?` · referência ${o.horarioPrevisto}`:''}</option>)}</SelectCampo></label><label>Horário realizado (opcional)<input type="time" value={horario} onChange={e=>setHorario(e.target.value)}/></label><label>Responsável<input required maxLength={160} value={responsavel} onChange={e=>setResponsavel(e.target.value)}/></label></div>
        <section className="bez-secao"><h3>Fornecimento por coleira</h3><TabelaFinanceira rotulo="Quantidade coletiva por coleira" itens={grupos} chaveDe={g=>g.chave} colunas={[
          {chave:'coleira',titulo:'Coleira',principal:true,celula:g=><ColeiraBadge nome={g.nome} cor={g.cor}/>},{chave:'animais',titulo:'Animais',celula:g=>g.participantes.length},{chave:'previsto',titulo:'Previsto (L)',celula:g=>numero(volumePrevisto(g,oferta))},{chave:'realizado',titulo:'Fornecido (L)',celula:g=><input required type="number" min="0" step="0.001" aria-label={`Litros coletivos ${g.nome}`} value={quantidades[g.chave]??''} onChange={e=>setQuantidades({...quantidades,[g.chave]:e.target.value})}/>} ]}/>
          {previsaoInicial.grupos.filter(g=>!grupos.some(atual=>atual.coleiraId===g.coleiraId)).map(g=><p key={g.coleiraId??''}>Rascunho preservado — {g.nome}: {litros(quantidades[g.coleiraId??''])}. Sem participantes atuais; esse volume não será enviado.</p>)}
        </section>
        <section className="bez-secao"><h3>Origens do leite</h3><p className="bez-aviso">{litros(total)} fornecidos · {litros(disponivel)} disponíveis. A baixa prioriza leite de descarte e complementa com leite comercial disponível.</p></section>
        <label className="bez-check"><input type="checkbox" checked={adicional} onChange={e=>setAdicional(e.target.checked)}/>Este é um consumo adicional ao leite já registrado em Nutrição; conferi que é um novo fornecimento.</label>
        <label className="bez-campo">Observação / motivo das diferenças<textarea required={!oferta||adicional} minLength={5} value={observacao} onChange={e=>setObservacao(e.target.value)} maxLength={500}/></label>
        <label className="bez-check"><input type="checkbox" required/>Conferi as quantidades fornecidas por coleira.</label>
      </fieldset>
    </form>
  </ModalBezerreiro>;
}
function EstornoOferta({sitio,oferta,aoFechar,aoSalvar}: {sitio:number;oferta:Oferta;aoFechar:()=>void;aoSalvar:()=>void}) {const [motivo,setMotivo]=useState(''),comando=useComando(sitio,aoSalvar);return <ModalBezerreiro titulo="Estornar fornecimento" form="estorno-oferta" aoFechar={aoFechar} textoSalvar="Confirmar estorno" {...comando}><form id="estorno-oferta" onSubmit={e=>{e.preventDefault();void comando.salvar(`/ofertas/${oferta.id}/estorno`,{versaoEsperada:oferta.versao,motivo});}}><p>O estorno conserva o fornecimento original e reverte os movimentos vinculados.</p><label className="bez-campo">Motivo<textarea required minLength={5} maxLength={500} value={motivo} onChange={e=>setMotivo(e.target.value)} disabled={comando.ocupado}/></label></form></ModalBezerreiro>;}
