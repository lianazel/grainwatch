// ============================================================
// GRAINWATCH — Sources Page Controller
// ============================================================

const SourcesPage = {

  // Sample responses for when CORS blocks the live call
  _samples: {
    worldbank: {
      "source": {
        "id": "41", "name": "Country Series - Time",
        "data": [
          { "series": { "id": "WHEAT_US_HRW", "value": "Wheat, US, HRW" }, "country": { "id": "WLD", "value": "World" }, "time": "2024M06", "value": "268.33" },
          { "series": { "id": "WHEAT_US_HRW", "value": "Wheat, US, HRW" }, "country": { "id": "WLD", "value": "World" }, "time": "2024M05", "value": "273.65" },
          { "series": { "id": "WHEAT_US_HRW", "value": "Wheat, US, HRW" }, "country": { "id": "WLD", "value": "World" }, "time": "2024M04", "value": "265.12" },
          { "series": { "id": "WHEAT_US_HRW", "value": "Wheat, US, HRW" }, "country": { "id": "WLD", "value": "World" }, "time": "2024M03", "value": "258.90" },
          { "series": { "id": "WHEAT_US_HRW", "value": "Wheat, US, HRW" }, "country": { "id": "WLD", "value": "World" }, "time": "2024M02", "value": "261.44" },
          { "series": { "id": "WHEAT_US_HRW", "value": "Wheat, US, HRW" }, "country": { "id": "WLD", "value": "World" }, "time": "2024M01", "value": "270.18" }
        ]
      }
    },
    usda: [
      { "commodityCode": "0410000", "commodityName": "Wheat", "countryCode": "US", "countryName": "United States", "marketYear": 2024, "calendarYear": 2024, "month": "Jun", "attributeId": 20, "attributeName": "Production", "unitId": 21, "unitDescription": "1000 MT", "value": 49787 },
      { "commodityCode": "0410000", "commodityName": "Wheat", "countryCode": "US", "countryName": "United States", "marketYear": 2024, "calendarYear": 2024, "month": "Jun", "attributeId": 176, "attributeName": "Ending Stocks", "unitId": 21, "unitDescription": "1000 MT", "value": 22791 },
      { "commodityCode": "0410000", "commodityName": "Wheat", "countryCode": "FR", "countryName": "France", "marketYear": 2024, "calendarYear": 2024, "month": "Jun", "attributeId": 20, "attributeName": "Production", "unitId": 21, "unitDescription": "1000 MT", "value": 35400 },
      { "commodityCode": "0410000", "commodityName": "Wheat", "countryCode": "CN", "countryName": "China", "marketYear": 2024, "calendarYear": 2024, "month": "Jun", "attributeId": 20, "attributeName": "Production", "unitId": 21, "unitDescription": "1000 MT", "value": 136590 }
    ],
  },

  // --------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------
  init() {
    this._bindEvents();
  },

  _bindEvents() {
    const backBtn = document.getElementById('sourcesBackBtn');
    if (backBtn) backBtn.addEventListener('click', () => this.close());

    const wbBtn = document.getElementById('sourcesWbBtn');
    if (wbBtn) wbBtn.addEventListener('click', () => this._callAPI('worldbank'));

    const usdaBtn = document.getElementById('sourcesUsdaBtn');
    if (usdaBtn) usdaBtn.addEventListener('click', () => this._callAPI('usda'));

    const gdeltBtn = document.getElementById('sourcesGdeltBtn');
    if (gdeltBtn) gdeltBtn.addEventListener('click', () => this._callAPI('gdelt'));
  },

  // --------------------------------------------------------
  // OPEN / CLOSE
  // --------------------------------------------------------
  open() {
    const commodity = ALL_COMMODITIES.find(c => c.id === App.state.selectedCommodity);
    if (commodity) {
      document.getElementById('sourcesCommodityName').textContent = I18N.commodityName(commodity);
      document.getElementById('sourcesCommodityIcon').textContent = commodity.icon;
    }

    const periodEl = document.getElementById('sourcesPeriod');
    if (periodEl) {
      periodEl.textContent = '01/2024 → 12/2024';
    }

    App.applyTranslations();

    document.getElementById('sourcesJsonWrapper').style.display = 'none';
    document.getElementById('sourcesLoading').style.display = 'none';
    document.getElementById('sourcesGdeltDesc').style.display = 'none';

    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.detail-panel').style.display = 'none';
    document.getElementById('exportPage').style.display = 'none';
    document.getElementById('sourcesPage').style.display = 'flex';
  },

  close() {
    document.getElementById('sourcesPage').style.display = 'none';
    document.querySelector('.sidebar').style.display = '';
    document.querySelector('.detail-panel').style.display = '';
  },

  // --------------------------------------------------------
  // BUILD URLs (same logic as api.js)
  // --------------------------------------------------------
  _buildWBUrl(commodityId) {
    const indicator = WB_INDICATORS[commodityId] || 'WHEAT_US_HRW';
    // World Bank data has ~6-12 months delay
    // Use 2024 which is guaranteed to have complete data
    return `https://api.worldbank.org/v2/sources/41/country/WLD/series/${indicator}/time/2024M01:2024M12?format=json&per_page=12`;
  },

  _buildUSDAUrl(commodityId) {
    const usdaCode = USDA_COMMODITY_CODES[commodityId];
    if (!usdaCode) return null;
    return `https://apps.fas.usda.gov/OpenData/api/psd/commodity/${usdaCode}?marketYear=2024`;
  },

  _buildGDELTUrl(commodityName) {
    const searchTerm = encodeURIComponent(commodityName);
    return `https://api.gdeltproject.org/api/v2/doc/doc?query=${searchTerm}&mode=ArtList&maxrecords=5&format=json&timespan=7d`;
  },

  // --------------------------------------------------------
  // API CALLS (with fallback to sample data)
  // --------------------------------------------------------
  async _callAPI(source) {
    const commodity = ALL_COMMODITIES.find(c => c.id === App.state.selectedCommodity);
    if (!commodity) return;

    const loadingEl = document.getElementById('sourcesLoading');
    const wrapperEl = document.getElementById('sourcesJsonWrapper');
    const outputEl = document.getElementById('sourcesJsonOutput');
    const badgeEl = document.getElementById('sourcesJsonBadge');
    const gdeltDesc = document.getElementById('sourcesGdeltDesc');

    if (source !== 'gdelt') gdeltDesc.style.display = 'none';

    loadingEl.style.display = 'flex';
    wrapperEl.style.display = 'none';

    const allBtns = ['sourcesWbBtn', 'sourcesUsdaBtn', 'sourcesGdeltBtn'];
    allBtns.forEach(id => document.getElementById(id).classList.add('loading'));

    let url = '';
    let badgeText = '';
    let usedSample = false;

    try {
      let data = null;

      if (source === 'worldbank') {
        url = this._buildWBUrl(commodity.id);
        badgeText = 'World Bank API';
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          data = await response.json();
        } catch (e) {
          data = this._samples.worldbank;
          usedSample = true;
        }

      } else if (source === 'usda') {
        url = this._buildUSDAUrl(commodity.id);
        badgeText = 'USDA PSD API';
        if (!url) {
          const msg = I18N.lang === 'en'
            ? `No USDA data for ${I18N.commodityName(commodity)}`
            : `Pas de donnees USDA pour ${I18N.commodityName(commodity)}`;
          throw new Error(msg);
        }
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          data = await response.json();
        } catch (e) {
          data = this._samples.usda;
          usedSample = true;
        }

      } else if (source === 'gdelt') {
        const name = I18N.commodityName(commodity);
        url = this._buildGDELTUrl(name);
        badgeText = 'GDELT Doc API';
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = await response.json();

        gdeltDesc.style.display = 'block';
        const p = gdeltDesc.querySelector('[data-i18n]');
        if (p) p.innerHTML = I18N.t('sources_gdelt_desc');
      }

      // Display
      loadingEl.style.display = 'none';
      wrapperEl.style.display = 'block';
      badgeEl.textContent = badgeText;

      const jsonStr = JSON.stringify(data, null, 2);

      // Build header with URL + optional sample notice
      let header = '';
      if (usedSample) {
        const sampleNote = I18N.lang === 'en'
          ? '// ⚠ This API blocks direct browser calls (CORS).\n// Below is a sample of what the API returns.\n// Copy the URL below into your browser to see live data:\n'
          : '// ⚠ Cette API bloque les appels directs depuis le navigateur (CORS).\n// Ci-dessous, un exemple de ce que l\'API renvoie.\n// Copiez l\'URL ci-dessous dans votre navigateur pour voir les données en direct :\n';
        header = `<span class="json-null">${sampleNote}//\n// ${url}\n\n</span>`;
        badgeEl.textContent = badgeText + ' (exemple)';
      } else {
        const urlLabel = I18N.lang === 'en' ? 'URL called' : 'URL appelée';
        header = `<span class="json-null">// ✅ ${I18N.lang === 'en' ? 'Live API response!' : 'Réponse API en direct !'}\n// ${urlLabel} :\n// ${url}\n\n</span>`;
      }

      outputEl.innerHTML = header + this._colorizeJSON(jsonStr);
      wrapperEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (error) {
      loadingEl.style.display = 'none';
      wrapperEl.style.display = 'block';
      badgeEl.textContent = 'ERREUR';

      // Construction DOM safe : error.message n'est jamais parsé comme HTML
      const errorText = `// ${I18N.lang === 'en' ? 'Error' : 'Erreur'} : ${error.message}\n// URL : ${url || 'N/A'}`;
      outputEl.textContent = '';
      const errSpan = document.createElement('span');
      errSpan.className = 'json-null';
      errSpan.textContent = errorText;
      outputEl.appendChild(errSpan);
    } finally {
      allBtns.forEach(id => document.getElementById(id).classList.remove('loading'));
    }
  },

  // --------------------------------------------------------
  // JSON SYNTAX COLORIZER
  // --------------------------------------------------------
  _colorizeJSON(jsonStr) {
    const escaped = jsonStr
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(?:[^"\\]|\\.)*")\s*:/g,
      '<span class="json-key">$1</span>:'
    ).replace(
      /:\s*("(?:[^"\\]|\\.)*")/g,
      ': <span class="json-string">$1</span>'
    ).replace(
      /:\s*(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
      ': <span class="json-number">$1</span>'
    ).replace(
      /:\s*(true|false)/g,
      ': <span class="json-bool">$1</span>'
    ).replace(
      /:\s*(null)/g,
      ': <span class="json-null">$1</span>'
    ).replace(
      /([[\]{}])/g,
      '<span class="json-bracket">$1</span>'
    );
  },
};
