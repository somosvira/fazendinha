import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
it('registra secagens antes de gerar produção que consolida as origens da data', () => {
  const entrada = readFileSync(new URL('../seed.ts', import.meta.url), 'utf8');
  const secagens = entrada.indexOf("await c.etapa('pesagens-secagem'");
  expect(secagens).toBeGreaterThan(-1);
  expect(secagens).toBeLessThan(entrada.indexOf('await prepararLeite(c)'));
});
