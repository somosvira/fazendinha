import { expect, test } from "vitest";
import { lerFichasIndividuais } from "./catalogo-pdf.js";

test("lê o RGN da ficha individual Mafra e ignora parentes e lotes coletivos", () => {
  const fichas = lerFichasIndividuais([
    "LOTE\nINDIVIDUALINDIVIDUAL0101\nSérie: CAMT\nPeso: 926kg\n11142 FIV MAFRA\nRGN:11142\nCLIQUE AQUI ASSISTA O VÍDEO\nPAI RGD:999",
    "MEGA\nLOTEMG1MG1\nSérie: MFRA\nRGN:15303",
    "LOTE\nINDIVIDUALINDIVIDUAL0202\nSérie: CAMT\nPeso: 900kg\nOUTRO\nRGN:21\nRGN:22",
  ]);
  expect(fichas).toEqual([{ numero: "01", titulo: "11142 FIV MAFRA", registro: "ABCZ:RGN:CAMT:11142", pagina: 1 }]);
});
