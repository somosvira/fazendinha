#!/usr/bin/env bash
set -euo pipefail
[[ ${CI:-} == true && ${GITHUB_ACTIONS:-} == true ]] || { echo 'Ensaio permitido somente no GitHub Actions.' >&2; exit 1; }
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=ci PGPASSWORD=ci
base=$(mktemp -d)
trap 'rm -rf "$base"' EXIT
mkdir -p "$base/antiga" "$base/nova/server/prisma/migrations"
cp server/prisma/schema.prisma "$base/nova/server/prisma/schema.prisma"
cp server/prisma/migrations/migration_lock.toml "$base/nova/server/prisma/migrations/"
cp -R server/prisma/migrations/20261124170000_base_unificada server/prisma/migrations/20261124170100_cadastros_padrao "$base/nova/server/prisma/migrations/"
git archive 4271f29952902fa1e4ccb30909b6c11afa35d607 server/prisma | tar -x -C "$base/antiga"
createdb baseline381_antiga
createdb baseline381_nova
url_antiga='postgresql://ci:ci@127.0.0.1:5432/baseline381_antiga'
url_nova='postgresql://ci:ci@127.0.0.1:5432/baseline381_nova'
DATABASE_URL="$url_antiga" DIRECT_URL="$url_antiga" pnpm --filter rionovo-server exec prisma migrate deploy --schema "$base/antiga/server/prisma/schema.prisma"
DATABASE_URL="$url_nova" DIRECT_URL="$url_nova" pnpm --filter rionovo-server exec prisma migrate deploy --schema "$base/nova/server/prisma/schema.prisma"
# A instalação vazia deve receber exatamente os cadastros padrão previstos.
psql "$url_nova" -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM public."GrupoCategoria") <> 7
 OR (SELECT count(*) FROM public."Categoria") <> 26
 OR (SELECT count(*) FROM public."Categoria" WHERE "grupoId" IS NOT NULL) <> 26
 OR (SELECT count(*) FROM public."CentroCusto") <> 5
 OR (SELECT count(*) FROM pecuaria."Raca" WHERE ativo) <> 10
 OR (SELECT string_agg(sigla || ':' || base::text, ',' ORDER BY sigla) FROM pecuaria."Raca" WHERE ativo) <> 'AN:true,CR:true,GL:false,GO:true,GU:true,HO:true,JE:true,NE:true,PS:true,SD:true'
 OR (SELECT count(*) FROM public."ProdutoCatalogo" WHERE fonte='IDEAGRI_DADOS000') <> 2576
 OR (SELECT count(*) FROM public."ProdutoCatalogo" WHERE fonte='IDEAGRI_DADOS777') <> 7
 THEN RAISE EXCEPTION 'Cadastros padrão incompletos ou divergentes'; END IF;
END $$;
SQL
# O ledger fica preservado, mas não participa da comparação estrutural.
dump_schema() {
  pg_dump --schema-only --no-owner --no-privileges --schema=public --schema=pecuaria --exclude-table=public._prisma_migrations "$1" | sed '/^\\restrict /d; /^\\unrestrict /d'
}
dump_dados() {
  pg_dump --data-only --inserts --no-owner --no-privileges --schema=public --schema=pecuaria --exclude-table=public._prisma_migrations "$1" | sed '/^\\restrict /d; /^\\unrestrict /d'
}
dump_schema "$url_antiga" > "$base/antiga.sql"
dump_schema "$url_nova" > "$base/nova.sql"
diff -u "$base/antiga.sql" "$base/nova.sql"
# Compara os cinco catálogos históricos, ignorando apenas o relógio da carga
# entre instalações independentes. Na reconciliação, conserva também timestamps.
snapshot_catalogo() {
  local url="$1" expressao="$2" tabela
  for tabela in FabricanteProduto ClassificacaoTecnicaProduto PrincipioAtivo ProdutoCatalogo ProdutoCatalogoPrincipioAtivo; do
    echo "$tabela"
    psql "$url" -XAt -v ON_ERROR_STOP=1 -c "SELECT $expressao FROM public.\"$tabela\" t ORDER BY 1"
  done
}
snapshot_catalogo "$url_antiga" "(to_jsonb(t) - 'atualizadoEm')::text" > "$base/catalogo-historico"
snapshot_catalogo "$url_nova" "(to_jsonb(t) - 'atualizadoEm')::text" > "$base/catalogo-novo"
diff -u "$base/catalogo-historico" "$base/catalogo-novo"
snapshot_catalogo "$url_antiga" 'to_jsonb(t)::text' > "$base/catalogo-antes-upgrade"
# Fixtures representam referências e cadastros que já pertencem à fazenda.
psql "$url_antiga" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO public."Produto" (id,nome,"categoriaId","updatedAt") SELECT 'fixture-produto','Produto preservado',id,'2020-01-01' FROM public."Categoria" WHERE nome='Sanidade';
INSERT INTO public."Produto" (id,nome,"categoriaId","updatedAt") SELECT 'fixture-produto-' || n, 'Produto ' || n, c.id, '2020-01-01' FROM public."Categoria" c CROSS JOIN generate_series(1,35) n WHERE c.nome='Sanidade';
INSERT INTO pecuaria."Raca" (id,nome,sigla,base,"atualizadoEm") VALUES
 ('fixture-ho','Holandês','HO',true,'2020-01-01'),
 ('fixture-gl','Girolando','GL',false,'2020-01-01'),
 ('fixture-si','Sindi','SI',true,'2020-01-01'),
 ('fixture-custom','Raça particular','XX',true,'2020-01-01'),
 ('fixture-gi','Grauvieh','GI',true,'2020-01-01');
