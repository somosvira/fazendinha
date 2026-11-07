export interface FonteRadar { titulo: string; url: string }
/** `valor` é o número da linha; `texto` explica de onde ele vem. */
export interface LeituraRadar { titulo: string; texto: string; fonte: FonteRadar; valor?: string }
export type UrgenciaRadar = 'atrasado' | 'hoje' | 'semana' | 'depois';
export interface PrioridadeRadar {
 id: string; titulo: string; descricao: string; fonte: FonteRadar; pergunta: string;
 // Opcionais: leituras em cache de versões anteriores não os têm.
 urgencia?: UrgenciaRadar; prazo?: string; quantidade?: { valor: number; unidade: string }; acao?: string;
}
export interface RadarDTO {
 dia: string; geradoEm: string; escopo: {propriedadeId:number|null;nome:string};
 sintese: {modo:'ia'|'deterministica';texto:string};
 prioridades: PrioridadeRadar[]; leitura: LeituraRadar[]; cobertura: LeituraRadar[];
}
