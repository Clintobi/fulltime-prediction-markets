use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TransferChecked};

declare_id!("37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW");

#[program]
pub mod fulltime {
    use super::*;

    pub fn create_market(
        ctx: Context<CreateMarket>,
        fixture_id: u64,
        market_type: MarketType,
        settle_authority: Pubkey,
    ) -> Result<()> {
        let m = &mut ctx.accounts.market;
        m.authority = ctx.accounts.authority.key();
        m.fixture_id = fixture_id;
        m.market_type = market_type;
        m.settle_authority = settle_authority;
        m.state = MarketState::Open;
        m.yes_amount = 0;
        m.no_amount = 0;
        m.resolution = None;
        m.bump = ctx.bumps.market;
        Ok(())
    }

    pub fn deposit_yes(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.market.state == MarketState::Open,
            MarketError::NotOpen
        );
        transfer_in(&ctx, amount)?;

        let user_key = ctx.accounts.user.key();
        let market_key = ctx.accounts.market.key();

        let m = &mut ctx.accounts.market;
        m.yes_amount = m.yes_amount.checked_add(amount).unwrap();

        let d = &mut ctx.accounts.deposit;
        d.owner = user_key;
        d.market = market_key;
        d.amount = d.amount.checked_add(amount).unwrap();
        d.is_yes = true;
        Ok(())
    }

    pub fn deposit_no(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.market.state == MarketState::Open,
            MarketError::NotOpen
        );
        transfer_in(&ctx, amount)?;

        let user_key = ctx.accounts.user.key();
        let market_key = ctx.accounts.market.key();

        let m = &mut ctx.accounts.market;
        m.no_amount = m.no_amount.checked_add(amount).unwrap();

        let d = &mut ctx.accounts.deposit;
        d.owner = user_key;
        d.market = market_key;
        d.amount = d.amount.checked_add(amount).unwrap();
        d.is_yes = false;
        Ok(())
    }

    pub fn settle(ctx: Context<Settle>, proof: SettlementProof) -> Result<()> {
        let settler = ctx.accounts.settler.key();
        require!(
            settler == ctx.accounts.market.settle_authority
                || settler == ctx.accounts.market.authority,
            MarketError::Unauthorized
        );
        require!(
            ctx.accounts.market.state == MarketState::Open,
            MarketError::NotOpen
        );

        // CPI to TxLINE's validateStatV2 — proves the score cryptographically.
        let ix = build_validate_stat_v2_ix(
            &ctx.accounts.txline_program.key(),
            &ctx.accounts.daily_scores_merkle_roots.key(),
            &proof,
        );
        invoke(
            &ix,
            &[
                ctx.accounts.daily_scores_merkle_roots.to_account_info(),
                ctx.accounts.txline_program.to_account_info(),
            ],
        )?;

        let market_type = ctx.accounts.market.market_type.clone();
        let resolution = match &market_type {
            MarketType::MatchWinner {
                team1_key,
                team2_key,
            } => {
                if proof.get_stat(*team1_key) > proof.get_stat(*team2_key) {
                    Outcome::Yes
                } else {
                    Outcome::No
                }
            }
            MarketType::OverUnder {
                stat_key,
                threshold,
            } => {
                if proof.get_stat(*stat_key) > *threshold {
                    Outcome::Yes
                } else {
                    Outcome::No
                }
            }
            MarketType::ExactScore { stat_key, target } => {
                if proof.get_stat(*stat_key) == *target {
                    Outcome::Yes
                } else {
                    Outcome::No
                }
            }
        };

        let m = &mut ctx.accounts.market;
        m.resolution = Some(resolution);
        m.state = MarketState::Settled;
        Ok(())
    }

    pub fn claim_winnings(ctx: Context<Claim>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.market.state == MarketState::Settled,
            MarketError::NotSettled
        );
        let resolution = ctx
            .accounts
            .market
            .resolution
            .ok_or(MarketError::NoResolution)?;

        require!(
            ctx.accounts.deposit.owner == ctx.accounts.user.key(),
            MarketError::Unauthorized
        );
        require!(!ctx.accounts.deposit.claimed, MarketError::AlreadyClaimed);

        let is_yes = ctx.accounts.deposit.is_yes;
        let won = matches!(
            (resolution, is_yes),
            (Outcome::Yes, true) | (Outcome::No, false)
        );
        require!(won, MarketError::Lost);

        let total_winning = if is_yes {
            ctx.accounts.market.yes_amount
        } else {
            ctx.accounts.market.no_amount
        };
        let vault_balance = ctx.accounts.vault.amount;

        // Pro-rata share of the vault for this claimant's stake.
        let payout = if total_winning > 0 && vault_balance > 0 {
            ((vault_balance as u128)
                .checked_mul(amount as u128)
                .unwrap()
                .checked_div(total_winning as u128)
                .unwrap()) as u64
        } else {
            0
        };

        if payout > 0 {
            let market_key = ctx.accounts.market.key();
            let vault_bump = ctx.bumps.vault_authority;
            let decimals = ctx.accounts.mint.decimals;
            let seeds: &[&[u8]] = &[b"vault", market_key.as_ref(), &[vault_bump]];

            token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.vault.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.user_token.to_account_info(),
                        authority: ctx.accounts.vault_authority.to_account_info(),
                    },
                    &[seeds],
                ),
                payout,
                decimals,
            )?;
        }

        ctx.accounts.deposit.claimed = true;
        Ok(())
    }
}

