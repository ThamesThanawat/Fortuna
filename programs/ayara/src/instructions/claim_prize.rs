use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{Draw, DrawStatus, Ticket};
use crate::errors::AyaraError;

/// Demo prize amount in lamports
/// $270.13 at ~$150/SOL ≈ 0.0018 SOL = 1_800_000 lamports
/// For devnet demo, use a small fixed amount
pub const DEMO_PRIZE_LAMPORTS: u64 = 1_800_000;

pub fn handler(ctx: Context<ClaimPrize>) -> Result<()> {
    let draw = &ctx.accounts.draw;
    let ticket = &mut ctx.accounts.ticket;

    // ── Checks ────────────────────────────────────────────────────────────
    require!(draw.status == DrawStatus::Settled, AyaraError::DrawNotSettled);
    require!(ticket.owner == ctx.accounts.owner.key(), AyaraError::NotTicketOwner);
    require!(!ticket.claimed, AyaraError::AlreadyClaimed);

    // ── Win condition: 3+ main matches OR bonus ball matches ───────────────
    let main_matches = ticket
        .main_numbers
        .iter()
        .filter(|&&n| draw.winning_main_numbers.contains(&n))
        .count();
    let bonus_matches = ticket.bonus_ball == draw.winning_bonus_ball;

    require!(
        main_matches >= 3 || bonus_matches,
        AyaraError::NotAWinner
    );

    // ── Effects: mark claimed BEFORE transfer (checks-effects-interactions) ─
    ticket.claimed = true;

    // ── Transfer prize from treasury to winner ────────────────────────────
    // For demo: treasury must have enough SOL
    // Production: use a proper prize vault PDA
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.treasury.to_account_info(),
            to: ctx.accounts.owner.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, DEMO_PRIZE_LAMPORTS)?;

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(
        seeds = [b"draw", draw.draw_id.to_le_bytes().as_ref()],
        bump = draw.bump
    )]
    pub draw: Account<'info, Draw>,

    #[account(
        mut,
        seeds = [
            b"ticket",
            ticket.draw_id.to_le_bytes().as_ref(),
            ticket.ticket_index.to_le_bytes().as_ref()
        ],
        bump = ticket.bump,
        constraint = ticket.draw_id == draw.draw_id
    )]
    pub ticket: Account<'info, Ticket>,

    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: treasury that pays prizes — must be pre-funded for demo
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
