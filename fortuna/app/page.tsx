"use client";

import { useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  WalletAdapterNetwork,
  WalletReadyState,
  type WalletName,
} from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";

type RoundStatus = "open" | "closed" | "drawing" | "settled";

type Ticket = {
  normals: number[];
  bonus: number;
};

const ROUND_COPY: Record<RoundStatus, string> = {
  open: "Ticket-inspired jackpot experience. Verifiable draw powered by MagicBlock VRF.",
  closed: "Ticket set locked before randomness.",
  drawing: "Requesting MagicBlock VRF randomness for production settlement.",
  settled: "Demo settlement complete.",
};

const STATUS_LABELS: Record<RoundStatus, string> = {
  open: "Open",
  closed: "Closed",
  drawing: "VRF Requested",
  settled: "Settled",
};

const INITIAL_ROUND_ID = 48;
const INITIAL_TICKETS = 1284;
const INITIAL_PRIZE_POOL = 1284;
const TICKET_PRICE = 1;
const CLAIM_AMOUNT = 270.13;
const BUY_AMOUNT_SOL = 0.001;
const BUY_AMOUNT_LAMPORTS = Math.round(BUY_AMOUNT_SOL * LAMPORTS_PER_SOL);
const FIRST_PRIZE = 1_000_000;
const DRAW_DATE = "Demo Draw · Devnet";
const DRAW_SERIAL = "AYR-048-1284";
const DEVNET_TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_FORTUNA_TREASURY ??
  "6JySoaKTABNQq3qLCpuAg2FXdTPAf3vZsfvghDgg6pkm";
const DEVNET_TREASURY = new PublicKey(DEVNET_TREASURY_ADDRESS);

const DEFAULT_TICKET: Ticket = {
  normals: [1, 2, 3, 4, 5],
  bonus: 7,
};

const DEMO_WINNING_TICKET: Ticket = {
  normals: [1, 2, 3, 8, 9],
  bonus: 7,
};

const TICKER_ITEMS = [
  "Serial AYR-048-1284 is live",
  "Ticket-inspired jackpot experience",
  "sreckovic won $270.13",
  "1,284 tickets sold",
  "Verifiable draw powered by MagicBlock VRF",
];

