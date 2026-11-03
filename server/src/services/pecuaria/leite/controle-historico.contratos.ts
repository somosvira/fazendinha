export interface ControleHistoricoLeiteDTO {
  id: string; tipo: "CONTROLE_PERIODICO" | "AGREGADO_MENSAL";
  inicio: string; fim: string; total: string | null; unidade: "L" | "KG";
  referenciaUnidade: string;
  parcelas: { rotulo: string | null; hora: string | null; quantidade: number | null }[];
  lactacaoId: string | null; origemColetiva: string | null; versao: number;
  contexto: "INTERNO" | "EXTERNO"; semEfeitoEstoqueFinanceiro: true;
  origem: { banco: string | null; chave: string | null; evidencia: string | null };
}
