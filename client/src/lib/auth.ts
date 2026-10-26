const CHAVE_USER = "rionovo:usuario";
export interface UsuarioSessao { id:number; nome:string; email:string; papel:string; abas:string[]; areas:string[]; flags:string[]; status:string; dono:boolean; ultimoAcesso?:string|null; }
export function getUsuario():UsuarioSessao|null{try{const v=localStorage.getItem(CHAVE_USER);return v?JSON.parse(v) as UsuarioSessao:null}catch{return null}}
export function setSessao(_token:string,u:UsuarioSessao){try{localStorage.setItem(CHAVE_USER,JSON.stringify(u))}catch{}}
export function setToken(_token:string):void{}
export function clearToken():void{}
export function getToken(){const u=getUsuario();return u?`clerk:${u.id}`:null}
export function clearSessao(){try{localStorage.removeItem(CHAVE_USER)}catch{}}
export function comAuth(headers:Record<string,string>={}){return headers}
