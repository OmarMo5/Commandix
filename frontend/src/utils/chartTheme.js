// Chart colours for the Wrike-style design (see /DESIGN.md). Canvas can't read CSS variables, so the
// palette lives here, one set per theme. Series colours were run through the dataviz CVD validator:
// adjacent/all-pairs separation passes in both themes; the low-chroma navy/steel hues are intentional
// (brand palette), so every chart also carries a legend and a 2px surface gap between marks.

const LIGHT = {
  surface: '#f2f5fa',          // Frost card
  text: '#5a6a87',
  grid: 'rgba(191,199,217,0.55)',
  tooltipBg: '#ffffff',
  tooltipBorder: '#bfc7d9',
  status: ['#657694', '#162136', '#00e05c'],       // pending · in progress · completed
  priority: ['#9aa7c0', '#657694', '#162136'],      // low → high (ordinal: light → dark)
  roles: { super_admin: '#162136', admin: '#c0303b', manager: '#657694', employee: '#00e05c' },
  roleFallback: '#9aa7c0',
  bar: '#009a4e',
};

const DARK = {
  surface: '#162136',          // navy card
  text: '#aab4ca',
  grid: 'rgba(43,58,87,0.8)',
  tooltipBg: '#0f1828',
  tooltipBorder: '#2b3a57',
  status: ['#8a96ae', '#f2f5fa', '#00e05c'],
  priority: ['#4a5b7c', '#8a96ae', '#f2f5fa'],
  roles: { super_admin: '#f2f5fa', admin: '#ff7b85', manager: '#8a96ae', employee: '#00e05c' },
  roleFallback: '#4a5b7c',
  bar: '#00e05c',
};

export const chartTheme = (dark) => (dark ? DARK : LIGHT);

/** Shared tooltip options so every chart's tooltip looks the same. */
export const tooltipStyle = (dark, isRTL) => {
  const c = chartTheme(dark);
  return {
    rtl: isRTL,
    textDirection: isRTL ? 'rtl' : 'ltr',
    backgroundColor: c.tooltipBg,
    titleColor: dark ? '#f2f5fa' : '#162136',
    bodyColor: c.text,
    borderColor: c.tooltipBorder,
    borderWidth: 1,
    cornerRadius: 12,
    padding: 10,
  };
};
