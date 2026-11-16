import { expect, it } from "vitest";
import { dadosClinicosIniciais, montarItemClinico, animaisIndicadosParaIatf } from "./clinica-form";
import type { TarefaOperacional } from "./api";
import type { ItemClinico } from "./clinica-api";
import type { AvaliacaoContextualInput } from "../reproducao/avaliacao-contextual-api";
const tarefa = { id:"t", animal:{id:"a",brinco:"123"}, propriedadeId:7, tarefaOrigem:{tipo:"AVALIACAO"} } as TarefaOperacional;
const avaliacao = () => ({...dadosClinicosIniciais(tarefa),momento:"2026-11-04",tipoExameId:"exame",formato:{tipoResultado:"MULTIPLO" as const,formatoExameHash:"a".repeat(64)},gestacaoId:"gestacao"});
it("sexagem conhecida exige sexo e preserva inconclusivo sem inventar sexo",()=>{
 const d={...avaliacao(),finalidade:"SEXAGEM" as const,resultado:"SEXAGEM"};
 expect(()=>montarItemClinico(tarefa,d)).toThrow(/sexo fetal observado/);
 expect(montarItemClinico(tarefa,{...d,sexoFetal:"F"})).toMatchObject({resultado:"SEXAGEM",finalidade:"SEXAGEM",sexoFetal:"F",gestacaoId:"gestacao"});
 expect(montarItemClinico(tarefa,{...d,resultado:"INCONCLUSIVO"})).not.toHaveProperty("sexoFetal");
});
it("DG positivo permite sexo e negativo omite sexo residual",()=>{
 expect(montarItemClinico(tarefa,{...avaliacao(),resultado:"POSITIVO",sexoFetal:"M"})).toMatchObject({resultado:"POSITIVO",sexoFetal:"M"});
 expect(montarItemClinico(tarefa,{...avaliacao(),resultado:"NEGATIVO",sexoFetal:"M",decisaoIatf:"NAO_INDICAR"})).not.toHaveProperty("sexoFetal");
});
it("quantidade excepcional exige motivo e transporta justificativa sem alterar quantidade",()=>{
 const t={...tarefa,tarefaOrigem:{...tarefa.tarefaOrigem,tipo:"TENTATIVA"}};
 const d={...dadosClinicosIniciais(t),momento:"2026-11-04",quantidade:"2"};
 expect(()=>montarItemClinico(t,d)).toThrow(/motivo da quantidade/);
 expect(montarItemClinico(t,{...d,motivoQuantidadeExcepcional:"Uso documentado pelo responsável"})).toMatchObject({quantidade:"2",motivoQuantidadeExcepcional:"Uso documentado pelo responsável"});
 expect(montarItemClinico(t,{...d,quantidade:""})).not.toHaveProperty("quantidade");
});

it("preparação usa indicadas de todas as páginas e exclui outras decisões/resultados",()=>{
 const itens: ItemClinico[]=Array.from({length:12},(_,i)=>({...montarItemClinico(tarefa,{...avaliacao(),resultado:"NEGATIVO"}),animalId:`a${i}`,decisaoIatf:i===0||i===11?"INDICAR":i===1?"NAO_INDICAR":undefined}));
 itens[2]={...itens[2],resultado:"POSITIVO",decisaoIatf:"INDICAR"};
 expect(animaisIndicadosParaIatf({versao:1,propriedadeId:7,itens})).toEqual(["a0","a11"]);
 expect(animaisIndicadosParaIatf(null)).toEqual([]);
});

it("DG e aptidão seguem independentes no mesmo exame e sem indicação de protocolo", () => {
 expect(montarItemClinico(tarefa,{...avaliacao(),resultado:"NEGATIVO",resultadoAptidao:"APTO",retornoAptidaoEm:"2026-11-12",decisaoIatf:"NAO_INDICAR"})).toMatchObject({resultado:"NEGATIVO",resultadoAptidao:"APTO",retornoAptidaoEm:"2026-11-12",decisaoIatf:"NAO_INDICAR"});
});

it("avaliação parcial exige item realizado e mantém cuidados sem conclusão selecionada", () => {
  const base = {
    ...avaliacao(),
    resultado: "NAO_AVALIADO",
    realizadoSemDG: true,
  };
  expect(() => montarItemClinico(tarefa, base)).toThrow(
    /Não atendimento exige justificativa/,
  );
  const vazio: AvaliacaoContextualInput = {
    catalogoId: "catalogo",
    itens: [{ codigo: "UTERO", estado: "NAO_AVALIADO" }],
    condutas: [],
  };
  expect(() =>
    montarItemClinico(tarefa, { ...base, avaliacaoContextual: vazio }),
  ).toThrow(/Não atendimento exige justificativa/);
  const contexto: AvaliacaoContextualInput = {
    ...vazio,
    itens: [{ codigo: "UTERO", estado: "CONCLUSIVO" }],
  };
  expect(
    montarItemClinico(tarefa, {
      ...base,
      gestacaoId: "",
      avaliacaoContextual: contexto,
      vinculosConclusao: [],
      resultados: [{ campo: "UTERO", valor: 0 }],
    }),
  ).toMatchObject({
    resultado: "NAO_AVALIADO",
    realizadoSemDG: true,
    avaliacaoContextual: contexto,
    vinculosConclusao: [],
    resultados: [{ campo: "UTERO", valor: 0 }],
  });
});
