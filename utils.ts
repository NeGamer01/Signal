import { Timeframe, Candle } from './types';

// Helper to format currency
export const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

export const getTimeframeLabel = (tf: Timeframe) => {
  switch (tf) {
    case Timeframe.M1: return '1 Minute (Scalping)';
    case Timeframe.M5: return '5 Minutes (Intraday)';
    case Timeframe.M15: return '15 Minutes (Swing)';
    default: return tf;
  }
};

/**
 * Calculates Simple Moving Average (SMA)
 */
export const calculateSMA = (data: number[], period: number): number => {
  if (data.length < period) return data[data.length - 1];
  const slice = data.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
};

/**
 * Calculates Exponential Moving Average (EMA)
 */
export const calculateEMA = (data: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const emaArray: number[] = [data[0]]; 
  
  for (let i = 1; i < data.length; i++) {
    const ema = (data[i] * k) + (emaArray[i - 1] * (1 - k));
    emaArray.push(ema);
  }
  return emaArray;
};

/**
 * Calculates MACD (12, 26, 9)
 */
export const calculateMACD = (prices: number[]) => {
  if (prices.length < 26) return { macdLine: 0, signalLine: 0, histogram: 0 };

  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  const macdLineArr = prices.map((_, i) => ema12[i] - ema26[i]);
  const signalLineArr = calculateEMA(macdLineArr, 9);
  
  const currentMACD = macdLineArr[macdLineArr.length - 1];
  const currentSignal = signalLineArr[signalLineArr.length - 1];
  
  return {
    macdLine: currentMACD,
    signalLine: currentSignal,
    histogram: currentMACD - currentSignal
  };
};

/**
 * Calculates BollingerBands (20, 2)
 */
export const calculateBollingerBands = (prices: number[], period: number = 20, multiplier: number = 2) => {
  if (prices.length < period) return { upper: prices[prices.length-1], middle: prices[prices.length-1], lower: prices[prices.length-1] };
  
  const sma = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const squaredDiffs = slice.map(x => Math.pow(x - mean, 2));
  const standardDeviation = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);

  return {
    middle: sma,
    upper: sma + (standardDeviation * multiplier),
    lower: sma - (standardDeviation * multiplier)
  };
};

/**
 * Calculates Average True Range (ATR) for volatility
 */
export const calculateATR = (highs: number[], lows: number[], closes: number[], period: number = 14): number => {
  if (highs.length < period + 1) return 1;

  const trs = [];
  for(let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i-1]),
      Math.abs(lows[i] - closes[i-1])
    );
    trs.push(tr);
  }

  const slice = trs.slice(-period);
  return slice.reduce((a,b) => a+b, 0) / period;
};

/**
 * Calculates Stochastic Oscillator (14, 3, 3)
 */
export const calculateStochastic = (highs: number[], lows: number[], closes: number[], period: number = 14) => {
  if (highs.length < period) return { k: 50, d: 50 };

  const currentClose = closes[closes.length - 1];
  const periodHighs = highs.slice(-period);
  const periodLows = lows.slice(-period);
  
  const highestHigh = Math.max(...periodHighs);
  const lowestLow = Math.min(...periodLows);

  let k = 50;
  if (highestHigh !== lowestLow) {
    k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  }
  
  return { k, d: k }; 
};

/**
 * Calculates RSI (Relative Strength Index)
 */
export const calculateRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return parseFloat(rsi.toFixed(2));
};

/**
 * Calculates ADX (Average Directional Index) 14
 * Used to determine Trend Strength (Not direction)
 * ADX > 25 = Strong Trend
 * ADX < 20 = Weak Trend (Range)
 */
