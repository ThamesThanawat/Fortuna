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
  open: "Ticket sales are open on Solana Devnet.",
  closed: "Ticket sales are closed. Awaiting draw.",
  drawing: "Requesting verifiable randomness from MagicBlock VRF...",
  settled: "Round settled with verifiable randomness.",
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

function formatSol(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
}: {
  number: number;
  bonus?: boolean;
  match?: boolean;
}) {
  return (
    <span
      className={[
        "ticket-ball",
        bonus ? "bonus" : "",
        match ? "match" : "",
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
  const [prizePool, setPrizePool] = useState(128.4);
  const [selectedNormals, setSelectedNormals] = useState<number[]>([]);
  const [selectedBonus, setSelectedBonus] = useState<number | null>(null);
  const [myTicket, setMyTicket] = useState<Ticket | null>(null);
  const [winning, setWinning] = useState<Ticket | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [animationNonce, setAnimationNonce] = useState(0);

  const ticketPrice = 0.1;
  const fixedPrize = 2.5;
  const balance = 12.482;

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

  const canBuy =
    walletConnected &&
    status === "open" &&
    selectedNormals.length === 5 &&
    selectedBonus !== null;

  const disableReason = useMemo(() => {
    if (!walletConnected) {
      return "Connect wallet to buy.";
    }
    if (status === "closed") {
      return "Round closed. Awaiting draw.";
    }
    if (status === "drawing") {
      return "Requesting verifiable randomness...";
    }
    if (status === "settled") {
      return "Round settled.";
    }
    if (selectedNormals.length !== 5 || selectedBonus === null) {
      return "Select 5 numbers and 1 bonusball.";
    }
    return "";
  }, [selectedBonus, selectedNormals.length, status, walletConnected]);

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

  function buyTicket() {
    if (!canBuy || selectedBonus === null) {
      return;
    }

    setMyTicket({
      normals: sortedNumbers(selectedNormals),
      bonus: selectedBonus,
    });
    setTicketCount((count) => count + 1);
    setPrizePool((pool) => pool + ticketPrice);
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
    setSelectedNormals([]);
    setSelectedBonus(null);
    setMyTicket(null);
    setWinning(null);
    setClaimed(false);
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

  const selectedSummary = `${selectedNormals.length ? sortedNumbers(selectedNormals).join(" ") : "None"} + ${
    selectedBonus === null ? "-" : selectedBonus
  }`;

  return (
    <>
      <header className="topbar" aria-label="Fortuna header">
        <a className="brand" href="#" aria-label="Fortuna home">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span className="brand-word">Fortuna</span>
        </a>

        <div className="network-pill" aria-label="Network">
          <span className="network-dot" aria-hidden="true" />
          Devnet
        </div>

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
        <section className="round-card" aria-labelledby="roundTitle">
          <div className="round-copy">
            <div className="eyebrow">Active round</div>
            <div className="round-title-line">
              <h1 id="roundTitle">
                Round <span>#{String(roundId).padStart(3, "0")}</span>
              </h1>
              <span className={`status-pill status-${status}`}>
                <span className="status-dot" aria-hidden="true" />
                {STATUS_LABELS[status]}
              </span>
            </div>
            <p className="round-subcopy">{ROUND_COPY[status]}</p>
          </div>

          <dl className="round-metrics" aria-label="Round details">
            <div className="metric">
              <dt>Ticket price</dt>
              <dd>{ticketPrice.toFixed(2)} SOL</dd>
            </div>
            <div className="metric">
              <dt>Tickets</dt>
              <dd>{ticketCount.toLocaleString("en-US")}</dd>
            </div>
            <div className="metric metric-prize">
              <dt>Prize pool</dt>
              <dd>{formatSol(prizePool)} SOL</dd>
            </div>
          </dl>
        </section>

        <section className="draw-strip" aria-labelledby="drawTitle">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Winning numbers</div>
              <h2 id="drawTitle">Draw</h2>
            </div>
            <a
              className={`vrf-badge ${winning || status === "drawing" ? "" : "is-muted"}`}
              href={winning ? PROOF_TX : "https://explorer.solana.com/?cluster=devnet"}
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
        </section>

        <section className="flow-grid" aria-label="Lottery flow">
          <article className="panel buy-panel" aria-labelledby="buyTitle">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">Buy ticket</div>
                <h2 id="buyTitle">Pick numbers</h2>
              </div>
              <button
                className="secondary-button"
                disabled={status !== "open"}
                onClick={quickPick}
                type="button"
              >
                Quick Pick
              </button>
            </div>

            <div className="picker-group">
              <div className="picker-label">
                <span>Normal numbers</span>
                <span className="count-chip">{selectedNormals.length}/5</span>
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
                <span className="summary-value mono">0.10 SOL</span>
              </div>
            </div>

            <button
              className="primary-button"
              disabled={!canBuy}
              onClick={buyTicket}
              type="button"
            >
              Buy Ticket
            </button>
            <p className="disable-reason">{disableReason}</p>
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
                          {fixedPrize.toFixed(3)} SOL
                        </span>
                      </div>
                    ) : (
                      <div className="claim-row">
                        <span className="claim-amount">
                          {fixedPrize.toFixed(3)} SOL
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
        </section>

        <section className="admin-panel" aria-labelledby="adminTitle">
          <div className="admin-heading">
            <div>
              <div className="eyebrow">Devnet only</div>
              <h2 id="adminTitle">Demo Admin Controls</h2>
            </div>
            <span className="admin-note">Local demo state</span>
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
