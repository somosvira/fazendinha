import { describe, expect, it } from "vitest";
import {
  decisaoAtencaoSchema,
  janelaAtencao,
  parametrosAtencaoSchema,
} from "./contratos.js";
import {
  exigirTipoRegistrado,
  validarResumoRegistrado,
} from "../../../alertas/registro.js";
const id = "9192047d-ab87-4ff6-bbc7-f7c6702eb83a";
const base = {
  chave: id,
  propriedadeId: 1,
  revisao: 3,
  motivo: "Revisão administrativa explícita",
};
describe("necessidade reprodutiva compartilhada", () => {
  it("consome antecedência e tolerância congeladas sem confundir ausência de regra com atraso", () => {
    const prevista = new Date("2026-11-10"),
      regra = { versao: 2, antecedencia: 3, tolerancia: 2 };
    expect(janelaAtencao(prevista, regra, new Date("2026-11-07"))).toEqual({
      situacao: "PROXIMO",
      visivelDesde: new Date("2026-11-07"),
      prazo: new Date("2026-11-12"),
    });
    expect(
      janelaAtencao(prevista, regra, new Date("2026-11-12")).situacao,
    ).toBe("PENDENTE");
    expect(
      janelaAtencao(prevista, regra, new Date("2026-11-13")).situacao,
    ).toBe("ATRASADO");
    expect(janelaAtencao(null, {}, new Date("2026-11-13")).situacao).toBe(
      "PLANEJAMENTO_PENDENTE",
    );
  });
  it.each(["REAGENDAR", "SUSPENDER"])(
    "%s exige data e destino, sem ocultação por observação livre",
    (tipo) => {
      expect(decisaoAtencaoSchema.safeParse({ ...base, tipo }).success).toBe(
        false,
      );
      expect(
        decisaoAtencaoSchema.safeParse({ ...base, tipo, data: "2026-11-20" })
          .success,
      ).toBe(false);
      expect(
        decisaoAtencaoSchema.parse({
          ...base,
          tipo,
          data: "2026-11-20",
          destino: "Visita de revisão",
        }).destino,
      ).toBe("Visita de revisão");
    },
  );
  it.each(["DISPENSAR", "RETIRAR"])(
    "%s é terminal com motivo e não finge reagendamento",
    (tipo) => {
      expect(decisaoAtencaoSchema.safeParse({ ...base, tipo }).success).toBe(
        true,
      );
      expect(
        decisaoAtencaoSchema.safeParse({
          ...base,
          tipo,
          data: "2026-11-20",
          destino: "ocultar",
        }).success,
      ).toBe(false);
    },
  );
  it("regra operacional declara público, referência e resolução compatíveis, sem prazo padrão", () => {
    const regra = {
      tipo: "APTA_SEM_ENCAMINHAMENTO",
      publico: "FEMEAS",
      referencia: "EXAME_APTIDAO",
      intervalo: 15,
      unidade: "DIAS",
      antecedencia: 2,
      tolerancia: 3,
      resolucao: "ENCAMINHAMENTO_EXPLICITO",
    };
    expect(
      parametrosAtencaoSchema.safeParse({ versao: 1, regras: [regra] }).success,
    ).toBe(true);
    expect(
      parametrosAtencaoSchema.safeParse({
        versao: 1,
        regras: [{ ...regra, intervalo: undefined }],
      }).success,
    ).toBe(false);
    expect(
      parametrosAtencaoSchema.safeParse({
        versao: 1,
        regras: [{ ...regra, resolucao: "TENTATIVA_REALIZADA" }],
      }).success,
    ).toBe(false);
  });
  it("publicação aceita origem registrada e recusa custos ou payload clínico livre", () => {
    const resumo = {
      necessidadeId: id,
      animalId: id,
      brinco: "17",
      nome: null,
      tarefaId: null,
      demandaId: null,
      participacaoId: null,
      tipoNecessidade: "DG_VENCIDO",
      destino: null,
      revisaoEm: null,
    };
    expect(() =>
      exigirTipoRegistrado("reproducao", "DG_VENCIDO", 1),
    ).not.toThrow();
    expect(() => validarResumoRegistrado("DG_VENCIDO", resumo)).not.toThrow();
    expect(() =>
      validarResumoRegistrado("DG_VENCIDO", { ...resumo, custo: 20 }),
    ).toThrow();
    expect(() =>
      validarResumoRegistrado("DG_VENCIDO", {
        ...resumo,
        achados: "dados livres",
      }),
    ).toThrow();
  });
});
