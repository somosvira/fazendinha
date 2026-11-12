import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/DatePicker';
import { SelectCampo } from '@/financeiro/SelectCampo';
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from '@/components/VisualizacaoConsulta';
import { TabelaFinanceira } from '@/financeiro/financeiro-ui';
import { navegarPara } from '../../../router';
import { formatarDataBR } from '../lib/rotulos';
import { FormFatoSanitario, type TipoFatoSanitario } from '../sanidade/FormFatoSanitario';
import { FormAplicacaoAnimal } from '../sanidade/FormAplicacaoAnimal';
import { ListaBezerreiro } from './ListaBezerreiro';
import { consultaBezerreiro } from './api';
import { dinheiro, litros } from './modelo';
import { EstadoConsulta, ModalBezerreiro, PaginacaoBezerreiro, useConsultaBezerreiro } from './ui';
import type { CustoBezerreiro, FatoSanidade, Pagina, Participacao } from './types';
export function PeriodoBezerreiro({params,mudar}: {params:URLSearchParams;mudar:(v:Record<string,string>)=>void}) {return <div className="bez-contexto"><label>De<DatePicker value={params.get('de')??''} onChange={v=>mudar({de:v,pagina:''})}/></label><label>Até<DatePicker value={params.get('ate')??''} onChange={v=>mudar({ate:v,pagina:''})}/></label></div>;}
export function CustosBezerreiro({sitio,params,mudar,revisao}: {sitio:number;params:URLSearchParams;mudar:(v:Record<string,string>)=>void;revisao:number}) {
  const consulta=useConsultaBezerreiro<CustoBezerreiro>(`/custos${consultaBezerreiro({de:params.get('de'),ate:params.get('ate'),animalId:params.get('animalId'),perfilId:params.get('perfil')})}`,sitio,revisao);
  const visual = useVisualizacaoConsulta('visualCustosBezerreiro', 'bezerreiro', 'visual');
  const dados = consulta.dados;
  const oculto = dados?.cobertura === 'OCULTO';
  const valor = (custo: Parameters<typeof dinheiro>[0]) => oculto ? 'Oculto' : dinheiro(custo);
  const coberturaRegistro = (pendencias: number) => pendencias
    ? `${pendencias} ${pendencias === 1 ? 'pendência' : 'pendências'}`
    : 'Registros conhecidos';

  return <div className="bez-painel-operacional">
    <header className="bez-painel-cabecalho">
      <div className="bez-painel-titulo">
        <h2>Custos do bezerreiro</h2>
        {dados && <span className="bez-selo bez-custos-cobertura" data-cobertura={dados.cobertura}>
          {oculto ? 'Valores ocultos por permissão' : dados.cobertura === 'COMPLETA' ? 'Cobertura completa' : 'Cobertura parcial'}
        </span>}
      </div>
      <AlternarVisualizacaoConsulta {...visual} rotulo="Visualização dos custos do bezerreiro" />
      <PeriodoBezerreiro params={params} mudar={mudar} />
    </header>
    <EstadoConsulta {...consulta} carregando={!dados}>
      {dados && <>
        <dl className="bez-indicadores">
          <div><dt>Alimentação · custo conhecido</dt><dd>{valor(dados.alimentacao.custoConhecido)}</dd></div>
          <div>
            <dt>Custo completo</dt><dd>{valor(dados.custoCompleto)}</dd>
            {!oculto && dados.alimentacao.pendencias > 0 &&
              <small className="bez-subtexto">{coberturaRegistro(dados.alimentacao.pendencias)} de alimentação</small>}
          </div>
          <div>
            <dt>Referência comercial do leite</dt><dd>{valor(dados.alimentacao.referenciaR07)}</dd>
            <small className="bez-subtexto">Valor separado do custo da alimentação</small>
          </div>
        </dl>
        <section>
          <h3>Componentes de custo</h3>
          <ListaBezerreiro modo={visual.modo} rotulo="Componentes de custo do bezerreiro" itens={[
            { id: 'alimentacao', nome: 'Alimentação registrada', base: litros(dados.alimentacao.quantidadeLitros),
              custo: dados.alimentacao.custoConhecido, pendencias: dados.alimentacao.pendencias },
            { id: 'sanidade', nome: 'Sanidade exclusiva dos bezerros', base: 'Fatos sanitários atribuídos',
              custo: dados.sanidade.custoConhecido, pendencias: dados.sanidade.pendencias },
          ]} chaveDe={c => c.id} colunas={[
            { chave: 'componente', titulo: 'Componente', principal: true, celula: c => c.nome },
            { chave: 'base', titulo: 'Base', celula: c => c.base },
            { chave: 'custo', titulo: 'Custo conhecido', alinhamento: 'direita', celula: c => valor(c.custo) },
            { chave: 'cobertura', titulo: 'Cobertura', celula: c => coberturaRegistro(c.pendencias) },
          ]} />
        </section>
        <section className="bez-painel-secao">
          <h3>Alimentação por animal</h3>
          <ListaBezerreiro modo={visual.modo} rotulo="Custos atribuídos por animal"
            itens={dados.porAnimal} chaveDe={a => a.animalId} colunas={[
              { chave: 'animal', titulo: 'Animal', principal: true, celula: a =>
                <button className="bez-link" onClick={() => navegarPara(`/pecuaria/bezerreiro/animais/${a.animalId}`)}>
                  {visual.modo === 'visual' ? <><span className="bez-animal-brinco">{a.brinco}</span> {a.nome ?? 'Sem nome'}</> : `${a.brinco} · ${a.nome ?? 'Sem nome'}`}
                </button> },
              { chave: 'volume', titulo: 'Volume atribuído', celula: a => litros(a.litrosAtribuidos) },
              { chave: 'custo', titulo: 'Custo alimentar atribuído', alinhamento: 'direita', celula: a => valor(a.custoAlimentarAtribuido) },
              { chave: 'sanidade', titulo: 'Sanidade', alinhamento: 'direita', celula: a => valor(a.custoSanitario) },
              { chave: 'pendencias', titulo: 'Cobertura', celula: a => coberturaRegistro(a.pendencias) },
            ]} />
          {dados.porAnimal.length === 0 && <p className="bez-estado">Nenhum custo atribuído por animal neste período.</p>}
          <p className="bez-ajuda">O custo da mistura é atribuído aos participantes da coleira na oferta. Isso não comprova quantos litros de cada origem cada animal ingeriu.</p>
        </section>
        <ul className="bez-lacunas">{dados.lacunas.map(l => <li key={l}>{l}</li>)}</ul>
      </>}
    </EstadoConsulta>
  </div>;
}
export function SanidadeBezerreiro({sitio,params,mudar,revisao,podeLancar,aoSalvar}: {sitio:number;params:URLSearchParams;mudar:(v:Record<string,string>)=>void;revisao:number;podeLancar:boolean;aoSalvar:()=>void}) {
  const pagina=Math.max(1,Number(params.get('pagina'))||1),consulta=useConsultaBezerreiro<Pagina<FatoSanidade>>(`/sanidade${consultaBezerreiro({de:params.get('de'),ate:params.get('ate'),pagina,animalId:params.get('animalId')})}`,sitio,revisao);
  const [selecionar,setSelecionar]=useState(false),[animalId,setAnimalId]=useState(''),[tipo,setTipo]=useState<TipoFatoSanitario|'aplicacao'>('exame'),[form,setForm]=useState(false);
  const participantes=useConsultaBezerreiro<Pagina<Participacao>>(selecionar?'/participantes?porPagina=100':null,sitio,revisao);
  function salvo(){setForm(false);aoSalvar();}
  const visual = useVisualizacaoConsulta('visualSanidadeBezerreiro', 'bezerreiro', 'visual');
  const rotulo = 'Sanidade dos bezerros';
  const chaveDe = (f: FatoSanidade) => `${f.tipo}-${f.id}`;
  const animal = (f: FatoSanidade) => <button className="bez-link" onClick={() => navegarPara(`/pecuaria/bezerreiro/animais/${f.animalId}`)}>
    {f.brinco} · {f.nome ?? 'Sem nome'}
  </button>;
  const situacao = (f: FatoSanidade) => f.status === 'VALIDO' ? 'Registrado' : f.status;
  const detalhes = (f: FatoSanidade) => <Button variant="outline" onClick={() => navegarPara(`/pecuaria/rebanho/animais/${f.animalId}#sanidade`)}>
    Ver detalhes
  </Button>;

  return <>
    <div className="bez-sectionhead">
      <h2>{rotulo}</h2>
      <AlternarVisualizacaoConsulta {...visual} rotulo="Visualização da sanidade dos bezerros" />
      {podeLancar && <Button onClick={() => setSelecionar(true)}>Registrar ação sanitária</Button>}
    </div>
    <PeriodoBezerreiro params={params} mudar={mudar} />
    <EstadoConsulta {...consulta} carregando={!consulta.dados}>
      {consulta.dados && <>
        {visual.modo === 'tabela' ? <TabelaFinanceira visualizacao="tabela" rotulo={rotulo}
          itens={consulta.dados.itens} chaveDe={chaveDe} colunas={[
            {chave:'animal',titulo:'Animal',principal:true,celula:animal},
            {chave:'acao',titulo:'Ação sanitária',celula:f=>f.descricao},
            {chave:'data',titulo:'Data',celula:f=>formatarDataBR(f.data)},
            {chave:'status',titulo:'Situação',celula:situacao},
            {chave:'detalhe',titulo:'Ação',acoes:true,celula:detalhes},
          ]} /> : consulta.dados.itens.length > 0 && <ul className="bez-sanidade-cartoes" aria-label={rotulo}>
          {consulta.dados.itens.map(f => <li className="bez-sanidade-cartao" key={chaveDe(f)}>
            <div className="bez-sanidade-cartao-topo">
              {animal(f)}
              <span className="bez-selo">{situacao(f)}</span>
            </div>
            <div className="bez-sanidade-cartao-corpo">
              <dl>
                <div><dt>Ação sanitária</dt><dd>{f.descricao}</dd></div>
                <div><dt>Data</dt><dd>{formatarDataBR(f.data)}</dd></div>
              </dl>
              {detalhes(f)}
            </div>
          </li>)}
        </ul>}
        {!consulta.dados.total && <p className="bez-estado">Nenhuma ação sanitária registrada durante as participações deste recorte.</p>}
        <PaginacaoBezerreiro pagina={pagina} total={consulta.dados.total} mudar={p => mudar({pagina:String(p)})} />
      </>}
    </EstadoConsulta>
    {selecionar&&<ModalBezerreiro titulo="Registrar ação sanitária" form="selecionar-acao" textoSalvar="Continuar" aoFechar={()=>setSelecionar(false)}><form id="selecionar-acao" onSubmit={e=>{e.preventDefault();setSelecionar(false);setForm(true);}}><div className="bez-campos"><label>Bezerro<SelectCampo required value={animalId} onValueChange={setAnimalId}><option value="">Selecione o animal</option>{participantes.dados?.itens.map(p=><option key={p.id} value={p.animalId}>{p.animal.brinco} · {p.animal.nome??'Sem nome'}</option>)}</SelectCampo></label><label>Ação<SelectCampo value={tipo} onValueChange={v=>setTipo(v as typeof tipo)}><option value="exame">Exame</option><option value="ocorrencia">Ocorrência sanitária</option><option value="protocolo">Protocolo sanitário</option><option value="aplicacao">Aplicação / vacinação</option></SelectCampo></label></div>{participantes.erro&&<p role="alert" className="bez-erro">{participantes.erro}</p>}</form></ModalBezerreiro>}
    {form&&(tipo==='aplicacao'?<FormAplicacaoAnimal animalInicial={animalId} onFechar={()=>setForm(false)} onSalvo={salvo}/>:<FormFatoSanitario tipo={tipo} animalInicial={animalId} fixo propriedadeId={sitio} onFechar={()=>setForm(false)} onSalvo={salvo}/>)}
  </>;
}
