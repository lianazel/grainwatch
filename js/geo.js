// ============================================================
// GRAINWATCH — Page géopolitique dédiée (GDELT à la demande)
// ============================================================
// Sort le contexte géopolitique du dashboard. L'appel GDELT ne part
// QUE sur clic explicite (1 denrée = 1 requête) → respecte le rate-limit
// GDELT (1 req/5s, cf. C10). Calqué sur ExportPage (réutilise les classes
// CSS .export-* et le dropdown groupé par catégorie).

const GeoPage = {
  _loading: false,

  // --------------------------------------------------------
  // INITIALIZATION (called once from App)
  // --------------------------------------------------------
  init() {
    this._bindEvents();
    this._populateDropdown();
  },

  _bindEvents() {
    const back = document.getElementById("geoBackBtn");
    if (back) back.addEventListener("click", () => this.close());
    const loadBtn = document.getElementById("geoLoadBtn");
    if (loadBtn) loadBtn.addEventListener("click", () => this._loadSelected());
  },

  // --------------------------------------------------------
  // POPULATE COMMODITY DROPDOWN
  // --------------------------------------------------------
  // Dropdown groupé par catégorie — calqué sur ExportPage._populateDropdown().
  // Catégories réelles (cereals/oilseeds/softs/fibers/industrials) et labels en
  // dur via ternaire I18N.lang (pas de clés i18n cat_*), à l'identique d'export.js.
  _populateDropdown() {
    const select = document.getElementById("geoCommoditySelect");
    if (!select) return;

    const placeholderText = I18N.t("export_select_placeholder");
    select.innerHTML = `<option value="">${placeholderText}</option>`;

    const categories = {
      cereals:     I18N.lang === "en" ? "Cereals" : "Céréales",
      oilseeds:    I18N.lang === "en" ? "Oilseeds" : "Oléagineux",
      softs:       I18N.lang === "en" ? "Softs" : "Denrées tropicales",
      fibers:      I18N.lang === "en" ? "Fibers" : "Fibres",
      industrials: I18N.lang === "en" ? "Industrial" : "Industriels",
    };

    const grouped = {};
    ALL_COMMODITIES.forEach(c => {
      const cat = c.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(c);
    });

    Object.entries(grouped).forEach(([cat, items]) => {
      const group = document.createElement("optgroup");
      group.label = categories[cat] || cat;
      items.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.icon} ${I18N.commodityName(c)} (${c.code})`;
        group.appendChild(opt);
      });
      select.appendChild(group);
    });
  },

  // --------------------------------------------------------
  // OPEN / CLOSE
  // --------------------------------------------------------
  open() {
    // Rafraîchit le dropdown si la langue a changé pendant que la page était fermée.
    this._populateDropdown();

    // Pré-sélectionne la denrée courante du dashboard (confort), SANS lancer de
    // requête : chargement à la demande strict (clic sur le bouton uniquement).
    const select = document.getElementById("geoCommoditySelect");
    if (select && App.state && App.state.selectedCommodity) {
      select.value = App.state.selectedCommodity;
    }

    if (App.applyTranslations) App.applyTranslations();

    document.querySelector(".sidebar").style.display = "none";
    document.querySelector(".detail-panel").style.display = "none";
    document.getElementById("exportPage").style.display = "none";
    document.getElementById("sourcesPage").style.display = "none";
    document.getElementById("geoPage").style.display = "flex";
  },

  close() {
    document.getElementById("geoPage").style.display = "none";
    document.querySelector(".sidebar").style.display = "";
    document.querySelector(".detail-panel").style.display = "";
  },

  // --------------------------------------------------------
  // LOAD NEWS FOR SELECTED COMMODITY (on explicit click only)
  // --------------------------------------------------------
  async _loadSelected() {
    if (this._loading) return; // anti double-clic / anti-spam rate-limit
    const select = document.getElementById("geoCommoditySelect");
    const loadBtn = document.getElementById("geoLoadBtn");
    const loadingEl = document.getElementById("geoPageLoading");
    const articlesEl = document.getElementById("geoPageArticles");
    const subtitleEl = document.getElementById("geoPageSubtitle");

    const id = select && select.value;
    if (!id) return; // aucune denrée choisie
    const commodity = ALL_COMMODITIES.find(c => c.id === id);
    if (!commodity) return;
    const name = I18N.commodityName(commodity);

    this._loading = true;
    if (loadBtn) loadBtn.disabled = true;
    if (loadingEl) loadingEl.style.display = "block";
    if (articlesEl) articlesEl.innerHTML = ""; // vide l'état précédent

    try {
      // fetchNews gère ses erreurs en interne (retourne [] sur échec réseau /
      // rate-limit) → render affiche alors l'état vide, pas de throw à catcher.
      const articles = await NewsManager.fetchNews(id);
      NewsManager.render(articles, name, { articlesEl, subtitleEl });
    } finally {
      this._loading = false;
      if (loadBtn) loadBtn.disabled = false;
      if (loadingEl) loadingEl.style.display = "none";
    }
  },
};
