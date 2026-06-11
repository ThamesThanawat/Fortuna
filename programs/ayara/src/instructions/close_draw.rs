use anchor_lang::prelude::*;
use crate::state::{GlobalConfig, Draw, DrawStatus};
use crate::errors::AyaraError;

pub fn handler(ctx: Context<CloseDraw>) -> Result<()> {
    let draw = &mut ctx.accounts.draw;
    let clock = Clock::get()?;

    require!(draw.status == DrawStatus::Open, AyaraError::DrawNotOpen);
    require!(draw.tickets_sold > 0, AyaraError::DrawNoTickets);

    draw.status = DrawStatus::Closed;
    draw.closed_slot = clock.slot;
    // ticket_commitment is now frozen — no more tickets can update it

    Ok(())
}

#[derive(Accounts)]
pub struct CloseDraw<'info> {
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

    #[account(
        constraint = authority.key() == global_config.authority @ AyaraError::Unauthorized
    )]
    pub authority: Signer<'info>,
}
