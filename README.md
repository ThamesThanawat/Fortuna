# Fortuna

Single-page Solana Devnet lottery dApp UI demo for a MagicBlock VRF powered jackpot flow.

## Preview

Open `index.html` in a browser for the dependency-free static preview. The app keeps all demo state in the page.

The Next.js version is in `fortuna/` and uses the same UI/state model.

```bash
cd fortuna
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Demo States

The page includes explicit controls for wallet disconnected, round open, round closed, VRF requested, settled win, settled lose, and prize claimed states.

The generated background asset is saved at `assets/fortuna-relief.png` and mirrored to `fortuna/public/fortuna-relief.png`.
