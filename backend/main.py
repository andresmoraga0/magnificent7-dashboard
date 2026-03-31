from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://magnificent7-dashboard.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TICKERS = {
    "Apple": "AAPL",
    "Microsoft": "MSFT",
    "Google": "GOOGL",
    "Amazon": "AMZN",
    "Nvidia": "NVDA",
    "Meta": "META",
    "Tesla": "TSLA"
}

@app.get("/prices")
def get_prices(
    stocks: List[str] = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...)
):
    # Validar
    for stock in stocks:
        if stock not in TICKERS:
            return {"error": f"Acción '{stock}' no válida. Opciones: {list(TICKERS.keys())}"}

    tickers_list = [TICKERS[s] for s in stocks]

    # Descargar datos
    data = yf.download(tickers_list, start=start_date, end=end_date, group_by='ticker', auto_adjust=False)

    if data.empty:
        return {"error": "No se pudieron descargar datos."}

    # Extraer Adj Close de manera robusta
    if len(tickers_list) == 1:
        # Para un solo ticker, data tiene un MultiIndex con dos niveles: (ticker, field)
        # Queremos la columna 'Adj Close' del ticker único.
        ticker = tickers_list[0]
        # Forma segura: acceder con (field, ticker) porque yfinance a veces invierte el orden
        try:
            # Intenta acceder como (ticker, 'Adj Close')
            adj_close = data[(ticker, 'Adj Close')].to_frame(name=ticker)
        except KeyError:
            # Alternativa: puede estar como ('Adj Close', ticker)
            adj_close = data[('Adj Close', ticker)].to_frame(name=ticker)
    else:
        # Para múltiples, xs funciona bien
        adj_close = data.xs('Adj Close', axis=1, level=1)

    # Renombrar columnas a los nombres amigables
    rename_map = {tick: stock for stock, tick in zip(stocks, tickers_list)}
    adj_close = adj_close.rename(columns=rename_map)

    # Eliminar filas con NaN (días sin trading)
    adj_close = adj_close.dropna()

    # Base 100
    base100 = adj_close.div(adj_close.iloc[0]) * 100

    # Volatilidad anualizada (rolling 20 días)
    returns = adj_close.pct_change()
    vol = returns.rolling(window=20).std() * (252 ** 0.5)
    vol = vol.fillna(0)

    # Respuesta
    dates = adj_close.index.strftime("%Y-%m-%d").tolist()
    return {
        "dates": dates,
        "prices_base100": {stock: base100[stock].tolist() for stock in stocks},
        "volatility": {stock: vol[stock].tolist() for stock in stocks}
    }