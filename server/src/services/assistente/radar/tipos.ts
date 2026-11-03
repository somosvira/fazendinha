export interface FonteRadar { titulo: string; url: string }
export interface LeituraRadar { titulo: string; texto: string; fonte: FonteRadar }
export interface PrioridadeRadar { id: string; titulo: string; descricao: string; fonte: FonteRadar; pergunta: string }
export interface RadarDTO {
 dia: string; geradoEm: string; escopo: {propriedadeId:number|null;nome:string};
 sintese: {modo:'ia'|'deterministica';texto:string};
 prioridades: PrioridadeRadar[]; leitura: LeituraRadar[]; cobertura: LeituraRadar[];
}
