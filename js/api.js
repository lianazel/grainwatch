// ============================================================
// GRAINWATCH — API Layer (Multi-source)
// Sources: World Bank | USDA | Simulated fallback
// ============================================================

// World Bank commodity indicator codes
// Source: https://api.worldbank.org/v2/sources/41/indicators
const WB_INDICATORS = {
  wheat:       "WHEAT_US_HRW",
  corn:        "MAIZE",
  rice:        "RICE_05",
  soybean:     "SOYBEANS",
  sugar:       "SUGAR_WLD",
  coffee:      "COFFEE_ARABIC",
  cocoa:       "COCOA",
  palm_oil:    "PALM_OIL",
  cotton:      "COTTON_A_INDX",
  barley:      "BARLEY",
  oats:        "WHEAT_US_SRW",
  sunflower:   "SUNFLOWER_OIL",
  // Extended catalog
  soybean_oil: "SOYBEAN_OIL",
  rapeseed:    "RAPESEED_OIL",
  rubber:      "RUBBER_SGP",
  tea:         "TEA_AVG",
  orange:      "ORANGE",
  banana:      "BANANA_US",
  olive_oil:   "OLIVE_OIL_EV",
  sorghum:     "SORGHUM",
  coconut_oil: "COCONUT_OIL",
  wool:        "WOOL_COARSE",
  tobacco:     "TOBACCO_US",
  groundnut:   "GRNUT_OIL",
  lentils:     "WHEAT_US_SRW",  // proxy
  millet:      "SORGHUM",       // proxy
};

// USDA FAS PSD commodity codes
// Source: https://apps.fas.usda.gov/opendata/swagger/ui/index
const USDA_COMMODITY_CODES = {
  wheat:    "0410000",
  corn:     "0440000",
  rice:     "0422110",
  soybean:  "2222000",
  sugar:    "0612000",
  coffee:   "0711100",
  cocoa:    "0721100",
  palm_oil: "4243000",
  cotton:   "2631000",
  barley:   "0430000",
  oats:     "0452000",
  sunflower:"2226000",
};

const SOURCE_INFO = {
  worldbank: {
    name: "Banque Mondiale",
    description: "Données mensuelles issues du Commodity Markets (Pink Sheet), publiées chaque mois par le Groupe de la Banque Mondiale. Couvre 70+ matières premières. C'est la référence institutionnelle mondiale pour les prix des commodités.",
    frequency: "Mensuelle",
    url: "https://www.worldbank.org/en/research/commodity-markets",
    icon: "🏛️",
  },
  usda: {
    name: "USDA (États-Unis)",
    description: "Production, Supply & Distribution (PSD) du Département de l'Agriculture des États-Unis. Données annuelles sur la production, les stocks et les exportations mondiales. Idéal pour comprendre l'offre et la demande.",
    frequency: "Annuelle",
    url: "https://apps.fas.usda.gov/psdonline/app/index.html",
    icon: "🇺🇸",
  },
  simulated: {
    name: "Simulation",
    description: "Données générées par un algorithme (marche aléatoire avec retour à la moyenne). Les prix imitent un comportement de marché réaliste mais ne reflètent PAS les cours réels. Utile pour comprendre le fonctionnement de l'interface.",
    frequency: "Quotidienne (simulée)",
    url: null,
    icon: "🧪",
  },
};

