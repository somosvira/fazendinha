# Entrada de uma visita — proposta

Mockup em `/mockups/entrada-visita/index.html`, aprovado e aplicado em `EntradaVisita.tsx`/`entrada-visita.css`. O mockup permanece estático.

Representa a entrada “Adicionar grupo” de uma visita existente, com o contexto observado na interface local: Visita prevista, 02/11/2026, Sítio principal, Equipe demonstrativa. Esses dados são estáticos e não há acesso à API ou gravação.

O contexto somente leitura substitui os campos com aparência editável. Agenda do dia e Seleção livre conservam os dois percursos atuais. Escolha via RadioGroup shadcn, indicação visual, continuidade contextual e ajuda por tooltip, sem descrições pequenas ou rodapés explicativos nos cards; o botão abre apenas uma explicação do próximo passo. A aplicação real continua responsável por consultar grupos/animais, revisar e preparar explicitamente. Nenhuma quantidade de animais ou tarefas é inventada.

Escopo: visita existente; o formulário editável de Nova visita permanece fora desta proposta. A sidebar é uma representação estática da navegação, sem atalhos operacionais. O contexto e as regras funcionais estão em `docs/pecuaria/reproducao.md` e `EntradaVisita.tsx`/`Visitas.tsx`.
