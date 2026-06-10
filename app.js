const ROUND_COPY = {
  open: "Ticket sales are open on Solana Devnet.",
  closed: "Ticket sales are closed. Awaiting draw.",
  drawing: "Requesting verifiable randomness from MagicBlock VRF...",
  settled: "Round settled with verifiable randomness."
};

const DEMO_ADDRESS = "7fK2MZJq5W4b1xR3NDmNf9sMZPaV8HqRcU91";
const PROOF_TX =
  "https://explorer.solana.com/tx/5mAGicB1ockVRFProof111111111111111111111111111111?cluster=devnet";

const state = {
  walletConnected: false,
  roundId: 48,
  status: "open",
  ticketPrice: 0.1,
  ticketCount: 1284,
  prizePool: 128.4,
  selectedNormals: [],
  selectedBonus: null,
  myTicket: null,
  winning: null,
  claimed: false,
  balance: 12.482,
  fixedPrize: 2.5,
  animationNonce: 0
};

const els = {
  walletButton: document.querySelector("#walletButton"),
  roundNumber: document.querySelector("#roundNumber"),
  statusPill: document.querySelector("#statusPill"),
  roundSubcopy: document.querySelector("#roundSubcopy"),
  ticketPrice: document.querySelector("#ticketPrice"),
  ticketCount: document.querySelector("#ticketCount"),
  prizePool: document.querySelector("#prizePool"),
  vrfBadge: document.querySelector("#vrfBadge"),
  drawStage: document.querySelector("#drawStage"),
  normalGrid: document.querySelector("#normalGrid"),
  bonusGrid: document.querySelector("#bonusGrid"),
  normalCount: document.querySelector("#normalCount"),
  bonusCount: document.querySelector("#bonusCount"),
  quickPickButton: document.querySelector("#quickPickButton"),
  selectionSummary: document.querySelector("#selectionSummary"),
  buyButton: document.querySelector("#buyButton"),
  disableReason: document.querySelector("#disableReason"),
  resultState: document.querySelector("#resultState"),
  ticketView: document.querySelector("#ticketView"),
  createRoundButton: document.querySelector("#createRoundButton"),
  closeRoundButton: document.querySelector("#closeRoundButton"),
  requestVrfButton: document.querySelector("#requestVrfButton"),
  mockSettleButton: document.querySelector("#mockSettleButton")
};

function formatSol(value) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function truncateAddress(address) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function sortedNumbers(numbers) {
  return [...numbers].sort((a, b) => a - b);
}

function pickUnique(count, max) {
  const pool = Array.from({ length: max }, (_, index) => index + 1);
  const chosen = [];

  while (chosen.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(index, 1)[0]);
  }

  return sortedNumbers(chosen);
}

function setStatus(status) {
  state.status = status;
  if (status !== "settled") {
    state.winning = null;
    state.claimed = false;
  }
  render();
}

function createNumberButtons() {
  for (let number = 1; number <= 20; number += 1) {
    const button = document.createElement("button");
    button.className = "number-button";
    button.type = "button";
    button.textContent = number;
    button.dataset.number = String(number);
    button.addEventListener("click", () => toggleNormal(number));
    els.normalGrid.append(button);
  }

  for (let number = 1; number <= 10; number += 1) {
    const button = document.createElement("button");
    button.className = "number-button bonus";
    button.type = "button";
    button.textContent = number;
    button.dataset.bonus = String(number);
    button.addEventListener("click", () => {
      state.selectedBonus = state.selectedBonus === number ? null : number;
      render();
    });
    els.bonusGrid.append(button);
  }
}

function toggleNormal(number) {
  if (state.selectedNormals.includes(number)) {
    state.selectedNormals = state.selectedNormals.filter((item) => item !== number);
    render();
    return;
  }

  if (state.selectedNormals.length === 5) {
    return;
  }

  state.selectedNormals = sortedNumbers([...state.selectedNormals, number]);
  render();
}

function quickPick() {
  state.selectedNormals = pickUnique(5, 20);
  state.selectedBonus = Math.floor(Math.random() * 10) + 1;
  render();
}

