import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Customized } from 'recharts';
import { ChartPoint, TrendLine } from '../types';

interface LiveChartProps {
  data: ChartPoint[];
  color: string;
  isDrawing: boolean;
  trendLines: TrendLine[];
  onAddLine: (line: TrendLine) => void;
}

// Custom Layer Component to render lines based on Recharts Scales
const TrendLineLayer = (props: any) => {
  const { xAxis, yAxis, data, trendLines, drawingStart, drawingCurrent } = props;

  // Helper to find X coordinate for a categorical label (Time)
  const getX = (label: string) => {
    if (!xAxis || !xAxis.scale) return 0;
    // For categorical charts, scale(label) returns the coordinate
    const x = xAxis.scale(label);
    // Add half bandwidth to center it on the tick/point
    return x !== undefined ? x + (xAxis.bandwidth ? xAxis.bandwidth / 2 : 0) : undefined;
  };

  const getY = (value: number) => {
    if (!yAxis || !yAxis.scale) return 0;
    return yAxis.scale(value);
  };

  return (
    <g className="recharts-layer trend-lines pointer-events-none">
      {/* Render Saved Lines */}
      {trendLines.map((line: TrendLine, index: number) => {
        const x1 = getX(line.start.time);
        const y1 = getY(line.start.value);
        const x2 = getX(line.end.time);
        const y2 = getY(line.end.value);

        // Only render if both points are visible (coordinate is not undefined)
        if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
          return (
            <line
              key={`line-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#facc15" // Yellow-400
              strokeWidth={2}
              strokeLinecap="round"
              filter="drop-shadow(0px 0px 2px rgba(0,0,0,0.5))"
            />
          );
        }
        return null;
      })}

      {/* Render Drawing Preview */}
      {drawingStart && drawingCurrent && (
        (() => {
          const x1 = getX(drawingStart.time);
          const y1 = getY(drawingStart.value);
          const x2 = getX(drawingCurrent.time);
          const y2 = getY(drawingCurrent.value);

          if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
            return (
              <>
                 {/* Start Point Dot */}
                 <circle cx={x1} cy={y1} r={4} fill="#facc15" stroke="#fff" strokeWidth={1} />
                 {/* Preview Line */}
                 <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#facc15"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  strokeOpacity={0.8}
                />
                {/* End Point Preview Dot */}
                <circle cx={x2} cy={y2} r={3} fill="#facc15" opacity={0.5} />
              </>
            );
          }
          return null;
        })()
      )}
    </g>
  );
};

const LiveChart: React.FC<LiveChartProps> = ({ data, color, isDrawing, trendLines, onAddLine }) => {
  const [startPoint, setStartPoint] = useState<ChartPoint | null>(null);
  const [currentHover, setCurrentHover] = useState<ChartPoint | null>(null);

  // Handle Chart Click
  const handleClick = (e: any) => {
    if (!isDrawing || !e || !e.activeLabel || !e.activePayload) return;

    const point: ChartPoint = {
      time: e.activeLabel,
      value: e.activePayload[0].payload.value, // Snap to the actual data point value
    };

    if (!startPoint) {
      setStartPoint(point);
    } else {
      onAddLine({ start: startPoint, end: point });
      setStartPoint(null);
    }
  };

  // Handle Mouse Move for Preview
  const handleMouseMove = (e: any) => {
    if (isDrawing && e && e.activeLabel && e.activePayload) {
      setCurrentHover({
        time: e.activeLabel,
        value: e.activePayload[0].payload.value,
      });
    } else {
      setCurrentHover(null);
    }
  };

  // Reset drawing state if mode changes
  React.useEffect(() => {
    if (!isDrawing) {
      setStartPoint(null);
      setCurrentHover(null);
    }
  }, [isDrawing]);

  return (
    <div className={`w-full h-full ${isDrawing ? 'cursor-crosshair' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart 
          data={data}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setCurrentHover(null)}
        >
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis 
            dataKey="time" 
            stroke="#9ca3af" 
            tick={{fontSize: 10}}
            tickMargin={10}
            interval="preserveStartEnd"
          />
          <YAxis 
            domain={['auto', 'auto']} 
            stroke="#9ca3af" 
            tick={{fontSize: 10}} 
            width={60}
            tickFormatter={(value) => value.toFixed(2)}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
            itemStyle={{ color: '#f3f4f6' }}
            formatter={(value: number) => [value.toFixed(2), 'Price']}
            cursor={{ stroke: isDrawing ? '#facc15' : '#9ca3af', strokeWidth: 1 }}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            fillOpacity={1} 
            fill="url(#colorValue)" 
            isAnimationActive={false} 
          />
          {/* Inject the Custom Layer with drawing props */}
          <Customized 
            component={
              <TrendLineLayer 
                trendLines={trendLines} 
                drawingStart={startPoint} 
                drawingCurrent={currentHover}
              />
            } 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LiveChart;