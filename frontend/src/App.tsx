import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './App.css';

const STOCKS = ['Apple', 'Microsoft', 'Google', 'Amazon', 'Nvidia', 'Meta', 'Tesla'];

interface PriceDataPoint {
  date: string;
  [stock: string]: string | number;
}

interface VolatilityDataPoint {
  date: string;
  [stock: string]: string | number;
}

function App() {
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [volData, setVolData] = useState<VolatilityDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckboxChange = (stock: string) => {
    setSelectedStocks(prev =>
      prev.includes(stock) ? prev.filter(s => s !== stock) : [...prev, stock]
    );
  };

  const fetchData = async () => {
    if (selectedStocks.length === 0) {
      setError('Selecciona al menos una acción.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const params = new URLSearchParams();
      selectedStocks.forEach(s => params.append('stocks', s));
      params.append('start_date', startDate);
      params.append('end_date', endDate);

      const res = await fetch(`${API_URL}/prices?${params}`);
      const json = await res.json();

      if (json.error) {
        setError(json.error);
        setPriceData([]);
        setVolData([]);
        return;
      }

      const dates = json.dates as string[];
      const prices = json.prices_base100;
      const vols = json.volatility;

      const priceChartData: PriceDataPoint[] = dates.map((date, idx) => {
        const point: PriceDataPoint = { date };
        selectedStocks.forEach(stock => {
          point[stock] = prices[stock][idx];
        });
        return point;
      });

      const volChartData: VolatilityDataPoint[] = dates.map((date, idx) => {
        const point: VolatilityDataPoint = { date };
        selectedStocks.forEach(stock => {
          point[stock] = vols[stock][idx];
        });
        return point;
      });

      setPriceData(priceChartData);
      setVolData(volChartData);
    } catch (err) {
      setError('Error al conectar con el servidor. Asegúrate de que el backend esté corriendo.');
    }
    setLoading(false);
  };

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#387908', '#d0ed57', '#a4de6c'];

  return (
    <div className="App">
      <header className="App-header">
        <h1>Magnificent 7 - Dashboard de Precios</h1>
      </header>
      <div className="controls">
        <div className="stocks-checkboxes">
          <label>Selecciona acciones:</label>
          {STOCKS.map((stock) => (
            <label key={stock} style={{ marginLeft: '15px' }}>
              <input
                type="checkbox"
                checked={selectedStocks.includes(stock)}
                onChange={() => handleCheckboxChange(stock)}
              />
              {stock}
            </label>
          ))}
        </div>
        <div className="date-pickers">
          <label>
            Desde:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label style={{ marginLeft: '20px' }}>
            Hasta:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          <button onClick={fetchData} disabled={loading}>
            {loading ? 'Cargando...' : 'Actualizar gráficos'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {priceData.length > 0 && (
        <>
          <h2>Precios (Base 100)</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={priceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => {
                if (typeof value === 'number') return value.toFixed(2);
                return value;
              }} />
              <Tooltip
                formatter={(value) => {
                  if (typeof value === 'number') return value.toFixed(2);
                  return value;
                }}
                labelFormatter={(label) => `Fecha: ${label}`}
              />
              <Legend />
              {selectedStocks.map((stock, idx) => (
                <Line
                  key={stock}
                  type="monotone"
                  dataKey={stock}
                  stroke={colors[idx % colors.length]}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <h2>Volatilidad expansiva (anualizada, rolling 20d)</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={volData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis
                tickFormatter={(value) => {
                  if (typeof value === 'number') return `${value.toFixed(2)}%`;
                  return value;
                }}
                unit="%"
              />
              <Tooltip
                formatter={(value) => {
                  if (typeof value === 'number') return `${value.toFixed(2)}%`;
                  return value;
                }}
                labelFormatter={(label) => `Fecha: ${label}`}
              />
              <Legend />
              {selectedStocks.map((stock, idx) => (
                <Line
                  key={stock}
                  type="monotone"
                  dataKey={stock}
                  stroke={colors[idx % colors.length]}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

export default App;