"use client";

import { useMemo, useState } from "react";

type RoundStatus = "open" | "closed" | "drawing" | "settled";
type Scenario =
  | "disconnected"
  | "open"
  | "closed"
  | "drawing"
  | "win"
  | "lose"
  | "claimed";

type Ticket = {
  normals: number[];
  bonus: number;
};

const ROUND_COPY: Record<RoundStatus, string> = {
  open: "Buy a $1 ticket. The round closes. VRF draws the winner on-chain.",
  closed: "Round closed. Awaiting the VRF draw.",
  drawing: "Requesting MagicBlock VRF randomness for on-chain settlement...",
  settled: "Winning numbers drawn and settled on-chain.",
};

const STATUS_LABELS: Record<RoundStatus, string> = {
  open: "Open",
  closed: "Closed",
  drawing: "VRF Requested",
  settled: "Settled",
};

const DEMO_ADDRESS = "7fK2MZJq5W4b1xR3NDmNf9sMZPaV8HqRcU91";
const PROOF_TX =
  "https://explorer.solana.com/tx/5mAGicB1ockVRFProof111111111111111111111111111111?cluster=devnet";

const DEFAULT_TICKET: Ticket = {
  normals: [3, 7, 11, 15, 19],
  bonus: 6,
};

const TICKER_ITEMS = [
  "0x7e...1201 bought 1 ticket",
  "sreckovic won $270.13",
  "1,284 tickets this round",
  "VRF draw pending",
];

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function sortedNumbers(numbers: number[]) {
  return [...numbers].sort((a, b) => a - b);
}

function pickUnique(count: number, max: number) {
  const pool = Array.from({ length: max }, (_, index) => index + 1);
  const chosen: number[] = [];

  while (chosen.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(index, 1)[0]);
  }

  return sortedNumbers(chosen);
}

function makeWinningForTicket(ticket: Ticket, shouldWin: boolean): Ticket {
  if (shouldWin) {
    const matches = ticket.normals.slice(0, 3);
    const fillers = Array.from({ length: 20 }, (_, index) => index + 1)
      .filter((number) => !ticket.normals.includes(number))
      .slice(0, 2);
    return {
      normals: sortedNumbers([...matches, ...fillers]),
      bonus: ticket.bonus === 10 ? 9 : ticket.bonus,
    };
  }

  const normals = Array.from({ length: 20 }, (_, index) => index + 1)
    .filter((number) => !ticket.normals.includes(number))
    .slice(0, 5);
  const bonus = ticket.bonus === 1 ? 2 : 1;
  return { normals, bonus };
}

