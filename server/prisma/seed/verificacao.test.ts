import { beforeEach, describe, expect, it, vi } from 'vitest';
const estado = vi.hoisted(() => ({ sitios: [] as Array<Record<string,unknown>>, usuarios: [] as Array<Record<string,unknown>>, bancos: [] as Array<Record<string,unknown>>, racaTest: 'NE' }));
vi.mock('../../src/db.js', () => ({ prisma: {
 propriedade: { findMany: vi.fn(async () => estado.sitios) }, usuario: { findMany: vi.fn(async () => estado.usuarios) }, contaFinanceira: { findMany: vi.fn(async () => estado.bancos) },
 localizacaoAnimal: { findMany: vi.fn(async ({where}:{where:{propriedadeId:number}}) => {
  const numeros = where.propriedadeId===1 ? Array.from({length:72},(_,i)=>i+1) : where.propriedadeId===2 ? Array.from({length:36},(_,i)=>i+101) : Array.from({length:24},(_,i)=>i+201);
  return numeros.map(n=>({animalId:`animal-${n}`,animal:{baixas:[],composicao:[{racaId:where.propriedadeId===3?estado.racaTest:'NE',fracao64:64}],destinos:[{aptidao:'CORTE'}],sexo:n===127?'M':'F',categoriasManuais:n===127?[{categoria:{chavePadrao:'M_REPRODUTOR'}}]:[]}}));
 }) },
} }));
vi.mock('./rebanho.js', () => ({animaisSeed:[]}));
vi.mock('../../src/services/pecuaria/leite/carencia-producao.js', () => ({conferirCarenciaProducaoTx:vi.fn()}));
vi.mock('../../src/services/pecuaria/leite/custos.js', () => ({consultarCustosLeiteTx:vi.fn()}));
import { verificar, verificarQualidadeSeed } from './verificacao.js';
import { Contexto, BANCO } from './contexto.js';
import { aplicarPreset } from '../../src/services/auth/papeis.js';
import { hashSenha } from '../../src/services/auth/hash.js';
const senhaHash = hashSenha('test1234');
const contexto = () => new Contexto({versao:1,banco:BANCO,identidade:'unitario',baseline:{nome:'base',checksum:'a'.repeat(64)},fuso:'America/Sao_Paulo',dataBase:'2026-10-24',ids:{'sitio:Principal':'1','sitio:Arrendado':'2','sitio:Test':'3','animal:127':'animal-127','raca:NE':'NE'},etapas:[],acoes:[],criadoEm:'2026-10-24T12:00:00.000Z'},true);
beforeEach(()=>{
 estado.sitios=['Sítio principal','Sítio arrendado','Sítio test'].map((nome,i)=>({id:i+1,nome,ativo:true,principal:i===0})); estado.racaTest='NE';
 estado.usuarios=['fellipe@test.com','rafael@test.com'].map(email=>({email,dono:true,papel:'proprietario',status:'ATIVO',senhaHash,...aplicarPreset('proprietario')}));
 estado.bancos=Array.from({length:4},()=>({instituicao:'mesmo banco',propriedadeId:1}));
});
describe('assertivas de verificação por leitura com fixtures efêmeras',()=>{
 it('rejeita nome de sítio divergente mesmo com três registros',async()=>{estado.sitios[0].nome='Principal';await expect(verificar(contexto())).rejects.toThrow('nome/estado');});
 it('rejeita Nelore de teste substituído por outra raça',async()=>{estado.racaTest='HO';await expect(verificar(contexto())).rejects.toThrow('Nelore de corte');});
 it('rejeita proprietário sem exportação, mesmo com marcador de dono',async()=>{estado.usuarios[0].flags=['verValores'];await expect(verificar(contexto())).rejects.toThrow('todas as áreas/abas/flags');});
 it('não confunde quatro contas da mesma instituição com quatro bancos distintos',async()=>{await expect(verificar(contexto())).rejects.toThrow('instituições bancárias distintas');});
});


describe('envelope operacional da qualidade individual e coletiva', () => {
  const resultados = ['CCS', 'CPP', 'GORDURA', 'PROTEINA'].map(campo => ({ campo, unidade: campo === 'CCS' ? 'mil células/mL' : campo === 'CPP' ? 'mil UFC/mL' : '%' }));
  const prepararAmostras = () => [
    ...Array.from({ length: 24 }, (_, i) => ({ data: new Date(i < 12 ? '2026-09-20' : '2026-10-20'), sujeito: 'ANIMAL', status: 'VALIDO', versao: i === 0 ? 2 : 1,
      resultados: [], exameAnimal: { animalId: `animal-${i % 12}`, status: 'VALIDO', resultados } })),
    ...Array.from({ length: 8 }, () => ({ data: new Date('2026-10-20'), sujeito: 'COLETIVO', status: 'VALIDO', versao: 1, resultados, exameAnimal: null })),
    { data: new Date('2026-10-20'), sujeito: 'COLETIVO', status: 'ANULADO', versao: 2, resultados, exameAnimal: null },
    { data: new Date('2026-10-20'), sujeito: 'COLETIVO', status: 'VALIDO', versao: 1, resultados: [], exameAnimal: null },
  ];
  it('conta os resultados vigentes de ResultadoExame quando a amostra ANIMAL não tem resultados próprios', () => {
    expect(verificarQualidadeSeed(prepararAmostras())).toEqual({ individuais: 24, coletivas: 8 });
  });
  it('não aceita resultados coletivos antigos como substitutos de um exame individual sem resultado', () => {
    const amostras = prepararAmostras();
    for (const a of amostras.filter(a => a.exameAnimal)) { a.resultados = resultados; a.exameAnimal!.resultados = []; }
    expect(() => verificarQualidadeSeed(amostras)).toThrow('12 animais');
  });
  it('considera a anulação do exame individual e mantém a exigência de doze animais distintos', () => {
    const amostras = prepararAmostras();
    for (const a of amostras.filter(a => a.exameAnimal?.animalId === 'animal-0')) a.exameAnimal!.status = 'ANULADO';
    expect(() => verificarQualidadeSeed(amostras)).toThrow('12 animais');
  });
});
