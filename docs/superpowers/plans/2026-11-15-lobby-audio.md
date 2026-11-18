# Áudio Contínuo no Lobby — Plano de Implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:executing-plans` para executar este plano tarefa por tarefa. As etapas usam checkboxes (`- [ ]`).

**Objetivo:** Tocar a trilha também na página inicial, com o mesmo painel de volumes e continuidade ao navegar para a partida.

**Arquitetura:** O controlador singleton `gameAudio` mantém a reprodução entre rotas. `HomePage` e `GameScreen` usam um helper compartilhado para desbloqueio por interação, enquanto nenhuma tela pausa a música ao desmontar.

**Stack:** React 19, TypeScript, Material UI, SCSS, Vitest e Testing Library.

**Especificação:** `docs/superpowers/specs/2026-11-15-game-audio-music-design.md`

## Restrições globais

- Implementar nas edições Ilha e República.
- Manter os textos em pt-BR com tradução inglesa.
- Não criar uma segunda instância de áudio nem reiniciar a faixa entre rotas.
- Executar `npx vitest run` e `npm run build` em cada edição antes do push.

## Foco da revisão

- Primeira tentativa bloqueada deve continuar aceitando novas interações.
- Desmontar Home ou Game não deve pausar nem reiniciar a música.
- O painel do lobby deve refletir imediatamente os volumes persistidos.
- Múltiplas montagens não podem acumular listeners nem instâncias.
- O botão do cabeçalho deve ser acessível por teclado e leitor de tela.

---

### Tarefa 1: Ciclo de vida compartilhado da música

**Arquivos:**
- Criar: `ui/src/hooks/useGameMusic.ts`
- Criar: `ui/src/hooks/useGameMusic.test.tsx`
- Modificar: `ui/src/pages/GameScreen.tsx`
- Modificar: `ui/src/pages/GameScreen.test.tsx`

**Interfaces:**
- Produz: `useGameMusic(): void`, que registra listeners de interação, remove-os após desbloqueio bem-sucedido e apenas limpa listeners no unmount.
- Consome: `unlockAndPlayMusic(): Promise<boolean>`.

- [ ] Escrever testes falhando para retry, remoção após sucesso, cleanup e ausência de `stopGameMusic` no unmount.
- [ ] Executar `npx vitest run src/hooks/useGameMusic.test.tsx` e confirmar RED.
- [ ] Implementar o hook e substituir os efeitos locais do `GameScreen`.
- [ ] Executar testes do hook e `GameScreen`; confirmar GREEN.
- [ ] Commit: `refactor: compartilhar ciclo de vida da musica`.

### Tarefa 2: Painel de áudio na Home

**Arquivos:**
- Modificar: `ui/src/pages/HomePage.tsx`
- Modificar: `ui/src/pages/HomePage.scss`
- Modificar: `ui/src/pages/HomePage.test.tsx`

**Interfaces:**
- Consome: `useGameMusic`, `AudioSettingsPopover`, getters e assinatura de `gameAudio`.

- [ ] Escrever teste falhando para botão **Configurar áudio**, painel, volumes e idioma inglês.
- [ ] Executar `npx vitest run src/pages/HomePage.test.tsx` e confirmar RED.
- [ ] Implementar botão compacto ao lado do seletor de idioma e o popover compartilhado.
- [ ] Executar `npx vitest run src/pages/HomePage.test.tsx src/hooks/useGameMusic.test.tsx`; confirmar GREEN.
- [ ] Commit: `feat: adicionar musica e volumes ao lobby`.

### Tarefa 3: Paridade e validação

**Arquivos:**
- Modificar: `docs/superpowers/specs/2026-11-15-game-audio-music-design.md`
- Criar: `docs/superpowers/plans/2026-11-15-lobby-audio.md`

- [ ] Executar suíte completa e build na primeira edição.
- [ ] Aplicar commits sobre a outra edição preservando mudanças remotas.
- [ ] Executar suíte completa e build na segunda edição.
- [ ] Fazer revisão independente final e corrigir achados Important/Critical por TDD.
- [ ] Commit: `docs: registrar audio continuo no lobby`.
