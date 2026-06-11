'use client'

import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { labels: string[]; rev: number[]; prf: number[] }
  showProfit?: boolean
}

const fmtK = (v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(1).replace('.0', '')}k` : `R$${v.toFixed(0)}`

export function RevenueChart({ data, showProfit = true }: Props) {
  const [colors, setColors] = useState({ accent: '#3B82F6', green: '#10B981', text3: '#9aa3b5', text4: '#5a6478' })

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement)
    setColors({
      accent: cs.getPropertyValue('--accent').trim() || '#3B82F6',
      green:  cs.getPropertyValue('--green').trim()  || '#10B981',
      text3:  cs.getPropertyValue('--text-3').trim() || '#9aa3b5',
      text4:  cs.getPropertyValue('--text-4').trim() || '#5a6478',
    })
  }, [])

  const chartData = data.labels.map((l, i) => ({ name: l, Faturamento: data.rev[i], Lucro: data.prf[i] }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gradFaturamento" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.accent} stopOpacity={0.35} />
            <stop offset="95%" stopColor={colors.accent} stopOpacity={0} />
          </linearGradient>
          {showProfit && <linearGradient id="gradLucro" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.green} stopOpacity={0.3} />
            <stop offset="95%" stopColor={colors.green} stopOpacity={0} />
          </linearGradient>}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.045)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: colors.text4, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: colors.text4, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={46} />
        <Tooltip
          formatter={(v, name) => [fmtK(Number(v)), name]}
          contentStyle={{ background: 'rgba(12,14,20,.92)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, fontSize: 12, padding: '8px 12px' }}
          labelStyle={{ color: '#f0f4fa', fontWeight: 600, marginBottom: 4 }}
          itemStyle={{ color: colors.text3 }}
          cursor={{ stroke: 'rgba(255,255,255,.08)', strokeWidth: 1 }}
        />
        <Area type="monotone" dataKey="Faturamento" stroke={colors.accent} strokeWidth={2}
              fill="url(#gradFaturamento)" dot={{ r: 3, fill: colors.accent, strokeWidth: 0 }}
              activeDot={{ r: 5 }} animationDuration={600} />
        {showProfit && <Area type="monotone" dataKey="Lucro" stroke={colors.green} strokeWidth={2}
              fill="url(#gradLucro)" dot={{ r: 3, fill: colors.green, strokeWidth: 0 }}
              activeDot={{ r: 5 }} animationDuration={600} />}
      </AreaChart>
    </ResponsiveContainer>
  )
}