SQL
snapshot_protegido() {
  psql "$url_antiga" -XAt -v ON_ERROR_STOP=1 -c "SELECT row_to_json(t) FROM (SELECT * FROM public.\"Produto\" WHERE id LIKE 'fixture-produto%' ORDER BY id) t UNION ALL SELECT row_to_json(t) FROM (SELECT id,nome,ativo,ordem FROM public.\"Categoria\" WHERE nome='Sanidade') t UNION ALL SELECT row_to_json(t) FROM (SELECT * FROM pecuaria.\"Raca\" WHERE id LIKE 'fixture-%' ORDER BY id) t;"
}
test "$(psql "$url_antiga" -XAt -c "SELECT count(*) FROM public.\"Produto\" WHERE id LIKE 'fixture-produto%'")" = 36
test "$(psql "$url_antiga" -XAt -c "SELECT count(*) FROM pecuaria.\"Raca\" WHERE id LIKE 'fixture-%'")" = 5
snapshot_protegido > "$base/protegido-antes"
DATABASE_URL="$url_antiga" DIRECT_URL="$url_antiga" pnpm --filter rionovo-server exec prisma migrate resolve --applied 20261124170000_base_unificada --schema "$base/nova/server/prisma/schema.prisma"
DATABASE_URL="$url_antiga" DIRECT_URL="$url_antiga" pnpm --filter rionovo-server exec prisma migrate deploy --schema "$base/nova/server/prisma/schema.prisma"
snapshot_protegido > "$base/protegido-depois"
diff -u "$base/protegido-antes" "$base/protegido-depois"
snapshot_catalogo "$url_antiga" 'to_jsonb(t)::text' > "$base/catalogo-depois-upgrade"
diff -u "$base/catalogo-antes-upgrade" "$base/catalogo-depois-upgrade"
test "$(psql "$url_antiga" -XAt -c "SELECT count(*) FROM public.\"Categoria\" c JOIN public.\"GrupoCategoria\" g ON g.id=c.\"grupoId\" WHERE c.nome='Sanidade' AND c.\"usoSanitario\" AND g.nome='Saúde do rebanho'")" = 1
dump_dados "$url_antiga" > "$base/antes-repeticao.sql"
psql "$url_antiga" -v ON_ERROR_STOP=1 -f server/prisma/migrations/20261124170100_cadastros_padrao/migration.sql > /dev/null
dump_dados "$url_antiga" > "$base/depois-repeticao.sql"
diff -u "$base/antes-repeticao.sql" "$base/depois-repeticao.sql"
dump_schema "$url_antiga" > "$base/upgrade.sql"
diff -u "$base/nova.sql" "$base/upgrade.sql"
# Uma identidade de raça inconsistente deve abortar a transação inteira.
psql "$url_antiga" -v ON_ERROR_STOP=1 -c 'UPDATE pecuaria."Raca" SET sigla = '\''ZZ'\'' WHERE id = '\''fixture-ho'\'';' > /dev/null
dump_dados "$url_antiga" > "$base/antes-conflito.sql"
if psql "$url_antiga" -v ON_ERROR_STOP=1 -f server/prisma/migrations/20261124170100_cadastros_padrao/migration.sql > "$base/conflito.log" 2>&1; then
  echo 'A colisão de raça deveria rejeitar a carga.' >&2
  exit 1
fi
grep -F "Identidade de raça conflitante" "$base/conflito.log" > /dev/null
dump_dados "$url_antiga" > "$base/depois-conflito.sql"
diff -u "$base/antes-conflito.sql" "$base/depois-conflito.sql"
