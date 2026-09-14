/**
 * Bảng màu Recharts chuẩn Light Mode thuần túy (Shadcn Zinc).
 */
const LIGHT = {
  grid: '#e2e8f0',
  gridOpacity: 1,
  axis: '#64748b',
  line: '#18181b',
  lineFillFrom: '#18181b',
  tooltip: {
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    boxShadow: '0 4px 16px rgba(0,0,0,.06)',
    fontSize: 12,
    padding: '8px 12px',
    color: '#09090b',
  },
}

export function getChartTheme() {
  return LIGHT
}
