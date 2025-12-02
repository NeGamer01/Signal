export enum Timeframe {
  M1 = 'M1',
  M5 = 'M5',
  M15 = 'M15',
}

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  NEUTRAL = 'NEUTRAL',
  WAIT = 'WAIT'
}

export type DataSource = 'BINANCE' | 'TWELVEDATA';

export type AIModel = 'gemini-2.5-flash' | 'gemini-flash-lite-latest' | 'gemini-3-pro-preview';

export interface SignalData {
  type: SignalType;
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string;
  timestamp: number;
}

export interface MACD {
  macdLine: number;
  signalLine: number;
  histogram: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

export interface Ichimoku {
  tenkan: number; // Conversion Line (9)
  kijun: number;  // Base Line (26)
  cloudStatus: 'ABOVE' | 'BELOW' | 'INSIDE'; // Simple Cloud status proxy
}

export interface PivotPoints {
  pivot: number;
  r1: number;
  s1: number;
  r2: number;
  s2: number;
}

export interface MarketData {
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  
  // Technical Indicators
  rsi: number;
  ma50: number;
  ema200: number; 
  macd: MACD;
  bollinger: BollingerBands;
  stochK: number; 
  stochD: number; 
  atr: number; 
  
  // Advanced Indicators
  adx: number; // Trend Strength
  ichimoku: Ichimoku;
  pivots: PivotPoints;
}

export interface ChartPoint {
  time: string;
  value: number;
}

export interface TrendLine {
  start: ChartPoint;
  end: ChartPoint;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}