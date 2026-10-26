import { beforeEach, describe, expect, it, vi } from 'vitest';
const estado=vi.hoisted(()=>({categorias:new Map<string,{id:string;nome:string;grupoId:string|null;classificacao:string}>(),atualizar:vi.fn()}));
vi.mock('../../src/db.js',()=>({prisma:{categoria:{findUniqueOrThrow:vi.fn(async({where}:{where:{id:string}})=>estado.categorias.get(where.id))}}}));
vi.mock('../../src/env.js',()=>({env:{DATABASE_URL:'postgresql://localhost/fazendinha_seedatev3',NODE_ENV:'test',STORAGE_NAMESPACE:'test'}}));
vi.mock('../../src/services/financeiro/cadastros-gerenciais.js',()=>({criarCategoria:vi.fn(),criarCentroCusto:vi.fn(),criarGrupoCategoria:vi.fn(),atualizarCategoria:estado.atualizar}));
import {regularizarCategoriasEstruturais} from './catalogos.js';
import {Contexto,BANCO} from './contexto.js';
const ids=['81939a31-d31b-4e1c-885e-681468621bc1','81939a31-d31b-4e1c-885e-681468621bc2'];
function contexto(){const c=new Contexto({versao:1,banco:BANCO,identidade:'unitario',baseline:{nome:'base',checksum:'a'.repeat(64)},fuso:'America/Sao_Paulo',dataBase:'2026-10-24',ids:{'usuario:dono':'1','categoria:Sanidade':ids[0],'categoria:Nutrição':ids[1],'grupo:Sanidade':'grupo-sanidade','grupo:Nutrição':'grupo-nutricao'},etapas:[],acoes:[],criadoEm:'2026-10-24T12:00:00.000Z'},false);vi.spyOn(c,'salvar').mockResolvedValue();return c;}
beforeEach(()=>{vi.clearAllMocks();estado.categorias.clear();['Sanidade','Nutrição'].forEach((nome,i)=>estado.categorias.set(ids[i],{id:ids[i],nome,grupoId:null,classificacao:'CUSTEIO'}));estado.atualizar.mockImplementation(async(id:string,patch:object)=>{Object.assign(estado.categorias.get(id)!,patch);});});
describe('complemento das categorias estruturais sem banco',()=>{
 it('completa grupo dos dois registros exatos da baseline pelo serviço',async()=>{await regularizarCategoriasEstruturais(contexto());expect(estado.atualizar).toHaveBeenCalledTimes(2);expect(estado.categorias.get(ids[0])!.grupoId).toBe('grupo-sanidade');expect(estado.categorias.get(ids[1])!.grupoId).toBe('grupo-nutricao');});
 it('a retomada não restaura uma edição posterior feita na interface',async()=>{const c=contexto();await regularizarCategoriasEstruturais(c);estado.categorias.get(ids[0])!.grupoId='grupo-da-interface';await regularizarCategoriasEstruturais(c);expect(estado.atualizar).toHaveBeenCalledTimes(2);expect(estado.categorias.get(ids[0])!.grupoId).toBe('grupo-da-interface');});
 it('recusa alteração de grupo anterior à ação sem sobrescrever',async()=>{estado.categorias.get(ids[0])!.grupoId='grupo-da-interface';await expect(regularizarCategoriasEstruturais(contexto())).rejects.toThrow('Não será reconfigurada');expect(estado.atualizar).not.toHaveBeenCalled();});
});
