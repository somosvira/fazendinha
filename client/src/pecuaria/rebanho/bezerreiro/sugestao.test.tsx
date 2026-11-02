// @vitest-environment jsdom
import { useState, type ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PartoCampos, dadosPartoVazios } from '../reproducao/PartoCampos';
import type { CriaInput } from '../reproducao/api';
import type { Lote } from '../types';
import { consultarBezerreiro } from './api';
import { useSugestaoBezerreiro } from './useSugestaoBezerreiro';
vi.mock('./api', () => ({consultarBezerreiro:vi.fn()}));
vi.mock('@/financeiro/SelectCampo', () => ({SelectCampo:({onValueChange, ...props}:ComponentProps<'select'> & {onValueChange:(v:string)=>void}) => <select {...props} onChange={e=>onValueChange(e.target.value)}/>}));
const lote:Lote = {id:'bez',nome:'Bezerreiro',propriedadeId:7,ativo:true,propriedade:{id:7,nome:'Sede'},observacao:null,animaisAtivos:0};
const perfil = {id:'perfil',loteId:'bez',ativo:true,lote:{id:'bez',nome:'Bezerreiro'}};
function Form({sitio=7, viva=true, lotesCarregando=false}:{sitio?:number;viva?:boolean;lotesCarregando?:boolean}) {
 const [crias,setCrias]=useState<CriaInput[]>([{viva,sexo:'F',aptidao:'LEITE'}]);
 return <PartoCampos lotesCarregando={lotesCarregando} valor={dadosPartoVazios()} onChange={vi.fn()} crias={crias} setCrias={setCrias} lotes={[lote,{...lote,id:"outro"}]} lactacao={false} setLactacao={vi.fn()} animalId="matriz" propriedadeId={sitio}/>;
}
function Consulta({sitio}:{sitio:number}) {const q=useSugestaoBezerreiro(sitio);return <p>{q.perfis.map(p=>p.id).join(',')}</p>;}
beforeEach(()=>{vi.clearAllMocks();vi.mocked(consultarBezerreiro).mockResolvedValue({perfis:[perfil]});});
afterEach(cleanup);
describe('sugestão de destino no parto',()=>{
 it('sugere o lote único no sítio sem exigir lactação e conserva Sem lote escolhido',async()=>{
  render(<Form/>);const campo=screen.getByLabelText('Lote da cria');
  await waitFor(()=>expect(campo).toHaveProperty('value','bez'));
  expect(consultarBezerreiro).toHaveBeenCalledWith('/configuracoes',7);
  expect(screen.getByText(/Ao salvar, entra no Bezerreiro sem programação alimentar/)).toBeTruthy();
  fireEvent.click(campo);fireEvent.change(campo,{target:{value:'__sem_lote__'}});fireEvent.change(screen.getByLabelText('Brinco (pode ficar pendente)'),{target:{value:'601'}});
  expect(campo).toHaveProperty('value','__sem_lote__');
 });
 it('não escolhe arbitrariamente com mais de um perfil',async()=>{
  vi.mocked(consultarBezerreiro).mockResolvedValue({perfis:[perfil,{...perfil,id:'outro',loteId:'outro'}]});render(<Form/>);
  await screen.findByText(/Há mais de um Bezerreiro/);expect(screen.getByLabelText('Lote da cria')).toHaveProperty('value','__escolher__');fireEvent.click(screen.getByLabelText('Lote da cria'));fireEvent.change(screen.getByLabelText('Lote da cria'),{target:{value:'__sem_lote__'}});expect(screen.getByLabelText('Lote da cria')).toHaveProperty('value','__sem_lote__');
 });
 it('ignora perfil ativo de lote desativado ao decidir o único destino',async()=>{
  vi.mocked(consultarBezerreiro).mockResolvedValue({perfis:[perfil,{...perfil,id:'inativo',loteId:'outro',lote:{id:'outro',nome:'Antigo',ativo:false}}]});render(<Form/>);
  await waitFor(()=>expect(screen.getByLabelText('Lote da cria')).toHaveProperty('value','bez'));
  expect(screen.queryByText(/Há mais de um Bezerreiro/)).toBeNull();
 });
 it('conserva Sem lote manual enquanto o catálogo de lotes ainda carrega',async()=>{
  const tela=render(<Form lotesCarregando/>);await screen.findByText(/Bezerreiro disponível/);
  const campo=screen.getByLabelText('Lote da cria');expect(campo).toHaveProperty('value','__escolher__');
  fireEvent.change(campo,{target:{value:'__sem_lote__'}});tela.rerender(<Form lotesCarregando={false}/>);
  expect(campo).toHaveProperty('value','__sem_lote__');
 });
 it('não sugere localização para natimorto',async()=>{render(<Form viva={false}/>);await waitFor(()=>expect(consultarBezerreiro).toHaveBeenCalled());expect(screen.getByLabelText('Lote da cria')).toHaveProperty('value','__sem_lote__');});
 it('não sobrescreve escolha manual com resposta atrasada',async()=>{
  let responder!:(v:unknown)=>void;vi.mocked(consultarBezerreiro).mockReturnValue(new Promise(r=>{responder=r;}));render(<Form/>);
  fireEvent.click(screen.getByLabelText('Lote da cria'));fireEvent.change(screen.getByLabelText('Lote da cria'),{target:{value:'__sem_lote__'}});responder({perfis:[perfil]});
  await screen.findByText(/Bezerreiro disponível/);expect(screen.getByLabelText('Lote da cria')).toHaveProperty('value','__sem_lote__');
 });
 it('descarta perfis recebidos para o sítio anterior',async()=>{
  let antigo!:(v:unknown)=>void;vi.mocked(consultarBezerreiro).mockImplementation((_path,sitio)=>sitio===7?new Promise(r=>{antigo=r;}):Promise.resolve({perfis:[{...perfil,id:'novo'}]}));
  const tela=render(<Consulta sitio={7}/>);tela.rerender(<Consulta sitio={8}/>);await screen.findByText('novo');antigo({perfis:[perfil]});
  await waitFor(()=>expect(screen.queryByText('perfil')).toBeNull());expect(screen.getByText('novo')).toBeTruthy();
 });
});
