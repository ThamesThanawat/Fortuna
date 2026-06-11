const ROUND_COPY = {
  open: "Buy a $1 ticket. The round closes. VRF draws the winner on-chain.",
  closed: "Ticket set locked before randomness",
  drawing: "Requesting MagicBlock VRF randomness for on-chain settlement...",
  settled: "Winning numbers settled for the hackathon demo."
};

const STATUS_LABELS = {
  open: "Open",
  closed: "Closed",
  drawing: "VRF Requested",
  settled: "Settled"
};

const DEMO_ADDRESS = "0x7e...1201";
const INITIAL_ROUND_ID = 48;
const INITIAL_TICKETS = 1284;
const INITIAL_PRIZE_POOL = 1284;
const TICKET_PRICE = 1;
const CLAIM_AMOUNT = 270.13;
const DEFAULT_TICKET = {
  normals: [1, 2, 3, 4, 5],
  bonus: 7
};
const DEMO_WINNING_TICKET = {
  normals: [1, 2, 3, 8, 9],
  bonus: 7
};

const state = {
  walletConnected: false,
  roundId: INITIAL_ROUND_ID,
  status: "open",
  ticketCount: INITIAL_TICKETS,
  prizePool: INITIAL_PRIZE_POOL,
  selectedNormals: [...DEFAULT_TICKET.normals],
  selectedBonus: DEFAULT_TICKET.bonus,
  myTicket: null,
  winning: null,
  claimed: false,
  numbersOpen: false,
  fairnessAcknowledged: false,
  animationNonce: 0
};

const els = {
  walletButton: document.querySelector("#walletButton"),
  statusPill: document.querySelector("#statusPill"),
  roundNumber: document.querySelector("#roundNumber"),
  ticketCountHero: document.querySelector("#ticketCountHero"),
  prizePool: document.querySelector("#prizePool"),
  roundSubcopy: document.querySelector("#roundSubcopy"),
  previewBalls: document.querySelector("#previewBalls"),
  previewStatus: document.querySelector("#previewStatus"),
  previewTime: document.querySelector("#previewTime"),
  quickPickButton: document.querySelector("#quickPickButton"),
  playButton: document.querySelector("#playButton"),
  numbersToggle: document.querySelector("#numbersToggle"),
  numbersToggleLabel: document.querySelector("#numbersToggleLabel"),
  drawerContent: document.querySelector("#drawerContent"),
  normalGrid: document.querySelector("#normalGrid"),
  bonusGrid: document.querySelector("#bonusGrid"),
  normalCount: document.querySelector("#normalCount"),
  bonusCount: document.querySelector("#bonusCount"),
  selectionSummary: document.querySelector("#selectionSummary"),
  ticketSummaryPrice: document.querySelector("#ticketSummaryPrice"),
  vrfBadge: document.querySelector("#vrfBadge"),
  drawStage: document.querySelector("#drawStage"),
  resultState: document.querySelector("#resultState"),
  ticketView: document.querySelector("#ticketView"),
  verifyFairnessButton: document.querySelector("#verifyFairnessButton"),
  fairnessGotIt: document.querySelector("#fairnessGotIt"),
  fairnessModal: document.querySelector("#fairnessModal"),
  modalGotItButton: document.querySelector("#modalGotItButton"),
  closeRoundButton: document.querySelector("#closeRoundButton"),
  requestVrfButton: document.querySelector("#requestVrfButton"),
  mockSettleButton: document.querySelector("#mockSettleButton"),
  resetDemoButton: document.querySelector("#resetDemoButton")
};

