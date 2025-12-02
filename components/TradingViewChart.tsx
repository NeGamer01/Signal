import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, LineStyle, IPriceLine } from 'lightweight-charts';
import { Candle, SignalData, SignalType } from '../types';
import { generateIchimokuData } from '../utils';

interface TradingViewChartProps {
  data: Candle[];
  signal?: SignalData | null;
  showIchimoku?: boolean;
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({ data, signal, showIchimoku = false }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  // Ichimoku Series Refs
  const tenkanRef = useRef<ISeriesApi<"Line"> | null>(null);
  const kijunRef = useRef<ISeriesApi<"Line"> | null>(null);
  const spanARef = useRef<ISeriesApi<"Line"> | null>(null);
  const spanBRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Refs for price lines to manage updates/removal
  const entryLineRef = useRef<IPriceLine | null>(null);
  const tpLineRef = useRef<IPriceLine | null>(null);
  const slLineRef = useRef<IPriceLine | null>(null);

  // Track state
  const isInitialized = useRef(false);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: '#9ca3af',
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151',
      },
      rightPriceScale: {
        borderColor: '#374151',
        scaleMargins: {
          top: 0.2, // More space for Ichimoku clouds
          bottom: 0.2,
        },
      },
      crosshair: {
        mode: 1, // Magnet mode
      }
    });

    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    seriesRef.current = series;
    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      isInitialized.current = false;
    };
  }, []);

  // Optimized Data Update Logic
  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;

    const mapCandle = (d: Candle) => ({
      time: (d.time / 1000) as any, 
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    });

    // Strategy:
    // 1. If not initialized, set full data.
    // 2. If data length difference is large (switching timeframes/history load), set full data.
    // 3. If data length is same or +1, just update the last candle (Real-time performance).

    const currentDataLength = data.length;
    // We can't easily get the internal series length efficiently without calling data(), 
    // so we rely on isInitialized and a heuristic or just always update the last one if initialized.
    
    if (!isInitialized.current) {
      // First Load
      const lwData = data.map(mapCandle);
      seriesRef.current.setData(lwData);
      if (chartRef.current) chartRef.current.timeScale().fitContent();
      isInitialized.current = true;
    } else {
      // Subsequent updates
      // Check if it's a history reload (e.g. user scrolled back or data reset)
      // We assume if we receive a large array, it might be a refresh. 
      // However, for this app, 'data' is the full history state.
      // To optimize, we check the last time.
      
      const lastCandle = data[data.length - 1];
      seriesRef.current.update(mapCandle(lastCandle));
    }
  }, [data]);

  // Update Ichimoku Lines
  useEffect(() => {
    if (!chartRef.current) return;

    // Cleanup existing lines if toggled off
    if (!showIchimoku) {
      if (tenkanRef.current) { chartRef.current.removeSeries(tenkanRef.current); tenkanRef.current = null; }
      if (kijunRef.current) { chartRef.current.removeSeries(kijunRef.current); kijunRef.current = null; }
      if (spanARef.current) { chartRef.current.removeSeries(spanARef.current); spanARef.current = null; }
      if (spanBRef.current) { chartRef.current.removeSeries(spanBRef.current); spanBRef.current = null; }
      return;
    }

    // Initialize series if not exists
    if (!tenkanRef.current) {
      tenkanRef.current = chartRef.current.addLineSeries({ color: '#ef4444', lineWidth: 1, title: 'Tenkan (9)', crosshairMarkerVisible: false });
    }
    if (!kijunRef.current) {
      kijunRef.current = chartRef.current.addLineSeries({ color: '#3b82f6', lineWidth: 1, title: 'Kijun (26)', crosshairMarkerVisible: false });
    }
    if (!spanARef.current) {
      spanARef.current = chartRef.current.addLineSeries({ color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Span A', crosshairMarkerVisible: false });
    }
    if (!spanBRef.current) {
      spanBRef.current = chartRef.current.addLineSeries({ color: '#f87171', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Span B', crosshairMarkerVisible: false });
    }

    // Calculate and Set Data
    // Note: Generating Ichimoku data is relatively cheap for 300 candles.
    if (data.length > 0) {
      const { tenkanSeries, kijunSeries, spanASeries, spanBSeries } = generateIchimokuData(data);
      tenkanRef.current?.setData(tenkanSeries);
      kijunRef.current?.setData(kijunSeries);
      spanARef.current?.setData(spanASeries);
      spanBRef.current?.setData(spanBSeries);
    }

  }, [data, showIchimoku]);

  // Handle Signal Visualization (Strategy Lines)
  useEffect(() => {
    if (!seriesRef.current) return;

    // Helper to safe remove lines
    const removeLine = (lineRef: React.MutableRefObject<IPriceLine | null>) => {
       if (lineRef.current && seriesRef.current) {
          seriesRef.current.removePriceLine(lineRef.current);
          lineRef.current = null;
       }
    };

    // Clean up old lines
    removeLine(entryLineRef);
    removeLine(tpLineRef);
    removeLine(slLineRef);

    // If valid active signal, draw new lines
    if (signal && (signal.type === SignalType.BUY || signal.type === SignalType.SELL)) {
       
       // 1. Entry Line (Blue)
       entryLineRef.current = seriesRef.current.createPriceLine({
          price: signal.entryPrice,
          color: '#3b82f6', // Blue-500
          lineWidth: 2,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `ENTRY ${signal.type}`,
       });

       // 2. Take Profit (Green)
       tpLineRef.current = seriesRef.current.createPriceLine({
          price: signal.takeProfit,
          color: '#10b981', // Emerald-500
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `TP (+Profit)`,
       });

       // 3. Stop Loss (Red)
       slLineRef.current = seriesRef.current.createPriceLine({
          price: signal.stopLoss,
          color: '#f43f5e', // Rose-500
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `SL (Risk)`,
       });
    }

  }, [signal]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
};

export default TradingViewChart;