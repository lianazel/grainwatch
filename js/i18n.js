// ============================================================
// GRAINWATCH — Internationalization (FR / EN)
// ============================================================

const I18N = {
  _lang: "fr",
  _listeners: [],

  get lang() { return this._lang; },

  set lang(value) {
    if (value !== "fr" && value !== "en") return;
    this._lang = value;
    try { localStorage.setItem("grainwatch_lang", value); } catch (e) {}
    this._listeners.forEach(fn => fn(value));
  },

  init() {
    try {
      const saved = localStorage.getItem("grainwatch_lang");
      if (saved === "en" || saved === "fr") this._lang = saved;
    } catch (e) {}
  },

  onChange(fn) { this._listeners.push(fn); },

  t(key) {
    const entry = this.translations[key];
    if (!entry) return key;
    return entry[this._lang] || entry.fr || key;
  },

  // Get commodity name in current language
  commodityName(commodity) {
    return this._lang === "en" ? (commodity.nameEN || commodity.name) : commodity.name;
  },

  // --------------------------------------------------------
  // TRANSLATION STRINGS
  // --------------------------------------------------------
  translations: {
    // Header
    "update_time":        { fr: "Mis à jour à", en: "Updated at" },
    "refresh":            { fr: "Rafraîchir", en: "Refresh" },

    // GrainTrack3D inter-app link
    "graintrack3d_tooltip": {
      fr: "Voir le transit maritime mondial sur GrainTrack3D",
      en: "View global maritime transit on GrainTrack3D"
    },
    "graintrack3d_tooltip_disabled": {
      fr: "Denrée non suivie par GrainTrack3D (céréales et oléagineux uniquement)",
      en: "Commodity not tracked by GrainTrack3D (grains and oilseeds only)"
    },

    // Source selector
    "source_worldbank":   { fr: "Banque Mondiale", en: "World Bank" },
    "source_usda":        { fr: "USDA", en: "USDA" },
    "source_simulation":  { fr: "Simulation", en: "Simulation" },

    // Source descriptions
    "source_desc_wb":     {
      fr: "Données mensuelles issues du Commodity Markets (Pink Sheet), publiées chaque mois par le Groupe de la Banque Mondiale. Couvre 70+ matières premières. C'est la référence institutionnelle mondiale pour les prix des commodités.",
      en: "Monthly data from the Commodity Markets (Pink Sheet), published monthly by the World Bank Group. Covers 70+ commodities. The global institutional reference for commodity prices."
    },
    "source_desc_usda":   {
      fr: "Production, Supply & Distribution (PSD) du Département de l'Agriculture des États-Unis. Données annuelles sur la production, les stocks et les exportations mondiales. Idéal pour comprendre l'offre et la demande.",
      en: "Production, Supply & Distribution (PSD) from the U.S. Department of Agriculture. Annual data on global production, stocks and exports. Ideal for understanding supply and demand."
    },
    "source_desc_sim":    {
      fr: "Données générées par un algorithme (marche aléatoire avec retour à la moyenne). Les prix imitent un comportement de marché réaliste mais ne reflètent PAS les cours réels. Utile pour comprendre le fonctionnement de l'interface.",
      en: "Algorithm-generated data (random walk with mean reversion). Prices mimic realistic market behavior but do NOT reflect actual prices. Useful for understanding the interface."
    },

    // Source badge
    "source_badge":       { fr: "Données fournies par", en: "Data provided by" },
    "source_updated":     { fr: "Dernière mise à jour", en: "Last updated" },
    "source_learn_more":  { fr: "En savoir plus", en: "Learn more" },

    // Tooltips
    "tooltip_source":     {
      fr: "D'où viennent les prix ? Choisissez l'organisme international qui fournit les données.",
      en: "Where do the prices come from? Choose the international organization that provides the data."
    },
    // Tooltip devise — texte dynamique selon la devise active (cf. App.updateCurrencyTooltip)
    "tooltip_currency_usd": {
      fr: "Devise d'affichage. Les cours sont en dollars US (devise de référence des marchés).",
      en: "Display currency. Prices are in US dollars (the markets' reference currency)."
    },
    "tooltip_currency_eur": {
      fr: "Devise d'affichage. Les cours de base (USD) sont convertis en euros selon le taux du jour.",
      en: "Display currency. Base prices (USD) are converted to euros at the current exchange rate."
    },
    "tooltip_period":     {
      fr: "Fenêtre temporelle du graphique. Plus la période est longue, plus vous voyez la tendance de fond.",
      en: "Chart time window. The longer the period, the more you see the underlying trend."
    },
    "tooltip_info_label": {
      fr: "Afficher l'aide",
      en: "Show help"
    },
    // Menu hamburger
    "menu_title":          { fr: "Menu", en: "Menu" },
    "menu_open_label":     { fr: "Ouvrir le menu", en: "Open menu" },
    "menu_close_label":    { fr: "Fermer le menu", en: "Close menu" },
    "menu_settings":       { fr: "Réglages", en: "Settings" },
    "menu_sources":        { fr: "Sources de données", en: "Data sources" },
    "menu_api_choice":     { fr: "Choix API", en: "API choice" },
    "menu_demo_mode":      { fr: "Mode démo (Simulation)", en: "Demo mode (Simulation)" },
    "menu_status_online":  { fr: "● En ligne", en: "● Online" },
    "menu_status_always":  { fr: "Toujours disponible", en: "Always available" },
    "menu_sources_more":   { fr: "En savoir plus", en: "Learn more" },
    "menu_about":          { fr: "À propos", en: "About" },
    "menu_about_text":     {
      fr: "Outil éducatif de suivi des cours mondiaux des denrées alimentaires.",
      en: "Educational tool for tracking global food commodity prices."
    },
    "menu_no_tracking":    {
      fr: "🔒 Pas de cookies tiers, pas de tracking.",
      en: "🔒 No third-party cookies, no tracking."
    },
    "menu_label_source":   { fr: "Source des données", en: "Data source" },
    "menu_label_currency": { fr: "Devise", en: "Currency" },
    "menu_label_lang":     { fr: "Langue", en: "Language" },
    "menu_label_theme":    { fr: "Thème", en: "Theme" },
    "menu_label_alerts":   { fr: "Alertes", en: "Alerts" },
    "menu_label_refresh":  { fr: "Rafraîchir", en: "Refresh" },

    // Tabs
    "tab_all":            { fr: "Toutes", en: "All" },
    "tab_favorites":      { fr: "Favoris", en: "Favorites" },
    "no_favorites":       {
      fr: "Aucun favori sélectionné.<br>Cliquez ☆ pour ajouter.",
      en: "No favorites selected.<br>Click ☆ to add."
    },

    // Period selector
    "period_label":       { fr: "Période :", en: "Period:" },
    "period_1m":          { fr: "1 mois", en: "1 month" },
    "period_3m":          { fr: "3 mois", en: "3 months" },
    "period_6m":          { fr: "6 mois", en: "6 months" },
    "period_1y":          { fr: "1 an", en: "1 year" },
    "period_5y":          { fr: "5 ans", en: "5 years" },
    "period_10y":         { fr: "10 ans", en: "10 years" },
    "period_15y":         { fr: "15 ans", en: "15 years" },
    "period_custom":      { fr: "Personnalisé", en: "Custom" },

    // Custom range picker
    "range_from":         { fr: "Du", en: "From" },
    "range_to":           { fr: "Au", en: "To" },
    "range_apply":        { fr: "Appliquer", en: "Apply" },
    "range_error_empty":  {
      fr: "Tous les champs sont obligatoires (mois et année).",
      en: "All fields are required (month and year)."
    },
    "range_error_month":  {
      fr: "Le mois doit être compris entre 01 et 12. On n'a pas encore inventé le 13e mois !",
      en: "Month must be between 01 and 12. The 13th month hasn't been invented yet!"
    },
    "range_error_19th":   {
      fr: "Techniquement impossible... Les satellites n'existaient pas au XIXe siècle, et les pigeons voyageurs ne transmettaient pas de données JSON.",
      en: "Technically impossible... Satellites didn't exist in the 19th century, and carrier pigeons didn't transmit JSON data."
    },
    "range_error_too_old": {
      fr: "Les données fiables commencent à partir de 1960. Avant, c'était le Far West des statistiques.",
      en: "Reliable data starts from 1960. Before that, it was the Wild West of statistics."
    },
    "range_error_future": {
      fr: "Nous ne disposons pas encore de la DeLorean. La date de fin ne peut pas être dans le futur.",
      en: "We don't have the DeLorean yet. End date cannot be in the future."
    },
    "range_error_order":  {
      fr: "La date de début doit être antérieure ou égale à la date de fin. Le temps ne remonte pas (encore).",
      en: "Start date must be before or equal to end date. Time doesn't flow backwards (yet)."
    },

    // Indicators
    "ind_variation":      { fr: "VARIATION SUR LA PÉRIODE", en: "PERIOD CHANGE" },
    "ind_average":        { fr: "PRIX MOYEN", en: "AVERAGE PRICE" },
    "ind_high":           { fr: "PLUS HAUT", en: "HIGHEST" },
    "ind_trend":          { fr: "TENDANCE", en: "TREND" },
    "trend_tooltip":      {
      fr: "Calculée par régression linéaire sur l'ensemble de la période. Peut différer du mouvement récent visible sur le graphique.",
      en: "Calculated by linear regression over the full period. May differ from the recent movement visible on the chart."
    },

    // Trends
    "trend_strong_up":    { fr: "🔥 Haussière", en: "🔥 Bullish" },
    "trend_up":           { fr: "📈 Hausse légère", en: "📈 Slight rise" },
    "trend_neutral":      { fr: "➡️ Neutre", en: "➡️ Neutral" },
    "trend_down":         { fr: "📉 Baisse légère", en: "📉 Slight decline" },
    "trend_strong_down":  { fr: "⬇️ Baissière", en: "⬇️ Bearish" },

    // USDA unit
    "usda_unit":          { fr: "production mondiale (milliers de tonnes)", en: "global production (thousand tonnes)" },

    // Export
    "export_csv":         { fr: "Exporter en CSV", en: "Export to CSV" },
    "csv_header_date":    { fr: "Date", en: "Date" },
    "csv_header_price":   { fr: "Prix", en: "Price" },
    "csv_header_commodity": { fr: "Denree", en: "Commodity" },
    "csv_header_source":  { fr: "Source", en: "Source" },

    // Geo panel
    "geo_title":          { fr: "Contexte géopolitique", en: "Geopolitical context" },
    "geo_subtitle":       { fr: "Actualités liées :", en: "Related news:" },
    "geo_loading":        { fr: "Chargement des actualités...", en: "Loading news..." },
    "geo_empty":          { fr: "Aucune actualité récente trouvée pour", en: "No recent news found for" },

    // Geo dedicated page (v0.9.2) — chargement GDELT à la demande
    "menu_geo":           { fr: "Géopolitique", en: "Geopolitics" },
    "menu_geo_open":      { fr: "🌍 Contexte géopolitique", en: "🌍 Geopolitical context" },
    "geo_back":           { fr: "Retour au tableau de bord", en: "Back to dashboard" },
    "geo_page_title":     { fr: "Contexte géopolitique", en: "Geopolitical context" },
    "geo_step1_title":    { fr: "Choisir une denrée", en: "Choose a commodity" },
    "geo_step2_title":    { fr: "Actualités", en: "News" },
    "geo_load_btn":       { fr: "Afficher les infos géopolitiques", en: "Show geopolitical news" },
    "geo_page_hint":      { fr: "Sélectionnez une denrée puis cliquez sur « Afficher les infos géopolitiques ».", en: "Select a commodity, then click \"Show geopolitical news\"." },

    // Customize panel
    "customize_btn":      { fr: "Personnaliser", en: "Customize" },
    "customize_title":    { fr: "Denrées affichées", en: "Displayed commodities" },
    "customize_hint":     { fr: "Cochez les denrées à afficher dans la barre latérale.", en: "Check the commodities to display in the sidebar." },
    "customize_all":      { fr: "Tout cocher", en: "Check all" },
    "customize_none":     { fr: "Tout décocher", en: "Uncheck all" },
    "customize_reset":    { fr: "Réinitialiser (12 par défaut)", en: "Reset (12 defaults)" },
    "customize_add_placeholder": { fr: "Ajouter une denrée...", en: "Add a commodity..." },
    "customize_add_btn":  { fr: "Ajouter", en: "Add" },
    "customize_delete_confirm": { fr: "Retirer de la liste ?", en: "Remove from list?" },
    "customize_empty_catalog":  { fr: "Toutes les denrées sont déjà dans votre liste.", en: "All commodities are already in your list." },

    // Export page
    "export_btn":         { fr: "Exporter", en: "Export" },
    "export_back":        { fr: "Retour au tableau de bord", en: "Back to dashboard" },
    "export_page_title":  { fr: "Centre d'export", en: "Export Center" },
    "export_step1_title": { fr: "Sélectionner les denrées", en: "Select commodities" },
    "export_step2_title": { fr: "Définir la période", en: "Set the period" },
    "export_step3_title": { fr: "Récupérer et exporter", en: "Fetch and export" },
    "export_select_placeholder": { fr: "Choisir une denrée...", en: "Choose a commodity..." },
    "export_empty_hint":  { fr: "Aucune denrée sélectionnée. Ajoutez-en depuis la liste ci-dessus.", en: "No commodity selected. Add from the list above." },
    "export_fetch":       { fr: "Vérifier les données", en: "Check data" },
    "export_fetching":    { fr: "Récupération en cours...", en: "Fetching data..." },
    "export_fetch_ok":    { fr: "données récupérées avec succès !", en: "data points retrieved successfully!" },
    "export_fetch_empty": { fr: "Aucune donnée trouvée pour cette période.", en: "No data found for this period." },
    "export_fetch_error": { fr: "Erreur lors de la récupération des données.", en: "Error fetching data." },
    "export_fetch_need_commodity": { fr: "Ajoutez au moins une denrée.", en: "Add at least one commodity." },
    "export_fetch_need_dates": { fr: "Renseignez la période complète.", en: "Fill in the complete period." },
    "export_copy":        { fr: "Copier dans le presse-papier", en: "Copy to clipboard" },
    "export_copied":      { fr: "Copié !", en: "Copied!" },
    "export_preview_title": { fr: "Aperçu des données", en: "Data preview" },
    "export_preview_rows": { fr: "lignes", en: "rows" },

    // Mobile
    "back_to_list":       { fr: "Retour à la liste", en: "Back to list" },

    // Loading
    "loading":            { fr: "Chargement...", en: "Loading..." },
    "loading_data":       { fr: "Chargement des données...", en: "Loading data..." },


    // Sources page
    "sources_free":       {
      fr: "🔓 <strong>100% gratuit et transparent</strong> — GrainWatch n'utilise que des APIs publiques et gratuites. Aucune clé d'API dans le code, aucun compte requis. Tout le monde peut reproduire ces appels.",
      en: "🔓 <strong>100% free and transparent</strong> — GrainWatch only uses free, public APIs. No API keys in the code, no account required. Anyone can reproduce these calls."
    },
    "sources_btn_gdelt":  { fr: "🌍 Appeler l'API GDELT", en: "🌍 Call GDELT API" },
    "sources_gdelt_desc": {
      fr: "L'API <strong>GDELT</strong> (Global Database of Events, Tone and Language) surveille les médias du monde entier en temps réel. GrainWatch l'utilise pour afficher le <strong>contexte géopolitique</strong> lié à chaque denrée : conflits, sécheresses, accords commerciaux… Tout ce qui peut influencer les prix.",
      en: "The <strong>GDELT</strong> API (Global Database of Events, Tone and Language) monitors world media in real time. GrainWatch uses it to display the <strong>geopolitical context</strong> related to each commodity: conflicts, droughts, trade agreements… Everything that can influence prices."
    },

    "sources_period":     { fr: "Période de l'appel", en: "API call period" },

    "sources_link":       { fr: "Les APIs utilisées", en: "APIs used" },
    "sources_back":       { fr: "Retour au tableau de bord", en: "Back to dashboard" },
    "sources_title":      { fr: "Sources de données & APIs", en: "Data Sources & APIs" },
    "sources_intro":      {
      fr: "GrainWatch récupère ses données en temps réel depuis des <strong>APIs</strong> (interfaces de programmation) mises à disposition par des organismes internationaux. Une API, c'est comme un guichet automatique : on envoie une requête (une question), et on reçoit une réponse structurée (des données). Aucune intervention humaine — c'est la machine qui parle à la machine.",
      en: "GrainWatch fetches its data in real time from <strong>APIs</strong> (Application Programming Interfaces) provided by international organizations. An API is like an automated service desk: you send a request (a question), and you get a structured response (data). No human intervention — it's machine-to-machine communication."
    },
    "sources_how_title":  { fr: "Comment ça marche ?", en: "How does it work?" },
    "sources_how_text":   {
      fr: "Quand vous ouvrez GrainWatch, l'application envoie automatiquement des requêtes aux APIs pour obtenir les prix les plus récents. Les données arrivent au format <strong>JSON</strong> (JavaScript Object Notation), un format universel lisible à la fois par les humains et les machines.",
      en: "When you open GrainWatch, the app automatically sends requests to the APIs to get the latest prices. Data comes back in <strong>JSON</strong> (JavaScript Object Notation) format, a universal format readable by both humans and machines."
    },
    "sources_try_title":  { fr: "Essayez vous-même !", en: "Try it yourself!" },
    "sources_try_text":   {
      fr: "Cliquez sur un bouton ci-dessous pour lancer un vrai appel API et voir exactement ce que l'API renvoie. C'est ce que GrainWatch fait en coulisses à chaque fois que vous consultez un prix.",
      en: "Click a button below to make a real API call and see exactly what the API returns. This is what GrainWatch does behind the scenes every time you look up a price."
    },
    "sources_btn_wb":     { fr: "🏛️ Appeler l'API Banque Mondiale", en: "🏛️ Call World Bank API" },
    "sources_btn_usda":   { fr: "🇺🇸 Appeler l'API USDA", en: "🇺🇸 Call USDA API" },
    "sources_loading":    { fr: "Appel en cours...", en: "Calling API..." },
    "sources_json_title": { fr: "Réponse brute de l'API", en: "Raw API response" },
    "sources_commodity":  { fr: "Denrée testée", en: "Tested commodity" },


    // Alerts system
    "alerts_title":       { fr: "Mes alertes", en: "My alerts" },
    "alerts_empty":       { fr: "Aucune alerte configurée.", en: "No alerts configured." },
    "alerts_add":         { fr: "Nouvelle alerte", en: "New alert" },
    "alerts_max":         { fr: "Maximum 5 alertes atteint.", en: "Maximum 5 alerts reached." },
    "alerts_commodity":   { fr: "Denrée", en: "Commodity" },
    "alerts_type":        { fr: "Type", en: "Type" },
    "alerts_type_above":  { fr: "Prix dépasse", en: "Price above" },
    "alerts_type_below":  { fr: "Prix descend sous", en: "Price below" },
    "alerts_type_var_up": { fr: "Hausse de plus de", en: "Rise of more than" },
    "alerts_type_var_down": { fr: "Baisse de plus de", en: "Drop of more than" },
    "alerts_value":       { fr: "Valeur", en: "Value" },
    "alerts_save":        { fr: "Créer l'alerte", en: "Create alert" },
    "alerts_cancel":      { fr: "Annuler", en: "Cancel" },
    "alerts_delete":      { fr: "Supprimer", en: "Delete" },
    "alerts_active":      { fr: "Active", en: "Active" },
    "alerts_triggered":   { fr: "Déclenchée !", en: "Triggered!" },
    "alerts_acknowledge": { fr: "OK, compris", en: "OK, got it" },
    "alerts_toast_above": { fr: "a dépassé", en: "exceeded" },
    "alerts_toast_below": { fr: "est passé sous", en: "dropped below" },
    "alerts_toast_var_up":  { fr: "a augmenté de", en: "rose by" },
    "alerts_toast_var_down": { fr: "a baissé de", en: "dropped by" },
    "alerts_history":     { fr: "Historique", en: "History" },
    "alerts_history_empty": { fr: "Aucune alerte déclenchée.", en: "No triggered alerts." },

    // Theme
    "theme_tooltip_dark":  { fr: "Passer en mode clair", en: "Switch to light mode" },
    "theme_tooltip_light": { fr: "Passer en mode sombre", en: "Switch to dark mode" },

    // Alerts improvements
    "alerts_reuse_hint":   { fr: "Cliquer pour recréer cette alerte", en: "Click to recreate this alert" },
    "alerts_replace_msg":  { fr: "Une alerte existe déjà pour {name}. Remplacer ?", en: "An alert already exists for {name}. Replace?" },
    "alerts_replace_yes":  { fr: "Oui, remplacer", en: "Yes, replace" },
    "alerts_replace_no":   { fr: "Annuler", en: "Cancel" },
    "alerts_cleared":     { fr: "à", en: "at" },
    "alerts_unit_price":  { fr: "Seuil", en: "Threshold" },
    "alerts_unit_percent": { fr: "Variation %", en: "Variation %" },

    // Footer
    "disclaimer":         {
      fr: "⚠ Cet outil est fourni à titre éducatif uniquement. Il ne constitue en aucun cas un conseil financier ou d'investissement. Les cours affichés proviennent de sources publiques et peuvent présenter un décalage temporel.",
      en: "⚠ This tool is provided for educational purposes only. It does not constitute financial or investment advice. Prices shown come from public sources and may have a time lag."
    },
  },
};
