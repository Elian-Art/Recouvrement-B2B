'use client'

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface MonthlyData {
  month: string
  collected: number
  invoiced: number
}

interface AgingData {
  bucket: string
  amount: number
  count: number
}

interface RecoveryData {
  month: string
  rate: number
}

function EuroTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-background border rounded-lg shadow-sm p-3 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.name === 'collected' || p.name === 'recouvré' ? '#16a34a' : '#2563eb' }}>
          {p.name}: {formatCurrency(p.value, 'EUR')}
        </p>
      ))}
    </div>
  )
}

export function MonthlyCollectionsChart({ data }: { data: MonthlyData[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v: number) => `${(v / 100).toFixed(0)}€`} tick={{ fontSize: 11 }} width={60} />
        <Tooltip content={<EuroTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="invoiced" name="facturé" fill="#93c5fd" radius={[4, 4, 0, 0]} />
        <Bar dataKey="collected" name="recouvré" fill="#16a34a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function AgingReportChart({ data }: { data: AgingData[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tickFormatter={(v: number) => `${(v / 100).toFixed(0)}€`} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="bucket" tick={{ fontSize: 11 }} width={80} />
        <Tooltip
          formatter={(v: unknown) => formatCurrency(v as number, 'EUR')}
        />
        <Bar dataKey="amount" name="Montant dû" fill="#f97316" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function RecoveryRateChart({ data }: { data: RecoveryData[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} width={44} />
        <Tooltip formatter={(v: unknown) => `${(v as number).toFixed(1)}%`} />
        <Line
          type="monotone"
          dataKey="rate"
          name="Taux de recouvrement"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
