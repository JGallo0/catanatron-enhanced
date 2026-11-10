# Instruções para Agentes de IA (Antigravity / Cursor / Claude Code)

Ao abrir este repositório em qualquer máquina, **leia obrigatoriamente o arquivo [`CONTEXTO_PROJETO.md`](./CONTEXTO_PROJETO.md)** antes de realizar alterações.

## Regras Principais do Projeto
1. **Idioma:** Todo o texto visível ao usuário deve estar **100% em Português Brasileiro (`pt-BR`)**, e todas as respostas ao usuário no chat devem ser em português.
2. **Direção de Arte:** Inspirada no **Catan Universe (Steam)**. Nunca volte a usar os SVGs pretos de circuito do Catanatron original.
3. **Sistema Híbrido de Ilustrações (Nano Banana Pro):**
   - As ilustrações customizadas ficam em `ui/public/assets/illustrations/{tiles,cards,dev,ui}/`.
   - O componente [`HybridIllustration`](./ui/src/components/icons/GameIcons.tsx) busca automaticamente arquivos `.webp`, `.png` ou `.jpg` e faz fallback para os componentes SVG ilustrados caso o arquivo ainda não tenha sido colocado na pasta.
4. **Testes e Build antes de Push:**
   - Sempre rode `npx vitest run` e `npm run build` dentro de `ui/` antes de fazer commit e push para `origin/main` (que dispara o deploy automático na Vercel).
