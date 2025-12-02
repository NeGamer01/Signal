import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, BarChart3, Settings, ShieldAlert, Cpu, Zap, Wifi, WifiOff, PenTool, Trash2, Gauge, Anchor, Layers, RefreshCcw, CheckCircle2, Globe, Server, ArrowRightLeft, KeyRound, Database, BrainCircuit, Bot, CandlestickChart, Eye, CloudRain, Volume2, VolumeX } from 'lucide-react';
import { MarketData, SignalData, Timeframe, ChartPoint, TrendLine, DataSource, AIModel, Candle, SignalType } from './types';
import { calculateRSI, calculateSMA, calculateEMA, calculateMACD, calculateBollingerBands, calculateATR, calculateStochastic, calculateADX, calculateIchimoku, calculatePivotPoints } from './utils';
import { analyzeAllTimeframes } from './services/geminiService';
import { fetchHistoricalData, subscribeToMarket, configureMarketService } from './services/marketService';
import SignalCard from './components/SignalCard';
import LiveChart from './components/LiveChart';
import TradingViewChart from './components/TradingViewChart';

const INITIAL_PRICE = 2650.00; 

// Professional "Sonar Ping" sound (Base64) for offline reliability
const ALERT_SOUND_B64 = "data:audio/wav;base64,UklGRl9vT1BXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"; // Short placeholder
// Using a better sound URI for the demo (Glass Ping)
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export default function App() {
  // --- State Management ---
  const [marketData, setMarketData] = useState<MarketData>({
    price: INITIAL_PRICE,
    change: 0,
    changePercent: 0,
    high: INITIAL_PRICE,
    low: INITIAL_PRICE,
    volume: 0,
    // Technicals
    rsi: 50,
    ma50: INITIAL_PRICE,
    ema200: INITIAL_PRICE,
    macd: { macdLine: 0, signalLine: 0, histogram: 0 },
    bollinger: { upper: INITIAL_PRICE, middle: INITIAL_PRICE, lower: INITIAL_PRICE },
    stochK: 50,
    stochD: 50,
    atr: 1.5,
    // Advanced
    adx: 20,
    ichimoku: { tenkan: INITIAL_PRICE, kijun: INITIAL_PRICE, cloudStatus: 'INSIDE' },
    pivots: { pivot: INITIAL_PRICE, r1: INITIAL_PRICE, s1: INITIAL_PRICE, r2: INITIAL_PRICE, s2: INITIAL_PRICE }
  });

  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]); // New State for Full Candle History
  const [isConnected, setIsConnected] = useState(false);
  
  // --- Calibration & Provider State ---
  // Defaulting to TWELVEDATA with the user provided key
  const [dataSource, setDataSource] = useState<DataSource>('TWELVEDATA');
  const [twelveDataKey, setTwelveDataKey] = useState<string>('2c476b93e3714ebeaf56a6f3064e7063'); 
  
  // --- AI Settings State ---
  const [selectedModel, setSelectedModel] = useState<AIModel>('gemini-2.5-flash');
  // Initialize from local storage if available
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => localStorage.getItem('USER_GEMINI_KEY') || '');

  const [priceOffset, setPriceOffset] = useState<number>(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [manualPriceInput, setManualPriceInput] = useState<string>("");

  // Signals for each timeframe
  const [signals, setSignals] = useState<Record<Timeframe, SignalData | null>>({
    [Timeframe.M1]: null,
    [Timeframe.M5]: null,
    [Timeframe.M15]: null,
  });

  const [isScanning, setIsScanning] = useState(false);
  const [showSettings, setShowSettings] = useState(false); // Settings Modal

  // --- Drawing Tools & View State ---
  const [isDrawing, setIsDrawing] = useState(false);
  const [trendLines, setTrendLines] = useState<TrendLine[]>([]);
  const [chartView, setChartView] = useState<'SIMPLE' | 'PRO'>('PRO');
  // State for which signal to visualize on the chart
  const [chartOverlayTimeframe, setChartOverlayTimeframe] = useState<Timeframe | 'OFF'>(Timeframe.M5);
  // State for showing Ichimoku
  const [showIchimoku, setShowIchimoku] = useState(false);
  // State for Audio
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  // Refs for data persistence across closures
  const candlesRef = useRef<Candle[]>([]);
  const marketDataRef = useRef(marketData);
  const offsetRef = useRef(priceOffset);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Keep ref in sync
  useEffect(() => { marketDataRef.current = marketData; }, [marketData]);
  useEffect(() => { offsetRef.current = priceOffset; }, [priceOffset]);

  // Check if Server Key is available (Safe check for Vercel/Vite env)
  const hasServerKey = useMemo(() => {
    // @ts-ignore
    const envKey = process.env.API_KEY;
    return Boolean(envKey && envKey.length > 5 && envKey !== 'undefined');
  }, []);

  // Initialize Audio
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
    audioRef.current.volume = 0.5;
  }, []);

  // --- Derived Data with Offset Applied ---
  const displayData = useMemo(() => {
    const offset = priceOffset;
    return {
      ...marketData,
      price: marketData.price + offset,
      high: marketData.high + offset,
      low: marketData.low + offset,
      ma50: marketData.ma50 + offset,
      ema200: marketData.ema200 + offset,
      bollinger: {
        upper: marketData.bollinger.upper + offset,
        middle: marketData.bollinger.middle + offset,
        lower: marketData.bollinger.lower + offset
      },
      ichimoku: {
        ...marketData.ichimoku,
        tenkan: marketData.ichimoku.tenkan + offset,
        kijun: marketData.ichimoku.kijun + offset,
      },
      pivots: {
        pivot: marketData.pivots.pivot + offset,
        r1: marketData.pivots.r1 + offset,
        s1: marketData.pivots.s1 + offset,
        r2: marketData.pivots.r2 + offset,
        s2: marketData.pivots.s2 + offset,
      }
    };
  }, [marketData, priceOffset]);

  const displayChartData = useMemo(() => {
    return chartData.map(pt => ({
      ...pt,
      value: pt.value + priceOffset
    }));
  }, [chartData, priceOffset]);

  const displayCandles = useMemo(() => {
    const offset = priceOffset;
    return candles.map(c => ({
      ...c,
      open: c.open + offset,
      high: c.high + offset,
      low: c.low + offset,
      close: c.close + offset
    }));
  }, [candles, priceOffset]);

  // Helper to process indicators
  const processIndicators = (candles: Candle[]) => {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    const rsi = calculateRSI(closes, 14);
    const ma50 = calculateSMA(closes, 50);
    const ema200Arr = calculateEMA(closes, 200); 
    const ema200 = ema200Arr[ema200Arr.length - 1] || ma50;

    const macd = calculateMACD(closes);
    const bollinger = calculateBollingerBands(closes, 20);
    const atr = calculateATR(highs, lows, closes, 14);
    const stoch = calculateStochastic(highs, lows, closes, 14);
    
    // New Advanced Indicators
    const adx = calculateADX(highs, lows, closes, 14);
    const ichimoku = calculateIchimoku(highs, lows);
    
    // Pivot Points
    const lastCandle = candles[candles.length - 1];
    const pivots = calculatePivotPoints(lastCandle.high, lastCandle.low, lastCandle.close);

    return { rsi, ma50, ema200, macd, bollinger, atr, stoch, adx, ichimoku, pivots };
  };

  // --- 1. Real-time Market Data Integration ---
  useEffect(() => {
    let cleanupWs: (() => void) | undefined;

    // Apply Service Configuration
    configureMarketService(dataSource, twelveDataKey);

    const initMarket = async () => {
      // Clear old data when switching sources
      setIsConnected(false);
      setChartData([]);
      setCandles([]);
      
      const history = await fetchHistoricalData(250); 
      
      let lastKnownPrice = INITIAL_PRICE;

      if (history.length > 0) {
        candlesRef.current = history;
        setCandles(history);
        
        const lastCandle = history[history.length - 1];
        lastKnownPrice = lastCandle.close;
        const prevCandle = history[history.length - 2] || lastCandle;

        // Calculate Technicals
        const techs = processIndicators(history);
        
        // Format chart data
        const formattedChartData = history.slice(-60).map(c => ({
           time: new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
           value: c.close
        }));

        setChartData(formattedChartData);
        setMarketData({
          price: lastCandle.close,
          change: lastCandle.close - prevCandle.close,
          changePercent: ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100,
          high: lastCandle.high,
          low: lastCandle.low,
          volume: lastCandle.volume,
          rsi: techs.rsi,
          ma50: techs.ma50,
          ema200: techs.ema200,
          macd: techs.macd,
          bollinger: techs.bollinger,
          stochK: techs.stoch.k,
          stochD: techs.stoch.d,
          atr: techs.atr,
          adx: techs.adx,
          ichimoku: techs.ichimoku,
          pivots: techs.pivots
        });
        setIsConnected(true);
      }

      // 2. Subscribe to Real-time WebSocket
      cleanupWs = subscribeToMarket((newCandle) => {
        setIsConnected(true);
        
        // Update Candle History
        const lastStored = candlesRef.current[candlesRef.current.length - 1];
        
        let updatedHistory = [...candlesRef.current];
        if (lastStored && lastStored.time === newCandle.time) {
          updatedHistory[updatedHistory.length - 1] = newCandle;
        } else {
          updatedHistory.push(newCandle);
          if (updatedHistory.length > 300) updatedHistory.shift(); // Keep buffer
        }
        
        candlesRef.current = updatedHistory;
        setCandles(updatedHistory); // Trigger React Re-render for charts

        // Recalculate Indicators with new data
        const techs = processIndicators(candlesRef.current);
        
        const prevClose = candlesRef.current.length > 1 
          ? candlesRef.current[candlesRef.current.length - 2].close 
          : newCandle.open;

        setMarketData(prev => ({
          ...prev,
          price: newCandle.close,
          change: newCandle.close - prevClose,
          changePercent: prevClose !== 0 ? ((newCandle.close - prevClose) / prevClose) * 100 : 0,
          high: Math.max(prev.high, newCandle.high), 
          low: Math.min(prev.low, newCandle.low),
          volume: newCandle.volume,
          rsi: techs.rsi,
          ma50: techs.ma50,
          ema200: techs.ema200,
          macd: techs.macd,
          bollinger: techs.bollinger,
          stochK: techs.stoch.k,
          stochD: techs.stoch.d,
          atr: techs.atr,
          adx: techs.adx,
          ichimoku: techs.ichimoku,
          pivots: techs.pivots
        }));

        // Update Simple Chart
        const chartPoint = {
          time: new Date(newCandle.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          value: newCandle.close
        };

        setChartData(prev => {
          const newData = [...prev];
          if (newData.length > 0 && newData[newData.length - 1].time === chartPoint.time) {
             newData[newData.length - 1] = chartPoint; 
          } else {
             newData.push(chartPoint); 
             if (newData.length > 60) newData.shift();
          }
          return newData;
        });
      }, lastKnownPrice);
    };

    initMarket();

    return () => {
      if (cleanupWs) cleanupWs();
    };
  }, [dataSource, twelveDataKey]); // Re-run when source or key changes

  // --- 2. AI Scanner Loop Effect (Batch Mode) ---
  useEffect(() => {
    const runBatchScanner = async () => {
      if (!candlesRef.current.length) return;

      setIsScanning(true);
      
      const currentRaw = marketDataRef.current;
      const currentOffset = offsetRef.current;
      
      const aiData: MarketData = {
        ...currentRaw,
        price: currentRaw.price + currentOffset,
        ema200: currentRaw.ema200 + currentOffset,
        ichimoku: {
            ...currentRaw.ichimoku,
            tenkan: currentRaw.ichimoku.tenkan + currentOffset,
            kijun: currentRaw.ichimoku.kijun + currentOffset
        },
        pivots: {
            pivot: currentRaw.pivots.pivot + currentOffset,
            r1: currentRaw.pivots.r1 + currentOffset,
            s1: currentRaw.pivots.s1 + currentOffset,
            r2: currentRaw.pivots.r2 + currentOffset,
            s2: currentRaw.pivots.s2 + currentOffset
        },
        bollinger: {
            upper: currentRaw.bollinger.upper + currentOffset,
            middle: currentRaw.bollinger.middle + currentOffset,
            lower: currentRaw.bollinger.lower + currentOffset
        }
      };

      // Pass the selected model ID and the User API Key to the service
      const newSignals = await analyzeAllTimeframes(aiData, selectedModel, geminiApiKey);
      setSignals(newSignals);
      
      // Play Sound if High Confidence Signal
      if (isSoundEnabled && audioRef.current) {
        const hasHighConfidence = Object.values(newSignals).some(
          s => s.confidence >= 80 && (s.type === SignalType.BUY || s.type === SignalType.SELL)
        );
        if (hasHighConfidence) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.log("Audio play failed (interaction required):", e));
        }
      }

      setIsScanning(false);
    };

    if (isConnected) runBatchScanner();

    const scannerInterval = setInterval(() => {
       if (isConnected) runBatchScanner();
    }, 45000); 

    return () => clearInterval(scannerInterval);
  }, [isConnected, selectedModel, geminiApiKey, isSoundEnabled]);

  // --- Handler for Exness Calibration ---
  const handleCalibrate = () => {
    const userPrice = parseFloat(manualPriceInput);
    if (!isNaN(userPrice) && userPrice > 0) {
      const offset = userPrice - marketData.price;
      setPriceOffset(offset);
      
      // Save Gemini Key to local storage
      if (geminiApiKey) {
        localStorage.setItem('USER_GEMINI_KEY', geminiApiKey);
      } else {
        localStorage.removeItem('USER_GEMINI_KEY');
      }

      setIsCalibrating(false);
    }
  };

  const isPositive = marketData.change >= 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-emerald-500/30">
      
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-tr from-yellow-400 to-yellow-600 rounded-lg shadow-lg shadow-yellow-500/20">
                <BarChart3 className="w-6 h-6 text-gray-900" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600">
                  XAUUSD AI Scanner
                </h1>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Pro Institutional</span>
                   <span className="text-[10px] text-gray-600">|</span>
                   <span className="text-[10px] uppercase tracking-wider text-emerald-500 font-mono flex items-center gap-1">
                      <Zap className="w-3 h-3" /> {selectedModel.replace('gemini-', '').replace('-latest','')}
                   </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Audio Toggle */}
              <button
                onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                className={`p-2 rounded-lg transition-colors ${isSoundEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}
                title={isSoundEnabled ? "Mute Alerts" : "Enable Alerts"}
              >
                {isSoundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${isConnected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? 'LIVE FEED' : 'OFFLINE'}
              </div>

              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Top: Price Ticker & Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Price Card */}
          <div className="lg:col-span-1 bg-gray-900 rounded-xl border border-gray-800 p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <Activity className="w-24 h-24 text-white" />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Global Spot Price
              </h2>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-mono font-bold tracking-tighter ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {displayData.price.toFixed(2)}
                </span>
                <span className="text-lg text-gray-500 font-medium">USD</span>
              </div>
              <div className={`flex items-center gap-2 mt-2 text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                 {isPositive ? '+' : ''}{displayData.change.toFixed(2)} ({isPositive ? '+' : ''}{displayData.changePercent.toFixed(2)}%)
              </div>
              
              {/* Calibration Status */}
              <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-500">Exness Calibration</span>
                {priceOffset !== 0 ? (
                  <span className="text-xs text-yellow-400 font-mono bg-yellow-400/10 px-2 py-0.5 rounded">
                    {priceOffset > 0 ? '+' : ''}{priceOffset.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-600">OFF</span>
                )}
              </div>
            </div>
          </div>

          {/* Technical Telemetry Grid */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
             {/* RSI */}
             <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                   <span className="text-xs text-gray-500 uppercase font-bold">RSI (14)</span>
                   <Activity className="w-4 h-4 text-gray-600" />
                </div>
                <div className="text-2xl font-mono font-bold text-white">{displayData.rsi}</div>
                <div className="h-1.5 w-full bg-gray-800 rounded-full mt-2 overflow-hidden">
                   <div 
                     className={`h-full rounded-full transition-all duration-500 ${displayData.rsi > 70 ? 'bg-rose-500' : displayData.rsi < 30 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                     style={{ width: `${displayData.rsi}%` }} 
                   />
                </div>
             </div>

             {/* ADX Trend Strength */}
             <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                   <span className="text-xs text-gray-500 uppercase font-bold">ADX Trend</span>
                   <Gauge className="w-4 h-4 text-gray-600" />
                </div>
                <div className="text-2xl font-mono font-bold text-white">{displayData.adx}</div>
                <span className={`text-xs font-bold ${displayData.adx > 25 ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {displayData.adx > 25 ? 'STRONG TREND' : 'WEAK / RANGE'}
                </span>
             </div>

             {/* Ichimoku Status */}
             <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                   <span className="text-xs text-gray-500 uppercase font-bold">Ichimoku</span>
                   <Layers className="w-4 h-4 text-gray-600" />
                </div>
                <div className="text-lg font-mono font-bold text-white truncate">
                  {displayData.price > displayData.ichimoku.kijun ? 'BULLISH' : 'BEARISH'}
                </div>
                <span className="text-xs text-gray-500">vs Kijun-sen</span>
             </div>

             {/* Bollinger Status */}
             <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                   <span className="text-xs text-gray-500 uppercase font-bold">Volatility</span>
                   <ShieldAlert className="w-4 h-4 text-gray-600" />
                </div>
                <div className="text-lg font-mono font-bold text-white truncate">
                   {displayData.price > displayData.bollinger.upper ? 'BREAKOUT' : displayData.price < displayData.bollinger.lower ? 'BREAKOUT' : 'INSIDE'}
                </div>
                <span className="text-xs text-gray-500">ATR: {displayData.atr.toFixed(2)}</span>
             </div>
          </div>
        </div>

        {/* Signals Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-yellow-400" />
              AI Confluence Matrix
              <button 
                  onClick={() => setShowSettings(true)}
                  className="ml-2 p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-white transition"
                  title="Configure AI Model"
              >
                  <Settings className="w-4 h-4" />
              </button>
            </h3>
            <div className="flex items-center gap-2 text-sm">
               <span className="text-gray-500">Model:</span>
               <span className="text-yellow-400 font-mono">{selectedModel}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SignalCard timeframe={Timeframe.M1} signal={signals[Timeframe.M1]} isScanning={isScanning} />
            <SignalCard timeframe={Timeframe.M5} signal={signals[Timeframe.M5]} isScanning={isScanning} />
            <SignalCard timeframe={Timeframe.M15} signal={signals[Timeframe.M15]} isScanning={isScanning} />
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 gap-6 h-[600px]">
           <div className="bg-gray-900 rounded-xl border border-gray-800 p-1 flex flex-col overflow-hidden relative">
              {/* Chart Toolbar */}
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-gray-950/80 backdrop-blur p-1 rounded-lg border border-gray-800">
                <button 
                  onClick={() => setChartView('SIMPLE')}
                  className={`px-3 py-1 text-xs font-medium rounded ${chartView === 'SIMPLE' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Line
                </button>
                <button 
                  onClick={() => setChartView('PRO')}
                  className={`px-3 py-1 text-xs font-medium rounded ${chartView === 'PRO' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Pro (Candles)
                </button>
                <div className="w-px h-4 bg-gray-700 mx-1"></div>
                
                {/* Overlay Toggle */}
                <select 
                   className="bg-gray-800 text-xs text-white border border-gray-700 rounded px-2 py-1 outline-none"
                   value={chartOverlayTimeframe}
                   onChange={(e) => setChartOverlayTimeframe(e.target.value as any)}
                >
                   <option value="OFF">No Overlay</option>
                   <option value={Timeframe.M1}>Show M1 Signal</option>
                   <option value={Timeframe.M5}>Show M5 Signal</option>
                   <option value={Timeframe.M15}>Show M15 Signal</option>
                </select>

                <div className="w-px h-4 bg-gray-700 mx-1"></div>

                <button
                    onClick={() => setShowIchimoku(!showIchimoku)}
                    className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded border ${showIchimoku ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                >
                    <Layers className="w-3 h-3" /> Ichimoku Cloud
                </button>
              </div>

              {/* Chart Render */}
              <div className="flex-1 w-full h-full">
                {chartView === 'SIMPLE' ? (
                   <LiveChart 
                      data={displayChartData} 
                      color={isPositive ? "#10b981" : "#ef4444"} 
                      isDrawing={isDrawing}
                      trendLines={trendLines}
                      onAddLine={(l) => setTrendLines([...trendLines, l])}
                   />
                ) : (
                   <TradingViewChart 
                      data={displayCandles} 
                      signal={chartOverlayTimeframe !== 'OFF' ? signals[chartOverlayTimeframe as Timeframe] : null}
                      showIchimoku={showIchimoku}
                   />
                )}
              </div>
           </div>
        </div>

      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-400" /> Configuration
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            
            <div className="p-6 space-y-6">
              
              {/* 1. Gemini API Key Configuration */}
              <div className="space-y-3">
                 <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-yellow-500" />
                    Gemini API Key
                 </label>
                 <div className="space-y-2">
                    <input 
                       type="password" 
                       placeholder="Paste your Google Gemini API Key"
                       className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-yellow-500/50 outline-none"
                       value={geminiApiKey}
                       onChange={(e) => setGeminiApiKey(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${geminiApiKey ? 'bg-emerald-500' : hasServerKey ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                       <span className="text-xs text-gray-500">
                          {geminiApiKey ? 'Using Custom Key' : hasServerKey ? 'Using Server Environment Key (Vercel)' : 'No Key Detected (Sim Mode)'}
                       </span>
                    </div>
                    <p className="text-[10px] text-gray-500">
                       Get a free key at <a href="https://aistudio.google.com" target="_blank" className="text-blue-400 hover:underline">aistudio.google.com</a>.
                       Your key is stored locally in your browser.
                    </p>
                 </div>
              </div>

              <div className="w-full h-px bg-gray-800"></div>

              {/* 2. AI Model Selection */}
              <div className="space-y-3">
                 <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-purple-400" />
                    AI Model Configuration
                 </label>
                 <div className="grid grid-cols-1 gap-2">
                    <button 
                       onClick={() => setSelectedModel('gemini-flash-lite-latest')}
                       className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${selectedModel === 'gemini-flash-lite-latest' ? 'bg-purple-500/10 border-purple-500/50' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'}`}
                    >
                       <div className="p-2 bg-gray-900 rounded-md"><Zap className="w-4 h-4 text-yellow-400" /></div>
                       <div>
                          <div className="text-sm font-bold text-gray-200">Flash Lite (Scalper)</div>
                          <div className="text-[10px] text-gray-500">Fastest response. Best for M1 scalping.</div>
                       </div>
                    </button>

                    <button 
                       onClick={() => setSelectedModel('gemini-2.5-flash')}
                       className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${selectedModel === 'gemini-2.5-flash' ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'}`}
                    >
                       <div className="p-2 bg-gray-900 rounded-md"><Bot className="w-4 h-4 text-emerald-400" /></div>
                       <div>
                          <div className="text-sm font-bold text-gray-200">2.5 Flash (Balanced)</div>
                          <div className="text-[10px] text-gray-500">Recommended. Good mix of logic & speed.</div>
                       </div>
                    </button>

                    <button 
                       onClick={() => setSelectedModel('gemini-3-pro-preview')}
                       className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${selectedModel === 'gemini-3-pro-preview' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'}`}
                    >
                       <div className="p-2 bg-gray-900 rounded-md"><BrainCircuit className="w-4 h-4 text-blue-400" /></div>
                       <div>
                          <div className="text-sm font-bold text-gray-200">3.0 Pro (Analyst)</div>
                          <div className="text-[10px] text-gray-500">Deep reasoning. Slower. Best for M15 Swing.</div>
                       </div>
                    </button>
                 </div>
              </div>

              <div className="w-full h-px bg-gray-800"></div>

              {/* 3. Broker Calibration */}
              <div className="space-y-3">
                 <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Anchor className="w-4 h-4 text-orange-400" />
                    Exness/Broker Calibration
                 </label>
                 <div className="flex gap-2">
                    <input 
                       type="number" 
                       placeholder="Enter Price (e.g. 2655.50)"
                       className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-orange-500/50 outline-none"
                       value={manualPriceInput}
                       onChange={(e) => setManualPriceInput(e.target.value)}
                    />
                    <button 
                       onClick={handleCalibrate}
                       className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                       Sync
                    </button>
                 </div>
                 <p className="text-[10px] text-gray-500">
                    Fixes the spread difference between this feed and your MT4/MT5.
                 </p>
              </div>

              <div className="w-full h-px bg-gray-800"></div>
              
              {/* 4. Data Source */}
              <div className="space-y-3">
                 <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-400" />
                    Data Feed Source
                 </label>
                 <div className="flex gap-2 p-1 bg-gray-950 rounded-lg border border-gray-800">
                    <button 
                      onClick={() => setDataSource('TWELVEDATA')}
                      className={`flex-1 py-2 text-xs font-bold rounded ${dataSource === 'TWELVEDATA' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}
                    >
                      TwelveData (Forex)
                    </button>
                    <button 
                      onClick={() => setDataSource('BINANCE')}
                      className={`flex-1 py-2 text-xs font-bold rounded ${dataSource === 'BINANCE' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}
                    >
                      Binance (Crypto)
                    </button>
                 </div>
                 {dataSource === 'TWELVEDATA' && (
                    <input 
                      type="text" 
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-400 outline-none"
                      placeholder="TwelveData API Key"
                      value={twelveDataKey}
                      onChange={(e) => setTwelveDataKey(e.target.value)}
                    />
                 )}
              </div>

            </div>
            
            <div className="p-4 border-t border-gray-800 flex justify-end">
              <button 
                onClick={() => {
                  handleCalibrate();
                  setShowSettings(false);
                }}
                className="bg-white text-black hover:bg-gray-200 px-6 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}