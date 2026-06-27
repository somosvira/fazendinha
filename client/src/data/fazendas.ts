/* Rio Novo — fazendas configuradas no workspace do usuário.
 * Dado estático (frontend-only): o backend ainda não modela multi-tenancy.
 * O modelo prevê N fazendas para o mesmo login, mas hoje há apenas uma. */

export type Fazenda = {
  id: string;
  nome: string;
  apelido?: string;        // como aparece no chip ("Rio Novo")
  cidade?: string;
  uf?: string;
  papel?: string;          // papel do usuário logado nessa fazenda
};

export const fazendas: Fazenda[] = [
  {
    id: "rio-novo",
    nome: "Fazenda Rio Novo",
    apelido: "Rio Novo",
    cidade: "Carmo do Paranaíba",
    uf: "MG",
    papel: "Proprietário",
  },
];

export const fazendaAtualId = "rio-novo";
