import React from 'react';
import { MonteCarloResults } from '../types';

interface SummaryBarChartProps {
  mc: MonteCarloResults;
}

export const SummaryBarChart: React.FC<SummaryBarChartProps> = ({ mc }) => {
  const items = [];
  if (mc.oiip) items.push({ key: 'oiip', label: 'OIIP (Oil)', res: mc.oiip, color: '#2a9bb0' });
  if (mc.giip) items.push({ key: 'giip', label: 'GIIP (Gas)', res: mc.giip, color: '#f0a500' });

  if (items.length === 0) return null;

  return (
    <div className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl p-4 shadow-xl">
      <span className="font-bold text-sm text-[#e8f4f8] block mb-4">
        Hydrocarbon Volumetric Percentiles Comparison (P10 / P50 / P90)
      </span>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(({ key, label, res, color }) => {
          const maxVal = res.p90 * 1.15 || 1;

          return (
            <div key={key} className="bg-[#071322] border border-[#2a9bb0]/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm" style={{ color }}>
                  {label}
                </span>
                <span className="text-xs text-[#8aafc0] font-mono">
                  Mean: <b>{res.mean.toFixed(1)} {res.unit}</b>
                </span>
              </div>

              {/* Bars */}
              <div className="space-y-3">
                {/* P10 */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-[#e74c3c]">P10 (Low / Conservative)</span>
                    <span className="font-bold text-[#e74c3c]">{res.p10.toFixed(1)} {res.unit}</span>
                  </div>
                  <div className="w-full h-3 bg-[#0d2138] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#e74c3c] rounded-full transition-all duration-500"
                      style={{ width: `${(res.p10 / maxVal) * 100}%` }}
                    />
                  </div>
                </div>

                {/* P50 */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-[#2ecc71]">P50 (Best / Median)</span>
                    <span className="font-bold text-[#2ecc71]">{res.p50.toFixed(1)} {res.unit}</span>
                  </div>
                  <div className="w-full h-3 bg-[#0d2138] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2ecc71] rounded-full transition-all duration-500"
                      style={{ width: `${(res.p50 / maxVal) * 100}%` }}
                    />
                  </div>
                </div>

                {/* P90 */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-[#f0a500]">P90 (High / Optimistic)</span>
                    <span className="font-bold text-[#f0a500]">{res.p90.toFixed(1)} {res.unit}</span>
                  </div>
                  <div className="w-full h-3 bg-[#0d2138] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#f0a500] rounded-full transition-all duration-500"
                      style={{ width: `${(res.p90 / maxVal) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
