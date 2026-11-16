# Música e Controles de Áudio do Jogo — Plano de Implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. As etapas usam checkboxes (`- [ ]`) para acompanhamento.

**Objetivo:** Incluir `Island Game Night` em loop nas edições Ilha e República, com volumes persistentes e independentes para música e efeitos.

**Arquitetura:** Um módulo compartilhado de áudio passa a controlar preferências, ganhos dos efeitos Web Audio e uma instância única de `HTMLAudioElement`. O `GameScreen` apenas observa e altera esse estado por meio de um painel compacto ligado ao botão de som existente. O patch é implementado e validado em uma edição, depois aplicado e novamente validado na outra.

**Stack:** React 19, TypeScript, Web Audio API, HTMLAudioElement, Material UI, SCSS, Vitest e Testing Library.

**Especificação:** `docs/superpowers/specs/2026-11-15-game-audio-music-design.md`

## Restrições globais

- Todo texto visível deve estar em Português Brasileiro, com tradução inglesa onde a tela já suporta alternância.
- Usar somente `ui/public/assets/audio/island-game-night-loop.ogg`; não adicionar a versão MP3 ao bundle.
- Música e efeitos devem ter controles independentes de 0 a 100 e persistir no navegador.
- A reprodução deve respeitar o bloqueio de autoplay e ser desbloqueada pela primeira interação do usuário.
- Executar `npx vitest run` e `npm run build` em cada edição antes da entrega.

## Foco da revisão

- `localStorage` ausente ou com valores inválidos deve resultar em padrões seguros, sem quebrar a partida.
- Múltiplas montagens do `GameScreen` não podem criar músicas sobrepostas.
- Música em 0 deve pausar; aumentá-la deve retomar somente após desbloqueio por interação.
- Efeitos em 0 não podem criar tons audíveis e não podem pausar a música.
- Navegação por teclado e leitores de tela devem identificar os dois controles e seus valores.

---

### Tarefa 1: Controlador compartilhado de áudio e trilha

**Arquivos:**
- Criar: `ui/src/utils/gameAudio.ts`
- Criar: `ui/src/utils/gameAudio.test.ts`
- Criar: `ui/src/utils/soundEffects.test.ts`
- Criar: `ui/public/assets/audio/island-game-night-loop.ogg`
- Modificar: `ui/src/utils/soundEffects.ts`

**Interfaces:**
- Produz: `getMusicVolume(): number`, `setMusicVolume(value: number): void`, `getEffectsVolume(): number`, `setEffectsVolume(value: number): void`, `subscribeAudioPreferences(listener): () => void`, `unlockAndPlayMusic(): Promise<void>` e `stopGameMusic(): void`.
- Valores públicos usam escala inteira `0..100`; o módulo faz clamp e persiste internamente.
- `soundEffects.ts` consome `getEffectsVolume()` para multiplicar `gainPeak` por `volume / 100`.

- [ ] **Etapa 1: Escrever testes falhando em `gameAudio.test.ts`**

Cobrir: padrões de música e efeitos; leitura inválida; clamp 0–100; persistência; notificação de assinantes; uma única instância de áudio; `loop=true`; pausa em música 0; retomada após `unlockAndPlayMusic`; e tolerância a rejeição de `play()`.

- [ ] **Etapa 2: Executar o teste e confirmar a falha**

Executar: `npx vitest run src/utils/gameAudio.test.ts`
Esperado: FAIL porque `gameAudio.ts` ainda não existe.

- [ ] **Etapa 3: Implementar `gameAudio.ts` e integrar o ganho dos efeitos**

Usar chaves `catanatron_music_volume_v1` e `catanatron_effects_volume_v1`, padrões `35` para música e `70` para efeitos, uma instância preguiçosa de `Audio('/assets/audio/island-game-night-loop.ogg')` e listeners internos para atualização da UI.

- [ ] **Etapa 4: Adicionar o OGG final aprovado**

Copiar a versão de crossfade de 12 segundos para `ui/public/assets/audio/island-game-night-loop.ogg` e confirmar duração aproximada de `162.7735s`.

- [ ] **Etapa 5: Executar os testes do controlador**

Executar: `npx vitest run src/utils/gameAudio.test.ts src/utils/soundEffects.test.ts`
Esperado: PASS, incluindo escala de ganho e silêncio em zero em `soundEffects.test.ts`.

- [ ] **Etapa 6: Commit**

