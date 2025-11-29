"use client";

import {
  LineChart as ReLineChart,
  Line,
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

export default function LineChart<T>({
  data,
  dataKey,
  labelKey = "date",
}: Props<T>) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ReLineChart data={data}>
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
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke="#60a5fa"
          strokeWidth={2}
          dot={false}
        />
      </ReLineChart>
    </ResponsiveContainer>
  );
}
