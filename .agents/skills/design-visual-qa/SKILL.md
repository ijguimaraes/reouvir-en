---
name: design-visual-qa
description: Use ao terminar qualquer mudança visual no Reouvir EN. Checklist final com capturas em vários tamanhos e nos dois temas, varredura de tokens e comparação com o protótipo.
---

# Revisão visual (QA)

Rode no fim de toda mudança visual. Olhe o resultado renderizado, não só o código. Junte as verificações numa passada, corrija o que aparecer e olhe de novo.

## Matriz de captura

| Eixo | Valores |
|---|---|
| Largura | 360, 390, 768, 1280 px |
| Tema | claro, escuro |
| Estado | com dados, vazio, carregando, erro, offline |
| Texto | fonte do sistema a 100% e 200% |

Portas de dev: web `5273`, admin `5274`. Use o navegador do ambiente (ou Playwright, se existir) e salve as capturas fora do repositório, a menos que se peça o contrário.

## Checklist

**Tokens e tema**
- Nenhuma cor ou valor solto novo (`grep -nE '#[0-9a-fA-F]{3,8}' apps/*/src/*.css`).
- Tema claro e escuro verificados, e a alternância manual funciona.

**Layout**
- Sem rolagem horizontal. Nada cortado ou sobreposto.
- Teste de apertar os olhos: principal, secundário e grupos distinguíveis.
- Áreas seguras respeitadas (barra inferior do iPhone, notch).

**Tipografia**
- Corpo ≥ 16px no app do aluno. Medida de linha confortável. Títulos com quebra equilibrada.

**Componentes**
- Todos os estados (padrão, hover, foco, ativo, desabilitado, carregando, erro, vazio) existem para o que foi tocado.

**Acessibilidade**
- Tab percorre tudo na ordem certa, com foco visível.
- Contraste conferido nos dois temas. Alvos de toque ≥ 44px no app do aluno.
- Movimento reduzido ativado: a tela continua clara.

**Movimento**
- Sem animação decorativa. Duração dentro da escala.

**Texto**
- Português correto com acentos. Botões com verbo de ação. Erros dizem como resolver.

**Coerência**
- Compare com `prototipo/` (referência de UX, não de código). Divergência precisa ser intencional.
- A tela parece parte do mesmo produto que as outras, nos dois apps.

## Relatório

Classifique o que sobrou: **P0** impede usar; **P1** quebra AA ou uma tarefa principal, corrigir antes de liberar; **P2** incômodo com contorno; **P3** acabamento. Poucos P3. Diga o que foi verificado e o que não foi (ex.: "não testado em Safari/iOS real", "gesto de arrastar só em emulação").

## O que nenhum agente valida

Áudio com a tela bloqueada, comportamento real no iOS, desempenho em celular fraco e sensação de uso em movimento. Registre como pendente de teste manual.
