// ============================================================
// GRAINWATCH — Main Application Controller
// ============================================================

// ── GrainTrack3D — Configuration inter-app ──────────────────
// Lien vers l'app sœur de l'écosystème CargoSphere (suivi 3D des
// vraquiers céréaliers). Paramètre URL attendu côté GrainTrack3D :
// ?grain=<key>  où key est l'une des 12 céréales suivies
// (cf. src/data/grainList.js du repo GrainTrack3D — validé contre
//  GRAIN_LIST.some(g => g.key === grainParam) dans App.jsx).
const GRAINTRACK3D_BASE_URL = 'https://grain-track3-d.vercel.app';
const GRAINTRACK3D_PARAM_NAME = 'grain';
const GRAINTRACK3D_SUPPORTED_KEYS = new Set([
  'wheat', 'corn', 'rice', 'soybean', 'sugar', 'barley',
  'oats', 'sorghum', 'rapeseed', 'groundnut', 'lentils', 'millet'
]);

/**
 * Construit l'URL GrainTrack3D pré-filtrée pour une denrée donnée.
 * Retourne null si la denrée n'est pas supportée par GrainTrack3D
 * (ex: café, cacao, coton — pas de ports vraquiers céréaliers).
 * @param {string} commodityId — id de la denrée (ex: 'wheat')
 * @returns {string|null}
 */
function buildGrainTrack3DUrl(commodityId) {
  if (!commodityId || typeof commodityId !== 'string') return null;
  const key = commodityId.trim().toLowerCase();
  if (!GRAINTRACK3D_SUPPORTED_KEYS.has(key)) return null;
  // URL() + searchParams.set() : encodage automatique, pas de concaténation.
  const url = new URL(GRAINTRACK3D_BASE_URL);
  url.searchParams.set(GRAINTRACK3D_PARAM_NAME, key);
  return url.toString();
}

