# Próximos passos — refino visual e validação operacional

Atualizado em 19/10/2026.

## Estado atual

- O client foi revisado visualmente com a Impeccable em desktop, mobile e rotas secundárias.
- A avaliação consolidada ficou em **25/40**: identidade visual coerente, mas ainda há problemas de densidade, consistência e adaptação móvel.
- O detector automático da Impeccable não encontrou ocorrências nos 319 arquivos analisados; isso não substitui a revisão visual.
- A revisão não alterou o comportamento nesta etapa.

## Prioridade recomendada

1. **Corrigir a ordenação das tarefas sanitárias.** Preservar a prioridade calculada no servidor e evitar que o client coloque tarefas concluídas antes de pendências.
2. **Corrigir layouts responsivos.** Resolver a sobreposição de período/sítio nos relatórios móveis, o corte de data em Conferir consumo e a largura das ações de PDF e tabelas.
3. **Padronizar formulários.** Alinhar labels com ícones de ajuda, campos de data, checkboxes, rodapés e ações de cancelamento.
4. **Reduzir conteúdo acima da dobra.** Compactar filtros e cabeçalhos em Compromissos, Animais, Estoque e fichas sanitárias.
5. **Unificar telas secundárias.** Aplicar o mesmo padrão de abas, âncoras, catálogos, estados inválidos e detalhes.

## Validações que dependem do ambiente

- Testar perfis restritos e autorização no servidor.
- Executar fluxos reais de gravação, edição, cancelamento, pagamento, convite e upload em banco descartável.
- Validar estados de erro de rede, token inválido e recuperação após recarregar durante um formulário.
- Confirmar todos os tipos de operação financeira e execução de etapas sanitárias.
- Repetir a inspeção em navegador móvel real e verificar flicker ao abrir dropdowns, trocar abas e restaurar scroll.
- Revalidar custo, áudio, imagem e limites do assistente de consulta com credenciais apropriadas.

## Critérios de aceite

- Nenhuma tabela ou ação primária exige rolagem horizontal em 390 px.
- Datas, sítio, status e ações permanecem legíveis sem sobreposição.
- Todas as telas de formulário têm label, ajuda, validação, cancelar e salvar com o mesmo padrão.
- Pendências sanitárias aparecem antes do histórico em todas as visões.
- Detalhes restauram o scroll de forma previsível e não escondem o cabeçalho.
- Cada ação de gravação mostra estado de carregamento, sucesso ou erro recuperável sem perder os dados digitados.
- Nova rodada da Impeccable supera 32/40 antes de considerar o refino concluído.

## Evidências

As capturas e o relatório detalhado desta revisão estão em:

`C:/Users/mathe/.codex/visualizations/2026/10/15/auditoria-completa/`

O snapshot da Impeccable está em `.impeccable/critique/`.