function formatUsd(value, cents = false) {
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: cents ? 2 : 0,
    minimumFractionDigits: cents ? 2 : 0
  })}`;
}

function sortedNumbers(numbers) {
  return [...numbers].sort((a, b) => a - b);
}

function setStatus(status) {
  state.status = status;
  if (status !== "settled") {
    state.winning = null;
    state.claimed = false;
  }
  render();
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
  state.selectedNormals = [...DEFAULT_TICKET.normals];
  state.selectedBonus = DEFAULT_TICKET.bonus;
  render();
}

function canBuy() {
  return (
    state.walletConnected &&
    state.status === "open" &&
    state.selectedNormals.length === 5 &&
    state.selectedBonus !== null &&
    !state.myTicket
  );
}

function playTicket() {
  if (!state.walletConnected) {
    state.walletConnected = true;
    render();
    return;
  }

  if (!canBuy()) {
    return;
  }

  state.myTicket = {
    normals: [...DEFAULT_TICKET.normals],
    bonus: DEFAULT_TICKET.bonus
  };
  state.selectedNormals = [...DEFAULT_TICKET.normals];
  state.selectedBonus = DEFAULT_TICKET.bonus;
  state.ticketCount += 1;
  state.prizePool += TICKET_PRICE;
  render();
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
  settleWithNumbers(DEMO_WINNING_TICKET.normals, DEMO_WINNING_TICKET.bonus);
}

function resetDemo() {
  state.walletConnected = false;
  state.roundId = INITIAL_ROUND_ID;
  state.status = "open";
  state.ticketCount = INITIAL_TICKETS;
  state.prizePool = INITIAL_PRIZE_POOL;
  state.selectedNormals = [...DEFAULT_TICKET.normals];
  state.selectedBonus = DEFAULT_TICKET.bonus;
  state.myTicket = null;
  state.winning = null;
  state.claimed = false;
  state.numbersOpen = false;
  state.fairnessAcknowledged = false;
  els.fairnessModal.hidden = true;
  els.fairnessGotIt.classList.remove("is-acknowledged");
  els.fairnessGotIt.textContent = "Got it";
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
  if (options.large) classes.push("large");
  return `<span class="${classes.join(" ")}">${number}</span>`;
}

function renderHeader() {
  if (state.walletConnected) {
    els.walletButton.classList.add("is-connected");
    els.walletButton.innerHTML = `
      <span class="mono">${DEMO_ADDRESS}</span>
    `;
    return;
  }

  els.walletButton.classList.remove("is-connected");
  els.walletButton.textContent = "Connect Wallet";
}

function renderHero() {
  els.roundNumber.textContent = `#${String(state.roundId).padStart(3, "0")}`;
  els.ticketCountHero.textContent = state.ticketCount.toLocaleString("en-US");
  els.prizePool.textContent = formatUsd(state.prizePool);
  els.roundSubcopy.textContent = ROUND_COPY[state.status];
  els.statusPill.className = `status-pill status-${state.status}`;
  els.statusPill.innerHTML = `<span class="status-dot" aria-hidden="true"></span>${STATUS_LABELS[state.status]}`;
}

function renderPlayCard() {
  const hasValidNumbers =
    state.selectedNormals.length === 5 && state.selectedBonus !== null;

  els.previewBalls.innerHTML = `
    ${state.selectedNormals.map((number) => ballHtml(number, { large: true })).join("")}
    ${state.selectedBonus !== null ? ballHtml(state.selectedBonus, { bonus: true, large: true }) : ""}
  `;
  els.previewStatus.textContent = STATUS_LABELS[state.status];
  els.previewTime.textContent = state.status === "open" ? "After close" : "Pending";
  els.drawerContent.hidden = !state.numbersOpen;
  els.numbersToggleLabel.textContent = state.numbersOpen ? "Hide" : "Open";
  els.normalCount.textContent = `${state.selectedNormals.length}/5`;
  els.bonusCount.textContent = `${state.selectedBonus === null ? 0 : 1}/1`;
  els.selectionSummary.textContent = `${
    state.selectedNormals.length ? sortedNumbers(state.selectedNormals).join(" ") : "None"
  } + ${state.selectedBonus === null ? "-" : state.selectedBonus}`;
  els.ticketSummaryPrice.textContent = formatUsd(TICKET_PRICE);
  els.playButton.disabled = state.walletConnected && !canBuy();

  if (!state.walletConnected) {
    els.playButton.textContent = "Connect Wallet";
  } else if (state.myTicket) {
    els.playButton.textContent = "Ticket Purchased";
  } else if (state.status === "closed") {
    els.playButton.textContent = "Round Closed";
  } else if (state.status === "drawing") {
    els.playButton.textContent = "VRF Draw Pending";
  } else if (state.status === "settled") {
    els.playButton.textContent = "Round Settled";
  } else if (!hasValidNumbers) {
    els.playButton.textContent = "Choose Numbers";
  } else {
    els.playButton.textContent = "Buy 1 Ticket - $1";
  }
}

