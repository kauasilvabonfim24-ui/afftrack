# AffTrack — Rastreador de Links de Afiliados

PWA para encurtar e rastrear links de afiliados em tempo real.

## Funcionalidades
- 🔗 Encurtador de links com redirecionamento instantâneo
- 📊 Dashboard com gráficos de cliques em tempo real
- 💰 Estimativa de ganhos por comissão
- 🔔 Notificações push via OneSignal
- 📱 PWA instalável no celular
- 🏆 Top 10 links mais clicados
- 📱 Filtro por plataforma
- ✏️ Edição de links

## Stack
- React + TypeScript + Vite
- Supabase (banco de dados + realtime)
- OneSignal (notificações push)
- Cloudflare Pages (hospedagem)

## Setup

1. Clone o repositório
2. Instale as dependências: `npm install`
3. Configure as variáveis de ambiente (copie `.env.example` para `.env`)
4. Rode localmente: `npm run dev`

## Deploy no Cloudflare Pages

1. Conecte o repositório GitHub ao Cloudflare Pages
2. Configure as variáveis de ambiente no painel do Cloudflare
3. Build command: `npm run build`
4. Output directory: `dist`

## Banco de dados (Supabase)

Execute o SQL em `supabase/migrations/init.sql` para criar as tabelas.
