import { useRef, useState } from 'react'
import { Download, FileBarChart2 } from 'lucide-react'
import { AdminChart } from '../components/admin-charts'
import type { ChartPoint } from '../components/admin-charts'
import { AdminData, AdminMetrics, AdminPage, AdminRefresh, AdminTable, FilterSelect } from '../components/admin-ui'
import { failureMessage, statusLabel, WorkspacePanel } from '../components/player-workspace-ui'
import { Field, Message, Skeleton } from '../components/ui'
import { ApiError, discoveryApi } from '../lib/api'
import { adminApi } from '../lib/admin-api'
import type { ReportType, SummaryReport } from '../lib/admin-api'
import { downloadReport } from '../lib/admin-export'
import type { ReportExport } from '../lib/admin-export'
import { addDays, formatTimestamp, priceLabel, sportLabel, todayInLahore } from '../lib/booking-time'
import { useResource } from '../lib/use-resource'

const titles: Record<ReportType, string> = {
  COURT_UTILIZATION: 'Court utilization', REVENUE_SUMMARY: 'Revenue summary', USER_DEMOGRAPHICS: 'User demographics',
  PLAYER_RANKINGS: 'Player rankings', FACILITY_FEEDBACK: 'Facility feedback',
}
type FilterState = { from: string; to: string; sport: string; facility: string; minimum: string }
const datePresets = { week: 'Last 7 days', month: 'Last 30 days', current: 'This month', previous: 'Previous month', custom: 'Custom range' }
type DatePreset = keyof typeof datePresets

function presetDates(preset: Exclude<DatePreset, 'custom'>) {
  const today = todayInLahore()
  const monthStart = today.slice(0, 7) + '-01'
  const previousEnd = addDays(monthStart, -1)
  switch (preset) {
    case 'week': return { from: addDays(today, -6), to: today }
    case 'month': return { from: addDays(today, -29), to: today }
    case 'current': return { from: monthStart, to: today }
    case 'previous': return { from: previousEnd.slice(0, 7) + '-01', to: previousEnd }
  }
}
type Metrics = [string, number | string][]
type ChartSpec = { title: string; points: ChartPoint[]; format?: (value: number) => string; donut?: boolean }
type Results = ReportExport & { type: ReportType; logFilters: Record<string, string>; metrics: Metrics; charts: ChartSpec[];
  warning?: string; description?: string; empty?: boolean }

const points = (data: Record<string, number>, label: (key: string) => string = key => key) =>
  Object.entries(data).map(([key, value]) => ({ label: label(key), value }))
const percent = (value: number) => value + '%'
const clean = (input: Record<string, string>) => Object.fromEntries(Object.entries(input).filter(([, value]) => value !== ''))

function summaryData(report: SummaryReport): Pick<Results, 'metrics' | 'charts' | 'rows' | 'description' | 'empty'> {
  let metrics: Metrics
  let charts: ChartSpec[]
  let description: string
  let empty: boolean
  if (report.type === 'COURT_UTILIZATION') {
    empty = report.totalBookings === 0
    metrics = [['Courts', report.totalCourts], ['Bookings', report.totalBookings], ['Past bookings', report.pastBookings],
      ['Upcoming bookings', report.upcomingBookings], ['Booked hours', report.totalBookedHours], ['Average utilization', percent(report.averageUtilization)]]
    charts = [{ title: 'Top courts · booked slots', points: report.topCourts.map(row => ({ label: row.courtName, value: row.bookedSlots })) },
      { title: 'Top courts · utilization', points: report.topCourts.map(row => ({ label: row.courtName, value: row.utilizationPercent })), format: percent }]
    description = 'Utilization uses the backend’s slot and opening-hours calculations.'
  } else if (report.type === 'REVENUE_SUMMARY') {
    empty = report.bookingCount === 0
    metrics = [['Reported total', priceLabel(report.totalRevenue)], ['Base revenue', priceLabel(report.baseRevenue)],
      ['Peak and weekend contribution', priceLabel(report.peakWeekendExtra)], ['Discounts applied', priceLabel(report.discountRevenue)],
      ['Bookings', report.bookingCount], ['Average per booking', priceLabel(report.averageRevenue)]]
    charts = [{ title: 'Reported amount by sport', points: points(report.revenueBySport, sportLabel), format: priceLabel }]
    description = 'Amounts come from confirmed and completed bookings by booking date. The pricing contribution comes from the backend calculation.'
  } else {
    empty = report.totalPlayers + report.totalManagers === 0
    metrics = [['Players', report.totalPlayers], ['Managers', report.totalManagers]]
    charts = [{ title: 'Player age groups', points: points(report.ageGroupCounts), donut: true },
      { title: 'Verified discount tiers', points: points(report.discountTierCounts, statusLabel), donut: true }]
    description = 'The period applies to account creation dates. The backend includes older records without a creation timestamp.'
  }
  return { metrics, charts, description, empty, rows: [...metrics, ...charts.flatMap(chart =>
    chart.points.map(point => [chart.title + ' · ' + point.label, chart.format ? chart.format(point.value) : point.value]))] }
}

