"""US equity universe for scanner & screener (~200 liquid symbols)."""

SCANNER_UNIVERSE: tuple[str, ...] = (
    # Mega-cap tech
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ORCL",
    "CRM", "ADBE", "AMD", "INTC", "CSCO", "IBM", "QCOM", "TXN", "AMAT", "LRCX",
    "KLAC", "MU", "ADI", "PANW", "CRWD", "SNOW", "DDOG", "NET", "PLTR", "COIN",
    "NOW", "INTU", "SNPS", "CDNS", "FTNT", "ZS", "TEAM", "WDAY", "HUBS", "VEEV",
  # Financials
    "BRK-B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "C", "AXP", "BLK", "SCHW",
    "SPGI", "MCO", "ICE", "CME", "PYPL", "SQ", "SOFI", "HOOD", "COIN", "AFRM", "UPST",
    "COF", "USB", "PNC", "TFC", "BK", "STT", "MET", "PRU", "AIG", "ALL",
    # Healthcare
    "UNH", "JNJ", "LLY", "MRK", "ABBV", "PFE", "TMO", "ABT", "DHR", "BMY", "AMGN",
    "GILD", "ISRG", "VRTX", "REGN", "CVS", "ELV", "CI", "HUM", "ZTS", "MDT", "SYK",
    "BSX", "EW", "DXCM", "MRNA", "BIIB", "ILMN", "IDXX",
    # Consumer
    "WMT", "COST", "HD", "LOW", "TGT", "TJX", "NKE", "SBUX", "MCD", "DIS", "NFLX",
    "BKNG", "ABNB", "UBER", "MAR", "CMG", "LULU", "ROST", "PG", "KO", "PEP", "PM",
    "MO", "CL", "EL", "YUM", "DPZ", "DRI", "ETSY", "CHWY", "DKNG", "RBLX", "DASH",
    # Energy & materials
    "XOM", "CVX", "COP", "SLB", "EOG", "OXY", "MPC", "PSX", "FCX", "NEM", "LIN",
    "APD", "SHW", "ECL", "DOW", "DD", "NUE", "STLD", "VMC", "MLM",
    # Industrials
    "CAT", "DE", "HON", "UPS", "RTX", "LMT", "BA", "GE", "MMM", "UNP", "FDX",
    "CSX", "NSC", "WM", "RSG", "EMR", "ITW", "PH", "ROK", "CARR", "OTIS",
    # Telecom & utilities
    "T", "VZ", "TMUS", "CMCSA", "NEE", "DUK", "SO", "AEP", "SRE", "EXC", "XEL",
    # Auto & growth / higher-beta
    "F", "GM", "RIVN", "LCID", "MARA", "RIOT", "SMCI", "ARM", "MRVL", "ON",
    "ENPH", "FSLR", "RUN", "PLUG", "CHPT",
    # REITs & ETFs
    "PLD", "AMT", "EQIX", "SPG", "O", "PSA", "SPY", "QQQ", "IWM", "DIA",
    # Additional large caps
    "DELL", "HPE", "HPQ", "WDC", "STX", "NTAP", "GLW", "KEYS", "ANET", "MCHP",
    "NXPI", "SWKS", "QRVO", "MPWR", "TTD", "PINS", "SNAP", "ROKU", "SPOT", "ZM",
)

# Deduplicate while preserving order
_seen: set[str] = set()
SCANNER_UNIVERSE = tuple(s for s in SCANNER_UNIVERSE if not (s in _seen or _seen.add(s)))
