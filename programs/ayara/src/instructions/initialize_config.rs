use anchor_lang::prelude::*;
use crate::state::GlobalConfig;

pub fn handler(ctx: Context<InitializeConfig>, ticket_price_lamports: u64) -> Result<()> {
    let config = &mut ctx.accounts.global_config;
    config.authority = ctx.accounts.authority.key();
    config.treasury = ctx.accounts.treasury.key();
    config.ticket_price_lamports = ticket_price_lamports;
    config.current_draw_id = 0;
    config.bump = ctx.bumps.global_config;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = GlobalConfig::LEN,
        seeds = [b"global_config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: just stored as treasury address
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
