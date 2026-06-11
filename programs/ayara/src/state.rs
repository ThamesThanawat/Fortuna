use anchor_lang::prelude::*;

// ─── GlobalConfig ────────────────────────────────────────────────────────────
// Seeds: ["global_config"]
// One per deployment. Stores protocol-level settings.

#[account]
pub struct GlobalConfig {
    pub authority: Pubkey,       // admin who can create/close/settle draws
    pub treasury: Pubkey,        // receives ticket sales
    pub ticket_price_lamports: u64,
    pub current_draw_id: u64,
    pub bump: u8,
}

impl GlobalConfig {
    // 8 (discriminator) + 32 + 32 + 8 + 8 + 1
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

// ─── Draw ────────────────────────────────────────────────────────────────────
// Seeds: ["draw", draw_id.to_le_bytes()]
// One per lottery round.

#[account]
pub struct Draw {
    pub draw_id: u64,
    pub authority: Pubkey,
    pub status: DrawStatus,
    pub ticket_price_lamports: u64,
    pub tickets_sold: u32,
    pub ticket_sales_lamports: u64,
    pub opened_slot: u64,
    pub closed_slot: u64,
    pub settled_slot: u64,
    // Ticket commitment — rolling hash of ticket set, frozen at close
    pub ticket_commitment: [u8; 32],
    // Winning result — zero until settled
    pub winning_main_numbers: [u8; 5],
    pub winning_bonus_ball: u8,
    pub bump: u8,
}

impl Draw {
    pub const LEN: usize = 8   // discriminator
        + 8    // draw_id
        + 32   // authority
        + 1    // status (enum)
        + 8    // ticket_price_lamports
        + 4    // tickets_sold
        + 8    // ticket_sales_lamports
        + 8    // opened_slot
        + 8    // closed_slot
        + 8    // settled_slot
        + 32   // ticket_commitment
        + 5    // winning_main_numbers
        + 1    // winning_bonus_ball
        + 1;   // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum DrawStatus {
    Open,
    Closed,
    Settled,
    Cancelled,
}

// ─── Ticket ──────────────────────────────────────────────────────────────────
// Seeds: ["ticket", draw_id.to_le_bytes(), ticket_index.to_le_bytes()]
// One per ticket purchase. POC: 1 account per ticket.

#[account]
pub struct Ticket {
    pub draw_id: u64,
    pub ticket_index: u32,
    pub owner: Pubkey,
    pub main_numbers: [u8; 5],
    pub bonus_ball: u8,
    pub purchased_slot: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl Ticket {
    pub const LEN: usize = 8   // discriminator
        + 8    // draw_id
        + 4    // ticket_index
        + 32   // owner
        + 5    // main_numbers
        + 1    // bonus_ball
        + 8    // purchased_slot
        + 1    // claimed
        + 1;   // bump
}
