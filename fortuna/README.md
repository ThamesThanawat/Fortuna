# Fortuna

Fortuna is a single-page Solana Devnet lottery dApp UI demo powered by MagicBlock VRF.

The app is a local hackathon demo: one active round, mock wallet state, mock ticket purchase, verifiable randomness request state, draw reveal, win/lose result, claim state, and dev-only admin controls.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm run lint
npm run build
```

## Scope

- No mainnet calls.
- No private keys or seed phrases.
- No real wallet signing.
- No real prize claims.
- Demo state is local to the page.

## Files

- `app/page.tsx` - Fortuna single-page UI and local state machine.
- `app/globals.css` - responsive visual system, draw animations, and state styling.
- `public/fortuna-relief.png` - generated Fortuna relief background asset.
