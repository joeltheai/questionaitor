# Questionaitor

A timed multiple-choice quiz app. Paste or upload questions as JSON, set a timer (total time or per question), take the test, and review correct vs incorrect answers. Past question sets are saved in a local question bank so you can retake, mix, or merge them later (duplicates are skipped).

# Getting Started

This is a tanstack router application.
See the [Tanstack Router documentation](https://tanstack.com/router/latest) for more information.

To run this application:

```bash
pnpm install
pnpm dev
```

# Building For Production

To build this application for production:

```bash
pnpm build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
pnpm test
```

## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting. The following scripts are available:

```bash
pnpm lint
pnpm format
pnpm check
```
