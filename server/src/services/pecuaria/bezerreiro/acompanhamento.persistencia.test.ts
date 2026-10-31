import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../../../prisma/migrations/20261028200000_acompanhamento_colostragem_sitio/migration.sql', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../../../../prisma/schema.prisma', import.meta.url), 'utf8');
const ddl = sql.replace(/--[^\n]*/g, '').trim();

describe('identidade persistida do acompanhamento por animal e sítio', () => {
  it('troca somente a unicidade, atomicamente, sem regravar dados ou remover histórico', () => {
    expect(ddl).toMatch(/^BEGIN;/);
    expect(ddl).toMatch(/COMMIT;$/);
    expect(ddl).toContain('CREATE UNIQUE INDEX "AcompanhamentoColostragem_animalId_propriedadeId_key"');
    expect(ddl).toContain('ON "pecuaria"."AcompanhamentoColostragem"("animalId", "propriedadeId")');
    expect(ddl).toContain('DROP INDEX "pecuaria"."AcompanhamentoColostragem_animalId_key"');
    expect(ddl.indexOf('CREATE UNIQUE INDEX')).toBeLessThan(ddl.indexOf('DROP INDEX'));
    expect(ddl).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP TABLE|DROP COLUMN|CASCADE)\b/i);
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
