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
  it("preserva nome específico e distinção entre avaliação e exame",()=>{
    expect(nomeEtapaOperacao({nome:"Conferência de resposta",tipo:"EXAME"})).toBe("Conferência de resposta");
    expect(nomeEtapaOperacao({nome:"Etapa",tipo:"EXAME",configuracao:{tipo:"AVALIACAO"}})).toBe("Avaliação");
    expect(nomeEtapaOperacao({nome:"Etapa",tipo:"EXAME"})).toBe("Exame");
  });
});
