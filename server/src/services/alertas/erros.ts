/** Erros do contrato comum; consumidores fazem seu mapeamento HTTP sem acoplar o núcleo a um domínio. */
export class AlertaError extends Error {
  constructor(public code:"VALIDACAO"|"CONFLITO",message:string,public campo?:string){super(message);}
}
