import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SignalData, SignalType, Timeframe, MarketData, AIModel } from "../types";

// Reusable property definition for a signal
const signalProperties = {
  signal: {
    type: Type.STRING,
    enum: ["BUY", "SELL", "NEUTRAL", "WAIT"],
    description: "The trading signal recommendation."
  },
  confidence: {
    type: Type.INTEGER,
    description: "Confidence level of the signal from 0 to 100."
  },
  entryPrice: {
    type: Type.NUMBER,
    description: "Recommended entry price level."
  },
  stopLoss: {
    type: Type.NUMBER,
    description: "Recommended stop loss level (Must be calculated using ATR)."
  },
  takeProfit: {
    type: Type.NUMBER,
    description: "Recommended take profit level (1:1.5 or 1:2 Risk Reward)."
  },
  reasoning: {
    type: Type.STRING,
    description: "Detailed technical reasoning citing specific indicators."
  }
};

// Batch Schema to get all timeframes in one API call
const batchSignalSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    M1: { type: Type.OBJECT, properties: signalProperties, required: ["signal", "confidence", "entryPrice", "stopLoss", "takeProfit", "reasoning"] },
    M5: { type: Type.OBJECT, properties: signalProperties, required: ["signal", "confidence", "entryPrice", "stopLoss", "takeProfit", "reasoning"] },
    M15: { type: Type.OBJECT, properties: signalProperties, required: ["signal", "confidence", "entryPrice", "stopLoss", "takeProfit", "reasoning"] },
  },
  required: ["M1", "M5", "M15"]
};

