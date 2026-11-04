import { expect, it } from 'vitest';
import { camposPartoPayload, dadosPartoVazios } from './PartoCampos';
it('preserva ausência de grau e limpa grau ao retirar RP', () => {
 const dados = {...dadosPartoVazios(), retencaoPlacenta:'SIM', grauRetencaoPlacenta:'2'};
 expect(camposPartoPayload(dados,'2026-11-04').grauRetencaoPlacenta).toBe(2);
 expect(camposPartoPayload({...dados,retencaoPlacenta:'NAO'},'2026-11-04').grauRetencaoPlacenta).toBeNull();
 expect(camposPartoPayload({...dados,grauRetencaoPlacenta:''},'2026-11-04').grauRetencaoPlacenta).toBeNull();
});
