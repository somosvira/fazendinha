import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baselineSql, contemSql } from '../../../test/sql-baseline.js';
const schema = readFileSync(new URL('../../../../prisma/schema.prisma', import.meta.url), 'utf8');
describe('identidade persistida do acompanhamento por animal e sítio', () => {
  it('impõe unicidade por animal e sítio, sem unicidade global por animal', () => {
    expect(contemSql(baselineSql, 'CREATE UNIQUE INDEX "AcompanhamentoColostragem_animalId_propriedadeId_key" ON pecuaria."AcompanhamentoColostragem" ("animalId", "propriedadeId")')).toBe(true);
    expect(baselineSql).not.toContain('CREATE UNIQUE INDEX "AcompanhamentoColostragem_animalId_key"');
  });
  it('conserva IDs e relações dos vínculos e permite múltiplos sítios por animal', () => {
    const acompanhamento = schema.match(/model AcompanhamentoColostragem \{([\s\S]*?)\n\}/)![1];
    expect(acompanhamento).toMatch(/id String @id @default\(uuid\(\)\)/);
    expect(acompanhamento).toContain('@@unique([animalId, propriedadeId])');
    expect(acompanhamento).not.toMatch(/animalId String @unique/);
    expect(schema).toContain('acompanhamentosColostragem AcompanhamentoColostragem[]');
    for (const nome of ['ExameImunidadeColostragem', 'VinculoFornecimentoColostragem']) {
      const vinculo = schema.match(new RegExp(`model ${nome} \\{([\\s\\S]*?)\\n\\}`))![1];
      expect(vinculo).toContain('AcompanhamentoColostragem @relation(fields: [acompanhamentoId], references: [id], onDelete: Restrict)');
    }
  });
});
