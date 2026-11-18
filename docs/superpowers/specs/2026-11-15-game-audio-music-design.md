# Música e controles de áudio do jogo

## Intenção

Adicionar a trilha instrumental `Island Game Night` às edições Ilha e República, em loop contínuo, permitindo que cada jogador ajuste música e efeitos sonoros separadamente sem poluir a tela do tabuleiro.

## Comportamento aprovado

- O botão de som existente na barra lateral abre um painel compacto de áudio.
- O painel contém dois controles independentes: **Música** e **Efeitos**.
- Cada controle vai de 0% a 100%, tem indicação numérica e pode ser ajustado durante a partida.
- Os volumes são persistidos no navegador e reaplicados em partidas futuras.
- A música usa o arquivo OGG com a emenda aprovada de 12 segundos e toca em loop nas duas edições.
- A reprodução começa assim que houver uma interação válida do usuário, respeitando o bloqueio de autoplay dos navegadores.
- Volume de música em 0% pausa a trilha; ao aumentar novamente, ela retoma.
- Volume de efeitos em 0% impede os efeitos existentes sem afetar a música.
- O ícone do botão reflete o estado geral: som ativo, volume reduzido ou tudo silenciado.
- A interface visível permanece em Português Brasileiro, com tradução inglesa onde o jogo já oferece alternância de idioma.

## Decisões de implementação

- Centralizar preferências e reprodução em um utilitário de áudio compartilhado pelas duas edições.
- Manter os efeitos Web Audio existentes, multiplicando seus ganhos pelo volume configurado de efeitos.
- Usar um único elemento `HTMLAudioElement` para a música, evitando reinício ao atualizar o estado da tela.
- Usar o OGG final no bundle e não incluir uma cópia MP3, reduzindo armazenamento e transferência.
- O painel deve ser acessível por teclado e fornecer nomes e valores compreensíveis por leitores de tela.

## Abordagens consideradas

1. **Volume mestre único:** interface mínima, mas não permite adaptar música e efeitos ao gosto do jogador.
2. **Música e efeitos separados — escolhida:** oferece controle suficiente com apenas dois sliders e preserva uma interface compacta.
3. **Volume mestre com mixagem avançada:** flexível, porém complexo demais para a necessidade atual.

## Fora do escopo

- Playlist, troca automática de músicas ou trilha diferente por edição.
- Equalizador, seleção de dispositivo de áudio ou controles por tipo individual de efeito.
- Hospedagem externa da trilha nesta etapa.

## Extensão aprovada: áudio na página inicial

- A trilha também toca na `HomePage` das edições Ilha e República.
- O desbloqueio respeita o navegador e acontece na primeira interação válida no lobby.
- Um botão compacto de áudio fica no cabeçalho da Home, próximo ao seletor de idioma, sem aumentar o dock inferior.
- O botão abre o mesmo `AudioSettingsPopover`, com os controles independentes de **Música** e **Efeitos**.
- As preferências são compartilhadas entre lobby e partida.
- A música deve continuar da posição atual durante a navegação entre lobby e partida, sem reiniciar nem criar instâncias sobrepostas.
- O ciclo de vida da música deixa de pertencer ao `GameScreen`: trocar de rota não pausa a trilha; apenas volume zero ou encerramento da página a interrompe.

## Validação

- Testes unitários para persistência, escala de ganho, pausa/retomada e desbloqueio após interação.
- Teste do painel e dos dois sliders no `GameScreen`.
- `npx vitest run` e `npm run build` em cada edição antes de considerar a integração pronta.