function TicketBall({
  number,
  bonus = false,
  match = false,
  large = false,
}: {
  number: number;
  bonus?: boolean;
  match?: boolean;
  large?: boolean;
}) {
  return (
    <span
      className={[
        "ticket-ball",
        bonus ? "bonus" : "",
        match ? "match" : "",
        large ? "large" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {number}
    </span>
  );
}

export default function Home() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [roundId, setRoundId] = useState(48);
  const [status, setStatusState] = useState<RoundStatus>("open");
  const [ticketCount, setTicketCount] = useState(1284);
  const [prizePool, setPrizePool] = useState(1284);
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
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [numbersOpen, setNumbersOpen] = useState(false);
  const [customQuantityOpen, setCustomQuantityOpen] = useState(false);
  const [fairnessAcknowledged, setFairnessAcknowledged] = useState(false);

  const ticketPrice = 1;
  const fixedPrize = 25;
  const balance = 12.482;
  const totalPrice = ticketQuantity * ticketPrice;

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
  const canBuy = walletConnected && status === "open" && hasValidNumbers;

  const playButtonLabel = useMemo(() => {
    if (!walletConnected) {
      return "Connect Wallet to Play";
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
    return `Buy ${ticketQuantity} Ticket${ticketQuantity === 1 ? "" : "s"} - ${formatUsd(
      totalPrice,
    )}`;
  }, [hasValidNumbers, status, ticketQuantity, totalPrice, walletConnected]);

  const selectedSummary = `${selectedNormals.length ? sortedNumbers(selectedNormals).join(" ") : "None"} + ${
    selectedBonus === null ? "-" : selectedBonus
  }`;

  function setTicketQuantityClamped(nextQuantity: number) {
    if (!Number.isFinite(nextQuantity)) {
      return;
    }
    setTicketQuantity(Math.min(99, Math.max(1, Math.round(nextQuantity))));
  }

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
    setSelectedNormals(pickUnique(5, 20));
    setSelectedBonus(Math.floor(Math.random() * 10) + 1);
  }

  function playTicket() {
    if (!walletConnected) {
      setWalletConnected(true);
      return;
    }

    if (!canBuy || selectedBonus === null) {
      return;
    }

    setMyTicket({
      normals: sortedNumbers(selectedNormals),
      bonus: selectedBonus,
    });
    setTicketCount((count) => count + ticketQuantity);
    setPrizePool((pool) => pool + totalPrice);
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
    if (myTicket) {
      settleWithNumbers(pickUnique(5, 20), Math.floor(Math.random() * 10) + 1);
      return;
    }

    settleWithNumbers([2, 7, 12, 16, 19], 6);
  }

  function createRound() {
    setRoundId((id) => id + 1);
    setStatusState("open");
    setTicketCount(0);
    setPrizePool(0);
    setSelectedNormals([...DEFAULT_TICKET.normals]);
    setSelectedBonus(DEFAULT_TICKET.bonus);
    setMyTicket(null);
    setWinning(null);
    setClaimed(false);
    setTicketQuantity(1);
    setNumbersOpen(false);
  }

  function setScenario(scenario: Scenario) {
    setWalletConnected(scenario !== "disconnected");
    setSelectedNormals([...DEFAULT_TICKET.normals]);
    setSelectedBonus(DEFAULT_TICKET.bonus);
    setMyTicket(
      ["win", "lose", "claimed"].includes(scenario)
        ? {
            normals: [...DEFAULT_TICKET.normals],
            bonus: DEFAULT_TICKET.bonus,
          }
        : null,
    );
    setClaimed(false);
    setNumbersOpen(false);

    if (scenario === "disconnected" || scenario === "open") {
      setStatusState("open");
      setWinning(null);
    } else if (scenario === "closed") {
      setStatusState("closed");
      setWinning(null);
    } else if (scenario === "drawing") {
      setStatusState("drawing");
      setWinning(null);
    } else if (scenario === "win") {
      setStatusState("settled");
      setWinning(makeWinningForTicket(DEFAULT_TICKET, true));
      setAnimationNonce((nonce) => nonce + 1);
    } else if (scenario === "lose") {
      setStatusState("settled");
      setWinning(makeWinningForTicket(DEFAULT_TICKET, false));
      setAnimationNonce((nonce) => nonce + 1);
    } else if (scenario === "claimed") {
      setStatusState("settled");
      setWinning(makeWinningForTicket(DEFAULT_TICKET, true));
      setClaimed(true);
      setAnimationNonce((nonce) => nonce + 1);
    }
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

      <header className="topbar" aria-label="Fortuna header">
        <a className="brand" href="#" aria-label="Fortuna home">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span className="brand-word">Fortuna</span>
        </a>

        <nav className="page-nav" aria-label="Page navigation">
          <a href="#play">Play</a>
          <a href="#results">Results</a>
          <a href="#how-it-works">How It Works</a>
        </nav>

        <button
          className={`wallet-button ${walletConnected ? "is-connected" : ""}`}
          onClick={() => setWalletConnected((connected) => !connected)}
          type="button"
        >
          {walletConnected ? (
            <>
              <span className="mono">{truncateAddress(DEMO_ADDRESS)}</span>
              <span className="wallet-balance">{balance.toFixed(2)} SOL</span>
            </>
          ) : (
            "Connect Wallet"
          )}
        </button>
      </header>

      <main className="page-shell">
        <section className="jackpot-hero" aria-labelledby="prizeTitle">
          <div className="hero-content">
            <div className="hero-meta-row">
              <span className={`status-pill status-${status}`}>
                <span className="status-dot" aria-hidden="true" />
                {STATUS_LABELS[status]}
              </span>
              <span>Round #{String(roundId).padStart(3, "0")}</span>
              <span>{ticketCount.toLocaleString("en-US")} tickets</span>
            </div>

            <div className="eyebrow">Prize Pool</div>
            <h1 className="prize-heading" id="prizeTitle">
              {formatUsd(prizePool)}
            </h1>
            <p className="tagline">Where luck becomes verifiable.</p>
            <p className="protocol-line">
              A verifiable jackpot protocol on Solana, powered by MagicBlock
              VRF.
            </p>
            <p className="round-subcopy">{ROUND_COPY[status]}</p>
            <p className="demo-path-note">
              VRF path prepared &middot; Mock demo enabled
            </p>

            <div className="hero-actions" aria-label="Quick links">
              <a href="#play">Play Now</a>
              <a href="#how-it-works">How to Play</a>
              <a href="#results">Prize Tiers</a>
            </div>
          </div>
        </section>

        <section className="play-section" id="play" aria-labelledby="playTitle">
          <article className="panel play-card">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">Play</div>
                <h2 id="playTitle">Get your ticket</h2>
              </div>
              <span className="price-pill">$1 per ticket</span>
            </div>

            <div className="ticket-preview" aria-label="Ticket preview">
              <div className="ticket-preview-top">
                <span>Your Quick Pick</span>
                <button
                  className="mini-button"
                  disabled={status !== "open"}
                  onClick={quickPick}
                  type="button"
                >
                  Shuffle
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
                  <span>Draw status</span>
                  <strong>{STATUS_LABELS[status]}</strong>
                </div>
                <div>
                  <span>Draw time</span>
                  <strong>{status === "open" ? "After close" : "Pending"}</strong>
                </div>
                <div>
                  <span>Ticket</span>
                  <strong>$1</strong>
                </div>
              </div>
            </div>

            <div className="quantity-block" aria-label="Ticket quantity">
              <div className="quantity-label">
                <span>Tickets</span>
                <strong>{formatUsd(totalPrice)} total</strong>
              </div>
              <div className="quantity-control">
                <button
                  onClick={() => setTicketQuantityClamped(ticketQuantity - 1)}
                  type="button"
                >
                  -
                </button>
                <span>{ticketQuantity}</span>
                <button
                  onClick={() => setTicketQuantityClamped(ticketQuantity + 1)}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>

            <div className="quick-quantity-row" aria-label="Quick quantities">
              {[1, 5, 10].map((quantity) => (
                <button
                  className={ticketQuantity === quantity ? "is-selected" : ""}
                  key={quantity}
                  onClick={() => {
                    setCustomQuantityOpen(false);
                    setTicketQuantityClamped(quantity);
                  }}
                  type="button"
                >
                  {quantity}
                </button>
              ))}
              <button
                className={customQuantityOpen ? "is-selected" : ""}
                onClick={() => setCustomQuantityOpen((open) => !open)}
                type="button"
              >
                Custom
              </button>
            </div>

            {customQuantityOpen ? (
              <label className="custom-quantity">
                <span>Custom ticket quantity</span>
                <input
                  inputMode="numeric"
                  max={99}
                  min={1}
                  onChange={(event) =>
                    setTicketQuantityClamped(Number(event.target.value))
                  }
                  type="number"
                  value={ticketQuantity}
                />
              </label>
            ) : null}

            <button
              className="primary-button play-button"
              disabled={walletConnected && !canBuy}
              onClick={playTicket}
              type="button"
            >
              {playButtonLabel}
            </button>

            <p className="play-note">
              One ticket = one dollar. Pick numbers yourself, or let Fortuna
              quick pick for you.
            </p>

            <div className="number-drawer">
              <button
                className="drawer-toggle"
                onClick={() => setNumbersOpen((open) => !open)}
                type="button"
              >
                <span>Choose numbers</span>
                <strong>{numbersOpen ? "Hide" : "Open"}</strong>
              </button>

              {numbersOpen ? (
                <div className="drawer-content">
                  <div className="picker-group">
                    <div className="picker-label">
                      <span>Normal numbers</span>
                      <span className="count-chip">
                        {selectedNormals.length}/5
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
                              disabled={status !== "open"}
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
                      <span>Bonusball</span>
                      <span className="count-chip gold-chip">
                        {selectedBonus === null ? 0 : 1}/1
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
                              disabled={status !== "open"}
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
                        {formatUsd(totalPrice)}
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
                <div className="eyebrow">Results</div>
                <h2 id="drawTitle">Winning numbers</h2>
              </div>
              <a
                className={`vrf-badge ${winning || status === "drawing" ? "" : "is-muted"}`}
                href={
                  winning ? PROOF_TX : "https://explorer.solana.com/?cluster=devnet"
                }
                target="_blank"
                rel="noreferrer"
              >
                {winning
                  ? "Verified by MagicBlock VRF"
                  : status === "drawing"
                    ? "MagicBlock VRF requested"
                    : status === "closed"
                      ? "MagicBlock VRF ready"
                      : "MagicBlock VRF pending"}
              </a>
            </div>

            <div
              className="draw-stage"
              aria-live="polite"
              data-animation={animationNonce}
            >
              {status === "drawing" ? (
                <div className="draw-pending">
                  <span className="draw-loader" aria-hidden="true" />
                  <span>Requesting verifiable randomness...</span>
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
                  {status === "closed" ? "Awaiting draw" : "Draw pending"}
                </div>
              )}
            </div>
          </article>

          <article className="panel result-panel" aria-labelledby="ticketTitle">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">My ticket</div>
                <h2 id="ticketTitle">Result</h2>
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
                    ? "Win"
                    : result
                      ? "Lose"
                      : myTicket
                        ? status === "drawing"
                          ? "Drawing"
                          : status === "closed"
                            ? "Awaiting draw"
                            : "Entered"
                        : "No ticket"}
              </span>
            </div>

            <div className="ticket-view">
              {!myTicket ? (
                <p className="empty-state">
                  No ticket purchased for this round.
                </p>
              ) : !winning ? (
                <>
                  <div className="ticket-block">
                    <h3>Your numbers</h3>
                    <div className="ticket-balls">
                      {myTicket.normals.map((number) => (
                        <TicketBall key={number} number={number} />
                      ))}
                      <TicketBall bonus number={myTicket.bonus} />
                    </div>
                  </div>
                  <p className="result-copy">Result unlocks after settlement.</p>
                </>
              ) : result ? (
                <>
                  <div className="ticket-block">
                    <h3>Your numbers</h3>
                    <div className="ticket-balls">
                      {myTicket.normals.map((number) => (
                        <TicketBall
                          key={number}
                          match={result.normalMatches.includes(number)}
                          number={number}
                        />
                      ))}
                      <TicketBall
                        bonus
                        match={result.bonusMatch}
                        number={myTicket.bonus}
                      />
                    </div>
                  </div>
                  <div className="ticket-block">
                    <h3>Winning numbers</h3>
                    <div className="ticket-balls">
                      {winning.normals.map((number) => (
                        <TicketBall
                          key={number}
                          match={myTicket.normals.includes(number)}
                          number={number}
                        />
                      ))}
                      <TicketBall
                        bonus
                        match={result.bonusMatch}
                        number={winning.bonus}
                      />
                    </div>
                  </div>
                  <p className="result-copy">
                    <strong>{result.normalMatches.length}</strong> normal match
                    {result.normalMatches.length === 1 ? "" : "es"} and{" "}
                    <strong>
                      {result.bonusMatch
                        ? "bonusball matched"
                        : "bonusball missed"}
                    </strong>
                    .
                  </p>
                  {result.didWin ? (
                    claimed ? (
                      <div className="claim-row">
                        <span className="claimed-mark">Prize claimed</span>
                        <span className="claim-amount">
                          {formatUsd(fixedPrize)}
                        </span>
                      </div>
                    ) : (
                      <div className="claim-row">
                        <span className="claim-amount">
                          {formatUsd(fixedPrize)}
                        </span>
                        <button
                          className="claim-button"
                          onClick={() => setClaimed(true)}
                          type="button"
                        >
                          Claim Prize
                        </button>
                      </div>
                    )
                  ) : null}
                </>
              ) : null}
            </div>
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
              <a href={PROOF_TX} target="_blank" rel="noreferrer">
                Verify Fairness
              </a>
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
              <div className="eyebrow">Hackathon POC</div>
              <h2 id="adminTitle">Demo Controls</h2>
            </div>
            <span className="admin-note">
              VRF path prepared &middot; Mock demo enabled
            </span>
          </div>

          <div className="admin-actions" aria-label="Admin actions">
            <button className="admin-button" onClick={createRound} type="button">
              Create Round
            </button>
            <button
              className="admin-button"
              onClick={() => setStatus("closed")}
              type="button"
            >
              Close Round
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
              Mock Settle (dev only)
            </button>
          </div>

          <div className="scenario-row" aria-label="State previews">
            {(
              [
                ["disconnected", "Wallet disconnected"],
                ["open", "Round open"],
                ["closed", "Round closed"],
                ["drawing", "VRF requested"],
                ["win", "Settled win"],
                ["lose", "Settled lose"],
                ["claimed", "Prize claimed"],
              ] as const
            ).map(([scenario, label]) => (
              <button
                className="scenario-button"
                key={scenario}
                onClick={() => setScenario(scenario)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
