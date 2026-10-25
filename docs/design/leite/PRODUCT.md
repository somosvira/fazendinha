# Produção de leite — contexto visual desta frente

Operadores registram o volume geral por tanque em cada ordenha, com régua e litros referentes somente àquela ordenha. O controle individual ocorre mensalmente na operação informada e continua disponível para outras frequências configuradas e futuras máquinas. O usuário confirmou três ordenhas iniciais, quantidade configurável e horário opcional. Gestores acompanham produção, saldo físico, natureza comercial e custos; valores monetários seguem permissões do servidor.

A referência aprovada para o controle individual é a segunda imagem apresentada na conversa: [Ordenha em foco](ordenha-aprovada.png). Conserva foco em uma sessão, resumo das posições, captura por animal e ação de salvar persistente. A captura geral por tanque evolui na [prévia navegável](previa-main/README.md). Os números e horários das imagens são ilustrativos; não se tornam dados da aplicação. O shell e a marca continuam os componentes reais do projeto.

O trabalho de Product Design definiu a direção; Impeccable é aplicado como refinamento de legibilidade, estados, teclado, responsividade e erros desta implementação. Não há uma nova direção estética global nem alteração da sidebar fora da navegação necessária.

## Contrato da direção

- **THESIS:** o operador reconhece a ordenha ativa, registra o próximo animal e entende o que ainda falta.
- **OWN-WORLD:** trabalho diário de fazenda; volumes conhecidos, histórico e responsabilidade permanecem explícitos.
- **STORY:** data → ordenha → animal/litros → cobertura → salvar. Estoque, destinos e custos têm entradas próprias no módulo.
- **FIRST VIEWPORT:** título, data, posições com volume/cobertura, primeiras linhas e ação persistente. No celular a navegação horizontal é contida e os controles continuam legíveis.
- **FORM:** superfícies claras, acento verde para seleção/ação, números tabulares e foco visível. Sem gráficos ou enfeites que disputem espaço com a captura.

## Adaptações funcionais

Busca, inclusão/exclusão justificada e situação da célula vêm dos contratos operacionais. Brinco identifica animais homônimos também nos rótulos acessíveis. Dados de raça, lote, horário ou produção não são inventados para copiar a imagem. Retirada física e fechamento comercial são independentes; o preço pode permanecer pendente até a negociação por comprador/período. Apuração de custo posterior é uma operação separada.

## Orientação visual registrada na revisão de 23/10/2026

As ações devem usar componentes de botão, com contorno ou preenchimento, estados e área de interação reconhecíveis. Não apresentar ações como texto sublinhado ou links avulsos. Não usar o texto colapsável nativo de `details/summary` como solução visual. Conteúdo deve usar componentes visíveis ou, quando a expansão for necessária, um componente com cabeçalho, botão, foco e estados próprios. Reutilizar esses componentes nas origens dos animais, na gestão dos tanques e nas ferramentas de revisão. Os controles exclusivos do mockup ficam separados da rotina do operador. Preservar as cores, tipografia e modais aprovados.

Os ajustes aprovados de escolha do tanque e pré-seleção por finalidade Leite/DEL > 0 na data estão no código da V5. Origens e gestão usam painéis com botões; detalhes secundários usam `SecaoDetalhesLeite` sobre os componentes compartilhados de expansão. O [contrato funcional](../../pecuaria/leite.md) registra as regras, a preservação histórica e os limites. As [capturas da implementação](implementacao-main/ajustes-origens-tanques/README.md) usam fixtures; não comprovam operação com banco nem homologação da fazenda.

As capturas de revisão usam os componentes reais e fixtures identificadas como ilustrativas, sem acesso ao banco. Elas comprovam renderização naquele cenário, não homologação da fazenda nem integração SQL.

A integração da main de 24/10/2026 conserva os ajustes aprovados de tanques/origens. Cabeçalho, abas, tabelas, expansões e ações reutilizam os componentes de Rebanho e Nutrição (`PageHeader`, `SubTabs`, `TabelaFinanceira`, primitivas `Table`, `SecaoRecolhivel` e `Button`), com os tokens Cooperativa existentes. A inspeção com dados ilustrativos não comprova integração com banco ou homologação operacional.
