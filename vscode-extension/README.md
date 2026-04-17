# FreeLang v11 — VS Code Extension

Syntax highlighting, snippets, and language configuration for **FreeLang v11** (`.fl`) files.

## Features

- ✨ **Syntax highlighting** — comments, strings, keywords, $-variables, blocks, builtins
- 🧠 **Snippets** — `defn`, `fn`, `let`, `if`, `cond`, `FUNC`, `sget`, `spost`, `mq`, `pl`
- 🔤 **Bracket matching** — `()`, `[]`, `{}`, `""`
- 🗒️ **Comments** — `;` line comment
- 🎨 **String interpolation** — `"Hello {$name}!"`, `"Result: {(+ 1 2)}"`

## Installation (local dev)

```bash
# Package
cd vscode-extension
npx @vscode/vsce package   # 생성: freelang-11.2.0.vsix

# Install
code --install-extension freelang-11.2.0.vsix
```

Or for quick testing, copy this directory to:
- Linux/Mac: `~/.vscode/extensions/freelang-11.2.0/`
- Windows: `%USERPROFILE%\.vscode\extensions\freelang-11.2.0\`

## Recognized blocks

`[FUNC]`, `[ROUTE]`, `[PAGE]`, `[COMPONENT]`, `[SERVICE]`, `[CONTROLLER]`,
`[GUARD]`, `[MODEL]`, `[REPOSITORY]`, `[KAFKA]`, `[JWT]`, `[DOCKERFILE]`,
`[K8S-DEPLOYMENT]`, `[AWS]`, `[GCP]`, `[AZURE]`, `[DATABASE]`,
AI blocks: `[COT]`, `[AGENT]`, `[EVOLVE]`, `[WISDOM]`, `[INTENT]`, `[REFLECT]`, ...

## Highlighted special forms

`fn`, `defn`, `define`, `let`, `if`, `cond`, `do`, `begin`, `loop`, `recur`,
`while`, `when`, `unless`, `match`, `and`, `or`, `not`, `null?`, `set!`,
`async`, `await`, `quote`, `try`, `catch`, `throw`, `return`.

## Status

v11.2 compatible. Built alongside the [FreeLang v11 runtime](https://gogs.dclub.kr/kim/freelang-v11).
