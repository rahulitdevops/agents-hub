# Contributing to Agent Hub

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/rahulitdevops/agents-hub.git
cd agents-hub
npm install
npm run dev
```

## Project Structure

- `src/app/` — Next.js App Router pages
- `src/components/` — React components
- `src/lib/` — Core business logic (runtime, containers, models)
- `src/hooks/` — Custom React hooks

## Code Style

- TypeScript strict mode
- Tailwind CSS for styling (no CSS modules)
- Functional React components with hooks
- File naming: kebab-case for files, PascalCase for components

## Pull Request Process

1. Fork the repo and create your branch from `main`
2. Make your changes with clear, descriptive commits
3. Test your changes locally (`npm run dev` + `npm run lint`)
4. Update documentation if needed
5. Submit a PR with a clear description of what changed and why

## Adding a New Model

Just add an entry to `MODEL_REGISTRY` in `src/lib/model-registry.ts`. It will automatically appear in the model picker, settings, and analytics.

## Adding a New Page

1. Create `src/app/your-page/page.tsx` (server component)
2. Create `src/app/your-page/client.tsx` (client component)
3. Add the route to `NAV` in `src/components/sidebar.tsx`
4. Add API routes in `src/app/api/your-endpoint/route.ts`

## Questions?

Open an issue or reach out in the discussions tab.