export const analyzeAllTimeframes = async (
  marketData: MarketData,
  modelId: AIModel = 'gemini-2.5-flash',
  userApiKey?: string
): Promise<Record<Timeframe, SignalData>> => {
  
  // Prioritize User Key from UI, fallback to Env, fallback to null
  // Robust check: Ensure process.env.API_KEY is not "undefined" string and has length
  const envKey = process.env.API_KEY;
  const validEnvKey = (envKey && envKey !== "undefined" && envKey.length > 5) ? envKey : undefined;
  
  const effectiveKey = userApiKey || validEnvKey;

  if (!effectiveKey) {
    console.warn("API Key missing (Both User & Env). Using simulation mode.");
    return generateBatchMockSignals(marketData);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: effectiveKey });
    
    // Pro-Grade Institutional Analysis Prompt for Exness/Forex
    const prompt = `
      Act as a Lead Market Analyst for a Forex & Commodities Desk specializing in Spot Gold (XAUUSD).
      The user has manually calibrated the feed to match their broker (Exness). Use the provided price data as the absolute truth.

      MARKET TELEMETRY (REAL-TIME CALIBRATED):
      ----------------------------------------
      Price: ${marketData.price.toFixed(2)}
      
      [TREND STRENGTH & STRUCTURE]
      ADX (14): ${marketData.adx.toFixed(2)} (${marketData.adx > 25 ? 'TRENDING' : 'RANGING/CHOPPY'})
      Ichimoku: Price ${marketData.price > marketData.ichimoku.kijun ? 'ABOVE' : 'BELOW'} Kijun-sen (Base Line)
      EMA200: ${marketData.ema200.toFixed(2)} (Major Trend Bias: ${marketData.price > marketData.ema200 ? 'BULLISH' : 'BEARISH'})
      
      [MOMENTUM & CYCLES]
      RSI (14): ${marketData.rsi}
      Stochastic: ${marketData.stochK.toFixed(2)}
      
      [KEY LEVELS]
      Pivot Point: ${marketData.pivots.pivot.toFixed(2)}
      Resistance (R1): ${marketData.pivots.r1.toFixed(2)}
      Support (S1): ${marketData.pivots.s1.toFixed(2)}
      Bollinger: ${marketData.price > marketData.bollinger.upper ? 'UPPER BREAKOUT' : marketData.price < marketData.bollinger.lower ? 'LOWER BREAKOUT' : 'INSIDE'}
      Volatility (ATR): ${marketData.atr.toFixed(2)}
      ----------------------------------------

      INSTITUTIONAL STRATEGY MATRIX (EXNESS / FOREX SPECIFIC):

      1. PSYCHOLOGICAL LEVELS (Forex Nuance):
         - Forex markets heavily respect "Round Numbers" (e.g., .00, .50, .20, .80). 
         - If Price is near a round number and ADX < 20, expect a Rejection (Mean Reversion).

      2. TREND FILTER (ADX & Ichimoku Rule):
         - If ADX < 20: IGNORE trend following signals. Trade ONLY Bollinger Reversals or Pivot Bounces.
         - If ADX > 25: Follow the direction of Ichimoku Kijun-sen. Breakouts are valid.

      3. SMART MONEY CONCEPTS (SMC):
         - Look for "Liquidity Grabs": If Price breaks a Pivot or Bollinger Band but immediately reverses (RSI Divergence), fade the move.
         - Confluence: A strong signal requires at least 3 confirmations (e.g., Price > EMA200 + RSI < 70 + Bounce off Pivot).

      4. EXNESS EXECUTION:
         - Account for typical spread.
         - Stop Loss must be wide enough to avoid "Stop Hunts" (Minimum 1.5x ATR).
         - M1 Scalping: Very high risk. Only signal if confidence > 85.

      RESPONSE REQUIREMENTS:
      - If conditions are mixed (e.g., ADX weak but Momentum high), output "WAIT".
      - Be conservative. Preserving capital is priority #1.
      
      Output JSON matching the schema.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: batchSignalSchema,
        temperature: 0.1 // Low temp for high precision
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const result = JSON.parse(text);
    const timestamp = Date.now();

    const mapSignal = (raw: any): SignalData => ({
      type: raw.signal as SignalType,
      confidence: raw.confidence,
      entryPrice: raw.entryPrice,
      stopLoss: raw.stopLoss,
      takeProfit: raw.takeProfit,
      reasoning: raw.reasoning,
      timestamp: timestamp
    });

    return {
      [Timeframe.M1]: mapSignal(result.M1),
      [Timeframe.M5]: mapSignal(result.M5),
      [Timeframe.M15]: mapSignal(result.M15),
    };

  } catch (error: any) {
    console.warn("Gemini Analysis Error (switching to simulation):", error.message || error);
    return generateBatchMockSignals(marketData);
  }
};

const generateBatchMockSignals = (data: MarketData): Record<Timeframe, SignalData> => {
  const timestamp = Date.now();
  
  const generateOne = (tf: Timeframe): SignalData => {
    let type = SignalType.NEUTRAL;
    let confidence = 50;
    
    // Mock Advanced Logic
    const trendBullish = data.price > data.ema200 && data.price > data.ichimoku.kijun;
    const trendBearish = data.price < data.ema200 && data.price < data.ichimoku.kijun;
    
    const momBullish = data.rsi < 45 && data.macd.histogram > 0;
    const momBearish = data.rsi > 55 && data.macd.histogram < 0;

    if (trendBullish && momBullish) { type = SignalType.BUY; confidence = 80; }
    else if (trendBearish && momBearish) { type = SignalType.SELL; confidence = 80; }
    else if (data.adx < 20) {
        // Range trading
        if (data.price <= data.bollinger.lower) { type = SignalType.BUY; confidence = 65; }
        else if (data.price >= data.bollinger.upper) { type = SignalType.SELL; confidence = 65; }
        else { type = SignalType.WAIT; }
    } else {
        type = SignalType.WAIT;
    }

    const atrMultiplier = tf === Timeframe.M1 ? 1.5 : 2;
    const slDist = data.atr * atrMultiplier;
    const tpDist = slDist * 2;

    return {
      type,
      confidence: Math.floor(confidence + (Math.random() * 5)),
      entryPrice: data.price,
      stopLoss: parseFloat((data.price + (type === SignalType.BUY ? -slDist : slDist)).toFixed(2)),
      takeProfit: parseFloat((data.price + (type === SignalType.BUY ? tpDist : -tpDist)).toFixed(2)),
      reasoning: `Simulated (Exness Mode): Price calibrated. ADX ${data.adx.toFixed(1)} suggests ${data.adx > 25 ? 'Trend' : 'Range'}. Ichimoku ${trendBullish ? 'Bullish' : trendBearish ? 'Bearish' : 'Neutral'}.`,
      timestamp
    };
  };

  return {
    [Timeframe.M1]: generateOne(Timeframe.M1),
    [Timeframe.M5]: generateOne(Timeframe.M5),
    [Timeframe.M15]: generateOne(Timeframe.M15),
  };
};