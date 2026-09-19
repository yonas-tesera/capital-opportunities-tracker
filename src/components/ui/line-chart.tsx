"use client";

import { CartesianGrid, Line, LineChart as RechartsLineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface LinePoint {
  label: string;
  value: number;
}

interface LineChartProps {
  points: LinePoint[];
  color: string;
  /** Y-axis tick spacing; ticks are 0, step, 2×step… up to the first multiple above the data. */
  yStep?: number;
  /** Accessible summary of what the chart shows. */
  description: string;
}

/** Recharts single-line chart: smooth coloured line only, no area fill. */
export function LineChart({ points, color, yStep = 5, description }: LineChartProps) {
  const max = Math.max(0, ...points.map((p) => p.value));
  const top = Math.max(yStep, Math.ceil(max / yStep) * yStep);
  const ticks = Array.from({ length: top / yStep + 1 }, (_, i) => i * yStep);

  return (
    <div role="img" aria-label={description} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={points} margin={{ top: 8, right: 24, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#475569" }} tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, top]}
            ticks={ticks}
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "#475569" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip />
          <Line type="monotone" dataKey="value" name="Opportunities" stroke={color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
