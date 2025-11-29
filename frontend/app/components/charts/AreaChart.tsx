"use client";

import {
  AreaChart as ReAreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props<T = unknown> {
  data: T[];
  dataKey: string;
  labelKey?: string;
}

export default function AreaChart<T>({
  data,
  dataKey,
  labelKey = "date",
}: Props<T>) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ReAreaChart data={data}>
        <defs>
          <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.7} />
            <stop offset="95%" stopColor="#0f172a" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey={labelKey}
          stroke="#64748b"
          tick={{ fontSize: 10 }}
          tickLine={false}
        />
        <YAxis
          stroke="#64748b"
          tick={{ fontSize: 10 }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#020617",
            borderRadius: 8,
            border: "1px solid #0f172a",
            color: "#e2e8f0",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke="#60a5fa"
          fill="url(#areaColor)"
          fillOpacity={1}
        />
      </ReAreaChart>
    </ResponsiveContainer>
  );
}
