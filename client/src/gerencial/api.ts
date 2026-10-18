import { comPropriedade } from "../propriedadeScope";
export type Bloco<T> = {estado:"DISPONIVEL";dados:T}|{estado:"RESTRITO";motivo:string};
type Media={animalDias:number;populacaoMedia:string;custoConhecido:string|null;porDia:string|null;porPeriodo:string|null;parcial:boolean};
export type ResumoGerencial={versao:string;corte:string;periodo:{inicio:string;fim:string};escopo:{propriedadeId:number|null;sitios:{id:number;nome:string}[]};avisos:string[];
  caixa:Bloco<{entradas:string;saidas:string;resultado:string;mensal:{mes:string;entradas:string;saidas:string;resultado:string;incompleto:boolean}[];centros:{id:string|null;nome:string;entradas:string;saidas:string;resultado:string}[];fontes:{contaId:string;movimentoId:string;propriedadeId:number;transacaoId:string;operacaoId:string|null;data:string;campo:string;valor:string}[];metodologia:string}>;
  estoque:Bloco<{data:string;valorConhecido:string;gruposPendentes:number;metodologia:string;itens:{produtoId:string;produto:string;unidade:string;propriedadeId:number;partidaId:string|null;quantidade:string;quantidadeValorizada:string;valor:string|null;bases:{id:string;baseOrigemId:string|null;metodo:string;quantidade:string;valor:string}[]}[]}>;
  nutricao:Bloco<{rebanho:Media;vacas:Media;metodologia:string;cobertura:{animalDias:number;diasAlimentados:number;diasClassificados:number;itensComCusto:number;itensPendentes:number;quantidades:{unidade:string;quantidadeConhecida:string;quantidadePendente:string}[]};lacunas:{fechamentoId:string;motivo:string}[];
    fontes:{fechamentoId:string;participacaoId:string;itemId:string;animalId:string;propriedadeId:number;centroCustoId:string;centroCustoNome:string;finalidade:string|null;unidade:string;quantidade:string;custoConhecido:string|null;custoVacas:string|null;movimentoEstoqueId:string|null;prova:string}[]}>;
  custos:Bloco<{lacunasNutricao:number;totalConhecido:string|null;componentesPendentes:number;cobertura:string;limitacoes:string[];finalidades:{finalidade:string;totalConhecido:string|null;componentesPendentes:number}[];componentes:{propriedadeId:number;chave:string;fonteId:string;animalId:string;tipoFonte:string;data:string;descricao:string;finalidade:string|null;natureza:string;estado:string;valor:string|null;origemId:string|null}[]}>;
  clinico:Bloco<{data:string;acompanhamentosPendentes:number}>;
};
export async function consultarResumo(inicio:string,fim:string,signal:AbortSignal):Promise<ResumoGerencial>{
  const resposta=await fetch(`/api/gerencial/resumo?${new URLSearchParams({inicio,fim})}`,{headers:comPropriedade(),signal});
  if(!resposta.ok){const dados=await resposta.json().catch(()=>null);throw new Error(dados?.error??"Falha ao consultar o painel gerencial");}
  return resposta.json();
}
export const hojeGerencial=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export function periodoGerencial(search:string){const p=new URLSearchParams(search);const hoje=hojeGerencial();return {inicio:p.get("inicio")??hoje.slice(0,7)+"-01",fim:p.get("fim")??hoje};}
