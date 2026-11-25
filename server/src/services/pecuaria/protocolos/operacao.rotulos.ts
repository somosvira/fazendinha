import { nomeExameApresentacao } from "../sanidade/nome-exame.js";
function ehObjeto(valor:unknown):valor is Record<string,unknown> {
  return valor!==null&&typeof valor==="object"&&!Array.isArray(valor);
}
function objeto(valor:unknown):Record<string,unknown> {
  return ehObjeto(valor)?valor:{};
}
function texto(valor:unknown) { return typeof valor==="string"&&valor.trim()?valor.trim():null; }
/** Rótulo do planejamento, sem inferir realização ou resultado clínico. */
export function nomeEtapaOperacao(etapa:{nome?:string|null;tipo:string;tipoExameId?:string|null;configuracao?:unknown;produto?:{nome:string}|null;tipoExame?:{nome:string}|null},planejado?:unknown) {
  const nome=texto(etapa.nome);
  if(nome&&nome.toLocaleLowerCase("pt-BR")!=="etapa")return nome;
  const configuracao=objeto(etapa.configuracao);const snapshot=objeto(planejado);
  const nomeConfigurado=texto(configuracao.nome);
  if(nomeConfigurado&&nomeConfigurado.toLocaleLowerCase("pt-BR")!=="etapa")return nomeConfigurado;
  const tipo=texto(configuracao.tipo)??etapa.tipo;
  const rotulos:Record<string,string>={APLICACAO:"Aplicação",EXAME:"Exame",AVALIACAO:"Avaliação",MANEJO:"Manejo",RETIRADA:"Retirada",TENTATIVA:"Tentativa"};
  const rotulo=rotulos[tipo]??"Etapa";
  const detalhe=tipo==="APLICACAO"?texto(snapshot.produtoNomeSnapshot)??texto(etapa.produto?.nome):tipo==="EXAME"||tipo==="AVALIACAO"?texto(snapshot.tipoExameNomeSnapshot)??texto(etapa.tipoExame?.nome):null;
  const nomeDetalhe = detalhe && (tipo === "EXAME" || tipo === "AVALIACAO") ? nomeExameApresentacao(typeof snapshot.tipoExameId === "string" ? snapshot.tipoExameId : etapa.tipoExameId, detalhe) : detalhe;
  return nomeDetalhe?`${rotulo} · ${nomeDetalhe}`:rotulo;
}