fn transfer_in(ctx: &Context<Deposit>, amount: u64) -> Result<()> {
    let decimals = ctx.accounts.mint.decimals;
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
        decimals,
    )
}

fn build_validate_stat_v2_ix(
    program_id: &Pubkey,
    daily_scores: &Pubkey,
    proof: &SettlementProof,
) -> Instruction {
    let disc: [u8; 8] = [208, 215, 194, 214, 241, 71, 246, 178];
    let mut data = Vec::with_capacity(1024);
    data.extend_from_slice(&disc);

    data.extend_from_slice(&proof.ts.to_le_bytes());
    data.extend_from_slice(&proof.fixture_id.to_le_bytes());
    data.extend_from_slice(&proof.update_count.to_le_bytes());
    data.extend_from_slice(&proof.min_timestamp.to_le_bytes());
    data.extend_from_slice(&proof.max_timestamp.to_le_bytes());
    data.extend_from_slice(&proof.events_sub_tree_root);

    encode_vec(&mut data, &proof.sub_tree_proof, |b, n| {
        b.extend_from_slice(&n.hash);
        b.push(n.is_right_sibling as u8);
    });
    encode_vec(&mut data, &proof.main_tree_proof, |b, n| {
        b.extend_from_slice(&n.hash);
        b.push(n.is_right_sibling as u8);
    });

    data.extend_from_slice(&proof.event_stat_root);

    encode_vec(&mut data, &proof.stats, |b, s| {
        b.extend_from_slice(&s.stat.key.to_le_bytes());
        b.extend_from_slice(&s.stat.value.to_le_bytes());
        b.extend_from_slice(&s.stat.period.to_le_bytes());
        encode_vec(b, &s.proof, |b2, n| {
            b2.extend_from_slice(&n.hash);
            b2.push(n.is_right_sibling as u8);
        });
    });

    Instruction {
        program_id: *program_id,
        accounts: vec![AccountMeta::new_readonly(*daily_scores, false)],
        data,
    }
}

fn encode_vec<T, F: Fn(&mut Vec<u8>, &T)>(buf: &mut Vec<u8>, items: &[T], f: F) {
    let len32 = items.len() as u32;
    buf.extend_from_slice(&len32.to_le_bytes());
    for item in items {
        f(buf, item);
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MarketState {
    Open,
    Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Outcome {
    Yes,
    No,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub enum MarketType {
    MatchWinner { team1_key: u16, team2_key: u16 },
    OverUnder { stat_key: u16, threshold: u64 },
    ExactScore { stat_key: u16, target: u64 },
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub authority: Pubkey,
    pub fixture_id: u64,
    pub market_type: MarketType,
    pub settle_authority: Pubkey,
    pub state: MarketState,
    pub yes_amount: u64,
    pub no_amount: u64,
    pub resolution: Option<Outcome>,
    pub bump: u8,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct StatLeaf {
    pub stat: ScoreStat,
    pub proof: Vec<ProofNode>,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SettlementProof {
    pub ts: i64,
    pub fixture_id: u64,
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
    pub events_sub_tree_root: [u8; 32],
    pub sub_tree_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub event_stat_root: [u8; 32],
    pub stats: Vec<StatLeaf>,
}

impl SettlementProof {
    pub fn get_stat(&self, key: u16) -> u64 {
        self.stats
            .iter()
            .find(|s| s.stat.key == key as u32)
            .map(|s| s.stat.value.max(0) as u64)
            .unwrap_or(0)
    }
}

#[account]
#[derive(InitSpace)]
pub struct UserDeposit {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub amount: u64,
    pub is_yes: bool,
    pub claimed: bool,
}

#[derive(Accounts)]
#[instruction(fixture_id: u64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", fixture_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserDeposit::INIT_SPACE,
        seeds = [b"deposit", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub deposit: Account<'info, UserDeposit>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_token: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: seed-verified vault authority PDA (owns the vault ATA)
    #[account(
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    pub settler: Signer<'info>,

    /// CHECK: CPI target — TxLINE oracle program
    pub txline_program: UncheckedAccount<'info>,

    /// CHECK: TxLINE daily_scores_merkle_roots PDA
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        close = user,
        seeds = [b"deposit", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub deposit: Account<'info, UserDeposit>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_token: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: seed-verified vault authority PDA (owns the vault ATA)
    #[account(
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Program<'info, Token2022>,
}

#[error_code]
pub enum MarketError {
    #[msg("Market is not open")]
    NotOpen,
    #[msg("Market is not settled yet")]
    NotSettled,
    #[msg("No resolution available")]
    NoResolution,
    #[msg("You lost this bet")]
    Lost,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Already claimed")]
    AlreadyClaimed,
}
