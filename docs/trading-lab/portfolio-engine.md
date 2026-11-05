# QUN Capital Engine — Portfolio Model v0.1

Status: research and simulation only. No real orders, deposits, withdrawals, staking, or wallet permissions.

## Objective

Build a reproducible portfolio simulator that compares capital preservation and growth strategies over explicit horizons. Do not optimize for a fantasy target such as a sextillion dollars; use it only as a stress-test of assumptions. Optimize measurable outcomes under risk constraints.

## Initial scenario

- Starting equity: configurable; default $100, with $1,000 as a comparison scenario.
- Horizon: configurable; initial benchmark 1 year.
- Instruments: begin with liquid spot crypto pairs and cash/stablecoin proxy; expand only when data quality and costs can be modeled.
- Leverage: disabled.
- Execution: backtest, then paper trading. Live execution is a separate future phase requiring explicit approval.
- Reinvestment: configurable; compounding must include fees, slippage, funding, staking lockups, and losses.
- No guaranteed-return assumptions.

## Portfolio sleeves

1. **Liquid reserve** — cash/stablecoin proxy. Model depeg, issuer/custody, and venue risks where applicable; do not treat stablecoins as risk-free.
2. **Yield sleeve** — staking or other yield only when rewards, token-denominated APR, lock/unbonding period, slashing, validator/protocol, liquidity, and price risk can be represented. Report yield in token units and USD separately.
3. **Trading sleeve** — spot-only strategies initially: trend/momentum, breakout, and mean reversion. No leverage or real orders.
4. **Allocator** — chooses sleeve weights subject to liquidity and drawdown constraints. Compare fixed weights, volatility targeting, trend/regime filters, and a conservative reserve-first baseline.

## Metrics

- Ending equity and CAGR/annualized return
- Maximum drawdown and time under water
- Volatility and downside volatility
- Sharpe and Sortino, with assumptions stated
- Worst day/week/month and tail-loss estimates
- Turnover, fees, slippage, rejected/missing data
- Time in market, reserve percentage, concentration
- Staking yield net of token-price change and lockup cost
- Probability of loss and bootstrap/Monte Carlo outcome ranges
- Out-of-sample and walk-forward performance

## Backtest rules

1. Use timestamped OHLCV data with explicit venue and symbol mapping. Never silently fill missing candles.
2. Split chronologically: train/design, validation, and untouched test windows. Avoid look-ahead and survivorship bias.
3. Include taker/maker fees where applicable, realistic spread/slippage, minimum order sizes, and rebalancing costs.
4. Compare every candidate with buy-and-hold and a reserve-only baseline.
5. Report gross and net results; include pessimistic cost scenarios.
6. Test multiple market regimes and instruments; correct for strategy selection/data snooping.
7. Use block bootstrap or regime-aware Monte Carlo for ranges, not a single deterministic forecast.
8. Paper-trade only after passing data-quality, out-of-sample, drawdown, and stability gates.

## Risk controls for research

- No leverage or borrowing.
- Per-strategy and whole-portfolio drawdown limits are configurable and tested.
- Maximum allocation per asset and protocol.
- Liquidity/exit checks before staking or allocation.
- Kill switch on stale data, exchange/API errors, abnormal spreads, or model drift.
- A model that violates a risk limit is rejected even if its backtest return is higher.

## Objective function

Do not maximize raw terminal equity alone. Compare a constrained objective such as:

- maximize median net terminal wealth across test/bootstrapped paths;
- subject to a user-defined maximum drawdown and minimum liquidity reserve;
- penalize ruin probability, tail losses, turnover, concentration, and unstable out-of-sample results.

Show the Pareto frontier between expected growth, drawdown, liquidity, and complexity instead of hiding trade-offs inside one score.

## Build sequence

1. Data layer: download and cache multi-year spot OHLCV; validate continuity, timezone, duplicates, and missing candles.
2. Baselines: reserve-only and buy-and-hold.
3. Strategy engine: deterministic entry/exit rules with parameters recorded.
4. Portfolio simulator: cash ledger, positions, fees, slippage, rebalancing, compounding.
5. Risk analytics and walk-forward tests.
6. Yield/staking module only after reliable historical reward and price data sources are identified.
7. Paper-trading monitor with no trading keys or withdrawal permissions.
8. Live execution remains disabled until separately reviewed and explicitly approved.

## Acceptance criteria

- Reproducible run with versioned parameters and data timestamps.
- Net performance after costs, not gross-only.
- Independent test period and multiple regimes.
- No hidden look-ahead, no fabricated data, no guaranteed outcomes.
- Clear disclosure when staking history or historical data is unavailable.
- Simulation must never submit a real order.
