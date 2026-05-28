// ============================================================
// GRAINWATCH — News & Geopolitical Context (GDELT API)
// Free, no API key, CORS-friendly
// ============================================================

// Search terms per commodity (English — GDELT indexes global press in EN).
// Syntaxe GDELT DOC 2.0 : ancre (hors parenthèses, AND implicite) + groupe OR parenthésé.
// Un OR DOIT être entre (), et () ne peut contenir QUE des OR (pas de AND). Ancre multi-mots → quotée.
const NEWS_KEYWORDS = {
  wheat:     "wheat (price OR export OR harvest OR shortage OR tariff OR crop)",
  corn:      "corn (price OR export OR harvest OR shortage OR tariff OR crop)",
  rice:      "rice (price OR export OR harvest OR shortage OR tariff OR crop)",
  soybean:   "soybean (price OR export OR harvest OR shortage OR tariff OR crop)",
  sugar:     "sugar (price OR export OR harvest OR shortage OR tariff OR crop)",
  coffee:    "coffee (price OR export OR harvest OR shortage OR tariff OR crop)",
  cocoa:     "cocoa (price OR export OR harvest OR shortage OR tariff OR crop)",
  palm_oil:  '"palm oil" (price OR export OR harvest OR shortage OR tariff OR crop)',
  cotton:    "cotton (price OR export OR harvest OR shortage OR tariff OR crop)",
  barley:    "barley (price OR export OR harvest OR shortage OR tariff OR crop)",
  oats:      "oats (price OR export OR harvest OR shortage OR tariff OR crop)",
  sunflower: '"sunflower oil" (price OR export OR harvest OR shortage OR tariff OR crop)',
  // Extended catalog
  soybean_oil: '"soybean oil" (price OR export OR harvest OR shortage OR tariff OR crop)',
  rapeseed:    "rapeseed (price OR export OR harvest OR shortage OR tariff OR crop)",
  rubber:      "rubber (price OR export OR harvest OR shortage OR tariff OR crop)",
  tea:         "tea (price OR export OR harvest OR shortage OR tariff OR crop)",
  orange:      '"orange juice" (price OR export OR harvest OR shortage OR tariff OR crop)',
  banana:      "banana (price OR export OR harvest OR shortage OR tariff OR crop)",
  olive_oil:   '"olive oil" (price OR export OR harvest OR shortage OR tariff OR crop)',
  sorghum:     "sorghum (price OR export OR harvest OR shortage OR tariff OR crop)",
  coconut_oil: '"coconut oil" (price OR export OR harvest OR shortage OR tariff OR crop)',
  wool:        "wool (price OR export OR harvest OR shortage OR tariff OR crop)",
  tobacco:     "tobacco (price OR export OR harvest OR shortage OR tariff OR crop)",
  groundnut:   "groundnut (price OR export OR harvest OR shortage OR tariff OR crop)",
  lentils:     "lentils (price OR export OR harvest OR shortage OR tariff OR crop)",
  millet:      "millet (price OR export OR harvest OR shortage OR tariff OR crop)",
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
      // Proxy Vercel /api/gdelt (même origine) → contourne le blocage CORS de GDELT (C9).
      // sort omis volontairement → tri par pertinence (défaut GDELT) ; datedesc renvoyait
      // les articles les plus récents sans rapport avec la denrée (cf. diagnostic C8).
      const url = `/api/gdelt?query=${query}&mode=artlist&maxrecords=8&format=json&timespan=3months`;

      // 30s : doit dépasser le timeout interne du proxy (25s) + cold start Vercel,
      // sinon le navigateur abandonne avant que /api/gdelt ait répondu (C9-bis).
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Parsing défensif : GDELT renvoie ses erreurs (syntaxe de requête, rate limit)
      // en TEXTE BRUT avec un HTTP 200. response.json() lèverait alors et le catch
      // masquerait la cause. On lit le texte puis on tente le parse en consignant le brut.
      const bodyText = await response.text();
      let json;
      try {
        json = JSON.parse(bodyText);
      } catch (parseError) {
        console.warn(`[GDELT] Réponse non-JSON (HTTP ${response.status}):`, bodyText.substring(0, 200));
        return [];
      }

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
      console.warn("[GDELT] Erreur réseau:", error.message || error);
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
