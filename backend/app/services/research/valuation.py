from app.schemas.research import ExtendedFundamentals, FairValueEstimate, ValuationMethod
from app.schemas.market import Quote


def compute_fair_value(
    fund: ExtendedFundamentals | None,
    quote: Quote | None,
) -> FairValueEstimate | None:
    if not fund or not quote:
        return None

    methods: list[ValuationMethod] = []
    estimates: list[float] = []
    data_points = 0

    # P/E relative (sector-neutral baseline P/E of 18 when sector unknown)
    if fund.eps and fund.eps > 0:
        baseline_pe = 18.0
        if fund.sector and "Technology" in fund.sector:
            baseline_pe = 25.0
        elif fund.sector and "Utilities" in fund.sector:
            baseline_pe = 14.0
        pe_estimate = fund.eps * baseline_pe
        methods.append(
            ValuationMethod(
                name="P/E Relative",
                estimate=round(pe_estimate, 2),
                note=f"EPS ${fund.eps:.2f} × baseline P/E {baseline_pe:.0f}",
            )
        )
        estimates.append(pe_estimate)
        data_points += 1

    # PEG-implied fair P/E
    if fund.peg_ratio and fund.pe_ratio and fund.revenue_growth and fund.revenue_growth > 0:
        growth_pct = fund.revenue_growth * 100
        fair_pe = growth_pct  # PEG=1 heuristic
        if fund.eps and fund.eps > 0:
            peg_estimate = fund.eps * fair_pe
            methods.append(
                ValuationMethod(
                    name="PEG Implied",
                    estimate=round(peg_estimate, 2),
                    note=f"Growth-adjusted P/E ~{fair_pe:.0f}",
                )
            )
            estimates.append(peg_estimate)
            data_points += 1

    # Simplified DCF proxy using FCF per share
    if fund.free_cash_flow and fund.shares_outstanding and fund.shares_outstanding > 0:
        fcf_per_share = fund.free_cash_flow / fund.shares_outstanding
        growth = max(0.03, min(0.12, (fund.revenue_growth or 0.05)))
        discount = 0.1
        if discount > growth:
            dcf = fcf_per_share * (1 + growth) / (discount - growth)
            methods.append(
                ValuationMethod(
                    name="DCF Proxy",
                    estimate=round(dcf, 2),
                    note="Simplified FCF growth model — illustrative only",
                )
            )
            estimates.append(dcf)
            data_points += 1

    # EV/EBITDA relative
    if fund.ev_to_ebitda and fund.ebitda and fund.shares_outstanding and fund.shares_outstanding > 0:
        sector_multiple = 12.0
        implied_ev = fund.ebitda * sector_multiple
        net_debt = (fund.total_debt or 0) - (fund.total_cash or 0)
        equity_value = implied_ev - net_debt
        ev_estimate = equity_value / fund.shares_outstanding
        if ev_estimate > 0:
            methods.append(
                ValuationMethod(
                    name="EV/EBITDA Relative",
                    estimate=round(ev_estimate, 2),
                    note=f"Sector-like multiple ~{sector_multiple:.0f}x EBITDA",
                )
            )
            estimates.append(ev_estimate)
            data_points += 1

    if not estimates:
        return FairValueEstimate(
            current_price=quote.price,
            confidence=0.0,
            methods=methods,
        )

    mid = sum(estimates) / len(estimates)
    spread = mid * 0.15
    low = mid - spread
    high = mid + spread
    upside = ((mid - quote.price) / quote.price) * 100 if quote.price else None

    return FairValueEstimate(
        current_price=quote.price,
        fair_value_low=round(low, 2),
        fair_value_mid=round(mid, 2),
        fair_value_high=round(high, 2),
        upside_percent=round(upside, 2) if upside is not None else None,
        methods=methods,
        confidence=round(min(1.0, data_points / 4), 2),
    )
