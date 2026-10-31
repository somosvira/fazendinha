import {afterEach,describe,it,expect,vi} from "vitest";
import type {Alerta,ProgramacaoSanitaria,NecessidadeProgramacaoSanitaria} from "@prisma/client";
import {prisma} from "../../../../db.js";
import {consultarDetalheProgramacaoAlerta} from "./detalhe.js";
const data=new Date("2026-10-01");
const p:ProgramacaoSanitaria={id:"p",propriedadeId:1,nome:"Versão original",tipo:"VACINACAO",meses:[10],ano:2026,vigenciaInicio:data,vigenciaFim:null,precisao:"MES",dia:null,recorrencia:"SEM_REPETICAO",produtoId:"antigo",procedimento:null,publico:{sexo:"F"},publicoConferido:true,fonte:null,observacao:null,executor:"APLICACAO",tipoExameId:null,sujeitoTipo:"ANIMAL",antecedenciaDias:7,ativo:true,revisao:1,ativadoEm:data,criadoPorId:1,regraEquivalenteId:null,criadoEm:data,atualizadoEm:data};
const n:NecessidadeProgramacaoSanitaria={id:"n",programacaoId:"p",sujeitoTipo:"ANIMAL",sujeitoId:"animal",propriedadeId:1,periodo:"UNICA",alertaId:"a",situacao:"PROXIMO",revisao:1,aplicacaoId:null,exameId:null,regraNecessidadeId:null,criadoEm:data,atualizadoEm:data};
const a:Alerta={id:"a",proprietario:"fazendinha",produtor:"sanidade",tipo:"PROGRAMACAO",chaveOcorrencia:"c",revisao:1,ciclo:"ABERTO",situacao:"PROXIMO",propriedadeId:1,origemId:"n",sujeitoTipo:"ANIMAL",sujeitoId:"animal",chaveAgrupamento:"g",titulo:"Original",motivo:"Programação",resumo:{programacaoSnapshot:JSON.parse(JSON.stringify(p)),inicioJanela:"2026-10-01"},snapshotInicial:{original:true},dataReferencia:null,visivelDesde:new Date("2026-09-24"),prazo:null,criadoEm:data,atualizadoEm:data};
const u={id:1,nome:"Usuário",email:"u@example.invalid",papel:"proprietario",abas:[],areas:["pecuaria"],flags:["lancar"],status:"ATIVO",dono:true};
function preparar(situacao="PROXIMO"){
 const necessidade={...n,situacao,programacao:{...p,revisao:2,nome:"Nova verificação",produtoId:null,executor:"EXAME_ANIMAL",tipoExameId:"novo-exame",publico:{sexo:"M"}}};
 vi.spyOn(prisma.necessidadeProgramacaoSanitaria,"findUnique").mockResolvedValue(necessidade);
 vi.spyOn(prisma.animal,"findUnique").mockResolvedValue(null);
 const produto=vi.spyOn(prisma.produto,"findUnique").mockResolvedValue(null);
 vi.spyOn(prisma.tipoExame,"findUnique").mockResolvedValue(null);
 vi.spyOn(prisma.eventoAlerta,"findMany").mockResolvedValue([]);
 return produto;
}
afterEach(()=>vi.restoreAllMocks());
describe("detalhe da programação preservada",()=>{
 it("usa produto, executor e público da ocorrência, separando cadastro vigente",async()=>{const produto=preparar();const d=await consultarDetalheProgramacaoAlerta(a,u,new Date("2026-10-01T12:00:00Z"));expect(produto).toHaveBeenCalledWith({where:{id:"antigo"},select:{id:true,nome:true,ativo:true}});expect(d?.origem).toMatchObject({programacao:{revisao:1,nome:"Versão original",produtoId:"antigo",executor:"APLICACAO",publico:{sexo:"F"}},programacaoVigente:{revisao:2,nome:"Nova verificação"}});});
 it.each([["2026-09-30","PROXIMO"],["2026-10-01","PENDENTE"],["2026-10-02","PENDENTE"]])("mensal em %s mostra %s sem inventar data diária",async(dia,esperada)=>{preparar();const d=await consultarDetalheProgramacaoAlerta(a,u,new Date(dia+"T12:00:00Z"));expect(d?.situacao).toBe(esperada);expect(d?.origem).toMatchObject({dataReferencia:null});});
 it.each([["2026-10-29","ADIADO"],["2026-10-30","PENDENTE"],["2026-10-31","ATRASADO"]])("adiamento mensal em %s mostra %s e preserva a referência original",async(dia,esperada)=>{preparar("ADIADO");const d=await consultarDetalheProgramacaoAlerta({...a,situacao:"ADIADO",prazo:new Date("2026-10-30")},u,new Date(dia+"T12:00:00Z"));expect(d?.situacao).toBe(esperada);expect(d?.origem).toMatchObject({dataReferencia:null,dataAtencao:"2026-10-30"});});
});
