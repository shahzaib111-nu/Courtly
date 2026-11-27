export interface ReportExport {
  title: string
  generatedAt: string
  filters: Record<string, string>
  columns: string[]
  rows: (string | number)[][]
}

function csvCell(value: string | number) {
  const string = String(value)
  const safe = typeof value === 'string' && (/^[\s\u0000-\u001f\uFEFF]*[=+\-@＝＋－＠]/u.test(string) || /^[\t\r\n]/.test(string))
    ? "'" + string : string
  return '"' + safe.replaceAll('"', '""') + '"'
}

export async function downloadReport(data: ReportExport, format: 'CSV' | 'PDF') {
  const metadata = [['Generated', data.generatedAt], ...Object.entries(data.filters)]
  let blob: Blob
  if (format === 'CSV') {
    blob = new Blob(['\ufeff', [[data.title], ...metadata, [], data.columns, ...data.rows].map(row => row.map(csvCell).join(',')).join('\r\n')],
      { type: 'text/csv;charset=utf-8' })
  } else {
    const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const pdf = new jsPDF({ orientation: data.columns.length > 5 ? 'landscape' : 'portrait', unit: 'pt' })
    pdf.setTextColor('#101C17')
    pdf.setFontSize(21)
    pdf.text('Courtly', 42, 46)
    pdf.setFontSize(15)
    pdf.text(data.title, 42, 71)
    pdf.setFontSize(10)
    const notes = pdf.splitTextToSize(metadata.map(([key, value]) => key + '  ' + value).join('\n'),
      pdf.internal.pageSize.getWidth() - 84) as string[]
    pdf.text(notes, 42, 90)
    autoTable(pdf, { startY: 103 + notes.length * 12, head: [data.columns], body: data.rows.map(row => row.map(String)),
      margin: { left: 42, right: 42, bottom: 35 }, styles: { fontSize: 9, overflow: 'linebreak' },
      headStyles: { fillColor: [16, 28, 23] } })
    blob = pdf.output('blob')
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'courtly-' + data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.' + format.toLowerCase()
  try { document.body.append(anchor); anchor.click() }
  finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
}
