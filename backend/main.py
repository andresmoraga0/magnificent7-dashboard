from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
from typing import List

app = FastAPI()

# Configuración CORS – ajusta los orígenes según tu frontend en producción
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://magnificent7-dashboard.vercel.app",   
        "https://*.vercel.app"                         # Opcional: permite todos los subdominios de 
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mapeo de nombres amigables a tickers de Yahoo Finance
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
    stocks: List[str] = Query(..., description="Lista de nombres de acciones"),
    start_date: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    end_date: str = Query(..., description="Fecha fin YYYY-MM-DD")
):
    # Validar que todas las acciones estén en el diccionario
    for stock in stocks:
        if stock not in TICKERS:
            return {"error": f"Acción '{stock}' no válida. Opciones: {list(TICKERS.keys())}"}

    tickers_list = [TICKERS[s] for s in stocks]

    # Descargar datos con auto_adjust=False para obtener "Adj Close"
    data = yf.download(tickers_list, start=start_date, end=end_date, group_by='ticker', auto_adjust=False)

    if data.empty:
        return {"error": "No se pudieron descargar datos. Verifica fechas o conexión."}

    # Extraer precios ajustados (Adj Close)
    try:
        # Si es un solo ticker, data es un DataFrame con MultiIndex o simple dependiendo de la versión
        if len(tickers_list) == 1:
            ticker = tickers_list[0]
            # Intenta acceder con (ticker, 'Adj Close') o ('Adj Close', ticker)
            if (ticker, 'Adj Close') in data.columns:
                adj_close = data[(ticker, 'Adj Close')].to_frame(name=ticker)
            elif ('Adj Close', ticker) in data.columns:
                adj_close = data[('Adj Close', ticker)].to_frame(name=ticker)
            else:
                # Fallback: a veces yfinance devuelve un DataFrame plano
                adj_close = data['Adj Close'].to_frame(name=ticker)
        else:
            # Múltiples tickers: extraer el nivel 'Adj Close'
            adj_close = data.xs('Adj Close', axis=1, level=1)
    except Exception as e:
        return {"error": f"Error al procesar datos: {str(e)}"}

    # Renombrar columnas con los nombres amigables (ej. 'Apple' en lugar de 'AAPL')
    rename_map = {ticker: stock for stock, ticker in zip(stocks, tickers_list)}
    adj_close = adj_close.rename(columns=rename_map)

    # Eliminar filas con valores nulos (días sin trading)
    adj_close = adj_close.dropna()

    # --- Cálculo de la serie base 100 ---
    base100 = adj_close.div(adj_close.iloc[0]) * 100

    # --- Cálculo de la volatilidad expansiva (acumulada) ---
    # Retornos diarios
    returns = adj_close.pct_change()

    # Volatilidad acumulada (expanding) anualizada
    vol_acum = returns.expanding().std() * (252 ** 0.5)

    # Reemplazar los primeros valores NaN con un valor pequeño para evitar división por cero
    vol_acum = vol_acum.fillna(0.01)

    # Retorno ajustado por volatilidad: retorno / volatilidad (expanding)
    ret_adj = returns / vol_acum

    # Índice acumulado base 100 a partir de los retornos ajustados
    precio_ajustado = (1 + ret_adj).cumprod() * 100

    # Rellenar cualquier NaN residual (por ejemplo, si la serie empezó con NaN)
    precio_ajustado = precio_ajustado.fillna(100)

    # --- Volatilidad móvil (rolling 20 días) para el gráfico de referencia ---
    vol_movil = returns.rolling(window=20).std() * (252 ** 0.5)
    vol_movil = vol_movil.fillna(0)

    # Preparar respuesta
    dates = adj_close.index.strftime("%Y-%m-%d").tolist()

    return {
        "dates": dates,
        "prices_base100": {stock: base100[stock].tolist() for stock in stocks},
        "prices_ajustado": {stock: precio_ajustado[stock].tolist() for stock in stocks},
        "volatility": {stock: vol_movil[stock].tolist() for stock in stocks}
    }