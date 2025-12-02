import React from 'react';
import { SignalData, SignalType, Timeframe } from '../types';
import { getTimeframeLabel } from '../utils';
import { ArrowUpCircle, ArrowDownCircle, MinusCircle, RefreshCw, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface SignalCardProps {
  timeframe: Timeframe;
  signal: SignalData | null;
  isScanning: boolean;
}

const SignalCard: React.FC<SignalCardProps> = ({ timeframe, signal, isScanning }) => {
  
  const getSignalColor = (type?: SignalType) => {
    switch (type) {
      case SignalType.BUY: return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case SignalType.SELL: return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
      case SignalType.NEUTRAL: 
      case SignalType.WAIT:
      default: return 'text-gray-400 border-gray-600/30 bg-gray-700/10';
    }
  };

  const getSignalIcon = (type?: SignalType) => {
    switch (type) {
      case SignalType.BUY: return <ArrowUpCircle className="w-8 h-8 text-emerald-400" />;
      case SignalType.SELL: return <ArrowDownCircle className="w-8 h-8 text-rose-400" />;
      default: return <MinusCircle className="w-8 h-8 text-gray-400" />;
    }
  };

  return (
    <div className={clsx(
      "relative flex flex-col p-4 rounded-xl border transition-all duration-300",
      signal ? getSignalColor(signal.type) : "border-gray-800 bg-gray-900/50"
    )}>
      
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-bold tracking-wider text-gray-300 uppercase">
          {getTimeframeLabel(timeframe)}
        </span>
        {isScanning ? (
          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
        ) : (
          <span className="text-xs text-gray-500">
            {signal ? new Date(signal.timestamp).toLocaleTimeString() : 'Waiting...'}
          </span>
        )}
      </div>

      {/* Main Signal Display */}
      <div className="flex items-center gap-3 mb-4">
        {isScanning && !signal ? (
          <div className="h-8 w-8 rounded-full bg-gray-700 animate-pulse" />
        ) : (
          getSignalIcon(signal?.type)
        )}
        
        <div className="flex flex-col">
          <span className="text-2xl font-black tracking-tight">
            {signal ? signal.type : 'SCANNING'}
          </span>
          {signal && (
            <span className="text-xs font-medium opacity-80">
              Confidence: <span className={signal.confidence > 75 ? "text-emerald-400" : "text-yellow-400"}>{signal.confidence}%</span>
            </span>
          )}
        </div>
      </div>

      {/* Details (Prices & Reasoning) */}
      {signal && signal.type !== SignalType.WAIT && signal.type !== SignalType.NEUTRAL && (
        <div className="space-y-2 text-xs bg-black/20 p-2 rounded-lg">
          <div className="flex justify-between">
            <span className="text-gray-400">Entry:</span>
            <span className="font-mono text-white">{signal.entryPrice}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-rose-400">Stop Loss:</span>
            <span className="font-mono text-rose-300">{signal.stopLoss}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-emerald-400">Take Profit:</span>
            <span className="font-mono text-emerald-300">{signal.takeProfit}</span>
          </div>
        </div>
      )}

      {/* Reasoning Text */}
      <div className="mt-3 text-xs text-gray-400 leading-relaxed border-t border-white/5 pt-2">
         {signal?.reasoning || "Waiting for market data analysis..."}
      </div>

    </div>
  );
};

export default SignalCard;