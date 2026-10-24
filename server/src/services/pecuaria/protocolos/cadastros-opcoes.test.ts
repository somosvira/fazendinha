import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({count:vi.fn(),lista:vi.fn()}));
vi.mock("../../../db.js",()=>({prisma:{$transaction:async(fn:(tx:unknown)=>unknown)=>fn({produto:{count:m.count,findMany:m.lista},materialGenetico:{count:m.count,findMany:m.lista},tipoExame:{count:m.count,findMany:m.lista},tipoAplicacaoSanitaria:{count:m.count,findMany:m.lista}})}}));
import {listarOpcoesCadastro,opcoesCadastroSchema} from "./cadastros-opcoes.js";
const id="c0000000-0000-4000-8000-000000000001";
beforeEach(()=>{vi.resetAllMocks();m.count.mockResolvedValue(14);m.lista.mockResolvedValue([]);});
it("pagina produtos ativos sanitários sem carregar saldo ou preço",async()=>{const r=await listarOpcoesCadastro({opcao:"PRODUTO",origem:"SANITARIO",pagina:2});expect(r).toMatchObject({total:14,pagina:2,porPagina:10});expect(m.lista).toHaveBeenCalledWith(expect.objectContaining({skip:10,take:10,where:expect.objectContaining({ativo:true,usoSanitario:true})}));expect(m.lista.mock.calls[0][0].select).not.toHaveProperty("movimentos");});
it("selecionado preserva inativo e exige contexto reprodutivo",async()=>{await listarOpcoesCadastro({opcao:"TIPO_EXAME",origem:"REPRODUTIVO",selecionadoId:id});const where=m.count.mock.calls[0][0].where;expect(where).toMatchObject({id,tipoResultado:"MULTIPLO",contexto:{in:["REPRODUTIVO","COMPARTILHADO"]}});expect(where).not.toHaveProperty("ativo");});
it("IA e TE filtram tipos genéticos e rejeitam paginação maior que10",async()=>{await listarOpcoesCadastro({opcao:"MATERIAL",origem:"REPRODUTIVO",tipoTentativa:"TE"});expect(m.count).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({tipo:"EMBRIAO"})}));expect(()=>opcoesCadastroSchema.parse({opcao:"MATERIAL",origem:"REPRODUTIVO",porPagina:11})).toThrow();});