function formatUsd(value: number, cents = false) {
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: cents ? 2 : 0,
    minimumFractionDigits: cents ? 2 : 0,
  })}`;
}

function sortedNumbers(numbers: number[]) {
  return [...numbers].sort((a, b) => a - b);
}

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function shortenSignature(signature: string) {
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
}

function explorerTxUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Transaction failed. Check your wallet and try again.";
}

function walletReadyLabel(readyState: WalletReadyState) {
  if (readyState === WalletReadyState.Installed) {
    return "Installed";
  }
  if (readyState === WalletReadyState.Loadable) {
    return "Available";
  }
  if (readyState === WalletReadyState.Unsupported) {
    return "Unsupported";
  }
  return "Not installed";
}

function TicketBall({
  number,
  bonus = false,
  match = false,
  noMatch = false,
  large = false,
}: {
  number: number;
  bonus?: boolean;
  match?: boolean;
  noMatch?: boolean;
  large?: boolean;
}) {
  return (
    <span
      className={[
        "ticket-ball",
        bonus ? "bonus" : "",
        match ? "match" : "",
        noMatch ? "no-match" : "",
        large ? "large" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {number}
    </span>
  );
}

const WALLET_INSTALL_URLS: Record<string, string> = {
  Phantom: "https://phantom.app/",
  Solflare: "https://solflare.com/",
};

function AyaraPage({ providerError }: { providerError: string | null }) {
  const { connection } = useConnection();
  const {
    publicKey,
    connected,
    connecting,
    disconnect,
    select,
    sendTransaction,
    wallets,
  } = useWallet();
  const [roundId, setRoundId] = useState(INITIAL_ROUND_ID);
  const [status, setStatusState] = useState<RoundStatus>("open");
  const [ticketCount, setTicketCount] = useState(INITIAL_TICKETS);
  const [prizePool, setPrizePool] = useState(INITIAL_PRIZE_POOL);
  const [selectedNormals, setSelectedNormals] = useState<number[]>([
    ...DEFAULT_TICKET.normals,
  ]);
  const [selectedBonus, setSelectedBonus] = useState<number | null>(
    DEFAULT_TICKET.bonus,
  );
  const [myTicket, setMyTicket] = useState<Ticket | null>(null);
  const [winning, setWinning] = useState<Ticket | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [animationNonce, setAnimationNonce] = useState(0);
  const [numbersOpen, setNumbersOpen] = useState(false);
  const [fairnessAcknowledged, setFairnessAcknowledged] = useState(false);
  const [fairnessModalOpen, setFairnessModalOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [purchasePending, setPurchasePending] = useState(false);
  const [purchaseSignature, setPurchaseSignature] = useState<string | null>(
    null,
  );
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  const anyWalletInstalled = wallets.some(
    (w) => w.readyState === WalletReadyState.Installed,
  );
  const displayError = walletError ?? providerError;

  const walletConnected = connected && publicKey !== null;
  const walletAddress = publicKey?.toBase58() ?? null;

  const result = useMemo(() => {
    if (!myTicket || !winning) {
      return null;
    }

    const normalMatches = myTicket.normals.filter((number) =>
      winning.normals.includes(number),
    );
    const bonusMatch = myTicket.bonus === winning.bonus;
    const didWin = bonusMatch || normalMatches.length >= 3;

    return {
      normalMatches,
      bonusMatch,
      didWin,
    };
  }, [myTicket, winning]);

  const hasValidNumbers = selectedNormals.length === 5 && selectedBonus !== null;
  const hasPurchased = myTicket !== null;
  const canBuy =
    walletConnected &&
    status === "open" &&
    hasValidNumbers &&
    !hasPurchased &&
    !purchasePending;

  const playButtonLabel = useMemo(() => {
    if (!walletConnected) {
      return "Connect Wallet";
    }
    if (purchasePending) {
      return "Sending devnet transaction...";
    }
    if (hasPurchased) {
      return "Ticket Purchased";
    }
    if (status === "closed") {
      return "Round Closed";
    }
    if (status === "drawing") {
      return "VRF Draw Pending";
    }
    if (status === "settled") {
      return "Round Settled";
    }
    if (!hasValidNumbers) {
      return "Choose Numbers";
    }
    return "Buy 1 Ticket — $1";
  }, [
    hasPurchased,
    hasValidNumbers,
    purchasePending,
    status,
    walletConnected,
  ]);

  const selectedSummary = `${selectedNormals.length ? sortedNumbers(selectedNormals).join(" ") : "None"} + ${
    selectedBonus === null ? "-" : selectedBonus
  }`;
  const displayTicket: Ticket = myTicket ?? {
    normals: sortedNumbers(selectedNormals),
    bonus: selectedBonus ?? DEFAULT_TICKET.bonus,
  };
  const ticketStatusLabel = result?.didWin
    ? "WINNING TICKET"
    : myTicket
      ? "ACTIVE"
      : "READY TO PRINT";
  const ticketId = `AYARA-${String(roundId).padStart(3, "0")}-${
    purchaseSignature ? purchaseSignature.slice(0, 6).toUpperCase() : "DEMO01"
  }`;

  function setStatus(nextStatus: RoundStatus) {
    setStatusState(nextStatus);
    if (nextStatus !== "settled") {
      setWinning(null);
      setClaimed(false);
    }
  }

  function toggleNormal(number: number) {
    if (selectedNormals.includes(number)) {
      setSelectedNormals((current) =>
        current.filter((item) => item !== number),
      );
      return;
    }

    if (selectedNormals.length === 5) {
      return;
    }

    setSelectedNormals((current) => sortedNumbers([...current, number]));
  }

  function quickPick() {
    setSelectedNormals([...DEFAULT_TICKET.normals]);
    setSelectedBonus(DEFAULT_TICKET.bonus);
  }

  async function chooseWallet(walletName: WalletName) {
    setWalletError(null);
    const walletInfo = wallets.find((w) => w.adapter.name === walletName);
    if (!walletInfo) return;
    select(walletName);
    setWalletConnecting(true);
    try {
      await walletInfo.adapter.connect();
      setWalletMenuOpen(false);
    } catch (error) {
      setWalletError(getErrorMessage(error));
    } finally {
      setWalletConnecting(false);
    }
  }

  async function toggleWallet() {
    if (walletConnected) {
      await disconnect();
      setWalletMenuOpen(false);
      setWalletError(null);
      return;
    }

    setWalletMenuOpen((open) => !open);
  }

  async function playTicket() {
    if (!walletConnected) {
      setWalletMenuOpen(true);
      return;
    }

    if (!canBuy || !publicKey) {
      return;
    }

    setPurchasePending(true);
    setPurchaseError(null);
    setPurchaseSignature(null);

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: DEVNET_TREASURY,
          lamports: BUY_AMOUNT_LAMPORTS,
        }),
      );
      const latestBlockhash =
        await connection.getLatestBlockhash("confirmed");

      transaction.feePayer = publicKey;
      transaction.recentBlockhash = latestBlockhash.blockhash;

      const signature = await sendTransaction(transaction, connection);

      await connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed",
      );

      setPurchaseSignature(signature);
      setMyTicket({
        normals: [...DEFAULT_TICKET.normals],
        bonus: DEFAULT_TICKET.bonus,
      });
      setSelectedNormals([...DEFAULT_TICKET.normals]);
      setSelectedBonus(DEFAULT_TICKET.bonus);
      setTicketCount((count) => count + 1);
      setPrizePool((pool) => pool + TICKET_PRICE);
    } catch (error) {
      setPurchaseError(getErrorMessage(error));
    } finally {
      setPurchasePending(false);
    }
  }

  function settleWithNumbers(normals: number[], bonus: number) {
    setStatusState("settled");
    setWinning({
      normals: sortedNumbers(normals),
      bonus,
    });
    setAnimationNonce((nonce) => nonce + 1);
  }

  function mockSettle() {
    settleWithNumbers(DEMO_WINNING_TICKET.normals, DEMO_WINNING_TICKET.bonus);
  }

  async function resetDemo() {
    if (walletConnected) {
      await disconnect().catch(() => undefined);
    }
    setRoundId(INITIAL_ROUND_ID);
    setStatusState("open");
    setTicketCount(INITIAL_TICKETS);
    setPrizePool(INITIAL_PRIZE_POOL);
    setSelectedNormals([...DEFAULT_TICKET.normals]);
    setSelectedBonus(DEFAULT_TICKET.bonus);
    setMyTicket(null);
    setWinning(null);
    setClaimed(false);
    setNumbersOpen(false);
    setFairnessAcknowledged(false);
    setFairnessModalOpen(false);
    setWalletMenuOpen(false);
    setWalletConnecting(false);
    setWalletError(null);
    setPurchasePending(false);
    setPurchaseSignature(null);
    setPurchaseError(null);
  }

  function renderTicketHeader() {
    return (
      <>
        <div className="ticket-brand-row">
          <div>
            <span className="ticket-logo">Ayara</span>
            <span>Ticket-Inspired Jackpot Entry</span>
          </div>
          <span
            className={`ticket-status-stamp ${
              result?.didWin ? "is-winning" : myTicket ? "is-active" : "is-preview"
            }`}
          >
            {ticketStatusLabel}
          </span>
        </div>
        <div className="ticket-meta-grid">
          <div>
            <span>Draw Date</span>
            <strong>{DRAW_DATE}</strong>
          </div>
          <div>
            <span>Ticket ID</span>
            <strong>{ticketId}</strong>
          </div>
          <div>
            <span>Ticket Price</span>
            <strong>{formatUsd(TICKET_PRICE)}</strong>
          </div>
          <div>
            <span>Ticket Serial</span>
            <strong>{DRAW_SERIAL}</strong>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="activity-ticker" aria-label="Recent activity">
        <div className="ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => (
            <span className="ticker-item" key={`${item}-${index}`}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <header className="topbar" aria-label="Ayara header">
        <a className="brand" href="#" aria-label="Ayara home">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span>
            <span className="brand-word">Ayara</span>
            <span className="brand-tagline">
              A verifiable jackpot draw on Solana
            </span>
          </span>
        </a>

        <nav className="page-nav" aria-label="Page navigation">
          <a href="#play">Play</a>
          <a href="#results">Draw Results</a>
          <a href="#prize-tiers">Prize Tiers</a>
        </nav>

        <div className="header-actions">
          <span className="network-badge">Devnet</span>
          <div className="wallet-connect">
          <button
            className={`wallet-button ${walletConnected ? "is-connected" : ""}`}
            onClick={toggleWallet}
            type="button"
          >
            {walletConnected && walletAddress ? (
              <span className="mono">{shortenAddress(walletAddress)}</span>
            ) : connecting || walletConnecting ? (
              "Connecting..."
            ) : (
              "Connect Wallet"
            )}
          </button>

          {walletMenuOpen && !walletConnected ? (
            <div className="wallet-menu" role="menu">
              <div className="wallet-menu-title">Choose wallet</div>
              {!anyWalletInstalled ? (
                <p className="wallet-no-wallet">
                  No Solana wallet detected. Install{" "}
                  <a href={WALLET_INSTALL_URLS["Phantom"]} rel="noreferrer" target="_blank">
                    Phantom
                  </a>{" "}
                  or{" "}
                  <a href={WALLET_INSTALL_URLS["Solflare"]} rel="noreferrer" target="_blank">
                    Solflare
                  </a>{" "}
                  and refresh the page.
                </p>
              ) : null}
              {wallets.map((walletOption) => {
                const readyLabel = walletReadyLabel(walletOption.readyState);
                const notInstalled =
                  walletOption.readyState === WalletReadyState.Unsupported ||
                  walletOption.readyState === WalletReadyState.NotDetected;
                const installUrl =
                  WALLET_INSTALL_URLS[walletOption.adapter.name];

                if (notInstalled && installUrl) {
                  return (
                    <a
                      className="wallet-install-link"
                      href={installUrl}
                      key={walletOption.adapter.name}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span>{walletOption.adapter.name}</span>
                      <span>Install →</span>
                    </a>
                  );
                }

                return (
                  <button
                    disabled={notInstalled}
                    key={walletOption.adapter.name}
                    onClick={() => chooseWallet(walletOption.adapter.name)}
                    role="menuitem"
                    type="button"
                  >
                    <span>{walletOption.adapter.name}</span>
                    <span>{readyLabel}</span>
                  </button>
                );
              })}
              {displayError ? (
                <p className="wallet-error">{displayError}</p>
              ) : null}
            </div>
          ) : null}
          </div>
        </div>
      </header>

      <main className="page-shell">
        <section className="jackpot-hero" aria-labelledby="prizeTitle">
          <div className="hero-content">
            <div className="ticket-stamp-row" aria-label="Current draw details">
              <span>Serial {DRAW_SERIAL}</span>
              <span>Round #{String(roundId).padStart(3, "0")}</span>
              <span>Draw Date {DRAW_DATE}</span>
            </div>

            <div className="eyebrow">Current Draw</div>
            <p className="hero-prize-label">First Prize</p>
            <h1 className="prize-heading" id="prizeTitle">
              {formatUsd(FIRST_PRIZE)}
            </h1>
            <p className="tagline">Demo Seeded Jackpot</p>

            <div className="draw-board" aria-label="Current draw board">
              <div>
                <span>Tickets Sold</span>
                <strong>{ticketCount.toLocaleString("en-US")}</strong>
              </div>
              <div>
                <span>Ticket Sales</span>
                <strong>{formatUsd(prizePool)}</strong>
              </div>
              <div>
                <span>Ticket Price</span>
                <strong>{formatUsd(TICKET_PRICE)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{STATUS_LABELS[status]}</strong>
              </div>
            </div>

            <p className="round-subcopy">{ROUND_COPY[status]}</p>

            <div className="demo-label-row" aria-label="Demo disclosure">
              <span>Demo settlement enabled</span>
              <span>Settlement is mocked for hackathon reliability</span>
              <span>Production path: MagicBlock VRF</span>
            </div>

            <div className="hero-actions" aria-label="Quick links">
              <a href="#play">Choose Numbers</a>
              <a href="#results">Draw Results</a>
              <a href="#prize-tiers">Prize Tiers</a>
            </div>
          </div>
        </section>

        <section className="play-section" id="play" aria-labelledby="playTitle">
          <article className="panel play-card">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">Ticket Picker</div>
                <h2 id="playTitle">Choose Your Numbers</h2>
              </div>
              <span className="price-pill">Ticket Price · $1</span>
            </div>

            <div className="ticket-preview" aria-label="Ticket preview">
              <div className="ticket-preview-top">
                <span>Main Numbers</span>
                <button
                  className="mini-button"
                  disabled={status !== "open" || hasPurchased || purchasePending}
                  onClick={quickPick}
                  type="button"
                >
                  Quick Pick
                </button>
              </div>

              <div className="preview-balls">
                {selectedNormals.map((number) => (
                  <TicketBall key={number} large number={number} />
                ))}
                {selectedBonus !== null ? (
                  <TicketBall bonus large number={selectedBonus} />
                ) : null}
              </div>

              <div className="preview-meta">
                <div>
                  <span>Main Numbers</span>
                  <strong>Pick 5</strong>
                </div>
                <div>
                  <span>Bonus Ball</span>
                  <strong>Pick 1</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{STATUS_LABELS[status]}</strong>
                </div>
              </div>
            </div>

            <button
              className="primary-button play-button"
              disabled={purchasePending || (walletConnected && !canBuy)}
              onClick={playTicket}
              type="button"
            >
              {playButtonLabel}
            </button>

            <div className="transaction-status" aria-live="polite">
              <p>
                Buy ticket uses a real Solana devnet transaction
                <span>Actual demo payment: {BUY_AMOUNT_SOL} SOL</span>
              </p>
              {purchaseSignature ? (
                <a
                  href={explorerTxUrl(purchaseSignature)}
                  rel="noreferrer"
                  target="_blank"
                >
                  View devnet transaction{" "}
                  <span className="mono">
                    {shortenSignature(purchaseSignature)}
                  </span>
                </a>
              ) : null}
              {purchaseError ? (
                <p className="transaction-error">{purchaseError}</p>
              ) : null}
            </div>

            <p className="play-note">
              One ticket = one dollar. The demo transaction uses 0.001 SOL on
              Solana Devnet.
            </p>

            <div className="number-drawer">
              <button
                className="drawer-toggle"
                onClick={() => setNumbersOpen((open) => !open)}
                type="button"
              >
                <span>Choose Your Numbers</span>
                <strong>{numbersOpen ? "Hide" : "Open"}</strong>
              </button>

              {numbersOpen ? (
                <div className="drawer-content">
                  <div className="picker-group">
                    <div className="picker-label">
                      <span>Main Numbers</span>
                      <span className="count-chip">
                        Pick 5 · {selectedNormals.length}/5
                      </span>
                    </div>
                    <div className="number-grid normal-grid">
                      {Array.from({ length: 20 }, (_, index) => index + 1).map(
                        (number) => {
                          const selected = selectedNormals.includes(number);
                          return (
                            <button
                              aria-pressed={selected}
                              className={`number-button ${selected ? "selected" : ""}`}
                              disabled={
                                status !== "open" ||
                                hasPurchased ||
                                purchasePending
                              }
                              key={number}
                              onClick={() => toggleNormal(number)}
                              type="button"
                            >
                              {number}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>

                  <div className="picker-group">
                    <div className="picker-label">
                      <span>Bonus Ball</span>
                      <span className="count-chip gold-chip">
                        Pick 1 · {selectedBonus === null ? 0 : 1}/1
                      </span>
                    </div>
                    <div className="number-grid bonus-grid">
                      {Array.from({ length: 10 }, (_, index) => index + 1).map(
                        (number) => {
                          const selected = selectedBonus === number;
                          return (
                            <button
                              aria-pressed={selected}
                              className={`number-button bonus ${selected ? "selected" : ""}`}
                              disabled={
                                status !== "open" ||
                                hasPurchased ||
                                purchasePending
                              }
                              key={number}
                              onClick={() =>
                                setSelectedBonus((current) =>
                                  current === number ? null : number,
                                )
                              }
                              type="button"
                            >
                              {number}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>

                  <div className="ticket-summary">
                    <div>
                      <span className="summary-label">Selection</span>
                      <span className="summary-value">{selectedSummary}</span>
                    </div>
                    <div>
                      <span className="summary-label">Price</span>
                      <span className="summary-value mono">
                        {formatUsd(TICKET_PRICE)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        </section>

        <section className="results-section" id="results" aria-label="Results">
          <article className="draw-strip" aria-labelledby="drawTitle">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Draw Results</div>
                <h2 id="drawTitle">
                  {winning ? "Winning Numbers" : "Waiting for draw"}
                </h2>
              </div>
              <button
                className={`vrf-badge ${winning || status === "drawing" ? "" : "is-muted"}`}
                onClick={() => setFairnessModalOpen(true)}
                type="button"
              >
                {winning
                  ? "Demo Settlement"
                  : status === "drawing"
                    ? "MagicBlock VRF pending"
                    : "MagicBlock VRF pending"}
              </button>
            </div>

            <div
              className="draw-stage"
              aria-live="polite"
              data-animation={animationNonce}
            >
              {status === "drawing" ? (
                <div className="draw-pending">
                  <span className="draw-loader" aria-hidden="true" />
                  <span>
                    Waiting for draw
                    <strong>MagicBlock VRF pending</strong>
                  </span>
                </div>
              ) : winning ? (
                [...winning.normals, winning.bonus].map((number, index) => (
                  <span
                    className={`draw-ball ${index === 5 ? "bonus" : ""}`}
                    key={`${animationNonce}-${number}-${index}`}
                    style={{ animationDelay: `${index * 190}ms` }}
                  >
                    {number}
                  </span>
                ))
              ) : (
                <div className="draw-placeholder">
                  {status === "closed" ? "Waiting for draw" : "Waiting for draw"}
                </div>
              )}
            </div>

            {winning ? (
              <>
                <div className="winning-summary">
                  <div>
                    <span>Winning Numbers</span>
                    <strong>{winning.normals.join(" ")}</strong>
                  </div>
                  <div>
                    <span>Bonus Ball</span>
                    <strong>{winning.bonus}</strong>
                  </div>
                </div>
                <p className="mock-disclosure">
                  Demo Settlement
                  <span>Production path: MagicBlock VRF</span>
                </p>
              </>
            ) : null}
          </article>

          <article className="panel result-panel" aria-labelledby="ticketTitle">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">My Ticket</div>
                <h2 id="ticketTitle">
                  {result?.didWin ? "Winning Ticket" : "My Ticket"}
                </h2>
              </div>
              <span
                className={[
                  "result-state",
                  claimed
                    ? "state-claimed"
                    : result?.didWin
                      ? "state-win"
                      : result
                        ? "state-lose"
                        : "state-waiting",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {claimed
                  ? "Claimed"
                  : result?.didWin
                    ? "WIN"
                    : result
                      ? "LOSE"
                      : myTicket
                        ? status === "drawing"
                          ? "Drawing"
                          : status === "closed"
                            ? "Waiting"
                            : "Entered"
                        : "No ticket"}
              </span>
            </div>

            <div className="ticket-view">
              {!myTicket ? (
                <>
                  {renderTicketHeader()}
                  <div className="ticket-block">
                    <h3>Main Numbers</h3>
                    <div className="ticket-balls">
                      {displayTicket.normals.map((number) => (
                        <TicketBall key={number} number={number} />
                      ))}
                    </div>
                  </div>
                  <div className="ticket-block">
                    <h3>Bonus Ball</h3>
                    <div className="ticket-balls">
                      <TicketBall bonus number={displayTicket.bonus} />
                    </div>
                  </div>
                  <div className="barcode-strip" aria-hidden="true" />
                  <p className="result-copy">
                    Selected numbers preview. Buy 1 Ticket — $1 to print this
                    ticket.
                  </p>
                </>
              ) : !winning ? (
                <>
                  {renderTicketHeader()}
                  <div className="ticket-block">
                    <h3>Main Numbers</h3>
                    <div className="ticket-balls">
                      {myTicket.normals.map((number) => (
                        <TicketBall key={number} number={number} />
                      ))}
                    </div>
                  </div>
                  <div className="ticket-block">
                    <h3>Bonus Ball</h3>
                    <div className="ticket-balls">
                      <TicketBall bonus number={myTicket.bonus} />
                    </div>
                  </div>
                  <div className="barcode-strip" aria-hidden="true" />
                  <p className="result-copy">Result unlocks after settlement.</p>
                  {purchaseSignature ? (
                    <p className="ticket-tx">
                      Ticket purchased on devnet{" "}
                      <a
                        href={explorerTxUrl(purchaseSignature)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {shortenSignature(purchaseSignature)}
                      </a>
                    </p>
                  ) : null}
                </>
              ) : result ? (
                <>
                  {renderTicketHeader()}
                  <div className="ticket-block">
                    <h3>Main Numbers</h3>
                    <div className="ticket-balls">
                      {myTicket.normals.map((number) => {
                        const isMatch = result.normalMatches.includes(number);
                        return (
                          <TicketBall
                            key={number}
                            match={isMatch}
                            noMatch={!isMatch}
                            number={number}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="ticket-block">
                    <h3>Bonus Ball</h3>
                    <div className="ticket-balls">
                      <TicketBall
                        bonus
                        match={result.bonusMatch}
                        number={myTicket.bonus}
                      />
                    </div>
                  </div>
                  <div className="ticket-block">
                    <h3>Winning Numbers</h3>
                    <div className="ticket-balls">
                      {winning.normals.map((number) => (
                        <TicketBall
                          key={number}
                          match={myTicket.normals.includes(number)}
                          number={number}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="ticket-block">
                    <h3>Bonus Ball</h3>
                    <div className="ticket-balls">
                      <TicketBall
                        bonus
                        match={result.bonusMatch}
                        number={winning.bonus}
                      />
                    </div>
                  </div>
                  <div className="barcode-strip" aria-hidden="true" />
                  {result.didWin ? (
                    <p className="result-copy result-win-copy">
                      <strong>Matched {result.normalMatches.length} numbers + bonus ball</strong>
                      <span>Prize Tier: Demo Prize</span>
                      <span>Claimable: {formatUsd(CLAIM_AMOUNT, true)}</span>
                      <span className="jackpot-note">(Jackpot requires 5 numbers + bonus ball = {formatUsd(FIRST_PRIZE)})</span>
                    </p>
                  ) : (
                    <p className="result-copy">
                      <strong>{result.normalMatches.length}</strong> normal
                      match{result.normalMatches.length === 1 ? "" : "es"} and{" "}
                      <strong>
                        {result.bonusMatch
                          ? "bonus ball matched"
                          : "bonus ball missed"}
                      </strong>
                      .
                    </p>
                  )}
                  {purchaseSignature ? (
                    <p className="ticket-tx">
                      Ticket transaction{" "}
                      <a
                        href={explorerTxUrl(purchaseSignature)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {shortenSignature(purchaseSignature)}
                      </a>
                    </p>
                  ) : null}
                  {result.didWin ? (
                    <>
                      <div className="claim-row">
                        <span
                          className={claimed ? "claimed-mark" : "claim-amount"}
                        >
                          {claimed
                            ? "Prize claimed"
                            : `Claimable: ${formatUsd(CLAIM_AMOUNT, true)}`}
                        </span>
                        <button
                          className="claim-button"
                          disabled={claimed}
                          onClick={() => setClaimed(true)}
                          type="button"
                        >
                          {claimed ? "Prize claimed" : "Claim Prize"}
                        </button>
                      </div>
                      {claimed ? (
                        <p className="claim-success">
                          Success: prize claim marked in demo state.
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          </article>

          <article
            className="panel prize-card"
            id="prize-tiers"
            aria-labelledby="prizeTiersTitle"
          >
            <div className="eyebrow">Prize Tiers</div>
            <h2 id="prizeTiersTitle">Prize Tiers</h2>
            <ul className="prize-tier-list">
              <li>
                <span>5 numbers + bonus ball</span>
                <strong>Jackpot</strong>
              </li>
              <li>
                <span>5 numbers</span>
                <strong>Second Prize</strong>
              </li>
              <li>
                <span>3+ numbers OR bonus ball</span>
                <strong>Demo Prize</strong>
              </li>
            </ul>
          </article>

          <article
            className="panel fairness-card"
            id="how-it-works"
            aria-labelledby="fairnessTitle"
          >
            <div className="eyebrow">How It Works</div>
            <h2 id="fairnessTitle">Verifiable Fairness</h2>
            <ol className="fairness-steps">
              <li>Tickets are locked before the draw</li>
              <li>MagicBlock VRF provides randomness</li>
              <li>Winning numbers settle on-chain</li>
              <li>Anyone can verify the result</li>
            </ol>
            <div className="fairness-actions">
              <button
                className="verify-button"
                onClick={() => setFairnessModalOpen(true)}
                type="button"
              >
                Verify Fairness
              </button>
              <button
                className={fairnessAcknowledged ? "is-acknowledged" : ""}
                onClick={() => setFairnessAcknowledged(true)}
                type="button"
              >
                {fairnessAcknowledged ? "Noted" : "Got it"}
              </button>
            </div>
          </article>
        </section>

        <section className="admin-panel" aria-labelledby="adminTitle">
          <div className="admin-heading">
            <div>
              <div className="eyebrow">HACKATHON DEMO</div>
              <h2 id="adminTitle">Demo Controls</h2>
            </div>
            <span className="admin-note">
              Demo settlement enabled &middot; Production path: MagicBlock VRF
            </span>
          </div>

          <div className="admin-actions" aria-label="Admin actions">
            <button
              className="admin-button"
              onClick={() => setStatus("closed")}
              type="button"
            >
              Close Draw
            </button>
            <button
              className="admin-button"
              onClick={() => setStatus("drawing")}
              type="button"
            >
              Request VRF
            </button>
            <button
              className="admin-button danger-admin"
              onClick={mockSettle}
              type="button"
            >
              Mock Settle
            </button>
            <button className="admin-button" onClick={resetDemo} type="button">
              Reset Demo
            </button>
          </div>
        </section>

        <p className="site-disclaimer">
          Hackathon prototype. Settlement is mocked for demo reliability.{" "}
          <span>Production randomness path: MagicBlock VRF.</span>
        </p>
      </main>

      <div className="debug-panel">
        <button
          className="debug-toggle"
          onClick={() => setDebugOpen((o) => !o)}
          type="button"
        >
          {debugOpen ? "▾" : "▸"} Wallet Debug
        </button>
        {debugOpen ? (
          <dl className="debug-list">
            <dt>Network</dt>
            <dd>Devnet</dd>
            <dt>Wallet extension</dt>
            <dd>{anyWalletInstalled ? "Installed" : "Not detected"}</dd>
            <dt>Connected</dt>
            <dd>{walletConnected ? "Yes" : "No"}</dd>
            <dt>Public key</dt>
            <dd className="mono">
              {walletAddress ?? "—"}
            </dd>
            <dt>Last error</dt>
            <dd className={displayError ? "debug-error" : ""}>
              {displayError ?? "—"}
            </dd>
          </dl>
        ) : null}
      </div>

      {fairnessModalOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => setFairnessModalOpen(false)}
          role="presentation"
        >
          <section
            aria-labelledby="fairnessModalTitle"
            aria-modal="true"
            className="fairness-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="eyebrow">Verifiable Fairness</div>
            <h2 id="fairnessModalTitle">Verifiable Fairness</h2>
            <ol className="fairness-steps">
              <li>Tickets are locked before the draw</li>
              <li>MagicBlock VRF provides randomness</li>
              <li>Winning numbers settle on-chain</li>
              <li>Anyone can verify the result</li>
            </ol>
            <p className="modal-footer">
              HACKATHON DEMO &middot; Demo settlement enabled &middot;
              Production path: MagicBlock VRF
            </p>
            <button
              className="primary-button modal-button"
              onClick={() => setFairnessModalOpen(false)}
              type="button"
            >
              Got it
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}

export default function Home() {
  const endpoint = useMemo(
    () => clusterApiUrl(WalletAdapterNetwork.Devnet),
    [],
  );
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet }),
    ],
    [],
  );

  const [providerError, setProviderError] = useState<string | null>(null);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        autoConnect
        wallets={wallets}
        onError={(error) => setProviderError(error.message)}
      >
        <AyaraPage providerError={providerError} />
      </WalletProvider>
    </ConnectionProvider>
  );
}
