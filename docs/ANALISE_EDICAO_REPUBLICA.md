# Comparação da edição República com a edição Ilha

Análise iniciada em 14/11/2026 e atualizada em 15/11/2026 após a branch República avançar até `d0a1104`. As melhorias comuns selecionadas foram integradas à árvore de trabalho da Edição Ilha, com adaptação temática.

## Referências examinadas

- `origin/main`: `e3e8fff` — perfis de jogadores e sistema de amizades.
- `origin/edicao-republica`: `d0a1104` — lobby pré-partida cênico e conjunto consolidado de melhorias.
- Base comum: `00513fc` — recebimento de cartas, trocas e ritmo da partida.
- A comparação inicial até `62bdaae` foi complementada pela revisão commit a commit de `f7f2d68` até `d0a1104`.
- Comparação: `git diff origin/main...origin/edicao-republica`, complementada pela leitura dos arquivos e testes modificados.
- A integração preserva o oceano, os portos com docas e barcos, Argila/Minério, progressão comercial de cosméticos, bots e provocações da Ilha.

## Integração até `d0a1104`

Foram transportados: ganhos de cartas em lote, sincronização visual pós-rolagem, anúncios de conquistas, tela final com ranking e avatares de corpo inteiro, filtro do histograma, central de comércio, fechamento ao concluir trocas, animação de roubo, nitidez no zoom, limpeza da Home, restrição de início ao anfitrião, Ladrão Amigável desligado por padrão e novo lobby pré-partida.

Ficaram deliberadamente de fora: desbloqueio gratuito de cosméticos, Pedra/Barro, cenário e objetos da República, elenco/jargões particulares e portos sem embarcações.

## O que mudou e vale aproveitar

| Item | Na main | Na República | Proposta para a Ilha |
|---|---|---|---|
| Recebimento de cartas | Uma carta por vez, 1,8 s cada | Todas lado a lado, 2,3 s para o conjunto; espera o fim da rolagem | Trazer a apresentação em grupos, corrigindo fila e trajetórias; limitar/agrupar grandes quantidades no celular |
| Barra inferior | Ícones de 23 px com quantidade ao lado | Ícones de 36 px, nome do recurso, contador destacado, cores por recurso, distinção entre vazio/disponível e desenvolvimento jogável | Trazer a hierarquia visual, ajustando altura para preservar espaço do tabuleiro |
| Ícones dos recursos | Vetores existentes | Contornos mais fortes e contraste refinado | Trazer somente os ícones, preservando o mar e as ilustrações da Ilha no mesmo arquivo |
| Aviso de turno | Banner central | Faixa abaixo dos jogadores, cor do jogador e brilho de entrada | Prioridade alta: mantém o centro do tabuleiro livre; testar nomes longos e movimento reduzido |
| Ladrão | Aviso discreto e peão escuro | Anel vermelho, onda na chegada, aviso destacado por 6,2 s e texto com destino/vítima | Trazer o feedback, preservando sincronização com dados e legibilidade em telas pequenas |
| Histórico | Descrição simples; mini-histórico some com chat aberto | Detalhes de ganhos/roubos no histórico completo; mini-histórico muda para a direita com chat aberto | Trazer a coexistência chat/histórico; refazer a origem dos dados detalhados antes de integrar |
| Velocidade lenta | Multiplicador 6×; pensamento dos bots de 3,2–5,8 s | Multiplicador 5×; pensamento de 1,6–2,9 s; giro 3,75 s e overlay de dados 9 s | Boa candidata a padrão mais fluido; validar sensação em partida |
| Portos | Barcos e placas com recurso/taxa | Placas padronizadas alinhadas às arestas, sem barcos; específicos exibem apenas recurso | Aproveitar alinhamento/contraste, manter barcos e indicação explícita 2:1 na Ilha |
| Menu e chat | Menu horizontal próximo ao topo | Menu vertical à esquerda, chat deslocado para abrir espaço | Tratar como variante de layout; avaliar tablet/celular antes de adotar |
| Zoom e dados | Fundo oceânico fora do zoom e dados sobre a tela | Mesa, tabuleiro e dados na mesma transformação | Conceito reutilizável, mas implementação atual depende da caixa de dados da mesa República |

Os comentários de commit sobre "mecânicas" correspondem principalmente a ritmo, apresentação e feedback. Não houve alteração de regras em `localEngine.ts`, `apply_action.py` ou `state.py` nesse intervalo. As alterações do backend são de nomes e avatares de bots.

## Ajustes necessários antes de transportar

### Cartas em grupo

Em `CardGainOverlay.tsx:60`, cada deslocamento ainda é calculado como destino menos centro da janela. Agora as cartas ocupam posições diferentes na fileira. Para acertar o destino individual, o cálculo precisa partir do centro real de cada carta.

Em `GameScreen.tsx:189`, a conclusão passou a limpar toda a fila. Ganhos novos continuam sendo acrescentados (`:895`), mas o overlay mantém a chave do primeiro ganho e seu temporizador original (`:1754`). Se outro ganho chegar durante a apresentação, ele pode receber menos tempo de exposição e ser apagado junto com o grupo anterior. Separar o grupo ativo dos ganhos pendentes.

