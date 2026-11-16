-- Dispensa é decisão administrativa terminal, distinta de não atendimento.
ALTER TYPE pecuaria."TipoEventoTarefaProtocolo" ADD VALUE IF NOT EXISTS 'DISPENSA';
