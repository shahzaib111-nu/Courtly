import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { WorkspacePanel } from './player-workspace-ui'

export type ChartPoint = { label: string; value: number }
const palette = ['#166239', '#293e32', '#5d842f', '#8fac56', '#bef264', '#849a8a', '#54785c', '#babf78']
type Props = { title: string; points: ChartPoint[]; format?: (value: number) => string; donut?: boolean }
export function AdminChart({ title, points, format = value => value.toLocaleString('en-PK'), donut }: Props) {
  const chart = donut ? points.filter(point => point.value > 0) : points
  const singleCategory = donut && chart.length === 1
  return <WorkspacePanel title={title}>
    {chart.length ? <>
      {!singleCategory && <div className="admin-chart" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {donut ? <PieChart accessibilityLayer={false}><Pie data={chart} dataKey="value" nameKey="label" innerRadius="61%" outerRadius="84%" paddingAngle={2}
            isAnimationActive={false}>{chart.map((point, index) => <Cell key={point.label} fill={palette[index % palette.length]} />)}</Pie>
            <Tooltip formatter={value => format(Number(value))} /></PieChart>
            : <BarChart accessibilityLayer={false} data={chart} layout="vertical" margin={{ top: 6, right: 18, left: 6, bottom: 6 }}>
              <CartesianGrid horizontal={false} stroke="#e2ebe1" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={95} tickFormatter={label => label.length > 13 ? label.slice(0, 12) + '…' : label}
                tick={{ fontSize: 11 }} />
              <Tooltip formatter={value => format(Number(value))} />
              <Bar dataKey="value" name={title} fill="#166239" radius={[0, 5, 5, 0]} maxBarSize={26} isAnimationActive={false} />
            </BarChart>}
        </ResponsiveContainer>
        {donut && <div className="admin-donut-total"><strong>{format(chart.reduce((sum, point) => sum + point.value, 0))}</strong><span>Total</span></div>}
      </div>}
      {singleCategory && <div className="admin-single-category" aria-hidden="true" />}
      <ul className="admin-chart-legend" aria-label={title + ' values'}>{chart.map((point, index) => <li key={point.label}>
        <span aria-hidden="true" style={{ background: donut ? palette[index % palette.length] : palette[0] }} />
        <span>{point.label}</span><strong>{format(point.value)}</strong>
      </li>)}</ul>
    </> : <p>No data for this selection.</p>}
  </WorkspacePanel>
}