O novo teste verifica três cartas e duração de 2,3 s. Ainda são necessários casos de chegada de novo ganho durante a animação, grandes quantidades, destinos individuais e telas pequenas.

### Histórico detalhado

`buildDetailedActionLogEntries`, em `promptUtils.ts:379`, reconstrói as mãos percorrendo as ações. Há lacunas identificáveis no código:

- `BUILD_ROAD` debita madeira/argila após o primeiro dado, inclusive para estradas gratuitas de uma carta de construção de estradas.
- `MOVE_ROBBER` atualiza a posição e escreve os textos, mas não transfere o recurso entre as mãos reconstruídas.
- A produção é calculada pelas construções e hexágonos, sem consultar a disponibilidade histórica do banco.
- Em histórico iniciado no meio da partida, o fallback usa construções atuais e ladrão inicialmente no deserto, o que não garante a situação histórica correta.

Essas estimativas são utilizadas para indicar vítimas do Monopólio; podem informar ganhos ou vítimas incorretos. O novo teste cobre produção simples e descrição de roubo, mas não esses cenários. Preferir eventos/resultados do motor para o histórico e evitar afirmar quantidades que a perspectiva do jogador não conhece.

A alteração também remove o nome do recurso roubado do aviso privado do autor. Para a Ilha, preservar a informação autorizada ao próprio jogador e ocultá-la no histórico público.

### Layout e zoom

- A nova barra de recursos cresce: os blocos passam de mínimo 42×37 para 68×64 px no desktop. É ganho de leitura, não de área livre. Transportar com medidas ajustadas ao objetivo anterior de ampliar a proporção do tabuleiro.
- `DiceRollOverlay.tsx` ancora os dados em `center + size * 10.5`, coordenada específica da caixa República. Não transportar essa posição para o oceano.
- `ZoomableBoard.tsx` reduz o zoom mínimo de 0,65 para 0,35 e desativa `limitToBounds`. Pode permitir afastar demais o tabuleiro; manter limites apropriados e recentralização na Ilha.
- O menu vertical e os avisos novos precisam de verificação em telas baixas, nomes longos, chat aberto e preferências de movimento reduzido.
- O mini-histórico continua oculto abaixo de 640 px de largura ou 480 px de altura. O título de commit "sempre visível" não significa visibilidade em todos os dispositivos.

## Personalizações exclusivas da República

- Mesa de madeira, mordida, caixas, bebidas, cinzeiro e objetos afetivos, implementados sobretudo em `OceanBackdrop.tsx` e seu SCSS.
- Catálogo ampliado de amigos/bots, nomes, avatares e frases em `botCatalog.ts`, `tauntCatalog.ts` e nos dois espelhos de `web/models.py`.
- Reações automáticas em `GameScreen.tsx` e efeitos correspondentes em `PlayerTopBar.scss` associados aos jargões do grupo.
- Mar substituído por hexágonos azuis opacos, retirada dos barcos e cenário de chão/mesa.

Essas escolhas atendem ao ambiente nostálgico; a Ilha mantém oceano, navegação, aventura e seu próprio elenco/textos. Alguns nomes do grupo já existem na main anterior à separação; criar um elenco comercial independente é um passo adicional, não algo resolvido simplesmente deixando de copiar os novos bots.

## Ordem sugerida de integração

1. Barra inferior e ícones mais legíveis; faixa de turno no alto; destaque do ladrão. Reaproveitar blocos específicos de `62bdaae`, `e458872` e `291d770`.
2. Animação de ganhos em grupos, combinando `e458872` e `ffe8de3` com correções de trajetória/fila e limite de cartas por grupo.
3. Mini-histórico junto do chat e histórico detalhado com dados confiáveis. Origem principal: `291d770`.
4. Calibração da velocidade lenta de `62bdaae`, com uma partida para avaliar ritmo.
5. Protótipo de portos/menu/posicionamento dos dados adaptado ao oceano, sem importar a geometria da mesa.

Não aplicar todos os commits em bloco: vários misturam tema, interface e comportamento. Um merge Git normal pode preservar o commit de amigos, mas também importaria o cenário da República; substituir arquivos inteiros pode perder melhorias exclusivas da main.

## Como manter duas edições com evolução compartilhada

Separar apresentação em uma configuração de edição: cenário, elenco/avatares, frases, reações e estilo de portos. O motor, contas/amigos, negociação, animações e componentes básicos de interface ficam compartilhados.

O backend também precisa conhecer o catálogo da edição, pois define nomes/avatares de bots. O frontend deve selecionar a cena correta, sem transformar `OceanBackdrop` permanentemente em uma mesa. Se ambas forem publicadas com personalizações próprias, usar configurações de deploy distintas e definir explicitamente se contas/amigos são compartilhados.

As branches podem continuar separadas durante a personalização, com commits pequenos para melhorias comuns. Evitar duas cópias completas do jogo que se afastem a cada correção.

## Relatório do Antigravity

Não é necessário para analisar os nove commits publicados. Seria útil somente para alterações ainda não enviadas ao GitHub, decisões de UX tomadas durante testes, problemas conhecidos e referências visuais aprovadas.

Comparação no GitHub: https://github.com/JGallo0/catanatron-enhanced/compare/e3e8fff...62bdaae
