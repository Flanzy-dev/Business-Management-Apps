// Literal hex mirrors of the Surya Baru CSS custom properties (src/index.css),
// for Recharts props that need literal color strings rather than var()/classes.
export const chartTheme = {
  accent: '#ffb224',
  accentHover: '#ffc14d',
  success: '#3ecf8e',
  warning: '#ffb224',
  danger: '#f2555a',
  info: '#4d9fff',
  violet: '#a684ff',
  fg1: '#e9eef5',
  fg3: '#7e8b9c',
  bg2: '#151b23',
  border2: '#2b3644',
  border3: '#3b4859',
  // Auto-assigned slice colors for donut/category charts with an
  // unbounded number of categories (e.g. inventory categories).
  categorical: ['#ffb224', '#4d9fff', '#3ecf8e', '#f2555a', '#a684ff', '#7e8b9c'],
}
