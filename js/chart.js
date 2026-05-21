// ============================================================
// GRAINWATCH — Chart Manager (Chart.js)
// ============================================================

const ChartManager = {
  chart: null,

  _isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.hasAttribute('data-theme') &&
       window.matchMedia('(prefers-color-scheme: dark)').matches);
  },

  /**
   * Create or update the main price chart
   * @param {Array} data - price history [{date, price}]
   * @param {string} commodityName
   * @param {string} direction - "up" or "down"
   * @param {string} currencySymbol
   */
  render(data, commodityName, direction, currencySymbol) {
    const ctx = document.getElementById('priceChart').getContext('2d');

    const dark = this._isDark();

    // Gradient fill — stronger in dark mode for contrast
    const gradient = ctx.createLinearGradient(0, 0, 0, 350);
    if (direction === "up") {
      gradient.addColorStop(0, dark ? 'rgba(138, 175, 62, 0.35)' : 'rgba(107, 124, 45, 0.25)');
      gradient.addColorStop(1, dark ? 'rgba(138, 175, 62, 0.05)' : 'rgba(107, 124, 45, 0.02)');
    } else {
      gradient.addColorStop(0, dark ? 'rgba(224, 123, 90, 0.35)' : 'rgba(192, 57, 43, 0.25)');
      gradient.addColorStop(1, dark ? 'rgba(224, 123, 90, 0.05)' : 'rgba(192, 57, 43, 0.02)');
    }

    const lineColor = direction === "up"
      ? (dark ? '#8AAF3E' : '#6B7C2D')
      : (dark ? '#E07B5A' : '#C0392B');

    const chartData = {
      labels: data.map(d => d.date),
      datasets: [{
        label: commodityName,
        data: data.map(d => d.price),
        borderColor: lineColor,
        backgroundColor: gradient,
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: lineColor,
        pointHoverBorderColor: dark ? '#242444' : '#FFFFFF',
        pointHoverBorderWidth: 2,
      }],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: dark ? '#333355' : '#2C2C2C',
          titleColor: '#FDF6E3',
          bodyColor: '#FDF6E3',
          titleFont: { family: "'Inter', sans-serif", size: 13 },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 14, weight: 'bold' },
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: function(items) {
              const d = new Date(items[0].label);
              const locale = typeof I18N !== "undefined" && I18N.lang === "en" ? "en-GB" : "fr-FR";
              return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
            },
            label: function(item) {
              return currencySymbol + item.formattedValue;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', drawBorder: false },
          ticks: {
            font: { family: "'Inter', sans-serif", size: 11 },
            color: dark ? '#A0A0B0' : '#6B6B6B',
            maxTicksLimit: 8,
            callback: function(value, index) {
              const label = this.getLabelForValue(value);
              const d = new Date(label);
              const locale = typeof I18N !== "undefined" && I18N.lang === "en" ? "en-GB" : "fr-FR";
              return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
            },
          },
        },
        y: {
          position: 'left',
          grid: { color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', drawBorder: false },
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 12 },
            color: dark ? '#A0A0B0' : '#6B6B6B',
            callback: function(value) {
              const locale = typeof I18N !== "undefined" && I18N.lang === "en" ? "en-GB" : "fr-FR";
              return currencySymbol + value.toLocaleString(locale);
            },
          },
        },
      },
      animation: {
        duration: 600,
        easing: 'easeOutQuart',
      },
    };

    if (this.chart) {
      this.chart.data = chartData;
      this.chart.options = options;
      this.chart.update('active');
    } else {
      this.chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: options,
      });
    }
  },

  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  },
};
