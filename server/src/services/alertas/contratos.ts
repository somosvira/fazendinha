import type { Prisma } from "@prisma/client";
export type CicloAlerta = "ABERTO" | "ENCERRADO" | "INVALIDADO";
export type AutorAlerta = { usuarioId: number; tecnico?: never } | { tecnico: string; usuarioId?: never };
export interface PublicacaoAlerta {
  proprietario: string; produtor: string; tipo: string; versaoContrato: 1;
  chaveOcorrencia: string; revisaoOrigem: number; eventoId: string;
  comando: "PUBLICAR" | "ENCERRAR" | "INVALIDAR" | "REABRIR";
  origemId: string; sujeitoTipo: string; sujeitoId: string; propriedadeId: number | null;
  chaveAgrupamento: string; titulo: string; motivo: string; situacao: string;
  resumo: Prisma.InputJsonObject;
  dataReferencia?: Date | null; visivelDesde?: Date | null; prazo?: Date | null;
}
export interface TotaisAlertas { cuidados: number; necessidades: number; animais: number }
export interface GrupoAlertaDTO {
  chave: string; titulo: string; motivo: string; produtor: string; tipo: string;
  propriedadeId: number | null; produtoId: string | null; produtoNome: string | null;
  necessidades: number; animais: number; situacoes: Record<string, number>; primeiraData: string | null;
}
export interface ParticipanteAlertaDTO {
  id: string; necessidadeId: string; animalId: string; brinco: string; nome: string | null;
  loteId: string | null; loteNome: string | null; titulo: string; motivo: string;
  situacao: string; dataReferencia: string | null; dataAtencao: string | null;
  revisao: number; chaveAgrupamento: string; propriedadeId: number | null;
}
export interface CoberturaAlertaDTO { estado: "ATUALIZADA" | "DESATUALIZADA" | "FALHA" | "NAO_AVALIADO"; diaCoberto: string | null; ultimaConclusao: string | null; erro: string | null }
export interface ConsultaAlertasDTO { itens: GrupoAlertaDTO[]; total: number; pagina: number; tamanho: number; totaisGerais: TotaisAlertas; totaisFiltrados: TotaisAlertas; cobertura: CoberturaAlertaDTO; tiposDisponiveis: string[] }
