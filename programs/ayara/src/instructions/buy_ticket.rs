use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{GlobalConfig, Draw, DrawStatus, Ticket};
use crate::errors::AyaraError;

pub fn handler(ctx: Context<BuyTicket>, main_numbers: [u8; 5], bonus_ball: u8) -> Result<()> {
    // ── Validate numbers ──────────────────────────────────────────────────
    // Main numbers: unique, 1–20
    for &n in &main_numbers {
        require!(n >= 1 && n <= 20, AyaraError::MainNumberOutOfRange);
    }
    // Check uniqueness
    for i in 0..5 {
        for j in (i + 1)..5 {
            require!(main_numbers[i] != main_numbers[j], AyaraError::DuplicateMainNumbers);
        }
    }
    // Bonus ball: 1–10
    require!(bonus_ball >= 1 && bonus_ball <= 10, AyaraError::BonusBallOutOfRange);

    // ── Validate draw state ───────────────────────────────────────────────
    let draw = &mut ctx.accounts.draw;
    require!(draw.status == DrawStatus::Open, AyaraError::DrawNotOpen);

    // ── Payment: transfer ticket price to treasury ────────────────────────
    let config = &ctx.accounts.global_config;
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, config.ticket_price_lamports)?;

    // ── Update draw state ─────────────────────────────────────────────────
    let ticket_index = draw.tickets_sold;
    draw.tickets_sold += 1;
    draw.ticket_sales_lamports += config.ticket_price_lamports;

    // Rolling ticket commitment: hash(prev_commitment || ticket_pubkey || numbers)
    let ticket_key = ctx.accounts.ticket.key();
    let mut commitment_input = Vec::new();
    commitment_input.extend_from_slice(&draw.ticket_commitment);
    commitment_input.extend_from_slice(ticket_key.as_ref());
    commitment_input.extend_from_slice(&main_numbers);
    commitment_input.push(bonus_ball);
    draw.ticket_commitment = anchor_lang::solana_program::hash::hash(&commitment_input).to_bytes();

    // ── Write ticket ──────────────────────────────────────────────────────
    let clock = Clock::get()?;
    let ticket = &mut ctx.accounts.ticket;
    ticket.draw_id = draw.draw_id;
    ticket.ticket_index = ticket_index;
    ticket.owner = ctx.accounts.buyer.key();
    ticket.main_numbers = main_numbers;
    ticket.bonus_ball = bonus_ball;
    ticket.purchased_slot = clock.slot;
    ticket.claimed = false;
    ticket.bump = ctx.bumps.ticket;

    Ok(())
}

#[derive(Accounts)]
#[instruction(main_numbers: [u8; 5], bonus_ball: u8)]
pub struct BuyTicket<'info> {
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
        init,
        payer = buyer,
        space = Ticket::LEN,
        seeds = [
            b"ticket",
            draw.draw_id.to_le_bytes().as_ref(),
            draw.tickets_sold.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub ticket: Account<'info, Ticket>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: treasury from config, just receives lamports
    #[account(
        mut,
        address = global_config.treasury
    )]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
