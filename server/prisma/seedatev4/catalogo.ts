export const AVISO = 'Demonstração V4 de software. Animais, produtos, doses e intervalos fictícios; não são recomendação clínica.';
export const PREFIXO = 'seedatev4-v1:';
export const nomeV4 = (nome: string) => `V4 · ${nome}`;
export const brincoV4 = (numero: number) => `V4-${String(numero).padStart(3, '0')}`;
export const faixa = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => de + i);

/** Cada negativo precede a repetição seguinte; a última fica disponível para DG. */
export function sequenciaTentativas(quantidade: number, ultima = -10) {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 3) throw new Error('Informe de uma a três tentativas.');
  return Array.from({ length: quantidade }, (_, i) => {
    const dia = ultima - (quantidade - 1 - i) * 50;
    return { dia, negativoEm: i === quantidade - 1 ? null : dia + 30 };
  });
}

type AnimalCenario = { numero: number; cenario: string; lote: string; sexo: 'F' | 'M'; papel: 'NENHUM' | 'DOADORA' | 'RECEPTORA' };
const individuais = [
  'Uma tentativa — aguardando DG', 'Duas tentativas — aguardando DG', 'Três tentativas — aguardando DG',
  'Gestante após uma tentativa', 'Gestante após duas tentativas', 'Gestante após três tentativas',
  'Aborto registrado — novo ciclo ativo', 'Perda gestacional explicada', 'Natimorto registrado',
  'Parto vivo e lactação', 'Gêmeos, RP e colostro', 'TE, cria provisória e filiação',
  'Gestante com origem desconhecida', 'Vazia com retorno informado', 'DG inconclusivo pendente',
  'Seca com lactação encerrada', 'Lactação histórica sem parto', 'Contexto desconhecido',
  'Descarte reprodutivo ainda em lactação', 'Alerta sanitário', 'Bloqueio sanitário',
  'Doadora disponível', 'Receptora — TE aguardando DG', 'Cobertura observada',
  'Exposição de touro', 'Novilha com liberação explícita', 'IA recente com baixa de estoque',
  'Gestante transferida ao destino', 'Matriz que saiu e retornou', 'Reserva para seleção livre',
];
export const animaisV4: AnimalCenario[] = [
  ...individuais.map((cenario, i): AnimalCenario => ({ numero: i + 1, cenario,
    lote: i === 24 ? 'Exposição de touro' : i >= 8 && i <= 11 ? 'Maternidade' : 'Ciclos individuais',
    sexo: 'F', papel: i === 21 ? 'DOADORA' : i === 11 || i === 22 ? 'RECEPTORA' : 'NENHUM' })),
  ...faixa(31, 60).map((numero): AnimalCenario => ({ numero,
    cenario: numero <= 36 ? 'IATF com aplicação inicial realizada' : numero <= 42 ? 'IATF com inseminação prevista hoje'
      : numero <= 48 ? 'IATF com hora desconhecida' : numero <= 54 ? 'TE prevista hoje' : 'Programação aguardando início',
    lote: 'Protocolos ativos', sexo: 'F', papel: numero >= 49 && numero <= 54 ? 'RECEPTORA' : 'NENHUM' })),
  { numero: 61, cenario: 'Touro de cobertura e exposição', lote: 'Reprodutores', sexo: 'M', papel: 'NENHUM' },
  { numero: 62, cenario: 'Execução anulada — regularização pendente', lote: 'Sanidade e regularização', sexo: 'F', papel: 'NENHUM' },
  { numero: 63, cenario: 'Protocolo sanitário parcialmente realizado', lote: 'Sanidade e regularização', sexo: 'F', papel: 'NENHUM' },
  { numero: 64, cenario: 'Protocolo sanitário a executar', lote: 'Sanidade e regularização', sexo: 'F', papel: 'NENHUM' },
  { numero: 65, cenario: 'Dois partos documentados — intervalo entre partos', lote: 'Maternidade', sexo: 'F', papel: 'NENHUM' },
  ...faixa(101, 220).map((numero): AnimalCenario => ({ numero, cenario: 'Diagnóstico coletivo pendente hoje', lote: 'Diagnóstico coletivo', sexo: 'F', papel: 'NENHUM' })),
];
