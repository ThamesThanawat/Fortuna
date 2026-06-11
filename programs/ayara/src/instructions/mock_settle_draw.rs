use anchor_lang::prelude::*;
use crate::state::{GlobalConfig, Draw, DrawStatus};
use crate::errors::AyaraError;

// ─────────────────────────────────────────────────────────────────────────────
// DEMO ONLY — mock_settle_draw
//
// Hardcodes winning numbers for demo reliability.
// This instruction is INTENTIONALLY separated from callback_settle_draw
// (the real MagicBlock VRF path) so the two cannot be confused.
//
// Production flow:
//   close_draw → request_vrf_for_draw → callback_settle_draw (MagicBlock signer)
//
// Demo flow:
//   close_draw → mock_settle_draw (authority signer)
// ─────────────────────────────────────────────────────────────────────────────

/// Demo winning numbers — match default ticket [1,2,3,4,5] + bonus 7
/// Result: 3 matches (1,2,3) + bonus ball → WINNER → $270.13
pub const DEMO_WINNING_MAIN: [u8; 5] = [1, 2, 3, 8, 9];
pub const DEMO_WINNING_BONUS: u8 = 7;

pub fn handler(ctx: Context<MockSettleDraw>) -> Result<()> {
    let draw = &mut ctx.accounts.draw;
    let clock = Clock::get()?;

    // Accept Closed or (future) VrfRequested status for demo flexibility
    require!(
        draw.status == DrawStatus::Closed,
        AyaraError::DrawNotClosed
    );
    require!(
        draw.status != DrawStatus::Settled,
        AyaraError::DrawAlreadySettled
    );

    // Shared settlement logic — same function production VRF callback will use
    settle_draw(draw, DEMO_WINNING_MAIN, DEMO_WINNING_BONUS, clock.slot);

    Ok(())
}

/// Core settlement — called by both mock and (future) real VRF callback
pub fn settle_draw(draw: &mut Draw, winning_main: [u8; 5], winning_bonus: u8, slot: u64) {
    draw.winning_main_numbers = winning_main;
    draw.winning_bonus_ball = winning_bonus;
    draw.status = DrawStatus::Settled;
    draw.settled_slot = slot;
}

#[derive(Accounts)]
pub struct MockSettleDraw<'info> {
    #[account(
        seeds = [b"global_config"],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"draw", draw.draw_id.to_le_bytes().as_ref()],
        bump = draw.bump
    )]
    pub draw: Account<'info, Draw>,

    // Authority must sign — this is NOT callable by any random user
    #[account(
        constraint = authority.key() == global_config.authority @ AyaraError::Unauthorized
    )]
    pub authority: Signer<'info>,
}
