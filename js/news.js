// ============================================================
// GRAINWATCH — News & Geopolitical Context (GDELT API)
// Free, no API key, CORS-friendly
// ============================================================

// Search terms per commodity (English — GDELT indexes global press in EN)
const NEWS_KEYWORDS = {
  wheat:     "wheat price OR wheat export OR wheat crisis OR wheat supply",
  corn:      "corn price OR maize price OR corn export OR corn shortage",
  rice:      "rice price OR rice export OR rice crisis OR rice supply",
  soybean:   "soybean price OR soybean export OR soybean trade",
  sugar:     "sugar price OR sugar production OR sugar shortage",
  coffee:    "coffee price OR coffee crisis OR coffee production",
  cocoa:     "cocoa price OR cocoa crisis OR chocolate price",
  palm_oil:  "palm oil price OR palm oil deforestation OR palm oil export",
  cotton:    "cotton price OR cotton production OR cotton trade",
  barley:    "barley price OR barley export OR beer price barley",
  oats:      "oats price OR oats production OR oats market",
  sunflower: "sunflower oil price OR sunflower oil export OR sunflower ukraine",
  // Extended catalog
  soybean_oil: "soybean oil price OR soybean oil export",
  rapeseed:    "rapeseed price OR canola price OR rapeseed export",
  rubber:      "rubber price OR natural rubber export OR rubber market",
  tea:         "tea price OR tea production OR tea export",
  orange:      "orange juice price OR citrus market OR orange production",
  banana:      "banana price OR banana export OR banana production",
  olive_oil:   "olive oil price OR olive oil crisis OR olive oil production",
  sorghum:     "sorghum price OR sorghum production OR sorghum export",
  coconut_oil: "coconut oil price OR coconut oil export",
  wool:        "wool price OR wool production OR wool market",
  tobacco:     "tobacco price OR tobacco production OR tobacco trade",
  groundnut:   "groundnut price OR peanut price OR groundnut export",
  lentils:     "lentils price OR lentil production OR pulse market",
  millet:      "millet price OR millet production OR millet food security",
};

const NewsManager = {
  _cache: {},
  _cacheExpiry: 15 * 60 * 1000, // 15 min

  /**
   * Fetch recent news for a commodity using GDELT
   * @param {string} commodityId
   * @returns {Promise<Array>} articles
   */
  async fetchNews(commodityId) {
    const cached = this._cache[commodityId];
    if (cached && Date.now() - cached.time < this._cacheExpiry) {
      return cached.data;
    }

    const keywords = NEWS_KEYWORDS[commodityId];
    if (!keywords) return [];

    try {
      const query = encodeURIComponent(keywords);
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=8&format=json&sort=datedesc&timespan=3months`;

      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();

      let articles = [];
      if (json && json.articles) {
        articles = json.articles
          .filter(a => a.title && a.url && a.seendate)
          .map(a => {
            const dateStr = a.seendate; // format: "20260501T120000Z"
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            const date = new Date(year, month, day);

            // Extract domain from URL
            let domain = "";
            try {
              domain = new URL(a.url).hostname.replace("www.", "");
            } catch (e) {
              domain = "source";
            }

            return {
              title: a.title,
              url: a.url,
              date: date,
              domain: domain,
              language: a.language || "en",
              image: a.socialimage || null,
            };
          })
          .slice(0, 6); // Keep top 6
      }

      this._cache[commodityId] = { data: articles, time: Date.now() };
      return articles;

    } catch (error) {
      console.warn("GDELT API failed:", error.message);
      return [];
    }
  },

  /**
   * Render articles in the geo panel
   */
  render(articles, commodityName) {
    const container = document.getElementById("geoArticles");
    const subtitle = document.getElementById("geoSubtitle");

    subtitle.textContent = `${I18N.t("geo_subtitle")} ${commodityName}`;

    if (!articles || articles.length === 0) {
      container.innerHTML = `<div class="geo-empty">${I18N.t("geo_empty")} ${commodityName}.</div>`;
      return;
    }

    const months = I18N.lang === "en"
      ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      : ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

    container.innerHTML = articles.map(a => {
      const day = a.date.getDate();
      const month = months[a.date.getMonth()];

      return `
        <a href="${this._safeUrl(a.url)}" target="_blank" rel="noopener noreferrer" class="geo-article">
          <div class="geo-article-date">
            <div class="day">${day}</div>
            <div class="month">${month}</div>
          </div>
          <div class="geo-article-content">
            <div class="geo-article-title">${this._escapeHtml(a.title)}</div>
            <div class="geo-article-source">
              <span class="domain">${this._escapeHtml(a.domain)}</span>
            </div>
          </div>
        </a>
      `;
    }).join("");
  },

  // Whitelist http(s) uniquement — bloque javascript:, data:, vbscript:, etc.
  _safeUrl(url) {
    if (typeof url !== "string") return "#";
    if (!/^https?:\/\//i.test(url)) return "#";
    return this._escapeHtml(url);
  },

  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },
};
