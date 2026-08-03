# feat/rebanho-formularios-campo

## Objetivo

Transformar relatórios do rebanho em folhas de trabalho persistidas: montar, visualizar, imprimir, preencher depois e concluir criando eventos reais na plataforma.

## Decisões

- O montador abre após gerar o relatório, usando a população real.
- Configurações podem ser salvas como modelos reutilizáveis.
- Campos de papel são estruturados e vinculados ao domínio; não há campo livre na v1.
- Cada folha é uma atividade com snapshot e status.
- O retorno do campo é digitado em grade, com rascunho.
- Toda linha precisa ser preenchida ou marcada “Não realizado” com motivo.
- A conclusão é idempotente e não pode deixar eventos parcialmente gravados.
- V1 concentra-se em reprodução; sanidade e produção reutilizam a fundação depois.
