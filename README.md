# Fortuna

Single-page Solana Devnet lottery dApp UI demo for a MagicBlock VRF powered jackpot flow.

## Hackathon Demo Status

Ayara is a ticket-inspired verifiable jackpot draw on Solana. The Anchor program is deployed on Solana devnet.

Program ID:

```text
8DjFVVLZAHxYAobiko9t7cXAmJ2QJMn5nU9M8ykzqvGj
```

The frontend demo uses a real wallet/devnet transaction for ticket purchase. The current buy flow sends a small `0.001 SOL` devnet transaction. Draw settlement is mocked for demo reliability, and the production randomness path is designed for MagicBlock VRF.

Implemented Anchor instructions:

- `initialize_config`
- `create_draw`
- `buy_ticket`
- `close_draw`
- `mock_settle_draw`
- `claim_prize`

Current limitations:

- IDL generation is not available yet
- Frontend is not fully wired to Anchor instructions
- MagicBlock VRF is not live
- Prize vault/claim flow is demo-level
- Not production-ready and not audited

### Demo Flow

1. Connect wallet
2. Buy ticket using a real devnet transaction
3. Close draw using demo control
4. Mock settle using demo control
5. View result: Demo Prize, not jackpot

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
