import { chave, deslocar, noMes } from '../contexto.js';
export const PREFIXO = 'seedatev5-v1:';
export const AVISO = 'Demonstração sintética V5; não representa produção real nem recomendação técnica.';
export const ref = (nome: string) => `${PREFIXO}${nome}`;
export const key = (nome: string) => chave(ref(nome));
export const nome = (valor: string) => `V5 · ${valor}`;
export const ETAPAS = ['cadastros', 'producao-individual', 'geral-anterior', 'qualidade-anterior', 'comercial-anterior', 'geral-atual', 'qualidade-atual', 'destinos', 'nutricao', 'comercial-atual', 'regularizacoes', 'relatorios'] as const;
export function calendario(dataBase: string) {
  const diaMes = Number(dataBase.slice(8));
  const controle = noMes(dataBase, 0, Math.min(20, diaMes));
  const atual = [...new Set([noMes(dataBase, 0, 1), controle, ...Array.from({ length: Math.min(7, diaMes) }, (_, i) => deslocar(dataBase, -i))])].sort();
  return { individual: noMes(dataBase, -2, 20), confirmacaoIndividual: noMes(dataBase, -2, 21), inicio: noMes(dataBase, -1, 1), anterior: noMes(dataBase, -1, 20),
    fimAnterior: noMes(dataBase, 0, 0), inicioAtual: noMes(dataBase, 0, 1), controle, atual, hoje: dataBase };
}
export const CAMPOS = [
  ['CCS', 'Contagem de células somáticas', 'mil células/mL', 240],
  ['CPP', 'Contagem padrão em placas', 'mil UFC/mL', 18],
  ['GORDURA', 'Gordura', '%', 3.8], ['PROTEINA', 'Proteína', '%', 3.3],
  ['NU', 'Nitrogênio ureico', 'mg/dL', 12], ['EXTRATO_SECO', 'Extrato seco', '%', 12.4],
  ['LACTOSE', 'Lactose', '%', 4.7],
] as const;

export function intervalo(inicio: string, fim: string) { const dias: string[] = []; for(let d=inicio;d<=fim;d=deslocar(d,1)) dias.push(d); return dias; }
