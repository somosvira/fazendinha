import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { registrarEvidenciaAvaliacaoTx } from "./evidencia-reprodutiva.js";
const campos=[{codigo:"CONCLUSAO_GESTACIONAL",tipo:"OPCAO",opcoes:["POSITIVO","NEGATIVO","INCONCLUSIVO"],obrigatorio:false},{codigo:"SEXO_FETAL",tipo:"OPCAO",opcoes:["F","M"]}];
describe("persistência da decisão posterior ao DG",()=>{
 it.each(["INDICAR","NAO_INDICAR",null] as const)("conserva %s no fato e na resposta sem criar participação",async decisaoIatf=>{
  const exame=vi.fn().mockResolvedValue({});
  const tx={
   $executeRaw:vi.fn().mockResolvedValue(1),
   tipoExame:{findUnique:vi.fn().mockResolvedValue({id:"exame",nome:"DG",tipoResultado:"MULTIPLO",contexto:"REPRODUTIVO",ativo:true,versaoFormato:1,campos})},
   exameAnimal:{create:exame},
   avaliacaoReprodutiva:{findUniqueOrThrow:vi.fn().mockResolvedValue({id:"dg",resultado:"NEGATIVO"})},
  } as unknown as Prisma.TransactionClient;
  const r=await registrarEvidenciaAvaliacaoTx(tx,{id:"dg",animalId:"a",data:new Date("2026-11-03"),resultado:"NEGATIVO",decisaoIatf,conduta:decisaoIatf==="INDICAR"?"IATF":null});
  expect(exame).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({interpretacao:{create:expect.objectContaining({decisaoIatf})}})}));
  expect(r.decisaoIatf).toBe(decisaoIatf);
 });
});

it("um único exame persiste DG e aptidão independentes, sem decisão extra", async () => {
 const create = vi.fn().mockResolvedValue({});
 const tx = { $executeRaw: vi.fn(), tipoExame: { findUnique: vi.fn().mockResolvedValue({ id: "exame", nome: "DG", tipoResultado: "MULTIPLO", contexto: "REPRODUTIVO", ativo: true, versaoFormato: 1, campos }) }, exameAnimal: { create }, avaliacaoReprodutiva: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "dg", resultado: "NEGATIVO" }) } } as unknown as Prisma.TransactionClient;
 const dados = { id: "dg", animalId: "a", data: new Date("2026-11-03"), resultado: "NEGATIVO", resultadoAptidao: "APTO" as const, responsavel: "Veterinária", decisaoIatf: "NAO_INDICAR" as const };
 const r = await registrarEvidenciaAvaliacaoTx(tx, dados);
 expect(create).toHaveBeenCalledTimes(1);
 expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ finalidades: expect.arrayContaining(["DIAGNOSTICO", "APTIDAO_REPRODUTIVA"]), interpretacao: { create: expect.objectContaining({ resultadoAptidao: "APTO", decisaoIatf: "NAO_INDICAR" }) } }) }));
 expect(r).toMatchObject({ resultado: "NEGATIVO", resultadoAptidao: "APTO", decisaoIatf: "NAO_INDICAR" });
 await expect(registrarEvidenciaAvaliacaoTx(tx, { ...dados, responsavel: null })).rejects.toThrow(/responsável/);
 await expect(registrarEvidenciaAvaliacaoTx(tx, { ...dados, resultado: "POSITIVO" })).rejects.toThrow(/Gestação confirmada/);
});

it("distingue avaliação de aptidão realizada sem DG de exame não realizado", async () => {
 const create = vi.fn().mockResolvedValue({});
 const tx = { $executeRaw: vi.fn(), tipoExame: { findUnique: vi.fn().mockResolvedValue({ id: "exame", nome: "Avaliação", tipoResultado: "MULTIPLO", contexto: "REPRODUTIVO", ativo: true, versaoFormato: 1, campos }) }, exameAnimal: { create }, avaliacaoReprodutiva: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "av", resultado: "NAO_AVALIADO" }) } } as unknown as Prisma.TransactionClient;
 const dados = { id: "av", animalId: "a", data: new Date("2026-11-03"), resultado: "NAO_AVALIADO", realizadoSemDG: true, resultadoAptidao: "APTO" as const, responsavel: "Veterinária" };
 await registrarEvidenciaAvaliacaoTx(tx, dados);
 expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ realizacao: "REALIZADO", finalidadePrincipal: "AVALIACAO_REPRODUTIVA", finalidades: ["AVALIACAO_REPRODUTIVA", "APTIDAO_REPRODUTIVA"], resultados: { create: [] }, interpretacao: { create: expect.objectContaining({ resultadoAptidao: "APTO" }) } }) }));
 await expect(registrarEvidenciaAvaliacaoTx(tx, { ...dados, realizadoSemDG: false })).rejects.toThrow(/realizada sem DG/);
 await expect(registrarEvidenciaAvaliacaoTx(tx, { ...dados, resultadoAptidao: null })).rejects.toThrow(/ao menos um item/);
});

it("sexagem inconclusiva contextual não cria resultado de DG", async () => {
 const create = vi.fn().mockResolvedValue({});
 const tx = { $executeRaw: vi.fn(), tipoExame: { findUnique: vi.fn().mockResolvedValue({ id: "exame", nome: "Avaliação", tipoResultado: "MULTIPLO", contexto: "REPRODUTIVO", ativo: true, versaoFormato: 1, campos }) }, exameAnimal: { create }, avaliacaoReprodutiva: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "av", resultado: "INCONCLUSIVO" }) } } as unknown as Prisma.TransactionClient;
 await registrarEvidenciaAvaliacaoTx(tx, { id:"av", animalId:"a", data:new Date("2026-11-03"), resultado:"INCONCLUSIVO", finalidade:"SEXAGEM", sexagemInconclusivaSemDG:true, contextualSnapshot:{ itens:[{tipo:"SEXAGEM",estado:"INCONCLUSIVO"}] } });
 expect(create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({resultados:{create:[]},finalidadePrincipal:"SEXAGEM",avaliacaoContextualSnapshot:{ itens:[{tipo:"SEXAGEM",estado:"INCONCLUSIVO"}] }})}));
});

it("reconfirmação contextual parcial preserva somente os itens realizados", async () => {
 const create=vi.fn().mockResolvedValue({});
 const tx={ $executeRaw:vi.fn(), tipoExame:{findUnique:vi.fn().mockResolvedValue({id:"exame",nome:"Avaliação",tipoResultado:"MULTIPLO",contexto:"REPRODUTIVO",ativo:true,versaoFormato:1,campos})},exameAnimal:{create},avaliacaoReprodutiva:{findUniqueOrThrow:vi.fn().mockResolvedValue({id:"av",resultado:"NAO_AVALIADO"})} } as unknown as Prisma.TransactionClient;
 const dados={id:"av",animalId:"a",data:new Date("2026-11-03"),resultado:"NAO_AVALIADO",finalidade:"RECONFIRMACAO" as const,realizadoSemDG:true,parcial:true,itensRealizados:true};
 await registrarEvidenciaAvaliacaoTx(tx,dados);
 expect(create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({finalidadePrincipal:"AVALIACAO_REPRODUTIVA",resultados:{create:[]}})}));
 await expect(registrarEvidenciaAvaliacaoTx(tx,{...dados,parcial:false})).rejects.toThrow(/contextual/);
});