async function generate(type: ReportType, filters: FilterState, facilityName: string): Promise<Results> {
  const { from, to, sport, facility, minimum } = filters
  const reportFilters = clean({ 'From': from, 'To': to, 'Sport': sport ? sportLabel(sport) : '',
    'Facility': facility ? facilityName : '', 'Minimum matches': minimum && minimum !== '0' ? minimum : '' })
  const base = { type, title: titles[type], generatedAt: new Date().toISOString(), filters: reportFilters, metrics: [], charts: [] }
  if (type === 'PLAYER_RANKINGS') {
    const ranked = (await adminApi.rankings(from, to, sport || undefined)).filter(row => row.matches >= Number(minimum))
    return { ...base, logFilters: clean({ dateFrom: from, dateTo: to, sportType: sport, minMatches: minimum }),
      description: 'Ranks and points are supplied by the backend. The minimum-match filter keeps the original ranks.',
      columns: ['Rank', 'Player', 'Sport', 'Matches', 'Wins', 'Losses', 'Draws', 'Points', 'Win rate'],
      rows: ranked.map(row => [row.rank, row.playerName, sportLabel(row.sportType), row.matches, row.wins, row.losses, row.draws, row.points, percent(row.winRate)]),
      charts: [{ title: 'Top ranking points', points: ranked.slice(0, 5).map(row => ({ label: row.playerName + ' · #' + row.rank, value: row.points })) }],
    }
  }
  if (type === 'FACILITY_FEEDBACK') {
    const feedback = (await adminApi.feedback()).filter(row =>
      (!sport || row.sportType === sport) && (!facility || row.facilityId === facility) &&
      (!from || (row.bookingDate && row.bookingDate >= from)) && (!to || (row.bookingDate && row.bookingDate <= to)))
    const logFilters = clean({ dateFrom: from, dateTo: to, sportType: sport, facility, facilityName })
    const distribution = [1, 2, 3, 4, 5].map(value => ({ label: value + ' / 5', value: feedback.filter(row => row.ratingScore === value).length }))
    const average = feedback.length ? (feedback.reduce((total, row) => total + row.ratingScore, 0) / feedback.length).toFixed(1) : '—'
    const details = { columns: ['Facility', 'Court', 'Sport', 'Booking date', 'Rating', 'Feedback'],
      rows: feedback.map(row => [row.facilityName ?? '—', row.courtName ?? '—', sportLabel(row.sportType ?? ''), row.bookingDate, row.ratingScore, row.feedbackText ?? '']) }
    const warning = await adminApi.log(type, logFilters, 'VIEW').then(() => undefined, () => 'The report loaded, but Courtly could not record its view in report history.')
    return { ...base, logFilters, warning, description: 'Feedback is filtered by the booking date.',
      ...details, metrics: [['Matching ratings', feedback.length], ['Average score', average]],
      charts: [{ title: 'Rating distribution', points: feedback.length ? distribution : [], donut: true }],
    }
  }
  const report = await adminApi.summary(type, from, to, sport || undefined)
  if (report.type !== type || !report.generatedAt) throw new ApiError('Courtly did not return a valid report for this selection.')
  return { ...base, generatedAt: report.generatedAt, filters: { ...reportFilters, From: report.startDate, To: report.endDate },
    logFilters: clean({ startDate: from, endDate: to, courtType: sport }), columns: ['Measure', 'Value'], ...summaryData(report) }
}