```bash
git add ui/src/utils/gameAudio.ts ui/src/utils/gameAudio.test.ts ui/src/utils/soundEffects.ts ui/src/utils/soundEffects.test.ts ui/public/assets/audio/island-game-night-loop.ogg
git commit -m "feat: adicionar trilha e controle de áudio"
```

### Tarefa 2: Painel de música e efeitos no jogo

**Arquivos:**
- Criar: `ui/src/components/AudioSettingsPopover.tsx`
- Criar: `ui/src/components/AudioSettingsPopover.test.tsx`
- Criar: `ui/src/components/AudioSettingsPopover.scss`
- Modificar: `ui/src/pages/GameScreen.tsx`
- Modificar: `ui/src/pages/GameScreen.test.tsx`

**Interfaces:**
- Consome: getters, setters, assinatura e desbloqueio de `gameAudio.ts`.
- Produz: `AudioSettingsPopover` com props `open: boolean`, `anchorEl: HTMLElement | null`, `onClose: () => void`, `language: AppLanguage`.

- [ ] **Etapa 1: Escrever testes falhando do painel**

Testar rótulos **Música** e **Efeitos**, valores iniciais, atualização independente, valor acessível, fechamento e tradução inglesa.

- [ ] **Etapa 2: Escrever teste falhando de integração no `GameScreen`**

Substituir a expectativa do antigo toggle por: clicar em **Configurar áudio** abre o painel; alterar Música não altera Efeitos; a primeira interação chama `unlockAndPlayMusic`; tudo em zero apresenta ícone silenciado.

- [ ] **Etapa 3: Executar os testes e confirmar a falha**

Executar: `npx vitest run src/components/AudioSettingsPopover.test.tsx src/pages/GameScreen.test.tsx`
Esperado: FAIL porque o painel e a integração ainda não existem.

- [ ] **Etapa 4: Implementar o painel e substituir o toggle antigo**

Usar `Popover`, dois sliders HTML acessíveis e valores percentuais. O botão lateral abre/fecha o painel; o primeiro `pointerdown` ou `keydown` no documento chama o desbloqueio uma única vez por montagem; desmontagem remove listeners sem destruir a instância compartilhada.

- [ ] **Etapa 5: Estilizar o painel compacto**

Aplicar o visual escuro/dourado já usado no HUD, largura adequada a desktop e toque, foco visível e controles legíveis sem cobrir o tabuleiro além do necessário.

- [ ] **Etapa 6: Executar os testes da interface**

Executar: `npx vitest run src/components/AudioSettingsPopover.test.tsx src/pages/GameScreen.test.tsx`
Esperado: PASS.

- [ ] **Etapa 7: Commit**

```bash
git add ui/src/components/AudioSettingsPopover.tsx ui/src/components/AudioSettingsPopover.test.tsx ui/src/components/AudioSettingsPopover.scss ui/src/pages/GameScreen.tsx ui/src/pages/GameScreen.test.tsx
git commit -m "feat: adicionar painel de volumes do jogo"
```

### Tarefa 3: Documentação, validação e paridade entre edições

**Arquivos:**
- Modificar: `docs/superpowers/specs/2026-11-15-game-audio-music-design.md`
- Modificar: `docs/superpowers/plans/2026-11-15-game-audio-music.md`

**Interfaces:**
- Consome: commits funcionais das tarefas 1 e 2.
- Produz: os mesmos arquivos e comportamentos nas branches das edições Ilha e República.

- [ ] **Etapa 1: Executar validação completa na primeira edição**

Executar em `ui/`: `npx vitest run` e `npm run build`.
Esperado: todos os testes relacionados ao patch passam e o build retorna código 0; qualquer falha preexistente deve ser reproduzida no commit-base e documentada.

- [ ] **Etapa 2: Aplicar os commits na outra edição**

Cherry-pick dos commits das tarefas 1 e 2 sobre a branch local baseada na edição restante; resolver somente diferenças temáticas sem mudar o comportamento de áudio.

- [ ] **Etapa 3: Executar validação completa na segunda edição**

Executar em `ui/`: `npx vitest run` e `npm run build`.
Esperado: mesmo critério da etapa 1.

- [ ] **Etapa 4: Conferir tamanho e conteúdo do bundle**

Confirmar que existe apenas um arquivo de música no bundle, que ele é OGG, e registrar o tamanho final do `ui/dist`.

- [ ] **Etapa 5: Commit dos documentos**

```bash
git add docs/superpowers/specs/2026-11-15-game-audio-music-design.md docs/superpowers/plans/2026-11-15-game-audio-music.md
git commit -m "docs: registrar integração da trilha do jogo"
```
