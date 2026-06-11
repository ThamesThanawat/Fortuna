use anchor_lang::prelude::*;

declare_id!("8DjFVVLZAHxYAobiko9t7cXAmJ2QJMn5nU9M8ykzqvGj");

pub mod instructions;
pub mod state;
pub mod errors;

use instructions::*;

#[program]
pub mod ayara {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        ticket_price_lamports: u64,
    ) -> Result<()> {
        instructions::initialize_config::handler(ctx, ticket_price_lamports)
    }

    pub fn create_draw(ctx: Context<CreateDraw>, draw_id: u64) -> Result<()> {
        instructions::create_draw::handler(ctx, draw_id)
    }

    pub fn buy_ticket(
        ctx: Context<BuyTicket>,
        main_numbers: [u8; 5],
        bonus_ball: u8,
    ) -> Result<()> {
        instructions::buy_ticket::handler(ctx, main_numbers, bonus_ball)
    }

    pub fn close_draw(ctx: Context<CloseDraw>) -> Result<()> {
        instructions::close_draw::handler(ctx)
    }

    pub fn mock_settle_draw(ctx: Context<MockSettleDraw>) -> Result<()> {
        instructions::mock_settle_draw::handler(ctx)
    }

    pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
        instructions::claim_prize::handler(ctx)
    }
}
