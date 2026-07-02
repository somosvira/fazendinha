/* Mapper Prisma → DTO do Funcionário. id→String, Decimal→Number,
 * datas → YYYY-MM-DD (ou null). Espelha plantio/mappers.ts. */

export interface FuncionarioDTO {
  id: string;
  nome: string;
  cargo: string | null;
  salarioMensal: number;
  cargaMensalHoras: number;
  jornadaDiariaHoras: number;
  dataAdmissao: string | null;
  cpf: string | null;
  chavePix: string | null;
  ativo: boolean;
}

const iso = (d: Date | null | undefined): string | null =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

export function toFuncionarioDTO(f: any): FuncionarioDTO {
  return {
    id: String(f.id),
    nome: f.nome,
    cargo: f.cargo ?? null,
    salarioMensal: Number(f.salarioMensal),
    cargaMensalHoras: Number(f.cargaMensalHoras),
    jornadaDiariaHoras: Number(f.jornadaDiariaHoras),
    dataAdmissao: iso(f.dataAdmissao),
    cpf: f.cpf ?? null,
    chavePix: f.chavePix ?? null,
    ativo: !!f.ativo,
  };
}
