# Handoff — aba Reprodução / IATF (2026-07-24)

> Registro do ponto em que a sessão de 24/07/2026 parou. O foco foi aproximar a aba **Reprodução** da operação real do IDEAGRI, principalmente na execução de protocolos IATF por animal e por lote.

## TL;DR

- A base de paridade com o IDEAGRI foi inventariada em `docs/design/reproducao-paridade-ideagri.md`.
- A fatia desta sessão materializa cada etapa de uma aplicação IATF e permite marcar a etapa como **feita**, **pulada** ou **pendente/reaberta**.
- Aplicações avulsas e programações por lote passam a criar um snapshot das etapas do protocolo, preservando o histórico mesmo se o catálogo for editado depois.
- O trabalho cobre uma parte importante da linha **Execução/sincronização IATF**, mas a aba Reprodução ainda não está em paridade completa com o IDEAGRI.

## O que ficou implementado nesta sessão

### Banco e domínio

- Novo enum `StatusExecucaoEtapaIATF`: `PENDENTE`, `CONCLUIDA` e `PULADA`.
- Novo modelo `ExecucaoEtapaIATF`, com:
  - etapa materializada por aplicação (`dia`, `ordem`, ação e hormônio);
  - data planejada e data real de execução;
  - status operacional;
  - produto, dose e observação opcionais;
  - cascade ao excluir a aplicação.
- `AplicacaoProtocoloIATF` ganhou as dimensões operacionais `usoCidr`, `estimulo` e `perdaImplante`.
- Migration aditiva com backfill das aplicações já existentes em `server/prisma/migrations/20260724170000_iatf_execucao_etapa/migration.sql`.

### Backend

- Aplicar um protocolo a um animal agora cria a aplicação e suas execuções pendentes na mesma operação.
- Programar um lote agora cria, para cada animal, a aplicação e o snapshot de execuções.
- O DTO da aplicação passou a devolver:
  - etapas com status real;
  - atraso de etapas pendentes;
  - data efetiva;
  - progresso (`concluídas`, `puladas`, `pendentes`, próxima etapa e conclusão).
- Nova rota `PATCH /api/rebanho/iatf/execucoes/:id` para concluir, pular ou reabrir uma etapa, respeitando o escopo da propriedade.
- O cálculo puro de status/progresso recebeu cobertura unitária.

### Frontend

- Na ficha do animal, a seção IATF mostra progresso e status de cada etapa.
- A operação pode marcar uma etapa como **feita**, **pular** ou **reabrir**.
- Etapas atrasadas ficam destacadas.
- As dimensões CIDR, estímulo e perda de implante são exibidas quando presentes no retorno.
- A programação por lote continua mostrando o calendário planejado; a execução real permanece detalhada por aplicação/animal.

## Decisões tomadas

1. **Snapshot por aplicação:** as etapas executáveis não dependem do catálogo depois da aplicação. Alterar o protocolo não reescreve o histórico dos animais já programados.
2. **Pulada conta como resolvida:** o protocolo só fica concluído quando não restam etapas pendentes; o resumo distingue concluídas de puladas.
3. **Execução individual:** o lote é o agrupador de programação, mas o status real fica por animal, pois animais do mesmo lote podem ter desvios diferentes.
4. **Retrocompatibilidade:** a migration materializa etapas pendentes para aplicações antigas. A API ainda deriva a agenda quando encontra um legado sem execuções, mas esse legado não pode ser atualizado pela UI até receber materialização.

## Onde exatamente paramos

Esta entrega avança a execução básica de IATF, porém ainda faltam os pontos abaixo para declarar paridade funcional:

### Próxima continuação recomendada

1. **Execução coletiva do lote:** abrir o detalhe da programação e permitir marcar uma mesma etapa para vários animais, com seleção e exceções individuais.
2. **Formulário operacional completo:** expor na UI de aplicação/execução os campos `usoCidr`, `estimulo`, `perdaImplante`, produto, dose e observação. Hoje o backend suporta esses campos, mas os botões rápidos da ficha enviam essencialmente status e data.
3. **Resumo real do lote:** agregar os status das execuções dos animais. A listagem de lote ainda calcula progresso pela passagem das datas planejadas, não pelo que foi realmente concluído/pulado.
4. **Integração com evento reprodutivo:** ao concluir a etapa de inseminação, definir e implementar a criação/vínculo do evento `INSEMINACAO`, evitando duplicidade.
5. **Importação/reconciliação IDEAGRI:** mapear e importar `PROGRAMACAOIATF`, `PROGRAMACAOIATFASSOCIACAO`, `PROTOCOLOIATF` e princípios ativos, validando as contagens do baseline.
6. **Testes de integração e navegador:** cobrir aplicação avulsa, lote, PATCH de etapa, escopo entre propriedades, backfill e fluxo visual completo.

### Outras lacunas da aba Reprodução

O contrato completo está em `docs/design/reproducao-paridade-ideagri.md`. Permanecem fora desta fatia, entre outros:

- separação histórica e reconciliação de IA, cobrição e transferência de embrião;
- aptidão automática de novilhas;
- diagnóstico/exame ginecológico com os resultados estruturados do IDEAGRI;
- parto com todos os tipos, auxílios, crias e perdas;
- coleta FIV/TE, embriões e pool de doadoras;
- biblioteca genética e recomendação de acasalamento completas;
- sincronização/recebimento mobile e relatórios reprodutivos equivalentes.

## Arquivos principais desta fatia

- `server/prisma/schema.prisma`
- `server/prisma/migrations/20260724170000_iatf_execucao_etapa/migration.sql`
- `server/src/services/rebanho/iatf.calc.ts`
- `server/src/services/rebanho/iatf.calc.test.ts`
- `server/src/services/rebanho/iatf.schemas.ts`
- `server/src/services/rebanho/iatf.ts`
- `server/src/services/rebanho/iatf-lote.ts`
- `server/src/routes/rebanho/iatf.ts`
- `client/src/rebanho/api.ts`
- `client/src/rebanho/components/IatfSection.tsx`
- `client/src/rebanho/components/ProgramacaoIatfLote.tsx`

## Validação da entrega

Antes do merge, confirmar e registrar no PR:

```bash
pnpm prisma:generate
pnpm --filter rionovo-server exec vitest run src/services/rebanho/iatf.calc.test.ts
pnpm build
```

Se houver banco de desenvolvimento disponível, aplicar a migration/db push e fazer smoke do fluxo:

1. criar ou escolher protocolo ativo;
2. aplicar a um animal e confirmar que as etapas foram materializadas;
3. concluir, pular e reabrir etapas;
4. programar um lote e conferir uma aplicação com execuções para cada animal;
5. verificar que outra propriedade não consegue alterar a execução.

## Referências

- Contrato de paridade: `docs/design/reproducao-paridade-ideagri.md`
- Design da programação por lote: `docs/superpowers/specs/2026-07-20-iatf-por-lote-design.md`
