import { describe, expect, it } from "vitest";
import { mascararCustos } from "./registros.js";

const exame = () => ({
  id: "exame", valorServicoAtribuido: "125.50", valor: "90.00",
  resultados: [
    { campo: "ESCORE", valor: 0 }, { campo: "ESCALA_MIN", valor: "0" },
    { campo: "ESCALA_MAX", valor: "5" }, { campo: "ACHADO", valor: false },
    { campo: "ESCALA_DESCRICAO", valor: "Escala declarada" }, { campo: "AUSENTE", valor: null },
  ],
});

describe("máscara financeira com resultados clínicos estruturados", () => {
  it("leitura operacional libera apenas parcelas escalares dos fatos e mantém documentos e totais protegidos", () => {
    const r = mascararCustos({ propriedadeId: 2, valorProdutoAtribuido: "0.00", valorServicoAtribuido: null,
      valorTotal: "500.00", documentoMaterial: { referencia: "Documento financeiro" },
      exame: { valorServicoAtribuido: { segredo: "SEGREDO" }, resultados: exame().resultados },
    }, false, true, 2);
    expect(r).toEqual({ propriedadeId: 2, valorProdutoAtribuido: "0.00", valorServicoAtribuido: null,
      valorTotal: null, documentoMaterial: null, exame: { valorServicoAtribuido: null, resultados: exame().resultados },
    });
  });
  it("preserva resultados na ficha e nas respostas de parto e avaliação, mas mascara custos", () => {
    const original = { valor: "500", partos: [{ examesPosParto: [exame()] }], avaliacoes: [{ exame: exame() }],
      examesPosParto: [exame()], exame: exame() };
    const r = mascararCustos(original, false);
    expect(r.valor).toBeNull();
    for (const e of [r.partos[0].examesPosParto[0], r.avaliacoes[0].exame, r.examesPosParto[0], r.exame]) {
      expect(e.resultados).toEqual(exame().resultados);
      expect(e.valorServicoAtribuido).toBeNull(); expect(e.valor).toBeNull();
    }
    expect(original.exame.valorServicoAtribuido).toBe("125.50");
    expect(mascararCustos(original, true)).toBe(original);
  });

  it("não aceita estrutura de exame imitada em rascunho, snapshot ou resultado fora da relação", () => {
    const falsaEstrutura = { exame: exame(), examesPosParto: [exame()], partos: [{ examesPosParto: [exame()] }] };
    const r = mascararCustos({ rascunho: falsaEstrutura, snapshot: falsaEstrutura,
      atividades: [{ participantes: [{ rascunho: falsaEstrutura }] }], resultados: exame().resultados }, false);
    for (const origem of [r.rascunho, r.snapshot, r.atividades[0].participantes[0].rascunho]) {
      for (const e of [origem.exame, origem.examesPosParto[0], origem.partos[0].examesPosParto[0]]) {
        expect(e.resultados.every(item => item.valor === null)).toBe(true);
        expect(e.valorServicoAtribuido).toBeNull();
      }
    }
    expect(r.resultados.every(item => item.valor === null)).toBe(true);
  });

  it("não abre exceção para objetos, arrays, campo ausente ou custos ao lado do valor clínico", () => {
    const r = mascararCustos({ exame: { resultados: [
      { campo: "ESCORE", valor: { valor: 100, valorTotal: 100 } },
      { campo: "ESCORE", valor: [100] }, { valor: 100 }, { campo: "", valor: 100 },
      { campo: "ESCORE", valor: 3, custoUnitario: 80, valorServicoAtribuido: 90 },
    ] } }, false);
    expect(r.exame.resultados.slice(0, 4).every(item => item.valor === null)).toBe(true);
    expect(r.exame.resultados[4]).toEqual({ campo: "ESCORE", valor: 3, custoUnitario: null, valorServicoAtribuido: null });
  });

  it("preserva observações reais dos rascunhos nos retornos de participante, confirmação, detalhe e impressão", () => {
    const resultados = [{ campo: "MEDIDA", valor: "0" }, { campo: "ACHADO", valor: false }, { campo: "NOTA", valor: 3 }];
    const participante = { rascunho: { resultados, dados: { resultados, valorServicoAtribuido: 80 }, valor: 90 } };
    const detalhe = { atividades: [{ participantes: [participante] }] };
    const esperado = { rascunho: { resultados, dados: { resultados, valorServicoAtribuido: null }, valor: null } };
    expect(mascararCustos(participante, false)).toEqual(esperado);
    expect(mascararCustos([participante], false)).toEqual([esperado]);
    expect(mascararCustos({ participantes: [participante] }, false)).toEqual({ participantes: [esperado] });
    expect(mascararCustos(detalhe, false)).toEqual({ atividades: [{ participantes: [esperado] }] });
    expect(mascararCustos({ snapshot: detalhe }, false)).toEqual({ snapshot: { atividades: [{ participantes: [esperado] }] } });
    expect(mascararCustos({ impressoes: [{ snapshot: detalhe }] }, false)).toEqual({ impressoes: [{ snapshot: { atividades: [{ participantes: [esperado] }] } }] });
    const malformado = { rascunho: { resultados: [{ campo: "MEDIDA", valor: { valorTotal: 80 } }],
      dados: { resultados: [{ campo: "MEDIDA", valor: [80] }, { campo: "MEDIDA", valor: 0, custoTotal: 80 }] } } };
    expect(mascararCustos(malformado, false)).toEqual({ rascunho: { resultados: [{ campo: "MEDIDA", valor: null }],
      dados: { resultados: [{ campo: "MEDIDA", valor: null }, { campo: "MEDIDA", valor: 0, custoTotal: null }] } } });
  });
});

it("detalhe operacional do parto preserva escore e escala sem abrir valores financeiros", () => {
 const resultado = mascararCustos({ escoresMatriz: [exame()], valorTotal: "100", snapshot: { escoresMatriz: [exame()] } }, false, true, 2);
 expect(resultado.escoresMatriz[0].resultados).toEqual(exame().resultados);
 expect(resultado.escoresMatriz[0].valor).toBeNull();
 expect(resultado.valorTotal).toBeNull();
 expect(resultado.snapshot.escoresMatriz[0].resultados.every(r=>r.valor===null)).toBe(true);
});
