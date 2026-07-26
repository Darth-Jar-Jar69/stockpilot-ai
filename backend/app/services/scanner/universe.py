"""Global equity universe for scanner & screener — US large/mid caps + major ADRs."""

SCANNER_UNIVERSE: tuple[str, ...] = (
    # Mega-cap tech
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ORCL",
    "CRM", "ADBE", "AMD", "INTC", "CSCO", "IBM", "QCOM", "TXN", "AMAT", "LRCX",
    "KLAC", "MU", "ADI", "PANW", "CRWD", "SNOW", "DDOG", "NET", "PLTR", "COIN",
    "NOW", "INTU", "SNPS", "CDNS", "FTNT", "ZS", "TEAM", "WDAY", "HUBS", "VEEV",
    "ACN", "ADP", "PAYX", "CTSH", "INFY", "WIT",
    # Semiconductors & hardware
    "ASML", "TSM", "ARM", "MRVL", "ON", "NXPI", "MCHP", "SWKS", "QRVO", "MPWR",
    "ANET", "DELL", "HPE", "HPQ", "WDC", "STX", "NTAP", "GLW", "KEYS", "SMCI",
    # Financials
    "BRK-B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "C", "AXP", "BLK", "SCHW",
    "SPGI", "MCO", "ICE", "CME", "PYPL", "SQ", "SOFI", "HOOD", "AFRM", "UPST",
    "COF", "USB", "PNC", "TFC", "BK", "STT", "MET", "PRU", "AIG", "ALL",
    "FIS", "FI", "GPN", "TRU", "NDAQ",
    # Healthcare
    "UNH", "JNJ", "LLY", "MRK", "ABBV", "PFE", "TMO", "ABT", "DHR", "BMY", "AMGN",
    "GILD", "ISRG", "VRTX", "REGN", "CVS", "ELV", "CI", "HUM", "ZTS", "MDT", "SYK",
    "BSX", "EW", "DXCM", "MRNA",     "BIIB", "ILMN", "IDXX", "NVO", "AZN", "GSK", "SNY", "TAK",
    # Consumer & retail
    "WMT", "COST", "HD", "LOW", "TGT", "TJX", "NKE", "SBUX", "MCD", "DIS", "NFLX",
    "BKNG", "ABNB", "UBER", "MAR", "CMG", "LULU", "ROST", "PG", "KO", "PEP", "PM",
    "MO", "CL", "EL", "YUM", "DPZ", "DRI", "ETSY", "CHWY", "DKNG", "RBLX", "DASH",
    "UL", "DEO", "BUD", "STZ", "BF-B", "MNST", "KDP", "GIS", "K", "HSY", "MDLZ",
    # Luxury, autos & travel
    "RACE", "TM", "HMC", "STLA", "F", "GM", "RIVN", "LCID", "MBLY", "APTV",
    "CCL", "RCL", "NCLH", "DAL", "UAL", "AAL", "LUV", "ALK", "EXPE", "LYFT",
    # Energy & materials
    "XOM", "CVX", "COP", "SLB", "EOG", "OXY", "MPC", "PSX", "FCX", "NEM", "LIN",
    "APD", "SHW", "ECL", "DOW", "DD", "NUE", "STLD", "VMC", "MLM",
    "BP", "SHEL", "TTE", "EQNR", "CNQ", "SU", "ENB", "TRP", "BHP", "RIO", "VALE",
    "SCCO", "AA", "X", "CLF",
    # Industrials & defense
    "CAT", "DE", "HON", "UPS", "RTX", "LMT", "BA", "GE", "MMM", "UNP", "FDX",
    "CSX", "NSC", "WM", "RSG", "EMR", "ITW", "PH", "ROK", "CARR", "OTIS",
    "GD", "NOC", "LHX", "TDG", "HEI", "AXON", "CNI", "CP", "URI", "PCAR", "CMI",
    # Telecom, media & utilities
    "T", "VZ", "TMUS", "CMCSA", "CHTR", "NEE", "DUK", "SO", "AEP", "SRE", "EXC",
    "XEL", "D", "PCG", "ED", "WEC", "ES",
    # Growth / higher-beta / crypto-related
    "MARA", "RIOT", "ENPH", "FSLR", "RUN", "PLUG", "CHPT", "TTD", "PINS", "SNAP",
    "ROKU", "SPOT", "ZM", "SHOP", "SE", "MELI", "NU", "GRAB",
    # China / Asia ADRs
    "BABA", "JD", "PDD", "BIDU", "NIO", "XPEV", "LI", "TME", "BILI", "NTES",
    "SONY",
    # Europe / UK / Canada banks & industrials
    "SAP", "SIEGY", "PHG", "ABB", "NOK", "ERIC", "RELX", "HSBC", "BCS", "DB",
    "ING", "SAN", "BBVA", "UBS", "RY", "TD", "BNS", "BMO", "CM",
    "IBN", "HDB", "ITUB", "PBR", "BBD",
    # REITs & ETFs
    "PLD", "AMT", "EQIX", "SPG", "O", "PSA", "WELL", "DLR", "VICI", "AVB",
    "SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "EFA", "EEM", "GLD", "SLV", "TLT", "HYG",
    # Additional large / mid caps
    "CRH", "ETN", "TT", "JCI", "IR", "AME", "FAST", "GWW", "CTAS", "ODFL",
    "CPRT", "ORLY", "AZO", "AAP", "BBY", "DG", "DLTR", "KR", "SYY",
    "MCK", "CAH", "COR", "WBA",
)

# Deduplicate while preserving order
_seen: set[str] = set()
SCANNER_UNIVERSE = tuple(s for s in SCANNER_UNIVERSE if not (s in _seen or _seen.add(s)))
