import { describe, expect, it } from "vitest";
import { eventoRegularizacao } from "./regularizacao.js";
import { criteriosVisitaSchema, regularizacaoSchema } from "./schemas.js";
const input = { propriedadeId:1, chave:"10000000-0000-4000-8000-000000000001", motivo:"Erro de registro comprovado", acao:"REABRIR" as const, cienciaNaoExecutado:true };
describe("regularização preserva efeitos e histórico",()=>{
  it("impede repetir consumo físico mantido; permite encerramento sem devolver material",()=>{
    const historico=[{acao:"FATO_ANULADO",destinoConsumo:"MANTER_CONSUMO"}];
    expect(()=>eventoRegularizacao(historico,input,{fatoId:"original"},3)).toThrow(/consumo mantido/);
    expect(eventoRegularizacao(historico,{...input,acao:"ENCERRAR_SEM_SUBSTITUICAO"},{fatoId:"original"},3)).toEqual(expect.arrayContaining([expect.objectContaining({acao:"ENCERRAR_SEM_SUBSTITUICAO",anterior:{fatoId:"original"}})]));
  });
  it("reabertura arquiva a realização original após confirmação explícita; schema rejeita ciência ausente",()=>{
    expect(regularizacaoSchema.safeParse({...input,cienciaNaoExecutado:false}).success).toBe(false);
    expect(eventoRegularizacao([{acao:"FATO_ANULADO",destinoConsumo:"DEVOLVER_ESTOQUE"}],input,{realizadaEm:"2026-10-01",fatoId:"original"},3)).toEqual(expect.arrayContaining([expect.objectContaining({acao:"REABRIR",anterior:{realizadaEm:"2026-10-01",fatoId:"original"},usuarioId:3})]));
  });
  it("intervalos inclusivos configurados rejeitam limites invertidos e negativos",()=>{
    expect(criteriosVisitaSchema.parse({diasTentativaMin:"0",diasTentativaMax:"0"})).toEqual({diasTentativaMin:0,diasTentativaMax:0});
    expect(criteriosVisitaSchema.safeParse({diasPartoMin:10,diasPartoMax:9}).success).toBe(false);
    expect(criteriosVisitaSchema.safeParse({diasGestacaoMin:-1}).success).toBe(false);
  });
});
