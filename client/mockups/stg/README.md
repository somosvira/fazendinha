# Proposta de regularização e aptidão

Referência navegável dos desenhos aprovados para C2/C5/C6/C7 e C3.1 do plano STG. **Não implementa os fluxos nem grava dados.** Os nomes, valores e registros são fictícios; não comprovam disponibilidade ou homologação no STG.

Servir `client` como raiz estática e abrir `/mockups/stg/`. Não iniciar `dev:server` para revisar este artefato, pois seu script aplica migrations.

## Decisões propostas

- Decisão confirmada pela fazenda: baixa com tipo não determinado restrita à regularização histórica. Evidência e motivo acompanham a saída; revisão não gera segunda baixa.
- Cadastro sanitário com escolha explícita de zero ou prazo em horas para leite/carne. Legado desconhecido continua desconhecido. Aplicações anteriores preservam snapshot.
- Critérios separados para vacas e novilhas. Campos opcionais participam apenas quando selecionados; valores não definidos não recebem limites fictícios. Referência adulta, escala e validade ficam identificadas.
- Avaliação devida, agendamento, retorno, DG/reconfirmação e pendência cadastral não se confundem com aptidão clínica. Exame apto e decisão individual são ações diferentes; no protótipo o formulário de decisão aparece apenas após a demonstração do registro de exame apto.
- PEV original permanece visível. Antecipação requer decisão comprovada e revalidação dos demais impedimentos.
- Histórico apresenta somente vínculos comprovados e mantém IA avulsa distinta de etapas. TETF sem IA prevista não recebe alerta de incompletude.

## Direção visual e revisão

Proposta para extensão das superfícies existentes, não aprovação de padrão global. Modo Operar; prioridade desktop. Paleta base: ação petróleo `#006f68`, detalhe `#009c91`, fundo `#f7f8fa`, navegação `#dce8e5`, texto `#263c3a` e aviso `#fff8e8`. Manrope conserva continuidade com o projeto. Títulos e campos alinhados à esquerda, formulários em duas colunas e evidências próximas da ação; faixas e divisórias substituem cartões repetidos.

Revisão com as orientações de `impeccable` e `frontend-design`: hierarquia por tarefa, ausência de liberação automática sugerida, resultados clínicos separados de impedimentos, estados desconhecidos preservados, foco visível, controles nativos e largura móvel sem rolagem horizontal da página. O detector apontou 25 recomendações de cores/tamanhos fora das escalas documentadas e um alerta de borda: este último corresponde ao sublinhado da aba selecionada, não a uma borda de cartão arredondado. Os valores são propostos neste mockup e não alteram os tokens do aplicativo.

## Validação e limites

Conferência local no navegador do artefato, incluindo navegação, carência com prazo obrigatório e adaptação estreita. Essas evidências são do protótipo: não substituem a validação funcional das futuras rotas e serviços. A aprovação visual cobre os desenhos apresentados; não equivale à homologação funcional ou à execução de dados. Os formulários de política e decisão ilustram a composição; não reproduzem todas as regras de domínio, permissões, concorrência ou estados de erro do aplicativo.

## Ampliação C3.1 — peso no encerramento da lactação

`secagem.html` acrescenta duas propostas sem substituir as cinco telas anteriores: encerramento manual com peso opcional (Não informar / Registrar / Reutilizar) e manutenção posterior (adicionar, corrigir, substituir ou desvincular com motivo). Precisão de um novo peso começa como Não informada; a correção conserva o valor conhecido da pesagem demonstrada. Reutilização mantém o registro original e a apresentação distingue vínculos ativos e revogados. Dados e autoria são fictícios.

Revisão com `impeccable` e `frontend-design`: extensão do modo Operar e da paleta existente, títulos/controles alinhados à esquerda, detalhes próximos da decisão e campos em duas colunas no desktop/uma no celular. Peso opcional não recebe marcador obrigatório; a confirmação nomeia o encerramento manual. Nenhuma pesagem isolada encerra lactação. O formulário de manutenção exige motivo e informa preservação da pesagem. Aprovação desta ampliação permanece pendente; o protótipo não escreve nem comprova funcionamento do contrato transacional.

Servido para revisão em `http://127.0.0.1:41876/mockups/stg/secagem.html`. Capturas `preview-secagem-desktop.png`, `preview-secagem-registrar.png`, `preview-secagem-manutencao.png` e `preview-secagem-mobile.png` documentam os estados ilustrativos, sem constituir homologação do produto.

Conferência desta proposta: desktop e celular de 390 px sem rolagem horizontal da página; estados Registrar e Adicionar exibem os campos correspondentes; adição não usa texto de substituição nem mostra vínculo ativo fictício. O detector retornou 11 recomendações de cores do CSS herdado do protótipo, sem apontamentos de estrutura; as cores não foram promovidas a tokens do produto.