export const calculateADX = (highs: number[], lows: number[], closes: number[], period: number = 14): number => {
  if (highs.length < period * 2) return 20; // Need more data for smoothing

  const trs = [];
  const plusDMs = [];
  const minusDMs = [];

  for (let i = 1; i < highs.length; i++) {
    const currentHigh = highs[i];
    const currentLow = lows[i];
    const prevHigh = highs[i-1];
    const prevLow = lows[i-1];
    const prevClose = closes[i-1];

    const tr = Math.max(currentHigh - currentLow, Math.abs(currentHigh - prevClose), Math.abs(currentLow - prevClose));
    trs.push(tr);

    const upMove = currentHigh - prevHigh;
    const downMove = prevLow - currentLow;

    if (upMove > downMove && upMove > 0) {
      plusDMs.push(upMove);
      minusDMs.push(0);
    } else if (downMove > upMove && downMove > 0) {
      plusDMs.push(0);
      minusDMs.push(downMove);
    } else {
      plusDMs.push(0);
      minusDMs.push(0);
    }
  }

  // Initial Smoothed values (Wilder's Smoothing)
  let smoothTR = trs.slice(0, period).reduce((a,b) => a+b, 0);
  let smoothPlusDM = plusDMs.slice(0, period).reduce((a,b) => a+b, 0);
  let smoothMinusDM = minusDMs.slice(0, period).reduce((a,b) => a+b, 0);

  // Smooth the rest
  for (let i = period; i < trs.length; i++) {
    smoothTR = smoothTR - (smoothTR / period) + trs[i];
    smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDMs[i];
    smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDMs[i];
  }

  const plusDI = (smoothPlusDM / smoothTR) * 100;
  const minusDI = (smoothMinusDM / smoothTR) * 100;
  const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;

  // For simplicity in this real-time app, we return the instantaneous DX as ADX approximation 
  // or we would need to smooth DX again. Returning DX for responsiveness.
  return parseFloat(dx.toFixed(2));
};

/**
 * Calculates Ichimoku Components (Tenkan and Kijun only)
 */
export const calculateIchimoku = (highs: number[], lows: number[]) => {
  const getAverage = (period: number) => {
    if (highs.length < period) return (highs[highs.length-1] + lows[lows.length-1]) / 2;
    const sliceHigh = highs.slice(-period);
    const sliceLow = lows.slice(-period);
    const max = Math.max(...sliceHigh);
    const min = Math.min(...sliceLow);
    return (max + min) / 2;
  };

  const tenkan = getAverage(9);
  const kijun = getAverage(26);

  // Cloud status simplified
  const cloudStatus = tenkan > kijun ? 'ABOVE' : 'BELOW';

  return { tenkan, kijun, cloudStatus: cloudStatus as 'ABOVE'|'BELOW'|'INSIDE' };
};

/**
 * Generate full Ichimoku Series Data for Charts
 */
export const generateIchimokuData = (candles: Candle[]) => {
  const tenkanSeries: { time: number, value: number }[] = [];
  const kijunSeries: { time: number, value: number }[] = [];
  const spanASeries: { time: number, value: number }[] = [];
  const spanBSeries: { time: number, value: number }[] = [];

  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  const getHL2 = (index: number, period: number) => {
    if (index < period - 1) return null;
    const sliceHigh = highs.slice(index - period + 1, index + 1);
    const sliceLow = lows.slice(index - period + 1, index + 1);
    return (Math.max(...sliceHigh) + Math.min(...sliceLow)) / 2;
  };

  for (let i = 0; i < candles.length; i++) {
    const time = candles[i].time / 1000; // Convert to seconds for lightweight-charts
    
    // Tenkan (9)
    const tenkan = getHL2(i, 9);
    if (tenkan !== null) tenkanSeries.push({ time: time as any, value: tenkan });

    // Kijun (26)
    const kijun = getHL2(i, 26);
    if (kijun !== null) kijunSeries.push({ time: time as any, value: kijun });

    // Span A (Tenkan + Kijun)/2 projected 26 forward
    if (tenkan !== null && kijun !== null) {
      const spanA = (tenkan + kijun) / 2;
      // Calculate future timestamp (Assuming 1 minute interval for simplicity in base calculation)
      // In a real app with mixed timeframes, we'd need exact interval logic.
      // Here we estimate 60s * 26.
      const futureTime = time + (26 * 60); 
      spanASeries.push({ time: futureTime as any, value: spanA });
    }

    // Span B (52) projected 26 forward
    const spanBVal = getHL2(i, 52);
    if (spanBVal !== null) {
      const futureTime = time + (26 * 60);
      spanBSeries.push({ time: futureTime as any, value: spanBVal });
    }
  }

  return { tenkanSeries, kijunSeries, spanASeries, spanBSeries };
};

/**
 * Calculates Pivot Points (Standard) based on previous Candle (or simplified recent High/Low/Close)
 */
export const calculatePivotPoints = (high: number, low: number, close: number) => {
  const pivot = (high + low + close) / 3;
  const r1 = (2 * pivot) - low;
  const s1 = (2 * pivot) - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);

  return { pivot, r1, s1, r2, s2 };
};