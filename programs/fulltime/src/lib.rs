use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::token_2022::{self, Token2022};
use anchor_spl::token_interface::{Mint, TokenAccount};

declare_id!("FULLTiME11111111111111111111111111111111111");

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
        let m = &mut ctx.accounts.market;
        require!(m.state == MarketState::Open, MarketError::NotOpen);
        transfer_usdc(&ctx, amount)?;
        m.yes_amount = m.yes_amount.checked_add(amount).unwrap();

        let d = &mut ctx.accounts.deposit;
        d.owner = ctx.accounts.user.key();
        d.market = m.key();
        d.amount = d.amount.checked_add(amount).unwrap();
        d.is_yes = true;
        Ok(())
    }

    pub fn deposit_no(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let m = &mut ctx.accounts.market;
        require!(m.state == MarketState::Open, MarketError::NotOpen);
        transfer_usdc(&ctx, amount)?;
        m.no_amount = m.no_amount.checked_add(amount).unwrap();

        let d = &mut ctx.accounts.deposit;
        d.owner = ctx.accounts.user.key();
        d.market = m.key();
        d.amount = d.amount.checked_add(amount).unwrap();
        d.is_yes = false;
        Ok(())
    }

    pub fn settle(ctx: Context<Settle>, proof: SettlementProof) -> Result<()> {
        require!(
            ctx.accounts.settler.key() == ctx.accounts.market.settle_authority
                || ctx.accounts.settler.key() == ctx.accounts.market.authority,
            MarketError::Unauthorized
        );
        let m = &mut ctx.accounts.market;
        require!(m.state == MarketState::Open, MarketError::NotOpen);

        let ix = build_validate_stat_v2_ix(
            &ctx.accounts.txline_program.key(),
            &ctx.accounts.daily_scores_merkle_roots.key(),
            &proof,
        );

        invoke(
            &ix,
            &[ctx.accounts.daily_scores_merkle_roots.to_account_info()],
        )?;

        m.resolution = Some(match &m.market_type {
            MarketType::MatchWinner { team1_key, team2_key } => {
                let g1 = proof.get_stat(*team1_key);
                let g2 = proof.get_stat(*team2_key);
                if g1 > g2 { Outcome::Yes } else { Outcome::No }
            }
            MarketType::OverUnder { stat_key, threshold } => {
                if proof.get_stat(*stat_key) > *threshold { Outcome::Yes } else { Outcome::No }
            }
            MarketType::ExactScore { stat_key, target } => {
                if proof.get_stat(*stat_key) == *target { Outcome::Yes } else { Outcome::No }
            }
        });
        m.state = MarketState::Settled;
        Ok(())
    }

    pub fn claim_winnings(ctx: Context<Claim>, amount: u64) -> Result<()> {
        let m = &ctx.accounts.market;
        require!(m.state == MarketState::Settled, MarketError::NotSettled);
        let resolution = m.resolution.ok_or(MarketError::NoResolution)?;

        let deposit = &ctx.accounts.deposit;
        require!(deposit.owner == ctx.accounts.user.key(), MarketError::Unauthorized);
        require!(!deposit.claimed, MarketError::AlreadyClaimed);

        let won = matches!((resolution, deposit.is_yes), (Outcome::Yes, true) | (Outcome::No, false));
        require!(won, MarketError::Lost);

        let total_winning = if deposit.is_yes { m.yes_amount } else { m.no_amount };
        let vault_balance = ctx.accounts.vault.amount;

        let payout = if total_winning > 0 && vault_balance > 0 {
            ((vault_balance as u128)
                .checked_mul(amount as u128).unwrap()
                .checked_div(total_winning as u128).unwrap()) as u64
        } else {
            0
        };

        if payout > 0 {
            let seeds = &[b"vault", m.key().as_ref(), &[ctx.accounts.vault_bump]];
            token_2022::transfer_common(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token_2022::TransferCommon {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.user_token.to_account_info(),
                        authority: ctx.accounts.vault_authority.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                    },
                    &[&seeds[..]],
                ),
                payout,
            )?;
        }

        ctx.accounts.deposit.claimed = true;
        Ok(())
    }
}

fn transfer_usdc(ctx: &Deposit, amount: u64) -> Result<()> {
    token_2022::transfer_common(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token_2022::TransferCommon {
                from: ctx.accounts.user_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
            },
        ),
        amount,
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
    data.extend_from_slice(&(proof.update_count as i32).to_le_bytes());
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MarketState { Open, Settled }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum Outcome { Yes, No }

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
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
        self.stats.iter()
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
        seeds = [b"market", &fixture_id.to_le_bytes()],
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
    )]
    pub user_token: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_authority,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: seed-verified vault PDA
    #[account(
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    pub settler: Signer<'info>,

    /// CHECK: CPI target — TxLINE oracle
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
    )]
    pub user_token: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_authority,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: seed-verified vault PDA
    #[account(
        seeds = [b"vault", market.key().as_ref()],
        bump = vault_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Program<'info, Token2022>,

    pub vault_bump: u8,
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
