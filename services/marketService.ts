import { DataSource, Candle } from "../types";

// --- BINANCE CONFIG (Crypto Fallback) ---
const BINANCE_SYMBOL = 'XAUUSDT';
const BINANCE_REST = 'https://api.binance.com/api/v3';
const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

// --- TWELVE DATA CONFIG (Real Forex) ---
const TWELVE_SYMBOL = 'XAU/USD';
const TWELVE_REST = 'https://api.twelvedata.com';
const TWELVE_WS = 'wss://ws.twelvedata.com/v1/quotes';

// Global state for service configuration
let currentDataSource: DataSource = 'BINANCE';
let twelveDataApiKey: string = '';

export const configureMarketService = (source: DataSource, apiKey?: string) => {
  currentDataSource = source;
  if (apiKey) twelveDataApiKey = apiKey;
};

/**
 * Generates realistic mock history
 */
const generateMockHistory = (limit: number): Candle[] => {
  const candles: Candle[] = [];
  let price = 2650.00; 
  const now = Date.now();
  const endTimestamp = Math.floor(now / 60000) * 60000;

  for (let i = limit; i > 0; i--) {
    const time = endTimestamp - (i * 60000);
    const change = (Math.random() - 0.5) * 1.5;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 0.5;
    const low = Math.min(open, close) - Math.random() * 0.5;
    
    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: Math.random() * 50 + 10
    });
    price = close;
  }
  return candles;
};

/**
 * FETCH HISTORICAL DATA
 */
export const fetchHistoricalData = async (limit: number = 100): Promise<Candle[]> => {
  if (currentDataSource === 'TWELVEDATA' && twelveDataApiKey) {
    return fetchTwelveDataHistory(limit);
  } else {
    return fetchBinanceHistory(limit);
  }
};

const fetchBinanceHistory = async (limit: number): Promise<Candle[]> => {
  try {
    const response = await fetch(`${BINANCE_REST}/klines?symbol=${BINANCE_SYMBOL}&interval=1m&limit=${limit}`);
    if (!response.ok) throw new Error("Binance API Error");
    const rawData = await response.json();
    return rawData.map((d: any) => ({
      time: d[0],
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
  } catch (error) {
    console.warn("Binance API unavailable. Using Sim.");
    return generateMockHistory(limit);
  }
};

const fetchTwelveDataHistory = async (limit: number): Promise<Candle[]> => {
  try {
    // Note: Twelve Data outputsize is max 5000, usually efficient.
    const url = `${TWELVE_REST}/time_series?symbol=${TWELVE_SYMBOL}&interval=1min&apikey=${twelveDataApiKey}&outputsize=${limit}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'error') {
      console.error("Twelve Data Error:", data.message);
      throw new Error(data.message);
    }

    // Twelve Data returns newest first, reverse it for charts
    return data.values.map((d: any) => ({
      time: new Date(d.datetime).getTime(),
      open: parseFloat(d.open),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      close: parseFloat(d.close),
      volume: 0 // Twelve data basic forex often doesn't have volume, or separate subscription
    })).reverse();

  } catch (error) {
    console.warn("Twelve Data History Failed (Check API Key). Fallback to Binance.");
    return fetchBinanceHistory(limit);
  }
};

/**
 * SUBSCRIBE TO REAL-TIME DATA
 */
export const subscribeToMarket = (onUpdate: (candle: Candle) => void, initialPrice: number) => {
  if (currentDataSource === 'TWELVEDATA' && twelveDataApiKey) {
    return subscribeTwelveDataWS(onUpdate, initialPrice);
  } else {
    return subscribeBinanceWS(onUpdate, initialPrice);
  }
};

// --- BINANCE WS IMPLEMENTATION ---
const subscribeBinanceWS = (onUpdate: (candle: Candle) => void, initialPrice: number) => {
  let ws: WebSocket | null = null;
  let active = true;

  const connect = () => {
    ws = new WebSocket(`${BINANCE_WS}/${BINANCE_SYMBOL.toLowerCase()}@kline_1m`);
    
    ws.onmessage = (event) => {
      if (!active) return;
      const message = JSON.parse(event.data);
      if (message.e === 'kline') {
        const k = message.k;
        onUpdate({
          time: k.t,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        });
      }
    };

    ws.onerror = (e) => console.log("Binance WS Error", e);
  };

  connect();

  return () => {
    active = false;
    if (ws) ws.close();
  };
};

// --- TWELVE DATA WS IMPLEMENTATION ---
const subscribeTwelveDataWS = (onUpdate: (candle: Candle) => void, initialPrice: number) => {
  let ws: WebSocket | null = null;
  let active = true;
  
  // Need to build local candle from ticks/quotes because TD sends updates
  let currentCandle: Candle = {
    time: Math.floor(Date.now() / 60000) * 60000,
    open: initialPrice,
    high: initialPrice,
    low: initialPrice,
    close: initialPrice,
    volume: 0
  };

  const connect = () => {
    // 1. WebSocket URL with API Key
    ws = new WebSocket(`${TWELVE_WS}?apikey=${twelveDataApiKey}`);

    ws.onopen = () => {
      console.log("Connected to Twelve Data WS");
      // 2. Subscribe Action
      if (ws) {
        ws.send(JSON.stringify({
          action: "subscribe",
          params: { symbols: TWELVE_SYMBOL }
        }));
      }
    };

    ws.onmessage = (event) => {
      if (!active) return;
      const data = JSON.parse(event.data);
      
      if (data.event === 'price') {
        const price = parseFloat(data.price);
        const now = Date.now();
        const minuteStart = Math.floor(now / 60000) * 60000;

        // Reset candle if new minute
        if (minuteStart > currentCandle.time) {
          currentCandle = {
            time: minuteStart,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0
          };
        }

        // Update High/Low
        currentCandle.close = price;
        currentCandle.high = Math.max(currentCandle.high, price);
        currentCandle.low = Math.min(currentCandle.low, price);
        
        // Push update
        onUpdate({ ...currentCandle });
      }
    };
    
    ws.onerror = (e) => console.log("Twelve Data WS Error:", e);
  };

  connect();

  return () => {
    active = false;
    if (ws) ws.close();
  };
};