import { describe,expect,it } from "vitest";
import { nomeEtapaOperacao } from "./operacao.rotulos.js";
describe("rótulos do planejamento das etapas",()=>{
  it("distingue aplicações sanitárias antigas com nome padrão pelo produto planejado",()=>{
    expect(nomeEtapaOperacao({nome:"Etapa",tipo:"APLICACAO",produto:{nome:"Produto atual"}},{produtoNomeSnapshot:"Vacina planejada"})).toBe("Aplicação · Vacina planejada");
    expect(nomeEtapaOperacao({nome:null,tipo:"APLICACAO",produto:{nome:"Vermífugo"}})).toBe("Aplicação · Vermífugo");
  });
  it("usa natureza legível sem inventar produto, realização ou resultado",()=>{
    expect(nomeEtapaOperacao({nome:" ",tipo:"EXAME",tipoExame:{nome:"Exame parasitológico"}})).toBe("Exame · Exame parasitológico");
    expect(nomeEtapaOperacao({tipo:"MANEJO"})).toBe("Manejo");
    expect(nomeEtapaOperacao({tipo:"APLICACAO"})).toBe("Aplicação");
  });
  it("apresenta o exame oficial por UUID preservando outros snapshots",()=>{
    expect(nomeEtapaOperacao({tipo:"EXAME",tipoExameId:"b0841f3c-3f88-4c2d-9d0d-3ef33d49b841"},{tipoExameNomeSnapshot:"Escore corporal"})).toBe("Exame · Escore de condição corporal (ECC)");
    expect(nomeEtapaOperacao({tipo:"EXAME",tipoExameId:"outro"},{tipoExameNomeSnapshot:"Escore corporal"})).toBe("Exame · Escore corporal");
  });
  it("preserva nome específico e distinção entre avaliação e exame",()=>{
    expect(nomeEtapaOperacao({nome:"Conferência de resposta",tipo:"EXAME"})).toBe("Conferência de resposta");
    expect(nomeEtapaOperacao({nome:"Etapa",tipo:"EXAME",configuracao:{tipo:"AVALIACAO"}})).toBe("Avaliação");
    expect(nomeEtapaOperacao({nome:"Etapa",tipo:"EXAME"})).toBe("Exame");
  });
});