function buyTicket() {
  if (!canBuy()) {
    return;
  }

  state.myTicket = {
    normals: sortedNumbers(state.selectedNormals),
    bonus: state.selectedBonus
  };
  state.ticketCount += 1;
  state.prizePool += state.ticketPrice;
  render();
}

function canBuy() {
  return (
    state.walletConnected &&
    state.status === "open" &&
    state.selectedNormals.length === 5 &&
    state.selectedBonus !== null
  );
}

function getDisableReason() {
  if (!state.walletConnected) {
    return "Connect wallet to buy.";
  }
  if (state.status === "closed") {
    return "Round closed. Awaiting draw.";
  }
  if (state.status === "drawing") {
    return "Requesting verifiable randomness...";
  }
  if (state.status === "settled") {
    return "Round settled.";
  }
  if (state.selectedNormals.length !== 5 || state.selectedBonus === null) {
    return "Select 5 numbers and 1 bonusball.";
  }
  return "";
}

function settleWithNumbers(normals, bonus) {
  state.status = "settled";
  state.winning = {
    normals: sortedNumbers(normals),
    bonus
  };
  state.animationNonce += 1;
  render();
}

function mockSettle() {
  if (state.myTicket) {
    settleWithNumbers(pickUnique(5, 20), Math.floor(Math.random() * 10) + 1);
    return;
  }

  settleWithNumbers([2, 7, 12, 16, 19], 6);
}

function makeWinningForTicket(ticket, shouldWin) {
  if (shouldWin) {
    const matches = ticket.normals.slice(0, 3);
    const fillers = Array.from({ length: 20 }, (_, index) => index + 1)
      .filter((number) => !ticket.normals.includes(number))
      .slice(0, 2);
    return {
      normals: sortedNumbers([...matches, ...fillers]),
      bonus: ticket.bonus === 10 ? 9 : ticket.bonus
    };
  }

  const normals = Array.from({ length: 20 }, (_, index) => index + 1)
    .filter((number) => !ticket.normals.includes(number))
    .slice(0, 5);
  const bonus = ticket.bonus === 1 ? 2 : 1;
  return { normals, bonus };
}

function setScenario(scenario) {
  const defaultTicket = {
    normals: [3, 7, 11, 15, 19],
    bonus: 6
  };

  state.walletConnected = scenario !== "disconnected";
  state.selectedNormals = [...defaultTicket.normals];
  state.selectedBonus = defaultTicket.bonus;
  state.myTicket = ["win", "lose", "claimed"].includes(scenario)
    ? { normals: [...defaultTicket.normals], bonus: defaultTicket.bonus }
    : null;
  state.claimed = false;

  if (scenario === "disconnected") {
    state.status = "open";
    state.winning = null;
  } else if (scenario === "open") {
    state.status = "open";
    state.winning = null;
  } else if (scenario === "closed") {
    state.status = "closed";
    state.winning = null;
  } else if (scenario === "drawing") {
    state.status = "drawing";
    state.winning = null;
  } else if (scenario === "win") {
    state.status = "settled";
    state.winning = makeWinningForTicket(defaultTicket, true);
    state.animationNonce += 1;
  } else if (scenario === "lose") {
    state.status = "settled";
    state.winning = makeWinningForTicket(defaultTicket, false);
    state.animationNonce += 1;
  } else if (scenario === "claimed") {
    state.status = "settled";
    state.winning = makeWinningForTicket(defaultTicket, true);
    state.claimed = true;
    state.animationNonce += 1;
  }

  render();
}

function createRound() {
  state.roundId += 1;
  state.status = "open";
  state.ticketCount = 0;
  state.prizePool = 0;
  state.selectedNormals = [];
  state.selectedBonus = null;
  state.myTicket = null;
  state.winning = null;
  state.claimed = false;
  render();
}

function getResult() {
  if (!state.myTicket || !state.winning) {
    return null;
  }

  const normalMatches = state.myTicket.normals.filter((number) =>
    state.winning.normals.includes(number)
  );
  const bonusMatch = state.myTicket.bonus === state.winning.bonus;
  const didWin = bonusMatch || normalMatches.length >= 3;

  return {
    normalMatches,
    bonusMatch,
    didWin
  };
}

