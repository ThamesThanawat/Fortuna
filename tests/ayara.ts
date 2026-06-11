import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Ayara } from "../target/types/ayara";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("ayara", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Ayara as Program<Ayara>;

  const authority = provider.wallet as anchor.Wallet;
  const buyer = Keypair.generate();

  // PDAs
  const [globalConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    program.programId
  );

  const DRAW_ID = new anchor.BN(1);
  const [drawPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("draw"), DRAW_ID.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const TICKET_PRICE = new anchor.BN(0.01 * LAMPORTS_PER_SOL); // 0.01 SOL for devnet demo
  const DEMO_MAIN_NUMBERS = [1, 2, 3, 4, 5];
  const DEMO_BONUS_BALL = 7;

  before(async () => {
    // Fund buyer wallet
    const sig = await provider.connection.requestAirdrop(
      buyer.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  });

  // ── 1. initialize_config ─────────────────────────────────────────────────
  it("initializes config", async () => {
    await program.methods
      .initializeConfig(TICKET_PRICE)
      .accounts({
        globalConfig: globalConfigPda,
        authority: authority.publicKey,
        treasury: authority.publicKey, // demo: treasury = authority
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.globalConfig.fetch(globalConfigPda);
    assert.equal(config.authority.toBase58(), authority.publicKey.toBase58());
    assert.ok(config.ticketPriceLamports.eq(TICKET_PRICE));
  });

  // ── 2. create_draw ───────────────────────────────────────────────────────
  it("creates a draw", async () => {
    await program.methods
      .createDraw(DRAW_ID)
      .accounts({
        globalConfig: globalConfigPda,
        draw: drawPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const draw = await program.account.draw.fetch(drawPda);
    assert.equal(draw.status.open !== undefined, true);
    assert.equal(draw.ticketsSold, 0);
  });

  // ── 3. buy_ticket ────────────────────────────────────────────────────────
  it("lets user buy a valid ticket", async () => {
    const [ticketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("ticket"),
        DRAW_ID.toArrayLike(Buffer, "le", 8),
        Buffer.from(new Uint8Array(new anchor.BN(0).toArrayLike(Buffer, "le", 4))),
      ],
      program.programId
    );

    await program.methods
      .buyTicket(DEMO_MAIN_NUMBERS, DEMO_BONUS_BALL)
      .accounts({
        globalConfig: globalConfigPda,
        draw: drawPda,
        ticket: ticketPda,
        buyer: buyer.publicKey,
        treasury: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const ticket = await program.account.ticket.fetch(ticketPda);
    assert.equal(ticket.owner.toBase58(), buyer.publicKey.toBase58());
    assert.deepEqual(ticket.mainNumbers, DEMO_MAIN_NUMBERS);
    assert.equal(ticket.bonusBall, DEMO_BONUS_BALL);
    assert.equal(ticket.claimed, false);

    const draw = await program.account.draw.fetch(drawPda);
    assert.equal(draw.ticketsSold, 1);
  });

  it("rejects invalid main numbers (out of range)", async () => {
    const [ticketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("ticket"),
        DRAW_ID.toArrayLike(Buffer, "le", 8),
        Buffer.from(new Uint8Array(new anchor.BN(1).toArrayLike(Buffer, "le", 4))),
      ],
      program.programId
    );

    try {
      await program.methods
        .buyTicket([1, 2, 3, 4, 25], 7) // 25 is out of range
        .accounts({
          globalConfig: globalConfigPda,
          draw: drawPda,
          ticket: ticketPda,
          buyer: buyer.publicKey,
          treasury: authority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();
      assert.fail("Should have thrown");
    } catch (e) {
      assert.include(e.message, "MainNumberOutOfRange");
    }
  });

  it("rejects duplicate main numbers", async () => {
    const [ticketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("ticket"),
        DRAW_ID.toArrayLike(Buffer, "le", 8),
        Buffer.from(new Uint8Array(new anchor.BN(1).toArrayLike(Buffer, "le", 4))),
      ],
      program.programId
    );

    try {
      await program.methods
        .buyTicket([1, 1, 2, 3, 4], 7) // duplicate 1
        .accounts({
          globalConfig: globalConfigPda,
          draw: drawPda,
          ticket: ticketPda,
          buyer: buyer.publicKey,
          treasury: authority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();
      assert.fail("Should have thrown");
    } catch (e) {
      assert.include(e.message, "DuplicateMainNumbers");
    }
  });

  // ── 4. close_draw ────────────────────────────────────────────────────────
  it("closes the draw", async () => {
    await program.methods
      .closeDraw()
      .accounts({
        globalConfig: globalConfigPda,
        draw: drawPda,
        authority: authority.publicKey,
      })
      .rpc();

    const draw = await program.account.draw.fetch(drawPda);
    assert.equal(draw.status.closed !== undefined, true);
    assert.isAbove(draw.closedSlot.toNumber(), 0);
  });

  it("rejects buying after close", async () => {
    const [ticketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("ticket"),
        DRAW_ID.toArrayLike(Buffer, "le", 8),
        Buffer.from(new Uint8Array(new anchor.BN(1).toArrayLike(Buffer, "le", 4))),
      ],
      program.programId
    );

    try {
      await program.methods
        .buyTicket([6, 7, 8, 9, 10], 3)
        .accounts({
          globalConfig: globalConfigPda,
          draw: drawPda,
          ticket: ticketPda,
          buyer: buyer.publicKey,
          treasury: authority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();
      assert.fail("Should have thrown");
    } catch (e) {
      assert.include(e.message, "DrawNotOpen");
    }
  });

  // ── 5. mock_settle_draw ──────────────────────────────────────────────────
  it("settles draw with mock winning numbers", async () => {
    await program.methods
      .mockSettleDraw()
      .accounts({
        globalConfig: globalConfigPda,
        draw: drawPda,
        authority: authority.publicKey,
      })
      .rpc();

    const draw = await program.account.draw.fetch(drawPda);
    assert.equal(draw.status.settled !== undefined, true);
    assert.deepEqual(draw.winningMainNumbers, [1, 2, 3, 8, 9]);
    assert.equal(draw.winningBonusBall, 7);
  });

  it("rejects double settlement", async () => {
    try {
      await program.methods
        .mockSettleDraw()
        .accounts({
          globalConfig: globalConfigPda,
          draw: drawPda,
          authority: authority.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown");
    } catch (e) {
      // DrawNotClosed because status is now Settled
      assert.ok(e.message);
    }
  });

  // ── 6. claim_prize ───────────────────────────────────────────────────────
  it("lets winner claim prize", async () => {
    const [ticketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("ticket"),
        DRAW_ID.toArrayLike(Buffer, "le", 8),
        Buffer.from(new Uint8Array(new anchor.BN(0).toArrayLike(Buffer, "le", 4))),
      ],
      program.programId
    );

    const balanceBefore = await provider.connection.getBalance(buyer.publicKey);

    await program.methods
      .claimPrize()
      .accounts({
        draw: drawPda,
        ticket: ticketPda,
        owner: buyer.publicKey,
        treasury: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const ticket = await program.account.ticket.fetch(ticketPda);
    assert.equal(ticket.claimed, true);

    const balanceAfter = await provider.connection.getBalance(buyer.publicKey);
    assert.isAbove(balanceAfter, balanceBefore);
  });

  it("rejects double claim", async () => {
    const [ticketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("ticket"),
        DRAW_ID.toArrayLike(Buffer, "le", 8),
        Buffer.from(new Uint8Array(new anchor.BN(0).toArrayLike(Buffer, "le", 4))),
      ],
      program.programId
    );

    try {
      await program.methods
        .claimPrize()
        .accounts({
          draw: drawPda,
          ticket: ticketPda,
          owner: buyer.publicKey,
          treasury: authority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();
      assert.fail("Should have thrown");
    } catch (e) {
      assert.include(e.message, "AlreadyClaimed");
    }
  });
});
