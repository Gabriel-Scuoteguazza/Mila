# Mila

A static multi-page website in Brazilian Portuguese presenting the **Mila** smart-desk concept — features, components, team ("Quem Somos"), references, and a game section.

## Stack

- Pure HTML / CSS / vanilla JavaScript (no build step)
- Pages live in `paginas/`, assets in `assets/`, styles in `css/` and `style.css`

## Running

```
npx --yes serve . -p 5000 --no-clipboard --no-port-switching
```

Workflow: **Start application** — serves the site on port 5000.

`serve.json` preserves `.html` URLs and their query parameters so questions sent
to `mila-app/chat.html?q=...&autoSend=true` reach the chat unchanged. This is a
multi-page site: do not enable the single-page (`-s`) fallback.

## User preferences

_None recorded yet._