function ballHtml(number, options = {}) {
  const classes = ["ticket-ball"];
  if (options.bonus) classes.push("bonus");
  if (options.match) classes.push("match");
  return `<span class="${classes.join(" ")}">${number}</span>`;
}

function renderHeader() {
  if (state.walletConnected) {
    els.walletButton.classList.add("is-connected");
    els.walletButton.innerHTML = `
      <span class="mono">${truncateAddress(DEMO_ADDRESS)}</span>
      <span class="wallet-balance">${state.balance.toFixed(2)} SOL</span>
    `;
    return;
  }

  els.walletButton.classList.remove("is-connected");
  els.walletButton.textContent = "Connect Wallet";
}

function renderRound() {
  const labels = {
    open: "Open",
    closed: "Closed",
    drawing: "VRF Requested",
    settled: "Settled"
  };

  els.roundNumber.textContent = `#${String(state.roundId).padStart(3, "0")}`;
  els.roundSubcopy.textContent = ROUND_COPY[state.status];
  els.ticketPrice.textContent = state.ticketPrice.toFixed(2);
  els.ticketCount.textContent = state.ticketCount.toLocaleString("en-US");
  els.prizePool.textContent = formatSol(state.prizePool);
  els.statusPill.className = `status-pill status-${state.status}`;
  els.statusPill.innerHTML = `<span class="status-dot" aria-hidden="true"></span>${labels[state.status]}`;
}

function renderDraw() {
  if (state.status === "drawing") {
    els.vrfBadge.className = "vrf-badge";
    els.vrfBadge.textContent = "MagicBlock VRF requested";
    els.vrfBadge.href = "https://explorer.solana.com/?cluster=devnet";
    els.drawStage.innerHTML = `
      <div class="draw-pending">
        <span class="draw-loader" aria-hidden="true"></span>
        <span>Requesting verifiable randomness...</span>
      </div>
    `;
    return;
  }

  if (!state.winning) {
    els.vrfBadge.className = "vrf-badge is-muted";
    els.vrfBadge.textContent =
      state.status === "closed" ? "MagicBlock VRF ready" : "MagicBlock VRF pending";
    els.vrfBadge.href = "https://explorer.solana.com/?cluster=devnet";
    els.drawStage.innerHTML = `<div class="draw-placeholder">${
      state.status === "closed" ? "Awaiting draw" : "Draw pending"
    }</div>`;
    return;
  }

  els.vrfBadge.className = "vrf-badge";
  els.vrfBadge.textContent = "Verified by MagicBlock VRF";
  els.vrfBadge.href = PROOF_TX;

  const balls = [...state.winning.normals, state.winning.bonus]
    .map((number, index) => {
      const isBonus = index === 5;
      const delay = index * 190;
      return `<span class="draw-ball ${isBonus ? "bonus" : ""}" style="animation-delay:${delay}ms">${number}</span>`;
    })
    .join("");

  els.drawStage.dataset.animation = String(state.animationNonce);
  els.drawStage.innerHTML = balls;
}

function renderPicker() {
  const openForPicking = state.status === "open";

  els.normalGrid.querySelectorAll(".number-button").forEach((button) => {
    const number = Number(button.dataset.number);
    button.classList.toggle("selected", state.selectedNormals.includes(number));
    button.disabled = !openForPicking;
    button.setAttribute("aria-pressed", String(state.selectedNormals.includes(number)));
  });

  els.bonusGrid.querySelectorAll(".number-button").forEach((button) => {
    const number = Number(button.dataset.bonus);
    button.classList.toggle("selected", state.selectedBonus === number);
    button.disabled = !openForPicking;
    button.setAttribute("aria-pressed", String(state.selectedBonus === number));
  });

  els.quickPickButton.disabled = !openForPicking;
  els.normalCount.textContent = `${state.selectedNormals.length}/5`;
  els.bonusCount.textContent = `${state.selectedBonus === null ? 0 : 1}/1`;

  const normals = state.selectedNormals.length
    ? sortedNumbers(state.selectedNormals).join(" ")
    : "None";
  const bonus = state.selectedBonus === null ? "-" : state.selectedBonus;
  els.selectionSummary.textContent = `${normals} + ${bonus}`;

  els.buyButton.disabled = !canBuy();
  els.disableReason.textContent = getDisableReason();
}

