import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exigirPreparacaoAntigaDisponivel } from './retomada-local.js';
const pastas: string[] = [];
afterEach(async () => { for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true }); });
it('permite a preparação anterior somente antes da consolidação autorizada', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'consolidacao-sitios-')); pastas.push(pasta);
  const arquivo = join(pasta, 'consolidacao-sitios.json');
  expect(() => exigirPreparacaoAntigaDisponivel(arquivo)).not.toThrow();
  await writeFile(arquivo, '{"versao":1}');
  expect(() => exigirPreparacaoAntigaDisponivel(arquivo)).toThrow('não recrie fixtures');
});
