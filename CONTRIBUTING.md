# Contributing to Monkey Mind

Thanks for your interest in contributing to Monkey Mind: Inner Invaders!

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

- **Dev server**: `pnpm dev` (opens at localhost:3000)
- **Type check**: `pnpm typecheck`
- **Lint**: `pnpm lint`
- **Format**: `pnpm format`
- **Test**: `pnpm test`
- **Build**: `pnpm build`

## Code Standards

- TypeScript with `strict: true` and `noImplicitOverride`
- Biome for linting and formatting (120 char line width, single quotes, trailing commas)
- All PRs must pass CI (lint, typecheck, test) before merge

## Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run `pnpm lint && pnpm typecheck && pnpm test` to verify
5. Submit a PR with a clear description of the changes

## Neurotech Devices

To test with real neurotech hardware:

- **Webcam (rPPG heart rate)**: Any modern browser with camera access
- **EEG headband (Muse S)**: Chrome/Edge with Web Bluetooth enabled (`chrome://flags/#enable-web-bluetooth`)

## License

ISC — see [LICENSE](LICENSE)
