# Padel Ranking

A modern web application to track and manage padel player rankings using Astro, Svelte, and Supabase.

## 🎾 About

This project is a ranking system for padel players, built with a fast and modern tech stack. It provides an interactive interface for tracking player performance and rankings.

## 🚀 Tech Stack

- **[Astro](https://astro.build)** - Modern static site builder for fast web experiences
- **[Svelte](https://svelte.dev)** - Reactive components for interactivity
- **[Tailwind CSS](https://tailwindcss.com)** - Utility-first CSS framework
- **[Supabase](https://supabase.com)** - Open-source Firebase alternative (PostgreSQL backend)
- **[TypeScript](https://www.typescriptlang.org)** - Type-safe JavaScript

## 📋 Project Structure

```
/
├── public/
│   └── favicon.svg
├── src/
│   ├── assets/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   └── styles/
├── package.json
└── astro.config.mjs
```

## 🧞 Getting Started

### Prerequisites

- Node.js `>=22.12.0`
- npm or your preferred package manager

### Installation

```sh
npm install
```

### Development

```sh
npm run dev
```

This starts a local development server at `http://localhost:4321`

### Build

```sh
npm run build
```

Creates a production-ready build in the `./dist/` directory.

### Preview

```sh
npm run preview
```

Preview your production build locally before deploying.

## 📖 Available Commands

| Command                   | Action                                      |
| :------------------------ | :------------------------------------------ |
| `npm install`             | Install project dependencies                |
| `npm run dev`             | Start local dev server at `localhost:4321`  |
| `npm run build`           | Build production site to `./dist/`          |
| `npm run preview`         | Preview build locally before deploying      |
| `npm run astro`           | Run Astro CLI commands                      |

## 🔧 Configuration

The project uses the following configuration files:
- `astro.config.mjs` - Astro configuration
- `tailwind.config.ts` - Tailwind CSS setup
- `tsconfig.json` - TypeScript configuration
- `package.json` - Project dependencies and scripts

## 📚 Learn More

- [Astro Documentation](https://docs.astro.build)
- [Svelte Documentation](https://svelte.dev/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Supabase Documentation](https://supabase.com/docs)

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License

This project is open source.
# Disponibilita campi OpenResa

La pagina `/prenotazioni` mostra una griglia pubblica in sola lettura. Il browser
interroga `/api/openresa/slots`, mentre il server Astro contatta OpenResa senza
esporre il token ai visitatori.

Configurare su Netlify:

```dotenv
OPENRESA_API_TOKEN=...
OPENRESA_API_BASE_URL=https://openresa.com/api/v1
OPENRESA_BOOKING_URL=https://openresa.com/tiebreak
```

Senza `OPENRESA_API_TOKEN` la pagina usa automaticamente dati dimostrativi.
L'adattatore invia il token server-side tramite l'header `X-API-Key`.
