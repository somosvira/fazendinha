import { req, post } from "./api";
export type ModeloMensal = "AUTOMATICO" | "MANUAL" | "PROVISORIO";
export type ConfiguracaoMensal = {
  id: string;
  propriedadeId: number;
  loteId: string | null;
  modelo: ModeloMensal;
  diaConferencia: number;
  autorizaValidade: boolean;
  desde: string;
};
export type ItemDia = {
  id: string;
  produtoId: string;
  nome: string;
  unidade: string;
  rastrearPartidas: boolean;
  prevista: string;
  confirmada: string;
  origemQuantidade: string;
};
export type DiaMensal = {
  id: string;
  data: string;
  situacao: string;
  pendencia: string | null;
  dieta: string | null;
  animais: number;
  itens: ItemDia[];
};
export type MesNutricional = {
  id: string;
  loteId: string;
  loteNome: string;
  propriedadeId: number;
  competencia: string;
  inicio: string;
  modelo: ModeloMensal;
  revisao: number;
  revisadoEm: string | null;
  prazo: string;
  situacao: string;
  verValores: boolean;
  itens: Array<{
    produtoId: string;
    nome: string;
    unidade: string;
    rastrearPartidas: boolean;
    prevista: string;
    confirmada: string;
    provisoria: string;
    custo: string | null;
  }>;
  dias: DiaMensal[];
};
const base = "/pecuaria/rebanho/nutricao/mensal";
export const statusMensal = () =>
  req<{ habilitada: boolean; automacao: boolean }>(base + "/status");
export const configuracoesMensais = () =>
  req<ConfiguracaoMensal[]>(base + "/configuracoes");
export const salvarConfiguracaoMensal = (
  body: Omit<ConfiguracaoMensal, "id">,
) => post(base + "/configuracoes", body);
export const mesesNutricionais = (
  pagina: number,
  loteId?: string,
  alertas = false,
) =>
  req<{ itens: MesNutricional[]; total: number }>(
    base +
      `/meses?pagina=${pagina}&alertas=${alertas}${loteId ? `&loteId=${encodeURIComponent(loteId)}` : ""}`,
  );
export const mesNutricional = (id: string) =>
  req<MesNutricional>(base + `/meses/${encodeURIComponent(id)}`);
export const reprocessarMensal = (propriedadeId: number, loteId: string) =>
  post(base + "/reprocessar", { propriedadeId, loteId });
export const confirmarMensal = (id: string, body: unknown) =>
  post(base + `/meses/${encodeURIComponent(id)}/confirmacao`, body);
export const confirmarDiasMensais = (id: string, body: unknown) =>
  post(base + `/meses/${encodeURIComponent(id)}/dias`, body);
export const reabrirMensal = (
  id: string,
  propriedadeId: number,
  motivo: string,
) =>
  post(base + `/meses/${encodeURIComponent(id)}/reabertura`, {
    propriedadeId,
    motivo,
  });

export const reconciliarMensal = (id: string, body: unknown) =>
  post(base + `/meses/${encodeURIComponent(id)}/reconciliacao`, body);