function renderDraw() {
  if (state.status === "drawing") {
    els.vrfBadge.className = "vrf-badge";
    els.vrfBadge.textContent = "MagicBlock VRF pending";
    els.drawStage.innerHTML = `
      <div class="draw-pending">
        <span class="draw-loader" aria-hidden="true"></span>
        <span>Draw pending<strong>MagicBlock VRF pending</strong></span>
      </div>
    `;
    return;
  }

  if (!state.winning) {
    els.vrfBadge.className = "vrf-badge is-muted";
    els.vrfBadge.textContent = "MagicBlock VRF pending";
    els.drawStage.innerHTML = `<div class="draw-placeholder">${
      state.status === "closed" ? "Awaiting draw" : "Draw pending"
    }</div>`;
    return;
  }

  els.vrfBadge.className = "vrf-badge";
  els.vrfBadge.textContent = "View fairness path";
  els.drawStage.dataset.animation = String(state.animationNonce);
  els.drawStage.innerHTML = `
    ${[...state.winning.normals, state.winning.bonus]
      .map((number, index) => {
        const isBonus = index === 5;
        return `<span class="draw-ball ${isBonus ? "bonus" : ""}" style="animation-delay:${
          index * 190
        }ms">${number}</span>`;
      })
      .join("")}
    <p class="mock-disclosure">
      Settled by mock demo randomness
      <span>Production path: MagicBlock VRF callback</span>
    </p>
  `;
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
  els.resultState.textContent = state.claimed ? "Claimed" : result.didWin ? "WIN" : "LOSE";

  const ticketBalls = state.myTicket.normals
    .map((number) => ballHtml(number, { match: result.normalMatches.includes(number) }))
    .join("");
  const winningBalls = state.winning.normals
    .map((number) => ballHtml(number, { match: state.myTicket.normals.includes(number) }))
    .join("");
  const claimMarkup = result.didWin
    ? state.claimed
      ? `<div class="claim-row"><span class="claimed-mark">Prize claimed</span><button class="claim-button" id="claimButton" type="button" disabled>Prize claimed</button></div><p class="claim-success">Success: prize claim marked in demo state.</p>`
      : `<div class="claim-row"><span class="claim-amount">Claimable: ${formatUsd(
          CLAIM_AMOUNT,
          true
        )}</span><button class="claim-button" id="claimButton" type="button">Claim Prize</button></div>`
    : "";
  const resultCopy = result.didWin
    ? `<p class="result-copy result-win-copy"><strong>WIN</strong><span>Matched 3 numbers + bonusball</span><span>Claimable: ${formatUsd(
        CLAIM_AMOUNT,
        true
      )}</span></p>`
    : `<p class="result-copy">
      <strong>${result.normalMatches.length}</strong> normal match${
        result.normalMatches.length === 1 ? "" : "es"
      } and <strong>${result.bonusMatch ? "bonusball matched" : "bonusball missed"}</strong>.
    </p>`;

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
    ${resultCopy}
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

function render() {
  renderHeader();
  renderHero();
  renderPlayCard();
  renderPicker();
  renderDraw();
  renderTicket();
}

function openFairnessModal() {
  els.fairnessModal.hidden = false;
}

function closeFairnessModal() {
  els.fairnessModal.hidden = true;
}

function attachEvents() {
  els.walletButton.addEventListener("click", () => {
    state.walletConnected = !state.walletConnected;
    render();
  });
  els.quickPickButton.addEventListener("click", quickPick);
  els.playButton.addEventListener("click", playTicket);
  els.numbersToggle.addEventListener("click", () => {
    state.numbersOpen = !state.numbersOpen;
    render();
  });
  els.vrfBadge.addEventListener("click", openFairnessModal);
  els.verifyFairnessButton.addEventListener("click", openFairnessModal);
  els.fairnessGotIt.addEventListener("click", () => {
    state.fairnessAcknowledged = true;
    els.fairnessGotIt.classList.add("is-acknowledged");
    els.fairnessGotIt.textContent = "Noted";
  });
  els.fairnessModal.addEventListener("click", (event) => {
    if (event.target === els.fairnessModal) {
      closeFairnessModal();
    }
  });
  els.modalGotItButton.addEventListener("click", closeFairnessModal);
  els.closeRoundButton.addEventListener("click", () => setStatus("closed"));
  els.requestVrfButton.addEventListener("click", () => setStatus("drawing"));
  els.mockSettleButton.addEventListener("click", mockSettle);
  els.resetDemoButton.addEventListener("click", resetDemo);
}

createNumberButtons();
attachEvents();
render();
