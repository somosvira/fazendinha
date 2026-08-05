import type { LinhaRelatorioRebanhoDTO, ResultadoRelatorioRebanhoDTO } from "../api";

export type ColunaRelatorioVisivel = {
  chave: string;
  rotulo: string;
  fixa: boolean;
  valor: (linha: LinhaRelatorioRebanhoDTO) => string | number | null;
};

const FIXAS: ColunaRelatorioVisivel[] = [
  { chave: "animal", rotulo: "Número / animal", fixa: true, valor: (l) => l.nome ? `#${l.numero} · ${l.nome}` : `#${l.numero}` },
  { chave: "categoria", rotulo: "Categoria", fixa: true, valor: (l) => l.categoria },
  { chave: "grupo", rotulo: "Grupo", fixa: true, valor: (l) => l.grupo },
  { chave: "setor", rotulo: "Setor", fixa: true, valor: (l) => l.setor },
  { chave: "data", rotulo: "Data", fixa: true, valor: (l) => l.data },
];

export function colunasDisponiveis(data: ResultadoRelatorioRebanhoDTO): ColunaRelatorioVisivel[] {
  return [
    ...FIXAS,
    ...data.colunas.map((coluna, indice) => ({
      chave: `d:${coluna.chave}`,
      rotulo: coluna.rotulo,
      fixa: false,
      valor: (linha: LinhaRelatorioRebanhoDTO) => linha.celulas[indice] ?? null,
    })),
  ];
}

export function resolverColunas(data: ResultadoRelatorioRebanhoDTO, ordem?: readonly string[]): ColunaRelatorioVisivel[] {
  const disponiveis = colunasDisponiveis(data);
  if (!ordem?.length) return disponiveis;
  const mapa = new Map(disponiveis.map((coluna) => [coluna.chave, coluna]));
  return ordem.flatMap((chave) => mapa.get(chave) ?? []);
}