function formatFilters(raw: string | null) {
  if (!raw) return '—'
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '—'
    const labels: Record<string, string> = { startDate: 'From', endDate: 'To', courtType: 'Sport', dateFrom: 'From',
      dateTo: 'To', sportType: 'Sport', facilityName: 'Facility', minMatches: 'Minimum matches' }
    return Object.entries(parsed).filter(([key, value]) => Object.hasOwn(labels, key) && typeof value === 'string' && value)
      .map(([key, value]) => labels[key] + ' ' + value).join(' · ') || '—'
  } catch { return '—' }
}

export function AdminReports() {
  const [preset, setPreset] = useState<DatePreset>('month')
  const [type, setType] = useState<ReportType>('COURT_UTILIZATION')
  const [filters, setFilters] = useState<FilterState>(() => ({ from: addDays(todayInLahore(), -29),
    to: todayInLahore(), sport: '', facility: '', minimum: '0' }))
  const sports = useResource(discoveryApi.sports)
  const facilities = useResource(discoveryApi.facilities)
  const facilityLabel = (id: string) => facilities.data?.find(item => item.facilityID === id)?.name ?? id
  const history = useResource(adminApi.history)
  const [result, setResult] = useState<Results>()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const operation = useRef(false)
  async function run(label: string, task: () => Promise<void>) {
    if (operation.current) return
    operation.current = true
    setError('')
    setNote('')
    setBusy(label)
    try { await task() }
    catch (failure) { setError(failureMessage(failure, 'Courtly could not complete this report action.')) }
    finally { operation.current = false; setBusy('') }
  }
  const allowSport = type === 'COURT_UTILIZATION' || type === 'PLAYER_RANKINGS' || type === 'FACILITY_FEEDBACK'
  const set = (key: keyof FilterState, value: string) => {
    if (key === 'from' || key === 'to') setPreset('custom')
    setFilters(previous => ({ ...previous, [key]: value }))
  }
  const exportFile = (format: 'CSV' | 'PDF') => {
    if (!result) return
    void run(format, async () => {
      const exportData = result.type === 'FACILITY_FEEDBACK' ? {
        ...result, filters: { ...result.filters, 'Matching ratings': String(result.rows.length), 'Average score': String(result.metrics[1][1]) },
      } : result
      await downloadReport(exportData, format)
      try { await adminApi.log(result.type, result.logFilters, format); history.retry(); setNote(format + ' download started.') }
      catch { setError('The download started, but Courtly could not record this export in report history.') }
    })
  }
  return <AdminPage title="Reports and analytics" description="Run date-scoped reports and export the resulting data.">
    <WorkspacePanel title="Report filters">
      <form className="admin-filters admin-report-filters" onSubmit={event => {
        event.preventDefault()
        void run('Generating', async () => {
          const { from, to, sport, facility, minimum } = filters
          if (from && to && from > to) throw new ApiError('The start date must be on or before the end date.')
          const selected = { from, to, sport: allowSport ? sport : '', facility: type === 'FACILITY_FEEDBACK' ? facility : '',
            minimum: type === 'PLAYER_RANKINGS' ? minimum : '' }
          const loaded = await generate(type, selected, selected.facility ? facilityLabel(selected.facility) : '')
          setResult(loaded)
          if (loaded.warning) setError(loaded.warning)
          history.retry()
        })
      }}>
        <label className="field"><span>Report type</span><select value={type} onChange={event => setType(event.target.value as ReportType)}>
          {Object.entries(titles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="field"><span>Date range</span><select value={preset} onChange={event => {
          const next = event.target.value as DatePreset
          setPreset(next)
          if (next !== 'custom') setFilters(previous => ({ ...previous, ...presetDates(next) }))
        }}>
          {Object.entries(datePresets).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <Field label="From" type="date" value={filters.from} required={type !== 'FACILITY_FEEDBACK' && type !== 'PLAYER_RANKINGS'}
          onChange={event => set('from', event.target.value)} />
        <Field label="To" type="date" value={filters.to} required={type !== 'FACILITY_FEEDBACK' && type !== 'PLAYER_RANKINGS'}
          onChange={event => set('to', event.target.value)} />
        {allowSport && <FilterSelect label="Sport" value={filters.sport} values={sports.data ?? []} emptyLabel="All sports" format={sportLabel} change={value => set('sport', value)} />}
        {type === 'FACILITY_FEEDBACK' && <FilterSelect label="Facility" value={filters.facility} emptyLabel="All facilities"
          values={facilities.data?.map(item => item.facilityID) ?? []} format={facilityLabel} change={value => set('facility', value)} />}
        {type === 'PLAYER_RANKINGS' && <Field label="Minimum matches" type="number" min={0} value={filters.minimum}
          onChange={event => set('minimum', event.target.value)} />}
        <button type="submit" className="button button--primary" disabled={!!busy}>
          <FileBarChart2 size={16} aria-hidden="true" />{busy === 'Generating' ? 'Generating…' : 'Generate report'}
        </button>
      </form>
      {allowSport && sports.error && <div className="admin-actions"><Message>{sports.error}</Message>
        <button type="button" className="text-link" onClick={sports.retry}>Reload sports</button></div>}
      {type === 'FACILITY_FEEDBACK' && facilities.error && <div className="admin-actions"><Message>{facilities.error}</Message>
        <button type="button" className="text-link" onClick={facilities.retry}>Reload facilities</button></div>}
      {error && <Message>{error}</Message>}
      {note && <Message kind="success">{note}</Message>}
    </WorkspacePanel>
    {busy === 'Generating' && <Skeleton label="Loading report" count={2} />}
    {result && <section className="player-page" aria-label={result.title}>
      <WorkspacePanel title={result.title} description={result.description}
        action={<div className="admin-actions">{(['PDF', 'CSV'] as const).map(format =>
          <button type="button" key={format} disabled={!!busy || !result.rows.length} className="button button--outline button--small"
            onClick={() => exportFile(format)}><Download size={15} aria-hidden="true" />Export {format}</button>)}</div>}>
        <div className="admin-strip"><strong>Applied filters</strong>
          {Object.entries(result.filters).map(([key, value]) => <span key={key}>{key} {value}</span>)}
          {!Object.keys(result.filters).length && <span>All available records</span>}
          <span>Generated {result.generatedAt.length === 10 ? result.generatedAt : formatTimestamp(result.generatedAt)}</span>
        </div>
        {(result.empty || !result.rows.length) && <p className="admin-report-empty" role="status">No matching records. Try a wider date range or clear an optional filter, then generate the report again.</p>}
        {!!result.metrics.length && <AdminMetrics values={result.metrics} />}
        {(result.type === 'PLAYER_RANKINGS' || result.type === 'FACILITY_FEEDBACK') &&
          <AdminTable label={result.title} columns={result.columns} rows={result.rows} />}
      </WorkspacePanel>
      {!result.empty && !!result.charts.length && <div className="admin-chart-grid">{result.charts.map(chart => <AdminChart key={chart.title} {...chart} />)}</div>}
    </section>}
    <WorkspacePanel title="Report history" description="Most recent 50 views and exports."
      action={<AdminRefresh onClick={history.retry} disabled={history.loading} />}>
      <AdminData resource={history} label="report history">{rows => <AdminTable label="Report history"
        columns={['Report', 'Generated', 'Applied filters', 'Format']}
        rows={rows.map(row => [titles[row.reportType as ReportType] ?? statusLabel(row.reportType), formatTimestamp(row.generatedAt),
          formatFilters(row.filters), row.exportFormat])} />}</AdminData>
    </WorkspacePanel>
  </AdminPage>
}
