export const toIndianNumber = (n) => {
  if (!n && n !== 0) return '—';
  const num = Math.round(Number(n));
  if (isNaN(num)) return '—';
  const s = num.toString();
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
};

export const toCrore = (n) => {
  const val = Number(n);
  if (isNaN(val)) return '—';
  if (val >= 10000000) return '₹' + (val / 10000000).toFixed(1) + ' Cr';
  if (val >= 100000) return '₹' + (val / 100000).toFixed(1) + ' L';
  return '₹' + toIndianNumber(val);
};

export const pctBadge = (val) => {
  const v = Number(val);
  if (isNaN(v)) return { text: '—', type: 'grey' };
  if (v > 0) return { text: `↑ ${Math.abs(v).toFixed(1)}%`, type: 'success' };
  if (v < 0) return { text: `↓ ${Math.abs(v).toFixed(1)}%`, type: 'danger' };
  return { text: '→ 0%', type: 'grey' };
};

export const accColor = (acc) => {
  if (acc >= 88) return '#16A34A';
  if (acc >= 80) return '#D97706';
  return '#DC2626';
};

export const biasColor = (bias) => {
  const b = Math.abs(bias);
  if (b < 5) return '#16A34A';
  if (b < 10) return '#D97706';
  return '#DC2626';
};
