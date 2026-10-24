-- Datas conhecidas do laudo pertencem à amostra, inclusive quando individual.
-- Sem preenchimento retroativo: cadastro, coleta, resultado e recebimento são fatos distintos.
ALTER TABLE pecuaria."AmostraQualidadeLeite"
  ADD COLUMN "dataResultadoLaboratorial" DATE,
  ADD COLUMN "dataRecebimentoLaudo" DATE;
