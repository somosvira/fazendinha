import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>{
 const catalogo=()=>({findUnique:vi.fn(),update:vi.fn()});
 const tx={
  $queryRaw:vi.fn(),$executeRaw:vi.fn(),
  reenvioCadastroEstoque:{findUnique:vi.fn(),create:vi.fn()},
  fabricanteProduto:catalogo(),classificacaoTecnicaProduto:catalogo(),principioAtivo:catalogo(),nutrienteProdutoCatalogo:catalogo(),
  perfilNutricionalProdutoItem:{count:vi.fn()},auditoriaFinanceira:{create:vi.fn()},
 };
 return {tx,transaction:vi.fn(async(fn:(db:typeof tx)=>Promise<unknown>)=>fn(tx))};
});
vi.mock("../../db.js",()=>({prisma:{$transaction:mocks.transaction}}));
import {atualizarFabricantes,atualizarClassificacoesTecnicas,atualizarPrincipiosAtivos,atualizarNutrientes} from "./catalogos.js";
import {patchCatalogoSchema,patchNutrienteSchema,patchPrincipioSchema} from "./catalogos.schemas.js";
import {uid} from "../../lib/uid.fixture.js";
const registro={id:uid(1),nome:"Nome anterior",nomeNormalizado:"nome anterior",ativo:true,revisao:1,origensCadastro:[],origens:[],unidadeReferencia:"MG_KG"};
const input={nome:"Nome novo",ativo:true,revisaoEsperada:1,chaveReenvio:uid(2)};
beforeEach(()=>{
 vi.clearAllMocks();
 mocks.tx.reenvioCadastroEstoque.findUnique.mockResolvedValue(null);
 mocks.tx.perfilNutricionalProdutoItem.count.mockResolvedValue(0);
 for(const cat of [mocks.tx.fabricanteProduto,mocks.tx.classificacaoTecnicaProduto,mocks.tx.principioAtivo,mocks.tx.nutrienteProdutoCatalogo]){
  cat.findUnique.mockResolvedValue(registro);cat.update.mockResolvedValue({...registro,nome:"Nome novo",revisao:2});
 }
});
describe("alterações dos catálogos auxiliares",()=>{
 it("schemas aceitam situação enviada sem mudança; decisão depende do cadastro vigente",()=>{
  expect(patchCatalogoSchema.safeParse(input).success).toBe(true);
  expect(patchPrincipioSchema.safeParse(input).success).toBe(true);
  expect(patchNutrienteSchema.safeParse(input).success).toBe(true);
 });
 it.each([atualizarFabricantes,atualizarClassificacoesTecnicas,atualizarPrincipiosAtivos,atualizarNutrientes])("renomeia sem exigir motivo quando a situação permanece",async atualizar=>{
  const salvo=await atualizar(uid(1),input,7);
  expect(salvo).toMatchObject({nome:"Nome novo",revisao:2});
 });
 it.each([atualizarFabricantes,atualizarClassificacoesTecnicas,atualizarPrincipiosAtivos,atualizarNutrientes])("exige motivo para mudança real de situação",async atualizar=>{
  await expect(atualizar(uid(1),{...input,ativo:false},7)).rejects.toMatchObject({code:"VALIDACAO",campo:"motivoAlteracao"});
  expect(mocks.tx.auditoriaFinanceira.create).not.toHaveBeenCalled();
 });
 it("bloqueia mudança de unidade quando nutriente tem histórico",async()=>{
  mocks.tx.perfilNutricionalProdutoItem.count.mockResolvedValue(1);
  await expect(atualizarNutrientes(uid(1),{...input,unidadeReferencia:"PERCENTUAL"},7)).rejects.toMatchObject({code:"CONFLITO",campo:"unidadeReferencia"});
  expect(mocks.tx.nutrienteProdutoCatalogo.update).not.toHaveBeenCalled();
 });
 it("permite unidade nova sem histórico e preserva unidade existente sem consulta desnecessária",async()=>{
  await atualizarNutrientes(uid(1),{...input,unidadeReferencia:"PERCENTUAL"},7);
  expect(mocks.tx.nutrienteProdutoCatalogo.update).toHaveBeenCalled();
  mocks.tx.perfilNutricionalProdutoItem.count.mockClear();
  await atualizarNutrientes(uid(1),{...input,unidadeReferencia:"MG_KG"},7);
  expect(mocks.tx.perfilNutricionalProdutoItem.count).not.toHaveBeenCalled();
 });
});
