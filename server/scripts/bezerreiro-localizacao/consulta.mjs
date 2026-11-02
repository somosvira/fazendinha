// Uma única SELECT produz um snapshot consistente. Não abre conexão nem carrega credenciais.
const literal = valor => `'${String(valor).replaceAll("'", "''")}'`;

export function consultaSnapshot(configuracao, idsAnimais) {
  const fonte = configuracao.fonte;
  const lotes = configuracao.lotes.map(l => literal(l.id)).join(', ');
  const animais = idsAnimais.map(literal).join(', ');
  if (!lotes || !animais) throw new Error('Informe os IDs evidenciados dos lotes e animais.');
  return `WITH coorte AS (
  SELECT id FROM pecuaria."Animal" WHERE id IN (${animais})
  UNION
  SELECT "animalId" FROM pecuaria."LocalizacaoAnimal" WHERE "loteId" IN (${lotes}) AND ate IS NULL
), participacoes AS (
  SELECT p.* FROM pecuaria."ParticipacaoBezerreiro" p JOIN coorte c ON c.id=p."animalId"
), perfis AS (
  SELECT p.* FROM pecuaria."PerfilBezerreiro" p WHERE p."loteId" IN (${lotes})
  OR p.id IN (SELECT "perfilId" FROM participacoes)
)
SELECT jsonb_build_object(
  'versaoFormato', 1,
  'fonte', jsonb_build_object('projetoId', ${literal(fonte.projetoId)}, 'branchId', ${literal(fonte.branchId)},
    'banco', current_database(), 'ambiente', ${literal(fonte.ambiente)}),
  'capturadoEm', CURRENT_TIMESTAMP,
  'dataReferencia', CURRENT_DATE,
  'snapshotTransacao', pg_current_snapshot()::text,
  'lotes', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM (
    SELECT id, nome, "propriedadeId", ativo, "atualizadoEm" FROM pecuaria."Lote" WHERE id IN (${lotes})
  ) l), '[]'::jsonb),
  'animais', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM (
    SELECT a.id, a.brinco, a."ideagriId", a."dataNascimento", a."dataEntrada", a."atualizadoEm",
      (SELECT count(*) FROM pecuaria."CriaParto" c WHERE c."animalId"=a.id) AS "partosVinculados",
      (SELECT count(*) FROM pecuaria."Pesagem" p WHERE p."animalId"=a.id) AS pesagens
    FROM pecuaria."Animal" a JOIN coorte c ON c.id=a.id
  ) a), '[]'::jsonb),
  'localizacoes', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l."animalId", l.desde, l.id) FROM (
    SELECT l.id, l."animalId", l."propriedadeId", l."loteId", l.desde, l.ate,
      l."movimentacaoId", l."criadoPorId", l."atualizadoEm"
    FROM pecuaria."LocalizacaoAnimal" l JOIN coorte c ON c.id=l."animalId"
  ) l), '[]'::jsonb),
  'perfis', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM perfis p), '[]'::jsonb),
  'participacoes', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p."animalId", p.desde, p.id) FROM participacoes p), '[]'::jsonb),
  'fases', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id)
    FROM pecuaria."PeriodoFaseBezerreiro" f WHERE f."participacaoId" IN (SELECT id FROM participacoes)), '[]'::jsonb),
  'ofertas', COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM (
    SELECT o.id, o."perfilId", o."propriedadeId", o.data, o.status, o.versao,
      g.id AS "grupoId", g."participantesSnapshot"
    FROM pecuaria."OfertaBezerreiro" o JOIN pecuaria."GrupoOfertaBezerreiro" g ON g."ofertaId"=o.id
    WHERE o."perfilId" IN (SELECT id FROM perfis)
  ) o), '[]'::jsonb),
  'baixas', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM (
    SELECT b.id, b."animalId", b.data, b."estornadaEm", b."localizacaoFechadaId", b."atualizadoEm"
    FROM pecuaria."BaixaAnimal" b JOIN coorte c ON c.id=b."animalId"
  ) b), '[]'::jsonb)
) AS snapshot;\n`;
}