// Version applicative — source unique (footer + menu À propos)
const APP_VERSION = '0.9.1';

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
    this._initTouchTooltips();
    this.updateLangButton();
    this.applyTranslations();
    this._setVersions();
    this._initMenu();
    this.setupToolbarOverflow();
    this.enforceSourceHiding();  // C4-bis : bretelle JS pour Safari iOS
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
        this.state.selectedPeriod = parseInt(btn.dataset.period, 10);
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

    // Sélection de source — boutons de la barre (desktop) ET items du menu (mobile).
    // Les deux UI partagent App.state.source comme source de vérité unique.
    document.querySelectorAll('.source-btn, .menu-api-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.source) this.setSource(btn.dataset.source);
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

    // GrainTrack3D link : quand la denrée n'est pas couverte (état désactivé),
    // le clic ne navigue pas ET ouvre/ferme la bulle explicative (C2 — le tap sur
    // l'icône grisée est le geste naturel ; sur tactile aucun title ne s'afficherait).
    const gt3dLink = document.getElementById('graintrack3d-link');
    if (gt3dLink) {
      gt3dLink.addEventListener('click', (e) => {
        if (!gt3dLink.classList.contains('graintrack3d-link--disabled')) return;
        e.preventDefault();
        const wrap = document.getElementById('gt3dWrap');
        if (!wrap || !wrap.querySelector('.tooltip-bubble')) return;
        // stopPropagation : empêche la délégation document de refermer aussitôt.
        e.stopPropagation();
        const wasOpen = wrap.classList.contains('tooltip-open');
        this._closeAllTooltips();
        if (!wasOpen) {
          wrap.classList.add('tooltip-open');
          this._clampTooltip(wrap);
        }
      });
    }
  },

  // --------------------------------------------------------
  // CUSTOM DATE RANGE VALIDATION & APPLICATION
  // --------------------------------------------------------
  _applyCustomRange() {
    // Radix 10 explicite : défense en profondeur contre toute valeur exotique
    // ("0x10", "07"…) que pourrait remonter un input altéré.
    const mStart = parseInt(document.getElementById('rangeMonthStart').value, 10);
    const yStart = parseInt(document.getElementById('rangeYearStart').value, 10);
    const mEnd   = parseInt(document.getElementById('rangeMonthEnd').value, 10);
    const yEnd   = parseInt(document.getElementById('rangeYearEnd').value, 10);
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

      // ── Lien GrainTrack3D — 3 états : ACTIF / DÉSACTIVÉ / MASQUÉ ────────
      //    ACTIF : denrée dans les 12 céréales/oléagineux trackés par AIS
      //    DÉSACTIVÉ : denrée sélectionnée mais hors catalogue GrainTrack3D
      //                (café, cacao, coton…) — icône grisée + barrée + tooltip
      //                explicatif, pour ne pas laisser l'utilisateur perplexe
      //    MASQUÉ : aucune denrée sélectionnée
      const gt3dWrap = document.getElementById('gt3dWrap');
      const gt3dLink = document.getElementById('graintrack3d-link');
      if (gt3dWrap && gt3dLink) {
        const gt3dUrl = buildGrainTrack3DUrl(selectedCommodity);
        if (gt3dUrl) {
          // ACTIF — lien cliquable. title natif conservé (hint desktop au survol ;
          // pas de bulle dans cet état, donc aucun double-tooltip).
          gt3dLink.href = gt3dUrl;
          gt3dLink.title = I18N.t('graintrack3d_tooltip');
          gt3dLink.setAttribute('aria-label', I18N.t('graintrack3d_tooltip'));
          gt3dLink.classList.remove('graintrack3d-link--disabled');
          gt3dLink.removeAttribute('aria-disabled');
          gt3dWrap.style.display = 'inline-flex';
          this._removeGrainTrack3DInfo();
        } else if (selectedCommodity) {
          // DÉSACTIVÉ — bulle explicative : tap sur l'icône (mobile) ou survol
          // (desktop) l'affiche. Pas de title natif ici → évite le double-tooltip.
          gt3dLink.href = '#';
          gt3dLink.removeAttribute('title');
          gt3dLink.setAttribute('aria-label', I18N.t('graintrack3d_tooltip_disabled'));
          gt3dLink.classList.add('graintrack3d-link--disabled');
          gt3dLink.setAttribute('aria-disabled', 'true');
          gt3dWrap.style.display = 'inline-flex';
          this._showGrainTrack3DInfo(I18N.t('graintrack3d_tooltip_disabled'));
        } else {
          // MASQUÉ — aucune denrée sélectionnée
          gt3dWrap.style.display = 'none';
          gt3dLink.href = '#';
          gt3dLink.classList.remove('graintrack3d-link--disabled');
          gt3dLink.removeAttribute('aria-disabled');
          this._removeGrainTrack3DInfo();
        }
      }

      // Show unit based on source, adapting currency symbol
      let unitText;
      if (source === "usda") {
        unitText = I18N.t("usda_unit");
      } else {
        const rawUnit = source === "worldbank" ? commodity.unitWB : commodity.unit;
        // Replace currency symbols — c/ becomes "ct/" (centimes d'euro) in EUR mode
        if (currency === "EUR") {
          unitText = rawUnit.replace("$/", "€/").replace("¢/", "ct/");
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
      console.error("Error loading detail:", error.message);
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
  // SOURCE SELECTION (barre desktop + menu mobile, état unique)
  // --------------------------------------------------------
  setSource(source) {
    // Whitelist : ne jamais accepter une valeur forgée via un DOM altéré.
    if (!['worldbank', 'usda', 'simulated'].includes(source)) return;
    this.state.source = source;
    // Synchronise l'état actif sur les deux représentations (barre + menu)
    document.querySelectorAll('.source-btn, .menu-api-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.source === source);
    });
    this.updateSourceBadge();      // met aussi à jour la pastille mobile
    this.updateSourceTooltip();
    this._updateExportVisibility();
    GrainWatchAPI._cache = {};     // vide le cache au changement de source
    this.refresh();
    this.closeMenu();              // referme le menu après sélection (no-op si fermé)
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

    // Pastille API active (mobile) — reflète la source courante dans la barre.
    const pastille = document.getElementById('sourcePastille');
    if (pastille) {
      pastille.textContent = info.icon;
      pastille.setAttribute('aria-label', `${I18N.t("menu_sources")} : ${sourceName}`);
      pastille.title = sourceName;
    }
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
        const parsed = JSON.parse(saved);
        // Validation : doit être un tableau de strings (IDs de commodities). Cf. CLAUDE.md §7.
        if (Array.isArray(parsed)) {
          this.state.favorites = new Set(parsed.filter(id => typeof id === 'string'));
        }
      }
    } catch (e) { /* localStorage not available or corrupted */ }
  },

  // --------------------------------------------------------
  // COMMODITY CUSTOMIZER
  // --------------------------------------------------------
  loadVisibleCommodities() {
    // Désérialisation défensive : on filtre les IDs sur le catalogue réel
    // pour ignorer toute valeur injectée. Cf. CLAUDE.md §7.
    try {
      const savedActive = localStorage.getItem('grainwatch_active_ids');
      if (savedActive) {
        const parsed = JSON.parse(savedActive);
        if (Array.isArray(parsed)) {
          this.state.activeCommodityIds = parsed.filter(
            id => typeof id === 'string' && ALL_COMMODITIES.some(c => c.id === id)
          );
        }
      }
      const savedVisible = localStorage.getItem('grainwatch_visible');
      if (savedVisible) {
        const parsed = JSON.parse(savedVisible);
        if (Array.isArray(parsed)) {
          this.state.visibleCommodities = new Set(parsed.filter(id => typeof id === 'string'));
        } else {
          this.state.visibleCommodities = new Set(this.state.activeCommodityIds);
        }
      } else {
        this.state.visibleCommodities = new Set(this.state.activeCommodityIds);
      }
    } catch (e) { /* localStorage not available or corrupted */ }
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

    // ARIA labels traduisibles (ex : indicateur ⓘ des tooltips tactiles)
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', I18N.t(el.getAttribute('data-i18n-aria')));
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
    const sourceIcons = ["🏛️", "🇺🇸", "🧪"];
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
  // TOOLTIPS TACTILES (tap-to-show)
  // --------------------------------------------------------
  // Sur appareil tactile (pas de hover), l'indicateur ⓘ révèle la bulle au tap.
  // Délégation sur document → robuste aux ⓘ déplacés dans le menu (cf. overflow toolbar).
  // Sur souris, l'ⓘ est masqué en CSS (@media hover:none) : ces handlers restent inertes.
  _initTouchTooltips() {
    document.addEventListener('click', (e) => {
      const infoBtn = e.target.closest('.tooltip-info');
      if (infoBtn) {
        // Tap sur ⓘ : bascule la bulle sans déclencher les boutons fonctionnels voisins
        e.preventDefault();
        e.stopPropagation();
        const wrapper = infoBtn.closest('.selector-with-tooltip, .indicator-card-trend');
        if (!wrapper) return;
        const wasOpen = wrapper.classList.contains('tooltip-open');
        this._closeAllTooltips();
        if (!wasOpen) {
          wrapper.classList.add('tooltip-open');
          infoBtn.setAttribute('aria-expanded', 'true');
          this._clampTooltip(wrapper);   // garde-fou anti-débordement viewport (P2)
        }
        return;
      }
      // Tap hors d'une bulle ouverte → fermeture
      if (!e.target.closest('.tooltip-bubble, .trend-tooltip')) {
        this._closeAllTooltips();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeAllTooltips();
    });
  },

  _closeAllTooltips() {
    document.querySelectorAll('.tooltip-open').forEach(el => {
      el.classList.remove('tooltip-open');
      const btn = el.querySelector('.tooltip-info');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      // Réinitialise le décalage anti-débordement (P2) pour la prochaine ouverture.
      const bubble = el.querySelector('.tooltip-bubble, .trend-tooltip');
      if (bubble) bubble.style.removeProperty('--tt-shift');
    });
  },

  // Garde-fou P2 : empêche une bulle de tooltip de déborder du viewport sur mobile.
  // Mesure la position réelle puis pose --tt-shift (px) ; la bulle ET sa flèche
  // réagissent via calc() en CSS, sans casser le centrage translateX(-50%).
  _clampTooltip(wrapper) {
    const bubble = wrapper.querySelector('.tooltip-bubble, .trend-tooltip');
    if (!bubble) return;
    bubble.style.removeProperty('--tt-shift');   // mesure depuis la position de base
    const rect = bubble.getBoundingClientRect();
    const margin = 8;
    let dx = 0;
    if (rect.left < margin) {
      dx = margin - rect.left;
    } else if (rect.right > window.innerWidth - margin) {
      dx = window.innerWidth - margin - rect.right;
    }
    if (dx !== 0) bubble.style.setProperty('--tt-shift', `${Math.round(dx)}px`);
  },

  // P3 / C2 : bulle explicative pour l'icône GrainTrack3D désactivée. L'icône
  // elle-même est le déclencheur (tap mobile / survol desktop) via le wrapper
  // #gt3dWrap (.selector-with-tooltip) → délégation _initTouchTooltips + clamp P2.
  // Construction DOM en createElement/textContent (zéro innerHTML — sécurité).
  _showGrainTrack3DInfo(message) {
    const wrap = document.getElementById('gt3dWrap');
    if (!wrap) return;
    let bubble = wrap.querySelector('.tooltip-bubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'tooltip-bubble';
      bubble.setAttribute('role', 'tooltip');
      const icon = document.createElement('span');
      icon.className = 'tooltip-icon';
      icon.textContent = '🌍';
      const txt = document.createElement('span');
      txt.className = 'gt3d-info-text';
      const arrow = document.createElement('div');
      arrow.className = 'tooltip-arrow';
      bubble.appendChild(icon);
      bubble.appendChild(txt);
      bubble.appendChild(arrow);
      wrap.appendChild(bubble);
    }
    wrap.querySelector('.gt3d-info-text').textContent = message;
  },

  _removeGrainTrack3DInfo() {
    const wrap = document.getElementById('gt3dWrap');
    if (!wrap) return;
    wrap.classList.remove('tooltip-open');
    const bubble = wrap.querySelector('.tooltip-bubble');
    if (bubble) bubble.remove();
  },

  // --------------------------------------------------------
  // MENU HAMBURGER + DÉBORDEMENT DE LA BARRE D'OUTILS
  // --------------------------------------------------------
  // Affiche la version (source unique) dans le footer et le menu À propos.
  _setVersions() {
    const label = `GrainWatch v${APP_VERSION}`;
    const fv = document.querySelector('.footer-version');
    if (fv) fv.textContent = label;
    const mv = document.getElementById('menuAboutVersion');
    if (mv) mv.textContent = label;
  },

  _initMenu() {
    const toggle = document.getElementById('menuToggle');
    const panel = document.getElementById('menuPanel');
    const overlay = document.getElementById('menuOverlay');
    const closeBtn = document.getElementById('menuClose');
    const moreBtn = document.getElementById('menuSourcesMore');
    if (!toggle || !panel || !overlay) return;

    this._menuLastFocus = null;

    toggle.addEventListener('click', () => this.openMenu());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeMenu());
    overlay.addEventListener('click', () => this.closeMenu());

    // Pastille API active (mobile) → ouvre le menu et amène le focus sur le
    // sélecteur de source (section « Sources de données ») : raccourci ergonomique.
    const pastille = document.getElementById('sourcePastille');
    if (pastille) pastille.addEventListener('click', () => {
      this.openMenu();
      const activeApi = document.querySelector('.menu-api-btn.active') || document.querySelector('.menu-api-btn');
      if (activeApi) activeApi.focus();
    });

    // « En savoir plus » → page Sources existante
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        this.closeMenu();
        if (typeof SourcesPage !== 'undefined' && SourcesPage.open) SourcesPage.open();
      });
    }

    // Échap (fermeture) + piège de focus (Tab) tant que le menu est ouvert
    document.addEventListener('keydown', (e) => {
      if (!panel.classList.contains('open')) return;
      if (e.key === 'Escape') { this.closeMenu(); return; }
      if (e.key === 'Tab') this._trapMenuFocus(e, panel);
    });
  },

  openMenu() {
    const panel = document.getElementById('menuPanel');
    const overlay = document.getElementById('menuOverlay');
    const toggle = document.getElementById('menuToggle');
    if (!panel || panel.classList.contains('open')) return;
    this._menuLastFocus = document.activeElement;
    overlay.hidden = false;
    void overlay.offsetWidth; // reflow → la transition d'opacité s'applique
    overlay.classList.add('visible');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
    const first = this._menuFocusables(panel)[0];
    (first || panel).focus();
  },

  closeMenu() {
    const panel = document.getElementById('menuPanel');
    const overlay = document.getElementById('menuOverlay');
    const toggle = document.getElementById('menuToggle');
    if (!panel || !panel.classList.contains('open')) return;
    panel.classList.remove('open');
    overlay.classList.remove('visible');
    panel.setAttribute('aria-hidden', 'true');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    setTimeout(() => { if (!panel.classList.contains('open')) overlay.hidden = true; }, 300);
    if (this._menuLastFocus && this._menuLastFocus.focus) this._menuLastFocus.focus();
    else if (toggle) toggle.focus();
  },

  _menuFocusables(panel) {
    return [...panel.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter(el => el.offsetParent !== null);
  },

  _trapMenuFocus(e, panel) {
    const f = this._menuFocusables(panel);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  },

  // Déplace les contrôles qui débordent de la barre vers le menu (Réglages),
  // et les y ramène quand l'espace le permet. Déplacement de nœuds réels (pas de clone)
  // → une seule source de vérité, aucun risque de désync d'état des toggles.
  setupToolbarOverflow() {
    const headerRight = document.querySelector('.header-right');
    const menuSettings = document.getElementById('menuSettings');
    const section = document.getElementById('menuSettingsSection');
    const hamburger = document.getElementById('menuToggle');
    const badge = document.getElementById('menuBadge');
    if (!headerRight || !menuSettings || !hamburger) return;

    // Ordre DOM d'origine (restauration) ; PRIORITY = ordre de retrait (1er part en premier)
    // #ctrlSource n'y figure plus (v0.9.1) : masqué sur mobile, son rôle est repris
    // par le sous-menu API du hamburger + la pastille. Il reste dans la barre en desktop.
    const ORIGINAL = ['#ctrlCurrency', '#themeToggle', '#langToggle', '#alertsBell', '#refreshBtn'];
    const PRIORITY = [
      { sel: '#refreshBtn',   key: 'menu_label_refresh'  },
      { sel: '#alertsBell',   key: 'menu_label_alerts'   },
      { sel: '#themeToggle',  key: 'menu_label_theme'    },
      { sel: '#langToggle',   key: 'menu_label_lang'     },
      { sel: '#ctrlCurrency', key: 'menu_label_currency' },
    ];

    const relayout = () => {
      this._closeAllTooltips();
      // 1. Reset : tout revient dans la barre, dans l'ordre d'origine, avant le hamburger
      ORIGINAL.forEach(sel => {
        const el = document.querySelector(sel);
        if (!el) return;
        const row = el.closest('.menu-setting-row');
        headerRight.insertBefore(el, hamburger);
        if (row) row.remove();
      });
      // 2. Déplacer vers le menu tant que la barre déborde
      let moved = 0;
      for (const item of PRIORITY) {
        if (headerRight.scrollWidth <= headerRight.clientWidth) break;
        const el = document.querySelector(item.sel);
        if (!el) continue;
        const row = document.createElement('div');
        row.className = 'menu-setting-row';
        const label = document.createElement('span');
        label.className = 'menu-setting-label';
        label.setAttribute('data-i18n', item.key);
        label.textContent = I18N.t(item.key);
        row.appendChild(label);
        row.appendChild(el);
        menuSettings.appendChild(row);
        moved++;
      }
      // 3. Badge compteur + visibilité de la section Réglages
      if (badge) {
        badge.textContent = String(moved);
        badge.style.display = moved ? 'flex' : 'none';
      }
      if (section) section.style.display = moved ? '' : 'none';
    };

    relayout();
    if ('ResizeObserver' in window) {
      let raf = null;
      const ro = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(relayout);
      });
      ro.observe(headerRight);
    } else {
      window.addEventListener('resize', relayout);
    }
  },

  // C4-bis : double verrouillage du masquage du sélecteur de source.
  // Safari iOS a continué d'afficher #ctrlSource en portrait malgré la règle
  // CSS `display: none !important` (cause non reproductible côté code — cache /
  // rendu WebKit). On ajoute une bretelle JS : style inline piloté par matchMedia,
  // qui garantit le comportement quel que soit l'état du cache CSS.
  // Desktop : on retire le style inline → le CSS reprend la main normalement.
  enforceSourceHiding() {
    const ctrl = document.getElementById('ctrlSource');
    const pastille = document.getElementById('sourcePastille');
    if (!ctrl) return;

    const mq = window.matchMedia('(max-width: 768px)');

    const apply = (mobile) => {
      if (mobile) {
        ctrl.style.display = 'none';
        if (pastille) pastille.style.display = '';
      } else {
        ctrl.style.display = '';
        if (pastille) pastille.style.display = 'none';
      }
    };

    apply(mq.matches);

    // Rotation portrait ↔ paysage / resize
    if (mq.addEventListener) {
      mq.addEventListener('change', (e) => apply(e.matches));
    } else if (mq.addListener) {
      // Fallback Safari ancien (< 14)
      mq.addListener((e) => apply(e.matches));
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
    // Whitelist stricte : data-theme ne doit jamais recevoir une valeur arbitraire
    // depuis localStorage (cohérent avec i18n.js qui valide déjà 'fr'/'en'). Cf. CLAUDE.md §7.
    const rawSaved = localStorage.getItem('grainwatch_theme');
    const saved = (rawSaved === 'dark' || rawSaved === 'light') ? rawSaved : null;
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
      // Cohérent avec la whitelist plus haut : un localStorage invalide est ignoré
      // et l'OS reste maître.
      const raw = localStorage.getItem('grainwatch_theme');
      const hasManualChoice = raw === 'dark' || raw === 'light';
      if (!hasManualChoice) {
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
