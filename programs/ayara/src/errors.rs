use anchor_lang::prelude::*;

#[error_code]
pub enum AyaraError {
    // Draw state errors
    #[msg("Draw is not open")]
    DrawNotOpen,
    #[msg("Draw is not closed")]
    DrawNotClosed,
    #[msg("Draw is not settled")]
    DrawNotSettled,
    #[msg("Draw already settled")]
    DrawAlreadySettled,
    #[msg("Draw has no tickets")]
    DrawNoTickets,

    // Ticket validation errors
    #[msg("Main numbers must be exactly 5")]
    InvalidMainNumbersCount,
    #[msg("Main numbers must be unique")]
    DuplicateMainNumbers,
    #[msg("Main numbers must be between 1 and 20")]
    MainNumberOutOfRange,
    #[msg("Bonus ball must be between 1 and 10")]
    BonusBallOutOfRange,

    // Claim errors
    #[msg("Ticket already claimed")]
    AlreadyClaimed,
    #[msg("Ticket is not a winner")]
    NotAWinner,
    #[msg("Signer is not ticket owner")]
    NotTicketOwner,

    // Auth errors
    #[msg("Unauthorized")]
    Unauthorized,

    // Payment errors
    #[msg("Insufficient payment")]
    InsufficientPayment,
}