const GrainWatchAPI = {
  _cache: {},
  _cacheExpiry: 30 * 60 * 1000, // 30 min cache

  /**
   * Get price history for a commodity from the selected source
   */
  async getPriceHistory(commodityId, days, source = "worldbank") {
    if (source === "worldbank") {
      return this._getWorldBankData(commodityId, days);
    }
    if (source === "usda") {
      return this._getUSDAData(commodityId, days);
    }
    return this._getSimulatedData(commodityId, days);
  },

  /**
   * Get current prices for all commodities
   */
  async getAllPrices(periodDays = 180, source = "worldbank") {
    const results = [];
    for (const commodity of COMMODITIES) {
      try {
        const history = await this.getPriceHistory(commodity.id, periodDays, source);
        if (history.length >= 2) {
          const current = history[history.length - 1].price;
          const first = history[0].price;
          const changePct = ((current - first) / first) * 100;
          results.push({
            ...commodity,
            currentPrice: current,
            change: Math.round(changePct * 100) / 100,
            direction: changePct >= 0 ? "up" : "down",
          });
        }
      } catch (e) {
        console.warn(`Failed to load ${commodity.id}:`, e.message);
      }
    }
    return results;
  },

  /**
   * Get statistics for a commodity over a period
   */
  async getStats(commodityId, days, source = "worldbank") {
    const history = await this.getPriceHistory(commodityId, days, source);
    const prices = history.map(h => h.price);

    if (prices.length < 2) {
      return { average: 0, high: 0, low: 0, variation: 0, variationDirection: "", trend: "—", trendDirection: "" };
    }

    const first = prices[0];
    const last = prices[prices.length - 1];
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const variation = ((last - first) / first) * 100;

    // Linear regression for trend
    const n = prices.length;
    const xMean = (n - 1) / 2;
    const yMean = avg;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (prices[i] - yMean);
      den += (i - xMean) * (i - xMean);
    }
    const slope = num / den;
    const slopePercent = (slope / yMean) * 100 * n;

    let trend, trendDirection, trendKey;
    if (slopePercent > 5) { trendKey = "trend_strong_up"; trendDirection = "up"; }
    else if (slopePercent > 1) { trendKey = "trend_up"; trendDirection = "up"; }
    else if (slopePercent > -1) { trendKey = "trend_neutral"; trendDirection = ""; }
    else if (slopePercent > -5) { trendKey = "trend_down"; trendDirection = "down"; }
    else { trendKey = "trend_strong_down"; trendDirection = "down"; }
    trend = typeof I18N !== "undefined" ? I18N.t(trendKey) : trendKey;

    return {
      average: Math.round(avg * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      variation: Math.round(variation * 100) / 100,
      variationDirection: variation >= 0 ? "up" : "down",
      trend,
      trendDirection,
    };
  },

  // --------------------------------------------------------
  // WORLD BANK DATA SOURCE
  // Monthly commodity prices (Pink Sheet)
  // --------------------------------------------------------
  async _getWorldBankData(commodityId, days) {
    const indicator = WB_INDICATORS[commodityId];
    if (!indicator) return this._getSimulatedData(commodityId, days);

    const cacheKey = `wb_${commodityId}_${days}`;
    const cached = this._cache[cacheKey];
    if (cached && Date.now() - cached.time < this._cacheExpiry) {
      return cached.data;
    }

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Math.max(days, 90));

      const startStr = startDate.getFullYear() + "M" + String(startDate.getMonth() + 1).padStart(2, "0");
      const endStr = endDate.getFullYear() + "M" + String(endDate.getMonth() + 1).padStart(2, "0");

      // per_page must be large enough for long periods (15 years = 180 months)
      const monthsNeeded = Math.max(Math.ceil(days / 30), 12);
      const perPage = Math.min(Math.max(monthsNeeded + 10, 100), 500);

      const url = `https://api.worldbank.org/v2/sources/41/country/WLD/series/${indicator}/time/${startStr}:${endStr}?format=json&per_page=${perPage}`;

      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();

      let data = [];
      if (json && json.source && json.source.data) {
        data = json.source.data
          .filter(d => d.value !== null && d.value !== "")
          .map(d => {
            const timeParts = d.time.match(/(\d{4})M(\d{2})/);
            const year = parseInt(timeParts[1]);
            const month = parseInt(timeParts[2]) - 1;
            const date = new Date(year, month, 15);
            return {
              date: date.toISOString().split('T')[0],
              timestamp: date.getTime(),
              price: parseFloat(d.value),
            };
          })
          .sort((a, b) => a.timestamp - b.timestamp);
      }

      if (data.length < 2) throw new Error("Insufficient data from World Bank");

      this._cache[cacheKey] = { data, time: Date.now() };
      return data;

    } catch (error) {
      console.warn(`World Bank API failed for ${commodityId}, falling back to simulation:`, error.message);
      return this._getSimulatedData(commodityId, days);
    }
  },

  // --------------------------------------------------------
  // USDA FAS DATA SOURCE
  // Production, Supply & Distribution
  // --------------------------------------------------------
  async _getUSDAData(commodityId, days) {
    const commodityCode = USDA_COMMODITY_CODES[commodityId];
    if (!commodityCode) return this._getSimulatedData(commodityId, days);

    const cacheKey = `usda_${commodityId}_${days}`;
    const cached = this._cache[cacheKey];
    if (cached && Date.now() - cached.time < this._cacheExpiry) {
      return cached.data;
    }

    try {
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - Math.ceil(days / 365) - 1;

      const url = `https://apps.fas.usda.gov/OpenData/api/psd/commodity/${commodityCode}?marketYear=${startYear}`;

      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();

      // USDA returns production data by country/year
      // Aggregate world production as a proxy for price trends
      const yearlyData = {};
      if (Array.isArray(json)) {
        json.forEach(record => {
          const year = record.marketYear || record.Market_Year;
          const attr = record.attributeDescription || record.Attribute_Description || "";
          const value = parseFloat(record.value || record.Value || 0);

          // Use "Production" attribute as main metric
          if (attr.toLowerCase().includes("production") && value > 0) {
            if (!yearlyData[year]) yearlyData[year] = 0;
            yearlyData[year] += value;
          }
        });
      }

      const data = Object.entries(yearlyData)
        .map(([year, production]) => ({
          date: `${year}-06-15`,
          timestamp: new Date(parseInt(year), 5, 15).getTime(),
          price: Math.round(production / 1000), // Scale to readable numbers (thousand tonnes)
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      if (data.length < 2) throw new Error("Insufficient data from USDA");

      this._cache[cacheKey] = { data, time: Date.now() };
      return data;

    } catch (error) {
      console.warn(`USDA API failed for ${commodityId}, falling back to simulation:`, error.message);
      return this._getSimulatedData(commodityId, days);
    }
  },

  // --------------------------------------------------------
  // SIMULATED DATA (fallback)
  // --------------------------------------------------------
  async _getSimulatedData(commodityId, days) {
    const commodity = COMMODITIES.find(c => c.id === commodityId);
    if (!commodity) throw new Error(`Unknown commodity: ${commodityId}`);

    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
    return generatePriceHistory(commodity, days);
  },

  // --------------------------------------------------------
  // CUSTOM DATE RANGE METHODS
  // --------------------------------------------------------

  /**
   * Get price history for a custom date range { startMonth, startYear, endMonth, endYear }
   */
  async getPriceHistoryCustomRange(commodityId, range, source = "worldbank") {
    if (source === "worldbank") {
      return this._getWorldBankDataRange(commodityId, range);
    }
    if (source === "usda") {
      return this._getUSDADataRange(commodityId, range);
    }
    // Simulated: convert range to days
    const startDate = new Date(range.startYear, range.startMonth - 1, 1);
    const endDate = new Date(range.endYear, range.endMonth - 1, 28);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    return this._getSimulatedData(commodityId, Math.max(days, 30));
  },

  /**
   * Get all prices for all commodities using a custom range
   */
  async getAllPricesCustomRange(range, source = "worldbank") {
    const results = [];
    for (const commodity of COMMODITIES) {
      try {
        const history = await this.getPriceHistoryCustomRange(commodity.id, range, source);
        if (history.length >= 2) {
          const current = history[history.length - 1].price;
          const first = history[0].price;
          const changePct = ((current - first) / first) * 100;
          results.push({
            ...commodity,
            currentPrice: current,
            change: Math.round(changePct * 100) / 100,
            direction: changePct >= 0 ? "up" : "down",
          });
        }
      } catch (e) {
        console.warn(`Failed to load ${commodity.id}:`, e.message);
      }
    }
    return results;
  },

  /**
   * Get stats for a custom range
   */
  async getStatsCustomRange(commodityId, range, source = "worldbank") {
    const history = await this.getPriceHistoryCustomRange(commodityId, range, source);
    const prices = history.map(h => h.price);

    if (prices.length < 2) {
      return { average: 0, high: 0, low: 0, variation: 0, variationDirection: "", trend: "—", trendDirection: "" };
    }

    const first = prices[0];
    const last = prices[prices.length - 1];
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const variation = ((last - first) / first) * 100;

    const n = prices.length;
    const xMean = (n - 1) / 2;
    const yMean = avg;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (prices[i] - yMean);
      den += (i - xMean) * (i - xMean);
    }
    const slope = num / den;
    const slopePercent = (slope / yMean) * 100 * n;

    let trendKey, trendDirection;
    if (slopePercent > 5) { trendKey = "trend_strong_up"; trendDirection = "up"; }
    else if (slopePercent > 1) { trendKey = "trend_up"; trendDirection = "up"; }
    else if (slopePercent > -1) { trendKey = "trend_neutral"; trendDirection = ""; }
    else if (slopePercent > -5) { trendKey = "trend_down"; trendDirection = "down"; }
    else { trendKey = "trend_strong_down"; trendDirection = "down"; }
    const trend = typeof I18N !== "undefined" ? I18N.t(trendKey) : trendKey;

    return {
      average: Math.round(avg * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      variation: Math.round(variation * 100) / 100,
      variationDirection: variation >= 0 ? "up" : "down",
      trend,
      trendDirection,
    };
  },

  /**
   * World Bank data with explicit date range
   */
  async _getWorldBankDataRange(commodityId, range) {
    const indicator = WB_INDICATORS[commodityId];
    if (!indicator) {
      const days = Math.ceil((new Date(range.endYear, range.endMonth - 1, 28) - new Date(range.startYear, range.startMonth - 1, 1)) / (1000 * 60 * 60 * 24));
      return this._getSimulatedData(commodityId, days);
    }

    const cacheKey = `wb_range_${commodityId}_${range.startMonth}_${range.startYear}_${range.endMonth}_${range.endYear}`;
    const cached = this._cache[cacheKey];
    if (cached && Date.now() - cached.time < this._cacheExpiry) {
      return cached.data;
    }

    try {
      const startStr = range.startYear + "M" + String(range.startMonth).padStart(2, "0");
      const endStr = range.endYear + "M" + String(range.endMonth).padStart(2, "0");

      const totalMonths = (range.endYear - range.startYear) * 12 + (range.endMonth - range.startMonth) + 1;
      const perPage = Math.min(Math.max(totalMonths + 10, 50), 500);

      const url = `https://api.worldbank.org/v2/sources/41/country/WLD/series/${indicator}/time/${startStr}:${endStr}?format=json&per_page=${perPage}`;

      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();
      let data = [];
      if (json && json.source && json.source.data) {
        data = json.source.data
          .filter(d => d.value !== null && d.value !== "")
          .map(d => {
            const timeParts = d.time.match(/(\d{4})M(\d{2})/);
            const year = parseInt(timeParts[1]);
            const month = parseInt(timeParts[2]) - 1;
            const date = new Date(year, month, 15);
            return {
              date: date.toISOString().split('T')[0],
              timestamp: date.getTime(),
              price: parseFloat(d.value),
            };
          })
          .sort((a, b) => a.timestamp - b.timestamp);
      }

      if (data.length < 2) throw new Error("Insufficient data from World Bank for custom range");

      this._cache[cacheKey] = { data, time: Date.now() };
      return data;

    } catch (error) {
      console.warn(`World Bank custom range failed for ${commodityId}:`, error.message);
      const days = Math.ceil((new Date(range.endYear, range.endMonth - 1, 28) - new Date(range.startYear, range.startMonth - 1, 1)) / (1000 * 60 * 60 * 24));
      return this._getSimulatedData(commodityId, days);
    }
  },

  /**
   * USDA data with explicit date range
   */
  async _getUSDADataRange(commodityId, range) {
    const commodityCode = USDA_COMMODITY_CODES[commodityId];
    if (!commodityCode) {
      const days = Math.ceil((new Date(range.endYear, range.endMonth - 1, 28) - new Date(range.startYear, range.startMonth - 1, 1)) / (1000 * 60 * 60 * 24));
      return this._getSimulatedData(commodityId, days);
    }

    const cacheKey = `usda_range_${commodityId}_${range.startYear}_${range.endYear}`;
    const cached = this._cache[cacheKey];
    if (cached && Date.now() - cached.time < this._cacheExpiry) {
      return cached.data;
    }

    try {
      const url = `https://apps.fas.usda.gov/OpenData/api/psd/commodity/${commodityCode}?marketYear=${range.startYear}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();

      const yearlyData = {};
      if (Array.isArray(json)) {
        json.forEach(record => {
          const year = record.marketYear || record.Market_Year;
          if (year < range.startYear || year > range.endYear) return;
          const attr = record.attributeDescription || record.Attribute_Description || "";
          const value = parseFloat(record.value || record.Value || 0);
          if (attr.toLowerCase().includes("production") && value > 0) {
            if (!yearlyData[year]) yearlyData[year] = 0;
            yearlyData[year] += value;
          }
        });
      }

      const data = Object.entries(yearlyData)
        .map(([year, production]) => ({
          date: `${year}-06-15`,
          timestamp: new Date(parseInt(year), 5, 15).getTime(),
          price: Math.round(production / 1000),
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      if (data.length < 2) throw new Error("Insufficient USDA data for custom range");

      this._cache[cacheKey] = { data, time: Date.now() };
      return data;

    } catch (error) {
      console.warn(`USDA custom range failed for ${commodityId}:`, error.message);
      const days = Math.ceil((new Date(range.endYear, range.endMonth - 1, 28) - new Date(range.startYear, range.startMonth - 1, 1)) / (1000 * 60 * 60 * 24));
      return this._getSimulatedData(commodityId, days);
    }
  },

  /**
   * Get info about a data source
   */
  getSourceInfo(sourceId) {
    return SOURCE_INFO[sourceId] || SOURCE_INFO.simulated;
  },
};