function renderTicket() {
  const result = getResult();

  if (!state.myTicket) {
    els.resultState.className = "result-state state-waiting";
    els.resultState.textContent = "No ticket";
    els.ticketView.innerHTML = `<p class="empty-state">No ticket purchased for this round.</p>`;
    return;
  }

  if (!state.winning) {
    els.resultState.className = "result-state state-waiting";
    els.resultState.textContent =
      state.status === "drawing" ? "Drawing" : state.status === "closed" ? "Awaiting draw" : "Entered";
    els.ticketView.innerHTML = `
      <div class="ticket-block">
        <h3>Your numbers</h3>
        <div class="ticket-balls">
          ${state.myTicket.normals.map((number) => ballHtml(number)).join("")}
          ${ballHtml(state.myTicket.bonus, { bonus: true })}
        </div>
      </div>
      <p class="result-copy">Result unlocks after settlement.</p>
    `;
    return;
  }

  els.resultState.className = `result-state ${
    state.claimed ? "state-claimed" : result.didWin ? "state-win" : "state-lose"
  }`;
  els.resultState.textContent = state.claimed ? "Claimed" : result.didWin ? "Win" : "Lose";

  const ticketBalls = state.myTicket.normals
    .map((number) =>
      ballHtml(number, {
        match: result.normalMatches.includes(number)
      })
    )
    .join("");

  const winningBalls = state.winning.normals
    .map((number) =>
      ballHtml(number, {
        match: state.myTicket.normals.includes(number)
      })
    )
    .join("");

  const claimMarkup = result.didWin
    ? state.claimed
      ? `<div class="claim-row"><span class="claimed-mark">Prize claimed</span><span class="claim-amount">${state.fixedPrize.toFixed(
          3
        )} SOL</span></div>`
      : `<div class="claim-row"><span class="claim-amount">${state.fixedPrize.toFixed(
          3
        )} SOL</span><button class="claim-button" id="claimButton" type="button">Claim Prize</button></div>`
    : "";

  els.ticketView.innerHTML = `
    <div class="ticket-block">
      <h3>Your numbers</h3>
      <div class="ticket-balls">
        ${ticketBalls}
        ${ballHtml(state.myTicket.bonus, {
          bonus: true,
          match: result.bonusMatch
        })}
      </div>
    </div>
    <div class="ticket-block">
      <h3>Winning numbers</h3>
      <div class="ticket-balls">
        ${winningBalls}
        ${ballHtml(state.winning.bonus, {
          bonus: true,
          match: result.bonusMatch
        })}
      </div>
    </div>
    <p class="result-copy">
      <strong>${result.normalMatches.length}</strong> normal match${
        result.normalMatches.length === 1 ? "" : "es"
      } and <strong>${result.bonusMatch ? "bonusball matched" : "bonusball missed"}</strong>.
    </p>
    ${claimMarkup}
  `;

  const claimButton = document.querySelector("#claimButton");
  if (claimButton) {
    claimButton.addEventListener("click", () => {
      state.claimed = true;
      render();
    });
  }
}

function render() {
  renderHeader();
  renderRound();
  renderDraw();
  renderPicker();
  renderTicket();
}

function attachEvents() {
  els.walletButton.addEventListener("click", () => {
    state.walletConnected = !state.walletConnected;
    render();
  });

  els.quickPickButton.addEventListener("click", quickPick);
  els.buyButton.addEventListener("click", buyTicket);
  els.createRoundButton.addEventListener("click", createRound);
  els.closeRoundButton.addEventListener("click", () => setStatus("closed"));
  els.requestVrfButton.addEventListener("click", () => setStatus("drawing"));
  els.mockSettleButton.addEventListener("click", mockSettle);

  document.querySelectorAll(".scenario-button").forEach((button) => {
    button.addEventListener("click", () => setScenario(button.dataset.scenario));
  });
}

createNumberButtons();
attachEvents();
render();
