/** Só identifica prazo herdado quando o calendário e o histórico comprovam a origem. */
export function tarefaComPrazoHerdado(t:{previstaPara:Date;previsaoOriginal:Date|null;precisaoTemporal:string;previsaoPendente:boolean;realizadaEm:Date|null;dispensadaEm:Date|null;regularizacaoPendente:boolean;parametros:unknown;historicoReprogramacao:unknown;eventos:unknown[];_count:{aplicacoes:number;exames:number;tentativas:number;manejos:number;vinculos:number}},previstaDemanda:Date|null):boolean {
 if(!previstaDemanda||t.precisaoTemporal!=="DIA"||t.previsaoPendente||t.realizadaEm||t.dispensadaEm||t.regularizacaoPendente||!t.previsaoOriginal||t.previstaPara.getTime()!==previstaDemanda.getTime()||t.eventos.length||Object.values(t._count).some(n=>n>0))return false;
 if(!t.parametros||typeof t.parametros!=="object"||Array.isArray(t.parametros)||!("previsaoOriginal" in t.parametros)||typeof t.parametros.previsaoOriginal!=="string"||t.parametros.previsaoOriginal.slice(0,10)!==t.previsaoOriginal.toISOString().slice(0,10))return false;
 if(!Array.isArray(t.historicoReprogramacao))return false;
 if(!t.historicoReprogramacao.length)return t.previstaPara.getTime()===t.previsaoOriginal.getTime();
 if(!t.historicoReprogramacao.every(e=>e&&typeof e==="object"&&!Array.isArray(e)&&e.acao==="REVISAO_REGRA_ACOMPANHAMENTO"))return false;
 return t.historicoReprogramacao.at(-1)?.previstaNova===t.previstaPara.toISOString().slice(0,10);
}
