'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export const CHART_THEME = {
  grid:     '#1A1D2E',
  text:     '#6B7280',
  primary:  '#00E87A',
  surface:  '#0D0F1A',
  positive: '#34D399',
  negative: '#F87171',
  warning:  '#FBBF24',
  blue:     '#60A5FA',
  purple:   '#C084FC',
} as const

export const CHART_COLORS = [
  CHART_THEME.primary,
  CHART_THEME.blue,
  CHART_THEME.purple,
  CHART_THEME.warning,
  CHART_THEME.positive,
  CHART_THEME.negative,
]

const tooltipStyle = {
  background: CHART_THEME.surface,
  border: `1px solid ${CHART_THEME.grid}`,
  borderRadius: '12px',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: '12px',
  color: '#E8EAF0',
}

const axisStyle = {
  fill: CHART_THEME.text,
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
}

// ── ToolBarChart ──────────────────────────────────────────────────────────────

interface BarDef {
  key: string
  label: string
  color?: string
  cellColorKey?: string  // data record key holding per-bar fill color
}

interface ToolBarChartProps {
  data: Record<string, string | number>[]
  xKey: string
  bars: BarDef[]
  height?: number
  yFormatter?: (v: number) => string
}

export function ToolBarChart({
  data,
  xKey,
  bars,
  height = 220,
  yFormatter,
}: ToolBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
        <XAxis dataKey={xKey} tick={axisStyle} />
        <YAxis tick={axisStyle} tickFormatter={yFormatter} width={60} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={yFormatter ? (v: number) => [yFormatter(v)] : undefined}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: CHART_THEME.text }} />
        {bars.map((b, i) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.label}
            fill={b.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
          >
            {b.cellColorKey &&
              data.map((entry, j) => (
                <Cell
                  key={j}
                  fill={String(entry[b.cellColorKey as string] ?? b.color ?? CHART_COLORS[i % CHART_COLORS.length])}
                />
              ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── ToolLineChart ─────────────────────────────────────────────────────────────

interface LineDef {
  key: string
  label: string
  color?: string
}

interface ToolLineChartProps {
  data: Record<string, string | number>[]
  xKey: string
  lines: LineDef[]
  height?: number
  yFormatter?: (v: number) => string
}

export function ToolLineChart({
  data,
  xKey,
  lines,
  height = 220,
  yFormatter,
}: ToolLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
        <XAxis dataKey={xKey} tick={axisStyle} />
        <YAxis tick={axisStyle} tickFormatter={yFormatter} width={60} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={yFormatter ? (v: number) => [yFormatter(v)] : undefined}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: CHART_THEME.text }} />
        {lines.map((l, i) => (
          <Line
            key={l.key}
            dataKey={l.key}
            name={l.label}
            stroke={l.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── ToolPieChart ──────────────────────────────────────────────────────────────

interface PieEntry {
  name: string
  value: number
}

interface ToolPieChartProps {
  data: PieEntry[]
  height?: number
  formatter?: (v: number) => string
}

export function ToolPieChart({ data, height = 220, formatter }: ToolPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ name, percent }: { name: string; percent: number }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
          labelLine={{ stroke: CHART_THEME.text }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={formatter ? (v: number) => [formatter(v)] : undefined}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
