# Central de Relatórios

## Decisão

`/relatorios` é a entrada única para documentos e consultas de toda a fazenda. O identificador interno de permissão continua `relatorio` para não invalidar usuários existentes; `/relatorio` permanece como alias de compatibilidade.

## Separação de responsabilidades

- **Dashboard:** indicadores atuais, alertas e perguntas executivas.
- **Módulos operacionais:** registro e execução de manejos.
- **Relatórios:** recortes históricos, listas, documentos e exportações.

O antigo relatório editorial foi preservado como o modelo **Financeiro · Fechamento financeiro mensal**. Os relatórios configuráveis do rebanho continuam usando o motor existente e são acessados pela Central; o item duplicado foi retirado da navegação interna do Rebanho.

## Estado da primeira entrega

- Catálogo pesquisável por título, descrição e sinônimos.
- Filtros por área.
- Favoritos e recentes persistidos no navegador.
- Distinção explícita entre relatórios disponíveis e modelos em preparação.
- Acesso ao compositor de relatórios reprodutivos.
- Fechamento mensal aberto dentro da Central, com retorno e exportação preservados.

## Próximas evoluções

1. Deep-link do catálogo para um `templateId` específico do compositor.
2. Persistência de favoritos, recentes e relatórios próprios no servidor por usuário/propriedade.
3. Fontes e métricas cruzadas: animal, evento, lactação, aplicação e financeiro.
4. Relatórios agendados e compartilhamento conforme permissões.
