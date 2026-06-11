use anchor_lang::prelude::*;
use crate::state::{GlobalConfig, Draw, DrawStatus};
use crate::errors::AyaraError;

pub fn handler(ctx: Context<CreateDraw>, draw_id: u64) -> Result<()> {
    let config = &mut ctx.accounts.global_config;
    let draw = &mut ctx.accounts.draw;
    let clock = Clock::get()?;

    require!(
        ctx.accounts.authority.key() == config.authority,
        AyaraError::Unauthorized
    );

    draw.draw_id = draw_id;
    draw.authority = ctx.accounts.authority.key();
    draw.status = DrawStatus::Open;
    draw.ticket_price_lamports = config.ticket_price_lamports;
    draw.tickets_sold = 0;
    draw.ticket_sales_lamports = 0;
    draw.opened_slot = clock.slot;
    draw.closed_slot = 0;
    draw.settled_slot = 0;
    draw.ticket_commitment = [0u8; 32];
    draw.winning_main_numbers = [0u8; 5];
    draw.winning_bonus_ball = 0;
    draw.bump = ctx.bumps.draw;

    config.current_draw_id = draw_id;

    Ok(())
}

#[derive(Accounts)]
#[instruction(draw_id: u64)]
pub struct CreateDraw<'info> {
    #[account(
        mut,
        seeds = [b"global_config"],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = authority,
        space = Draw::LEN,
        seeds = [b"draw", draw_id.to_le_bytes().as_ref()],
        bump
    )]
    pub draw: Account<'info, Draw>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
