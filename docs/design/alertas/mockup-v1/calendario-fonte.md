# Calendário da fazenda — leitura do documento

Fonte fornecida pelo usuário: [Documento Escaneado 18.pdf](</Users/montes/Downloads/Documento Escaneado 18.pdf>), página única, título “CALENDÁRIO DE VACINAÇÃO”. Leitura visual em 27/10/2026; o PDF não contém texto extraível. O documento original não foi alterado nem copiado para o repositório.

A tabela registra as marcações do papel. Não valida indicação clínica, calendário legal, produto comercial, elegibilidade individual ou atendimento realizado. O ano 2026 apresentado no protótipo é apenas contexto de simulação; o documento não informa ano ou dias específicos.

| Linha no papel | Atividade | Público/condição no papel | Meses marcados |
|---|---|---|---|
| 1 | Exame de Brucelose | > 24 meses | Agosto |
| 2 | Exame de Tuberculose | Acima de 3 meses | Agosto |
| 3 | Vacina de Clostridiose e Raiva 1ª dose | 4 a 6 meses de idade | Março, junho, setembro, dezembro |
| 4 | Vacina de Clostridiose e Raiva 2ª dose | 5 a 7 meses de idade | Janeiro, abril, julho, outubro |
| 5 | Vacina de Clostridiose | 8 meses a 24 meses | Fevereiro, agosto |
| 6 | Vacinação Clostridiose Gado Adulto | Todo rebanho | Agosto |
| 7 | Vacina de Brucelose (RB-51) | 4 meses | Todos os meses |
| 8 | Vacina de Leptospirose | A partir de 3 meses | Fevereiro, agosto |
| 9 | Vacina de IBR/BVD/Leptospirose | A partir de 3 meses | Maio, novembro |
| 10 | Vacina Tifopasteurina 8º Mês de Gestação | Pré-parto | Todos os meses |
| 12 | Vacina de Raiva Todo Rebanho | Todo rebanho | Agosto |
| 12 | Vermifugação (injetável) | Animais > 3 meses | Maio, julho, setembro, novembro |
| 13 | Vermifugação (oral) | Animais mamando | Todos os meses |
| 14 | Ceratoconjuntivite | Avaliar infecção | Março, setembro |

O rodapé informa reforço em 21 dias após a aplicação para animais recebendo a vacina pela primeira vez na vida. Não identifica as linhas às quais se aplica. A numeração repete 12 e não apresenta 11; foram conservadas as 14 linhas, usando identidades internas próprias no protótipo.

## Pontos a conferir antes de configurar regras reais

- “Gado Adulto” no título versus “Todo Rebanho” no público da linha 6.
- Relação entre calendário da segunda dose e orientação de reforço em 21 dias. Não calcular uma aplicação automática com base na nota genérica.
- Nome comercial e produto da linha de Tifopasteurina; referência ao 8º mês de gestação pertence ao título.
- Critérios inclusivos/exclusivos das faixas, sexo e demais condições do público, e significado de “animais mamando”.
- “Todos os meses” é janela de avaliação/programação. Não prova revacinação mensal do mesmo animal; recorrência individual precisa ser definida por cuidado e histórico.
- “Avaliar infecção” não comprova doença nem indica automaticamente vacinação ou produto.
- Produtos do cadastro, antecedência, dia/janela, repetição anual e histórico de atendimento não constam no documento.

## Consequências para o desenho

A agenda oferece eventos do mês e matriz anual. Cada evento mantém atividade, meses, público textual e origem; detalhes explicam como uma regra conferida/ativada publicará alertas e como o atendimento atualizará o mesmo cuidado. O desenho não vincula essas marcações aos animais fictícios já presentes na central. A ação “Simular alerta deste evento” gera uma prévia com público a selecionar, sem execução ou ativação, e reutiliza a identidade ao repetir o mesmo evento/mês.

O calendário evidencia critérios combinados de mês e público, gestação, fase de amamentação, dose e histórico. Esses requisitos precisam ser detalhados no domínio sanitário, mantendo o núcleo comum de alertas independente. Eles não podem ser reduzidos a idade mínima ou a uma tarefa mensal para todo animal.
