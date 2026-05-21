// ============================================================
// GRAINWATCH — Main Application Controller
// ============================================================

const App = {
  state: {
    selectedCommodity: "wheat",
    selectedPeriod: 180,
    currency: "USD",
    source: "worldbank",
    favorites: new Set(["wheat", "corn", "rice", "coffee"]),
    // User's active commodity IDs — loaded from localStorage or defaults
    activeCommodityIds: [...DEFAULT_COMMODITY_IDS],
    visibleCommodities: new Set(DEFAULT_COMMODITY_IDS),
    tab: "all",
    prices: [],
    loading: false,
    // Custom date range mode
    customRange: null, // { startMonth, startYear, endMonth, endYear } or null
  },

  // --------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------
  async init() {
    I18N.init();
    this.loadFavorites();
    this.loadVisibleCommodities();
    this.bindEvents();
    this.updateLangButton();
    this.applyTranslations();
    this.updateTime();
    this.updateSourceBadge();
    this.updateSourceTooltip();
    // Initialize export page
    ExportPage.init();
    SourcesPage.init();
    AlertsManager.init();
    this._initTheme();
    this._updateExportVisibility();
    // Show loading state before fetching data
    this.setLoading(true);
    await this.loadAllPrices();
    AlertsManager.checkAlerts(this.state.prices);
    // On mobile: load detail data but stay on list view
    this._initializing = true;
    await this.selectCommodity("wheat");
    this._initializing = false;
  },

  // --------------------------------------------------------
  // EVENT BINDINGS
  // --------------------------------------------------------
  bindEvents() {
    // Period buttons (standard preset periods)
    document.querySelectorAll('.period-btn[data-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.selectedPeriod = parseInt(btn.dataset.period);
        this.state.customRange = null; // exit custom mode
        document.getElementById('customRangePicker').style.display = 'none';
        document.getElementById('customPeriodToggle').classList.remove('active');
        this.loadDetail();
      });
    });

    // Custom period toggle button
    document.getElementById('customPeriodToggle').addEventListener('click', () => {
      const picker = document.getElementById('customRangePicker');
      const toggle = document.getElementById('customPeriodToggle');
      const isOpen = picker.style.display !== 'none';
      if (isOpen) {
        picker.style.display = 'none';
        toggle.classList.remove('active');
      } else {
        picker.style.display = 'block';
        toggle.classList.add('active');
        // Remove active from other period buttons
        document.querySelectorAll('.period-btn[data-period]').forEach(b => b.classList.remove('active'));
        // Scroll picker into view on mobile
        if (window.innerWidth <= 768) {
          setTimeout(() => picker.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        }
        // Pre-fill with sensible defaults if empty
        const now = new Date();
        const endM = document.getElementById('rangeMonthEnd');
        const endY = document.getElementById('rangeYearEnd');
        if (!endM.value) endM.value = now.getMonth() + 1;
        if (!endY.value) endY.value = now.getFullYear();
      }
    });

    // Custom range apply button — iOS fix: touchend fires even if keyboard was open
    const applyBtn = document.getElementById('rangeApplyBtn');
    applyBtn.addEventListener('click', () => {
      this._applyCustomRange();
    });
    applyBtn.addEventListener('touchend', (e) => {
      e.preventDefault(); // prevent ghost click
      document.activeElement.blur(); // close keyboard first
      setTimeout(() => this._applyCustomRange(), 50);
    });

    // Blur range inputs on scroll (closes iOS keyboard)
    const detailPanel = document.querySelector('.detail-panel');
    if (detailPanel) {
      detailPanel.addEventListener('scroll', () => {
        if (document.activeElement && document.activeElement.classList.contains('range-input')) {
          document.activeElement.blur();
        }
      }, { passive: true });
    }

    // Allow Enter key in range inputs
    document.querySelectorAll('.range-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._applyCustomRange();
      });
    });

    // Currency buttons
    document.querySelectorAll('.currency-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.currency = btn.dataset.currency;
        this.renderCommodityList();
        this.loadDetail();
      });
    });

    // Source buttons
    document.querySelectorAll('.source-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.source = btn.dataset.source;
        this.updateSourceBadge();
        this.updateSourceTooltip();
        this._updateExportVisibility();
        // Clear cache when switching source
        GrainWatchAPI._cache = {};
        this.refresh();
      });
    });

    // Customize panel
    document.getElementById('customizeBtn').addEventListener('click', () => this.openCustomizePanel());
    document.getElementById('customizeClose').addEventListener('click', () => this.closeCustomizePanel());

    // Add commodity from dropdown
    const addBtn = document.getElementById('addCommodityBtn');
    const addSelect = document.getElementById('addCommoditySelect');

    // Show button only when a real commodity is selected
    addSelect.addEventListener('change', () => {
      addBtn.style.display = addSelect.value ? 'inline-block' : 'none';
    });

    addBtn.addEventListener('click', () => {
      if (addSelect.value) {
        this._addCommodity(addSelect.value);
        // Hide button again after adding
        addBtn.style.display = 'none';
      }
    });

    // Select all / Reset
    document.getElementById('selectAllBtn').addEventListener('click', () => {
      this.state.visibleCommodities = new Set(this.state.activeCommodityIds);
      this._saveState();
      this._renderCustomizeList();
      this.loadAllPrices();
    });
    document.getElementById('resetBtn').addEventListener('click', () => {
      this._resetCommodities();
    });

    // Language toggle
    document.getElementById('langToggle').addEventListener('click', () => {
      I18N.lang = I18N.lang === "fr" ? "en" : "fr";
      this.updateLangButton();
      this.applyTranslations();
      this.updateSourceBadge();
      this.updateSourceTooltip();
      this.renderCommodityList();
      this.loadDetail();
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => this.refresh());

    // Mobile back button
    document.getElementById('mobileBackBtn').addEventListener('click', () => {
      this._showMobileList();
    });

    // Export page button
    document.getElementById('openExportPage').addEventListener('click', () => ExportPage.open());

    // Sources page link (event delegation since link is recreated on badge update)
    document.getElementById('sourceBadge').addEventListener('click', (e) => {
      if (e.target.id === 'openSourcesPage' || e.target.closest('#openSourcesPage')) {
        e.preventDefault();
        SourcesPage.open();
      }
    });

    // Sidebar tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.tab = btn.dataset.tab;
        this.renderCommodityList();
      });
    });
  },

  // --------------------------------------------------------
  // CUSTOM DATE RANGE VALIDATION & APPLICATION
  // --------------------------------------------------------
  _applyCustomRange() {
    const mStart = parseInt(document.getElementById('rangeMonthStart').value);
    const yStart = parseInt(document.getElementById('rangeYearStart').value);
    const mEnd   = parseInt(document.getElementById('rangeMonthEnd').value);
    const yEnd   = parseInt(document.getElementById('rangeYearEnd').value);
    const errEl  = document.getElementById('rangeError');

    // Helper to show error
    const showError = (msg) => {
      errEl.textContent = msg;
      errEl.style.display = 'block';
      errEl.classList.add('shake');
      setTimeout(() => errEl.classList.remove('shake'), 500);
    };
    const hideError = () => { errEl.style.display = 'none'; };
    hideError();

    // --- Validation ---

    // 1. All fields filled?
    if (!mStart || !yStart || !mEnd || !yEnd) {
      showError(I18N.t('range_error_empty'));
      return;
    }

    // 2. Month range check (1-12)
    if (mStart < 1 || mStart > 12 || mEnd < 1 || mEnd > 12) {
      showError(I18N.t('range_error_month'));
      return;
    }

    // 3. 19th century check — the fun one
    if (yStart < 1900 || yEnd < 1900) {
      showError(I18N.t('range_error_19th'));
      return;
    }

    // 4. Not before 1960 (World Bank data starts ~1960)
    if (yStart < 1960 || yEnd < 1960) {
      showError(I18N.t('range_error_too_old'));
      return;
    }

    // 5. Not in the future
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    if (yEnd > currentYear || (yEnd === currentYear && mEnd > currentMonth)) {
      showError(I18N.t('range_error_future'));
      return;
    }

    // 6. Start must be <= End
    if (yStart > yEnd || (yStart === yEnd && mStart > mEnd)) {
      showError(I18N.t('range_error_order'));
      return;
    }

    // --- All good! Apply custom range ---
    this.state.customRange = {
      startMonth: mStart,
      startYear: yStart,
      endMonth: mEnd,
      endYear: yEnd,
    };

    // Calculate equivalent days for compatibility
    const startDate = new Date(yStart, mStart - 1, 1);
    const endDate = new Date(yEnd, mEnd - 1, 28);
    this.state.selectedPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    hideError();
    // On mobile, close keyboard and scroll to chart
    if (window.innerWidth <= 768) {
      document.activeElement.blur();
      setTimeout(() => {
        const chart = document.querySelector('.chart-container');
        if (chart) chart.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
    this.loadDetail();
  },

  // --------------------------------------------------------
  // DATA LOADING
  // --------------------------------------------------------
  async loadAllPrices() {
    if (this.state.customRange) {
      this.state.prices = await GrainWatchAPI.getAllPricesCustomRange(this.state.customRange, this.state.source);
    } else {
      this.state.prices = await GrainWatchAPI.getAllPrices(this.state.selectedPeriod, this.state.source);
    }
    this.renderCommodityList();
    AlertsManager.checkAlerts(this.state.prices);
  },

  async loadDetail() {
    const { selectedCommodity, selectedPeriod, currency, source } = this.state;
    const commodity = COMMODITIES.find(c => c.id === selectedCommodity);
    const symbol = CURRENCY_SYMBOLS[currency];
    const rate = EXCHANGE_RATES[currency];

    // Show loading state
    this.setLoading(true);

    try {
      // Load price history and stats in parallel
      const customRange = this.state.customRange;
      const [history, stats] = await Promise.all([
        customRange
          ? GrainWatchAPI.getPriceHistoryCustomRange(selectedCommodity, customRange, source)
          : GrainWatchAPI.getPriceHistory(selectedCommodity, selectedPeriod, source),
        customRange
          ? GrainWatchAPI.getStatsCustomRange(selectedCommodity, customRange, source)
          : GrainWatchAPI.getStats(selectedCommodity, selectedPeriod, source),
      ]);

      // Convert prices to selected currency
      const convertedHistory = history.map(h => ({
        ...h,
        price: Math.round(h.price * rate * 100) / 100,
      }));

      // Update header
      const currentPrice = convertedHistory[convertedHistory.length - 1].price;
      document.getElementById('detailIcon').textContent = commodity.icon;
      document.getElementById('detailName').textContent = I18N.commodityName(commodity);
      document.getElementById('detailCode').textContent = commodity.code;
      document.getElementById('detailPrice').textContent = symbol + this.formatNumber(currentPrice);

      // Show unit based on source, adapting currency symbol
      let unitText;
      if (source === "usda") {
        unitText = I18N.t("usda_unit");
      } else {
        const rawUnit = source === "worldbank" ? commodity.unitWB : commodity.unit;
        // Replace currency symbols — c/ becomes "ct/" (centimes d'euro) in EUR mode
        if (currency === "EUR") {
          unitText = rawUnit.replace("$/", "€/").replace("c/", "ct/");
        } else {
          unitText = rawUnit;
        }
      }
      document.getElementById('detailUnit').textContent = unitText;

      const changeEl = document.getElementById('detailChange');
      const periodLabel = this.getPeriodLabel(selectedPeriod);
      const arrow = stats.variationDirection === "up" ? "▲" : "▼";
      changeEl.textContent = `${arrow} ${Math.abs(stats.variation).toFixed(2)}% (${periodLabel})`;
      changeEl.className = 'detail-change ' + stats.variationDirection;

      // Update chart
      ChartManager.render(convertedHistory, I18N.commodityName(commodity), stats.variationDirection, symbol);

      // Update indicators
      const indVariation = document.getElementById('indVariation');
      indVariation.textContent = `${stats.variation >= 0 ? '+' : ''}${stats.variation.toFixed(2)}%`;
      indVariation.className = 'indicator-value ' + stats.variationDirection;

      document.getElementById('indAverage').textContent = symbol + this.formatNumber(Math.round(stats.average * rate * 100) / 100);
      document.getElementById('indHigh').textContent = symbol + this.formatNumber(Math.round(stats.high * rate * 100) / 100);

      const indTrend = document.getElementById('indTrend');
      indTrend.textContent = stats.trend;
      indTrend.className = 'indicator-value ' + stats.trendDirection;

      // Update source date
      if (history.length > 0) {
        const lastDate = new Date(history[history.length - 1].date);
        const locale = I18N.lang === "en" ? "en-GB" : "fr-FR";
        document.getElementById('sourceDate').textContent = lastDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      }

      // Store last history for CSV export
      this._lastHistory = convertedHistory;
      this._lastCommodity = commodity;

      // Refresh sidebar
      await this.loadAllPrices();

      // Load geopolitical news (async, non-blocking)
      this.loadNews(selectedCommodity, I18N.commodityName(commodity));

    } catch (error) {
      console.error("Error loading detail:", error);
    } finally {
      this.setLoading(false);
    }
  },

  // --------------------------------------------------------
  // COMMODITY SELECTION
  // --------------------------------------------------------
  async selectCommodity(commodityId) {
    this.state.selectedCommodity = commodityId;

    // Highlight in sidebar
    document.querySelectorAll('.commodity-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === commodityId);
    });

    await this.loadDetail();

    // On mobile: switch to detail view
    this._showMobileDetail();
  },

  // --------------------------------------------------------
  // RENDER SIDEBAR LIST
  // --------------------------------------------------------
  renderCommodityList() {
    const list = document.getElementById('commodityList');
    const { currency, tab, favorites, prices } = this.state;
    const symbol = CURRENCY_SYMBOLS[currency];
    const rate = EXCHANGE_RATES[currency];

    let items = prices.filter(p => this.state.visibleCommodities.has(p.id));
    if (tab === "favorites") {
      items = items.filter(p => favorites.has(p.id));
    }

    if (items.length === 0 && tab === "favorites") {
      list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--grey);font-size:13px;">${I18N.t("no_favorites")}</div>`;
      return;
    }

    list.innerHTML = items.map(p => {
      const convertedPrice = Math.round(p.currentPrice * rate * 100) / 100;
      const arrow = p.direction === "up" ? "▲" : "▼";
      const isFav = favorites.has(p.id);
      const isActive = p.id === this.state.selectedCommodity;
      const displayName = I18N.commodityName(p);

      return `
        <div class="commodity-item ${isActive ? 'active' : ''}" data-id="${p.id}" onclick="App.selectCommodity('${p.id}')">
          <span class="icon">${p.icon}</span>
          <div class="info">
            <div class="name">${displayName}</div>
            <div class="code">${p.code}</div>
          </div>
          <div class="price-col">
            <div class="price">${symbol}${this.formatNumber(convertedPrice)}</div>
            <div class="change ${p.direction}">${arrow} ${Math.abs(p.change).toFixed(2)}%</div>
          </div>
          <button class="fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); App.toggleFavorite('${p.id}')" title="Favori">
            ${isFav ? '★' : '☆'}
          </button>
        </div>
      `;
    }).join('');
  },

  // --------------------------------------------------------
  // SOURCE BADGE
  // --------------------------------------------------------
  updateSourceBadge() {
    const info = GrainWatchAPI.getSourceInfo(this.state.source);
    const badge = document.getElementById('sourceBadge');
    const sourceName = I18N.lang === "en" && this.state.source === "worldbank" ? "World Bank" : info.name;
    const freq = I18N.lang === "en" ? (info.frequency === "Mensuelle" ? "Monthly" : info.frequency === "Annuelle" ? "Annual" : "Daily (simulated)") : info.frequency;

    // Construction DOM safe — pas d'innerHTML, info.url whitelistée http(s)
    badge.textContent = '';
    badge.appendChild(document.createTextNode(`${info.icon} ${I18N.t("source_badge")} `));

    const strong = document.createElement('strong');
    strong.textContent = sourceName;
    badge.appendChild(strong);

    badge.appendChild(document.createTextNode(` (${freq}) — ${I18N.t("source_updated")} : `));

    const dateSpan = document.createElement('span');
    dateSpan.id = 'sourceDate';
    dateSpan.textContent = '--';
    badge.appendChild(dateSpan);

    if (info.url) {
      badge.appendChild(document.createTextNode(' — '));
      const a = document.createElement('a');
      a.href = /^https?:\/\//i.test(info.url) ? info.url : '#';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.color = 'var(--olive)';
      a.style.textDecoration = 'underline';
      a.textContent = I18N.t("source_learn_more");
      badge.appendChild(a);
    }

    badge.appendChild(document.createTextNode(' — '));
    const sourcesLink = document.createElement('a');
    sourcesLink.href = '#';
    sourcesLink.className = 'sources-link';
    sourcesLink.id = 'openSourcesPage';
    sourcesLink.textContent = I18N.t("sources_link");
    badge.appendChild(sourcesLink);
  },

  updateSourceTooltip() {
    const info = GrainWatchAPI.getSourceInfo(this.state.source);
    const tooltip = document.getElementById('tooltipSource');
    if (tooltip) {
      const descKey = this.state.source === "worldbank" ? "source_desc_wb" : this.state.source === "usda" ? "source_desc_usda" : "source_desc_sim";
      tooltip.innerHTML = `<span class="tooltip-icon">${info.icon}</span><span>${I18N.t(descKey)}</span><div class="tooltip-arrow" id="sourceArrow"></div>`;

      // Position the arrow above the active source button
      this._positionSourceArrow();
    }
  },

  _positionSourceArrow() {
    const activeBtn = document.querySelector('.source-btn.active');
    const tooltip = document.getElementById('tooltipSource');
    const arrow = document.getElementById('sourceArrow');
    if (!activeBtn || !tooltip || !arrow) return;

    // Get positions relative to the tooltip's parent container
    const container = tooltip.parentElement;
    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    // Arrow should point to the center of the active button
    const btnCenterX = btnRect.left + btnRect.width / 2 - containerRect.left;

    // tooltip is right-aligned in the header, so we use right-based offset
    const tooltipRect = tooltip.getBoundingClientRect();
    const arrowPosFromLeft = btnCenterX - (tooltipRect.left - containerRect.left);

    arrow.style.left = arrowPosFromLeft + 'px';
    arrow.style.right = 'auto';
    arrow.style.transform = 'translateX(-50%)';
  },

  // --------------------------------------------------------
  // FAVORITES
  // --------------------------------------------------------
  toggleFavorite(commodityId) {
    if (this.state.favorites.has(commodityId)) {
      this.state.favorites.delete(commodityId);
    } else {
      this.state.favorites.add(commodityId);
    }
    this.saveFavorites();
    this.renderCommodityList();
  },

  saveFavorites() {
    try {
      localStorage.setItem('grainwatch_favorites', JSON.stringify([...this.state.favorites]));
    } catch (e) { /* localStorage not available */ }
  },

  loadFavorites() {
    try {
      const saved = localStorage.getItem('grainwatch_favorites');
      if (saved) {
        this.state.favorites = new Set(JSON.parse(saved));
      }
    } catch (e) { /* localStorage not available */ }
  },

  // --------------------------------------------------------
  // COMMODITY CUSTOMIZER
  // --------------------------------------------------------
  loadVisibleCommodities() {
    try {
      // Load user's active list
      const savedActive = localStorage.getItem('grainwatch_active_ids');
      if (savedActive) {
        this.state.activeCommodityIds = JSON.parse(savedActive);
      }
      // Load visibility (checked/unchecked)
      const savedVisible = localStorage.getItem('grainwatch_visible');
      if (savedVisible) {
        this.state.visibleCommodities = new Set(JSON.parse(savedVisible));
      } else {
        this.state.visibleCommodities = new Set(this.state.activeCommodityIds);
      }
    } catch (e) {}
    // Rebuild COMMODITIES from active IDs
    this._rebuildCommodities();
  },

  _rebuildCommodities() {
    COMMODITIES = this.state.activeCommodityIds
      .map(id => ALL_COMMODITIES.find(c => c.id === id))
      .filter(Boolean);
  },

  _saveState() {
    try {
      localStorage.setItem('grainwatch_active_ids', JSON.stringify(this.state.activeCommodityIds));
      localStorage.setItem('grainwatch_visible', JSON.stringify([...this.state.visibleCommodities]));
    } catch (e) {}
  },

  openCustomizePanel() {
    const panel = document.getElementById('customizePanel');
    this._renderCustomizeList();
    this._renderAddDropdown();
    panel.classList.add('open');
  },

  closeCustomizePanel() {
    document.getElementById('customizePanel').classList.remove('open');
  },

  _renderCustomizeList() {
    const list = document.getElementById('customizeList');
    const activeIds = this.state.activeCommodityIds;

    list.innerHTML = activeIds.map(id => {
      const c = ALL_COMMODITIES.find(x => x.id === id);
      if (!c) return '';
      const checked = this.state.visibleCommodities.has(id) ? 'checked' : '';
      const displayName = I18N.commodityName(c);
      const isDefault = DEFAULT_COMMODITY_IDS.includes(id);

      return `
        <div class="customize-item" data-id="${id}">
          <input type="checkbox" value="${id}" ${checked}>
          <span class="item-icon">${c.icon}</span>
          <span class="item-label">${displayName}</span>
          ${!isDefault ? '<span class="item-badge">+</span>' : ''}
          <span class="item-code">${c.code}</span>
          <button class="item-delete" data-id="${id}" title="${I18N.lang === 'en' ? 'Remove' : 'Retirer'}">&times;</button>
        </div>
      `;
    }).join('');

    // Bind checkboxes
    list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) {
          this.state.visibleCommodities.add(cb.value);
        } else {
          // Keep at least one visible
          const visibleCount = [...this.state.visibleCommodities].length;
          if (visibleCount <= 1) {
            cb.checked = true;
            return;
          }
          this.state.visibleCommodities.delete(cb.value);
        }
        this._saveState();
        this.loadAllPrices();
      });
    });

    // Bind delete buttons
    list.querySelectorAll('.item-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this._removeCommodity(id);
      });
    });
  },

  _renderAddDropdown() {
    const select = document.getElementById('addCommoditySelect');
    const activeSet = new Set(this.state.activeCommodityIds);

    // Available = all catalog items NOT in active list
    const available = ALL_COMMODITIES.filter(c => !activeSet.has(c.id));

    // Reset dropdown
    const placeholderText = I18N.t('customize_add_placeholder');
    select.innerHTML = `<option value="">${placeholderText}</option>`;

    if (available.length === 0) {
      select.innerHTML = `<option value="">${I18N.t('customize_empty_catalog')}</option>`;
      document.getElementById('addCommodityBtn').disabled = true;
      document.getElementById('addCommodityBtn').style.display = 'none';
      return;
    }

    document.getElementById('addCommodityBtn').disabled = false;
    document.getElementById('addCommodityBtn').style.display = 'none';

    // Group by category
    const categories = {
      cereals:     I18N.lang === 'en' ? 'Cereals' : 'Céréales',
      oilseeds:    I18N.lang === 'en' ? 'Oilseeds' : 'Oléagineux',
      softs:       I18N.lang === 'en' ? 'Softs' : 'Denrées tropicales',
      fibers:      I18N.lang === 'en' ? 'Fibers' : 'Fibres',
      industrials: I18N.lang === 'en' ? 'Industrial' : 'Industriels',
    };

    const grouped = {};
    available.forEach(c => {
      const cat = c.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(c);
    });

    Object.entries(grouped).forEach(([cat, items]) => {
      const group = document.createElement('optgroup');
      group.label = categories[cat] || cat;
      items.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.icon} ${I18N.commodityName(c)} (${c.code})`;
        group.appendChild(opt);
      });
      select.appendChild(group);
    });
  },

  _addCommodity(id) {
    if (!id || this.state.activeCommodityIds.includes(id)) return;
    const commodity = ALL_COMMODITIES.find(c => c.id === id);
    if (!commodity) return;

    this.state.activeCommodityIds.push(id);
    this.state.visibleCommodities.add(id);
    this._rebuildCommodities();
    this._saveState();
    this._renderCustomizeList();
    this._renderAddDropdown();
    this.loadAllPrices();
  },

  _removeCommodity(id) {
    // Don't allow removing if it's the last one
    if (this.state.activeCommodityIds.length <= 1) return;

    this.state.activeCommodityIds = this.state.activeCommodityIds.filter(x => x !== id);
    this.state.visibleCommodities.delete(id);
    this._rebuildCommodities();
    this._saveState();

    // If we removed the selected commodity, switch to first available
    if (this.state.selectedCommodity === id) {
      const firstVisible = this.state.activeCommodityIds.find(x => this.state.visibleCommodities.has(x))
        || this.state.activeCommodityIds[0];
      this.selectCommodity(firstVisible);
    }

    this._renderCustomizeList();
    this._renderAddDropdown();
    this.loadAllPrices();
  },

  _resetCommodities() {
    this.state.activeCommodityIds = [...DEFAULT_COMMODITY_IDS];
    this.state.visibleCommodities = new Set(DEFAULT_COMMODITY_IDS);
    this._rebuildCommodities();
    this._saveState();
    this._renderCustomizeList();
    this._renderAddDropdown();

    // If selected commodity was removed, switch to wheat
    if (!DEFAULT_COMMODITY_IDS.includes(this.state.selectedCommodity)) {
      this.selectCommodity("wheat");
    }
    this.loadAllPrices();
  },

  // --------------------------------------------------------
  // GEOPOLITICAL NEWS
  // --------------------------------------------------------
  async loadNews(commodityId, commodityName) {
    const articles = await NewsManager.fetchNews(commodityId);
    NewsManager.render(articles, commodityName);
  },



  // --------------------------------------------------------
  // LOADING STATE
  // --------------------------------------------------------
  setLoading(isLoading) {
    this.state.loading = isLoading;
    const btn = document.getElementById('refreshBtn');
    const overlay = document.getElementById('chartLoadingOverlay');
    const priceEl = document.getElementById('detailPrice');
    if (isLoading) {
      btn.classList.add('loading');
      btn.disabled = true;
      if (overlay) overlay.classList.remove('hidden');
      priceEl.classList.add('loading-pulse');
      priceEl.textContent = I18N.t('loading');
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
      if (overlay) overlay.classList.add('hidden');
      priceEl.classList.remove('loading-pulse');
    }
  },

  // --------------------------------------------------------
  // REFRESH
  // --------------------------------------------------------
  async refresh() {
    GrainWatchAPI._cache = {};
    await this.loadDetail();
    AlertsManager.checkAlerts(this.state.prices);
    this.updateTime();
  },

  // --------------------------------------------------------
  // LANGUAGE
  // --------------------------------------------------------
  updateLangButton() {
    document.getElementById('langFlag').textContent = I18N.lang === "fr" ? "🇫🇷" : "🇬🇧";
    document.getElementById('langCode').textContent = I18N.lang.toUpperCase();
  },

  applyTranslations() {
    // Translate all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = I18N.t(key);
      if (key === "tab_favorites") {
        el.textContent = "★ " + text;
      } else if (el.tagName === "P" || key === "no_favorites" || el.classList.contains('sources-free-notice') || el.classList.contains('sources-text')) {
        el.innerHTML = text;
      } else {
        el.textContent = text;
      }
    });

    // Tooltip texts
    const tooltipSource = document.querySelector('#tooltipSource > span:not(.tooltip-icon)');
    if (tooltipSource) tooltipSource.textContent = I18N.t("tooltip_source");

    const tooltipCurrencyText = document.getElementById('tooltipCurrencyText');
    if (tooltipCurrencyText) tooltipCurrencyText.textContent = I18N.t("tooltip_currency");

    const tooltipPeriod = document.querySelector('#tooltipPeriod > span:not(.tooltip-icon)');
    if (tooltipPeriod) tooltipPeriod.textContent = I18N.t("tooltip_period");

    // Source buttons text
    const sourceButtons = document.querySelectorAll('.source-btn');
    const sourceLabels = ["source_worldbank", "source_usda", "source_simulation"];
    const sourceIcons = ["🏛️", "🇺🇸", "🔬"];
    sourceButtons.forEach((btn, i) => {
      if (sourceLabels[i]) {
        btn.innerHTML = `<span class="source-dot"></span> ${sourceIcons[i]} ${I18N.t(sourceLabels[i])}`;
      }
    });

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      const svg = refreshBtn.querySelector('svg').outerHTML;
      refreshBtn.innerHTML = svg + "\n        " + I18N.t("refresh");
    }
  },

  // --------------------------------------------------------
  // UTILITIES
  // --------------------------------------------------------
  updateTime() {
    const now = new Date();
    const locale = I18N.lang === "en" ? "en-GB" : "fr-FR";
    document.getElementById('updateTime').textContent =
      `${I18N.t("update_time")} ${now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
  },

  getPeriodLabel(days) {
    // Custom range mode
    if (this.state.customRange) {
      const { startMonth, startYear, endMonth, endYear } = this.state.customRange;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(startMonth)}/${startYear} — ${pad(endMonth)}/${endYear}`;
    }
    if (days <= 30) return "1M";
    if (days <= 90) return "3M";
    if (days <= 180) return "6M";
    if (days <= 365) return "1A";
    if (days <= 1825) return "5A";
    if (days <= 3650) return "10A";
    if (days <= 5475) return "15A";
    return `${Math.round(days / 365)}A`;
  },

  // --------------------------------------------------------
  // MOBILE: TWO-VIEW NAVIGATION
  // --------------------------------------------------------
  _isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  },

  _showMobileDetail() {
    if (!this._isMobile() || this._initializing) return;
    document.querySelector('.main-layout').classList.add('mobile-detail-active');
    // Scroll detail panel to top
    const panel = document.querySelector('.detail-panel');
    if (panel) panel.scrollTop = 0;
  },

  _showMobileList() {
    document.querySelector('.main-layout').classList.remove('mobile-detail-active');
  },

  // --------------------------------------------------------
  // THEME (dark/light mode)
  // --------------------------------------------------------
  _initTheme() {
    const saved = localStorage.getItem('grainwatch_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else if (prefersDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    // else: no attribute = light (default)

    this._updateThemeIcon();

    // Toggle button
    document.getElementById('themeToggle').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('grainwatch_theme', next);
      this._updateThemeIcon();
      // Update chart gradient colors
      if (this.state.selectedCommodity) this.loadDetail();
    });

    // Listen for OS theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('grainwatch_theme')) {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        this._updateThemeIcon();
        if (this.state.selectedCommodity) this.loadDetail();
      }
    });
  },

  _updateThemeIcon() {
    const theme = document.documentElement.getAttribute('data-theme');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  },

  _updateExportVisibility() {
    const exportBtn = document.getElementById('openExportPage');
    if (exportBtn) {
      exportBtn.closest('.export-row').style.display =
        this.state.source === 'simulated' ? 'none' : '';
    }
  },

  formatNumber(num) {
    const locale = I18N.lang === "en" ? "en-GB" : "fr-FR";
    if (num >= 1000) {
      return num.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    if (num >= 100) {
      return num.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    return num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
};

// ============================================================
// LAUNCH
// ============================================================
document.addEventListener('DOMContentLoaded', () => App.init());

// Detect resize changes (e.g. rotation)
window.addEventListener('resize', () => {
  const wasMobile = document.querySelector('.main-layout.mobile-detail-active');
  if (!App._isMobile() && wasMobile) {
    // Switching to desktop: show both panels
    document.querySelector('.main-layout').classList.remove('mobile-detail-active');
  }
});
