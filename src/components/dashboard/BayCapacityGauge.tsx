import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'

interface BayCapacityGaugeProps {
  percentage: number
  className?: string
}

export function BayCapacityGauge({ percentage, className = '' }: BayCapacityGaugeProps) {
  const data = [
    { name: 'capacity', value: percentage, fill: '#a9dfd8' },
  ]

  const getColor = (pct: number) => {
    if (pct >= 90) return '#f0667a' // critical - over capacity
    if (pct >= 70) return '#fcb859' // amber - busy
    return '#a9dfd8' // mint - normal
  }

  data[0].fill = getColor(percentage)

  return (
    <div className={`relative ${className}`}>
      <ResponsiveContainer width="100%" height={160}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="90%"
          startAngle={180}
          endAngle={0}
          data={data}
        >
          <RadialBar
            background={{ fill: '#2b2b36' }}
            dataKey="value"
            cornerRadius={10}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
        <span className="text-3xl font-bold text-text-primary tabular-nums">{percentage}%</span>
        <span className="text-caption">Bay Capacity</span>
      </div>
    </div>
  )
}
