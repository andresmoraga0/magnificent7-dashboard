import React, { useState, useRef, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush
} from 'recharts';
import html2canvas from 'html2canvas';
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

const formatXAxis = (dateStr: string, index: number, allDates: string[]) => {
  const date = new Date(dateStr);
  if (allDates && allDates.length > 0) {
    const firstYear = new Date(allDates[0]).getFullYear();
    const lastYear = new Date(allDates[allDates.length - 1]).getFullYear();
    if (lastYear - firstYear > 2) {
      return date.getFullYear().toString();
    }
  }
  return date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
};

function App() {
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [adjustedData, setAdjustedData] = useState<PriceDataPoint[]>([]);
  const [volData, setVolData] = useState<VolatilityDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hiddenLines, setHiddenLines] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'base' | 'adjusted'>('base');

  const chartRef = useRef<HTMLDivElement | null>(null);
  const volChartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedStocks, startDate, endDate]);

  const handleCheckboxChange = (stock: string) => {
    setSelectedStocks(prev =>
      prev.includes(stock) ? prev.filter(s => s !== stock) : [...prev, stock]
    );
    setHiddenLines([]);
  };

  const setLastMonth = () => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    setStartDate(formatDate(lastMonth));
    setEndDate(formatDate(today));
  };
  const setLastQuarter = () => {
    const today = new Date();
    const lastQuarter = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    setStartDate(formatDate(lastQuarter));
    setEndDate(formatDate(today));
  };
  const setLastYear = () => {
    const today = new Date();
    const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    setStartDate(formatDate(lastYear));
    setEndDate(formatDate(today));
  };
  const setYearToDate = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 1);
    setStartDate(formatDate(start));
    setEndDate(formatDate(today));
  };
  const setFullYear = (year: number) => {
    setStartDate(`${year}-01-01`);
    setEndDate(`${year}-12-31`);
  };
  const [yearInput, setYearInput] = useState('2024');

  const handleFullYear = () => {
    const year = parseInt(yearInput, 10);
    if (!isNaN(year)) setFullYear(year);
  };

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const fetchData = async () => {
    if (!startDate || !endDate) {
      setError('Por favor selecciona ambas fechas.');
      return;
    }
    if (startDate > endDate) {
      setError('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }
    if (selectedStocks.length === 0) {
      setError('Selecciona al menos una acción.');
      setPriceData([]);
      setAdjustedData([]);
      setVolData([]);
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
        setAdjustedData([]);
        setVolData([]);
        setLoading(false);
        return;
      }

      const dates = json.dates as string[];
      if (!dates || dates.length === 0) {
        setError('No hay datos para el rango de fechas seleccionado.');
        setPriceData([]);
        setAdjustedData([]);
        setVolData([]);
        setLoading(false);
        return;
      }

      const pricesBase = json.prices_base100;
      const pricesAdj = json.prices_ajustado;
      const vols = json.volatility;

      const priceChartData: PriceDataPoint[] = dates.map((date, idx) => {
        const point: PriceDataPoint = { date };
        selectedStocks.forEach(stock => {
          point[stock] = pricesBase[stock][idx];
        });
        return point;
      });

      const adjustedChartData: PriceDataPoint[] = dates.map((date, idx) => {
        const point: PriceDataPoint = { date };
        selectedStocks.forEach(stock => {
          point[stock] = pricesAdj[stock][idx];
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
      setAdjustedData(adjustedChartData);
      setVolData(volChartData);
    } catch (err) {
      setError('Error al conectar con el servidor. Asegúrate de que el backend esté corriendo.');
      setPriceData([]);
      setAdjustedData([]);
      setVolData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLegendClick = (dataKey: string) => {
    setHiddenLines(prev =>
      prev.includes(dataKey) ? prev.filter(k => k !== dataKey) : [...prev, dataKey]
    );
  };

  const exportChart = async (ref: React.RefObject<HTMLDivElement | null>, title: string) => {
    if (!ref.current) return;
    try {
      const canvas = await html2canvas(ref.current, { scale: 2 });
      const link = document.createElement('a');
      link.download = `${title}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (err) {
      console.error('Error al exportar:', err);
    }
  };

  const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2'];
  const manyDates = priceData.length > 25;
  const currentData = viewMode === 'base' ? priceData : adjustedData;

  return (
    <div className="App">
      <header className="App-header">
        <h1>Magnificent 7 - Dashboard de Precios</h1>
        <p>Análisis cuantitativo: precio base 100 y precio ajustado por volatilidad expansiva (acumulada)</p>
      </header>

      <div className="controls">
        <div className="stocks-grid">
          <label>Selecciona acciones:</label>
          <div className="grid-container">
            {STOCKS.map((stock) => (
              <label key={stock} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedStocks.includes(stock)}
                  onChange={() => handleCheckboxChange(stock)}
                />
                {stock}
              </label>
            ))}
          </div>
        </div>

        <div className="date-pickers">
          <div className="date-range">
            <label>Desde:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <label>Hasta:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="quick-ranges">
            <button onClick={setLastMonth}>Último mes</button>
            <button onClick={setLastQuarter}>Último trimestre</button>
            <button onClick={setLastYear}>Último año</button>
            <button onClick={setYearToDate}>Año hasta hoy</button>
            <div className="year-input-group">
              <input
                type="number"
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                placeholder="Año"
                min="2000"
                max="2030"
              />
              <button onClick={handleFullYear}>Año completo</button>
            </div>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        {selectedStocks.length === 0 && !error && (
          <p className="hint">Selecciona al menos una acción para ver los gráficos.</p>
        )}
        {loading && <p className="hint">Cargando datos...</p>}
      </div>

      {currentData.length > 0 && (
        <div className="chart-container" ref={chartRef}>
          <div className="chart-header">
            <div className="toggle-container">
              <button
                className={`toggle-btn ${viewMode === 'base' ? 'active' : ''}`}
                onClick={() => setViewMode('base')}
              >
                Precio Base 100
              </button>
              <button
                className={`toggle-btn ${viewMode === 'adjusted' ? 'active' : ''}`}
                onClick={() => setViewMode('adjusted')}
              >
                Precio Ajustado por Volatilidad
              </button>
            </div>
            <button onClick={() => exportChart(chartRef, viewMode === 'base' ? 'precios_base100' : 'precios_ajustado')} className="export-btn">
              Exportar imagen
            </button>
          </div>
          <ResponsiveContainer width="100%" height={550}>
            <LineChart
              data={currentData}
              margin={{ top: 60, right: 40, left: 40, bottom: 120 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tickCount={6}
                tickFormatter={(value, idx) => formatXAxis(value, idx, currentData.map(d => d.date))}
                tick={{
                  fontSize: manyDates ? 10 : 12,
                  angle: manyDates ? -45 : 0,
                  textAnchor: manyDates ? 'end' : 'middle'
                }}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(value) => {
                  if (typeof value === 'number') return value.toFixed(2);
                  return value;
                }}
              />
              <Tooltip
                formatter={(value, name) => {
                  if (typeof value === 'number') return [value.toFixed(2), name];
                  return [value, name];
                }}
                labelFormatter={(label) => `Fecha: ${label}`}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '10px', cursor: 'pointer' }}
                onClick={(e) => handleLegendClick(e.dataKey as string)}
              />
              <text
                x="50%"
                y={520}
                textAnchor="middle"
                fill="#3b82f6"
                fontSize="12"
                fontWeight="normal"
                style={{ pointerEvents: 'none' }}
              >
                ← Arrastra aquí para hacer zoom →
              </text>
              <Brush
                dataKey="date"
                height={40}
                stroke="#3b82f6"
                fill="#f0f9ff"
                y={490}
                travellerWidth={10}
              />
              {selectedStocks.map((stock, idx) => (
                <Line
                  key={stock}
                  type="monotone"
                  dataKey={stock}
                  stroke={colors[idx % colors.length]}
                  strokeWidth={hiddenLines.includes(stock) ? 0 : 2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  hide={hiddenLines.includes(stock)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {volData.length > 0 && (
        <div className="chart-container" ref={volChartRef}>
          <div className="chart-header">
            <h2>Volatilidad expansiva (anualizada, acumulada)</h2>
            <button onClick={() => exportChart(volChartRef, 'volatilidad')} className="export-btn">
              Exportar imagen
            </button>
          </div>
          <ResponsiveContainer width="100%" height={500}>
            <LineChart
              data={volData}
              margin={{ top: 60, right: 40, left: 40, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tickCount={6}
                tickFormatter={(value, idx) => formatXAxis(value, idx, volData.map(d => d.date))}
                tick={{
                  fontSize: manyDates ? 10 : 12,
                  angle: manyDates ? -45 : 0,
                  textAnchor: manyDates ? 'end' : 'middle'
                }}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(value) => {
                  if (typeof value === 'number') return `${value.toFixed(2)}%`;
                  return value;
                }}
              />
              <Tooltip
                formatter={(value, name) => {
                  if (typeof value === 'number') return [`${value.toFixed(2)}%`, name];
                  return [value, name];
                }}
                labelFormatter={(label) => `Fecha: ${label}`}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '10px', cursor: 'pointer' }}
                onClick={(e) => handleLegendClick(e.dataKey as string)}
              />
              {selectedStocks.map((stock, idx) => (
                <Line
                  key={stock}
                  type="monotone"
                  dataKey={stock}
                  stroke={colors[idx % colors.length]}
                  strokeWidth={hiddenLines.includes(stock) ? 0 : 2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  hide={hiddenLines.includes(stock)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default App;