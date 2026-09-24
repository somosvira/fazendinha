-- A baixa guarda as linhas de histórico que fechou (o estorno reabre exatamente essas). Com
-- RESTRICT, uma baixa ESTORNADA continuava prendendo a linha e impedia desfazer a movimentação
-- (ou mudança de destino) que a abriu. Agora a baixa ativa segue protegida pelo app (desfazer
-- recusa enquanto ela vale) e a estornada só perde o vínculo quando a linha é apagada.

ALTER TABLE "pecuaria"."BaixaAnimal" DROP CONSTRAINT "BaixaAnimal_localizacaoFechadaId_fkey";
ALTER TABLE "pecuaria"."BaixaAnimal" ADD CONSTRAINT "BaixaAnimal_localizacaoFechadaId_fkey" FOREIGN KEY ("localizacaoFechadaId") REFERENCES "pecuaria"."LocalizacaoAnimal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pecuaria"."BaixaAnimal" DROP CONSTRAINT "BaixaAnimal_destinoFechadoId_fkey";
ALTER TABLE "pecuaria"."BaixaAnimal" ADD CONSTRAINT "BaixaAnimal_destinoFechadoId_fkey" FOREIGN KEY ("destinoFechadoId") REFERENCES "pecuaria"."DestinoAnimal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
