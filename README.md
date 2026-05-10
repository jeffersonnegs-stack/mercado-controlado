# NotaFácil

Aplicativo PWA estático para gerenciamento de gastos com comparação de preços de mercados e leitura de NFC-e.

## Estrutura do projeto

- `index.html` — shell principal do aplicativo
- `manifest.json` — configuração PWA
- `sw.js` — service worker para cache e offline
- `css/style.css` — estilos principais
- `js/app.js` — controladora de navegação e inicialização
- `core/` — utilitários compartilhados
- `data/` — dados de mercado e cesta básica
- `features/` — regras de tela e comportamento do app
- `icons/` — ícones para PWA

## Como usar

1. Sirva o diretório `mercado-controlado-main` por HTTP/HTTPS.
2. Abra `index.html` no navegador.
3. Habilite o service worker e instale como PWA para uso offline.

> Nota: o app usa `navigator.geolocation` e `getUserMedia` para recursos de localização e leitura de QR Code.
