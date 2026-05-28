# Journal détaillé des actions — GrainWatch (jusqu'à v0.9.1)

> Ce fichier contient l'historique détaillé des actions terminées, extrait de `CLAUDE.md`
> pour alléger ce dernier. CLAUDE.md ne conserve qu'une ligne par correctif dans son
> tableau « Historique des versions ». Le détail technique de chaque correctif est ici.

---

## Suivi du projet — Journal des actions

### Fait
- [x] Structure initiale du projet (HTML/CSS/JS, 10 modules)
- [x] Intégration Chart.js pour les graphiques (adaptatif dark/light)
- [x] Mode sombre/clair complet (détection OS + toggle + persistance)
- [x] Système d'alertes V2 (historique cliquable, détection doublons, pré-remplissage)
- [x] Responsive mobile (header 2 lignes, fix iOS touchend, scroll clavier)
- [x] Panneau géopolitique GDELT
- [x] Déploiement GitHub Pages fonctionnel
- [x] Rédaction de la note technique sécurité (OWASP Top 10)
- [x] Rédaction des règles Security Hardening Policy
- [x] Création DEPLOY_GITHUB.md et script .bat
- [x] Mise en place du README.md

### Fait — Sécurité (corrections appliquées 21/05/2026)
- [x] **XSS GDELT** — `js/news.js` : validation et échappement de l'URL via `_safeUrl()` (whitelist http(s), bloque `javascript:`, `data:`, etc.) ; ajout `rel="noopener noreferrer"`
- [x] **Meta CSP** — `index.html` : ajout balise `<meta http-equiv="Content-Security-Policy">` (default-src 'self', script/style/connect/font/img whitelisted, base-uri/form-action self, frame-ancestors none)
- [x] **SRI CDN** — `index.html` : ajout `integrity` SHA-384 + `crossorigin="anonymous"` sur Chart.js 4.4.7 et chartjs-adapter-date-fns 3.0.0
- [x] **XSS sources.js** — ligne 205 : `error.message` rendu via `textContent` au lieu de `innerHTML` (créa span + appendChild)
- [x] **XSS GDELT domain** — `js/news.js:135` : `${a.domain}` passé via `_escapeHtml()` (même classe de bug que l'URL)

### Fait — Sécurité §6 — Validation inputs alertes (21/05/2026)
- [x] **Validation `_createAlert()`** — `js/alerts.js:161-172` : ajout (1) whitelist du `type` parmi `['above','below','var_up','var_down']`, (2) vérification que `commodityId` existe dans `ALL_COMMODITIES` (évite IDs forgés via DOM altéré ou extension), (3) borne haute `value <= 1_000_000` (cf. CLAUDE.md §6 — anti-overflow et anti-DoS sur le rendu). La validation existante (`!commodityId`, `isNaN`, `value <= 0`) est conservée.

### Fait — Sécurité §7 — Désérialisation localStorage défensive (21/05/2026)
- [x] **`alerts.js:_load()`** — refactor complet. `_alerts` filtré par `Array.isArray` + validation par item (`id`/`commodityId` strings, `type` whitelisté, `value` number fini dans `]0, 1_000_000]`). `_history` filtré par `Array.isArray` + validation `text`/`time` strings, slice(-50) pour borne dure. En cas de `JSON.parse` qui throw, fallback sur tableau vide explicite.
- [x] **`app.js:loadFavorites()`** — validation `Array.isArray` + filtre `typeof id === 'string'` avant `new Set(...)`. Évite qu'un JSON `{}` ou un objet non-array fasse exploser `Set` ou injecte des entrées non-string.
- [x] **`app.js:loadVisibleCommodities()`** — validation `Array.isArray` sur `grainwatch_active_ids` et `grainwatch_visible`. Bonus défense en profondeur : `activeCommodityIds` filtré contre `ALL_COMMODITIES` (un ID inconnu est silencieusement ignoré).
- [x] **`app.js:_initTheme()`** — whitelist stricte `'dark'|'light'` sur `grainwatch_theme` à la lecture initiale ET dans le listener `matchMedia` (sinon `data-theme="foo"` aurait été accepté tel quel — non exploitable XSS mais incohérent avec la politique de validation).
- _Volontairement non touché_ : `i18n.js:20` déjà conforme (`=== "en" || === "fr"` à la lecture).

### Fait — Sécurité §6 — Radix 10 sur tous les parseInt (21/05/2026)
Défense en profondeur (pas d'exploit connu sur `<input type="number">`, mais aligne sur la politique "validation stricte des conversions") :
- [x] **`app.js:_applyCustomRange()`** — 4 `parseInt` sur les inputs date custom passés à radix 10.
- [x] **`export.js:_validateDates()`** — 4 `parseInt` sur les inputs date custom passés à radix 10.
- [x] **`app.js:60`** — `parseInt(btn.dataset.period, 10)` (dataset interne mais cohérence).
- [x] **`alerts.js:409`** — `parseInt(el.dataset.histIdx, 10)` (idem).
- _Note_ : `parseFloat` n'a pas de notion de radix — `alerts.js:186` reste tel quel (déjà entouré de bornes 0 < x ≤ 1_000_000).

- [x] **Synchro `site/`** (21/05/2026 — 2e batch) — `js/alerts.js`, `js/app.js`, `js/export.js` recopiés dans `site/js/`.

### Fait — Sécurité — console.* en prod (21/05/2026)
Audit complet : 10 occurrences de `console.warn/error` dans `api.js`, `app.js`, `export.js`, `news.js`. **Aucune** ne loggue de données personnelles, clé API, valeur d'alerte, prix ou input utilisateur. Le seul risque réel : 5 d'entre elles loggaient l'objet `Error` entier (stack + URL fetch potentielle visibles dans DevTools).
- [x] **`api.js:116, 346`** — `console.warn(..., e)` → `console.warn(..., e.message)` (loadAll standard + custom range).
- [x] **`export.js:323`** — `console.error('Export fetch error:', error)` → `error.message`.
- [x] **`export.js:590`** — `console.error('Clipboard copy failed:', err)` → `err.message`.
- [x] **`app.js:410`** — `console.error("Error loading detail:", error)` → `error.message`.
- _Inchangés_ : les 5 autres (`api.js:228/289/453/509`, `news.js:99`) loggaient déjà `error.message` uniquement.
- [x] **Synchro `site/`** (3e batch) — `js/api.js`, `js/app.js`, `js/export.js` recopiés.

### Fait — Sécurité MOYEN §5 — innerHTML avec interpolation (21/05/2026)
Audit complet des 17 `innerHTML` dans `app.js`, `alerts.js`, `export.js` :
- [x] **XSS historique alertes** — `js/alerts.js:333` : `h.text`/`h.time`/`h.commodityId` proviennent de `localStorage` (altérable par extension malveillante). Refactor complet en `createElement` + `textContent`. L327 (état vide) refactorisé par cohérence.
- [x] **Durcissement href source badge** — `js/app.js:484-488` (`updateSourceBadge`) : refactor complet en `createElement`. `info.url` whitelistée http(s) avant assignation à `a.href`. Pas une faille réelle aujourd'hui (URLs en dur dans `api.js`) mais aligné sur `news.js` pour la défense en profondeur.
- _Volontairement non touché_ : `app.js:810` (innerHTML d'i18n contenant `<strong>` et `<br>` voulus pour les paragraphes — confirmé dans `i18n.js`). Les 13 autres `innerHTML` interpolent uniquement i18n bundled + catalog commodities statique + nombres calculés → aucun n'est exploitable.

- [x] **Synchro `site/`** — `index.html`, `js/news.js`, `js/sources.js`, `js/app.js`, `js/alerts.js` recopiés dans `site/` (déploiement GitHub Pages prêt)

### Fait — Checklist release — Vérification finale (21/05/2026)
Parcours systématique des 9 items de la checklist `Security Hardening Policy`. Aucune régression détectée.

| # | Item checklist | Statut | Détail |
|---|---|---|---|
| 1 | Aucune clé API/token/secret dans code/commits | ✅ | `grep -rEn "(api[_-]?key|token|secret|password|bearer)"` → 0 hit légitime |
| 2 | `innerHTML` avec données externes : zéro occurrence | ✅ | Audit des 19 `innerHTML` restants : tous interpolent uniquement i18n bundlé, `ALL_COMMODITIES` (catalogue statique), ou nombres calculés. `sources.js:196` (`_colorizeJSON`) échappe `&<>` avant le regex highlighting. `export.js:404` (`r.date`) est safe : les dates sont reconstruites via `toISOString().split('T')[0]` dans `api.js:214,439`, jamais raw API. `app.js:855` (`el.innerHTML = text`) interpole `I18N.t(key)` → bundle statique. |
| 3 | Meta CSP présente et à jour dans `index.html` | ✅ | Lignes 6-15. `default-src 'self'`, script/style/connect/font/img whitelistés, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. |
| 4 | SRI sur toutes les dépendances CDN | ✅ | Chart.js 4.4.7 et chartjs-adapter-date-fns 3.0.0 : `integrity="sha384-..."` + `crossorigin="anonymous"` (`index.html:21-26`). |
| 5 | Inputs utilisateur validés et bornés | ✅ | Cf. §6 du 21/05 : whitelist type, validation `commodityId ∈ ALL_COMMODITIES`, borne haute `value ≤ 1_000_000`. |
| 6 | localStorage : uniquement les clés documentées | ⚠️→✅ | Écart constaté : 7 clés réellement utilisées vs 4 documentées. Toutes légitimes (préférences UI). Tableau "Persistance localStorage" mis à jour ce jour pour refléter la réalité (`grainwatch_alerts_history`, `grainwatch_active_ids`, `grainwatch_visible` ajoutées). |
| 7 | Désérialisation localStorage protégée par try/catch | ✅ | Cf. §7 du 21/05 : `alerts.js:_load()`, `app.js:loadFavorites/loadVisibleCommodities/_initTheme`, `i18n.js:20`. |
| 8 | Pas de `console.log` contenant des données utilisateur en prod | ✅ | 10 `console.warn/error` audités, aucun ne loggue prix/alerte/input utilisateur. 5 objets `Error` entiers filtrés en `.message` le 21/05. |
| 9 | Vérifier securityheaders.com pour l'URL de production | ✅ | Voir section ci-dessous. |

### Fait — Vérification securityheaders.com / headers HTTP prod (21/05/2026)
URL prod réelle : **https://grainwatch.vercel.app/** (hébergement Vercel, et non GitHub Pages comme initialement supposé dans CLAUDE.md — corrigé).
securityheaders.com refuse les requêtes automatisées (403). Audit fait directement via `curl -sIL` sur l'URL prod.

**Headers présents :**
- ✅ `strict-transport-security: max-age=63072000; includeSubDomains; preload` (HSTS très fort — 2 ans + preload)
- ✅ `Content-Security-Policy` délivrée via `<meta>` HTML (vérifié dans la réponse).

**Headers manquants** (cause attendue : pas de `vercel.json` dans le repo) :
- ❌ `X-Content-Type-Options: nosniff`
- ❌ `Referrer-Policy: strict-origin-when-cross-origin` (ou `no-referrer`)
- ❌ `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- ❌ `X-Frame-Options: DENY` (redondant avec CSP `frame-ancestors 'none'` mais attendu par les scanners)
- ❌ `Cross-Origin-Opener-Policy: same-origin`
- ❌ CSP en **header HTTP** (uniquement présente en `<meta>` aujourd'hui — perte de points scoring)

**Scoring estimé sans correction : B**. Pour atteindre A/A+ → ajout d'un `vercel.json` (nouvelle tâche enregistrée ci-dessous). À noter : GitHub Pages ne supportant pas les headers HTTP custom, la meta CSP reste indispensable pour le fallback `site/`.

**Recommandation `vercel.json` minimal** :
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    }
  ]
}
```
La CSP en header peut être migrée dans un second temps (mêmes directives que la meta — copier-coller depuis `index.html:7-15`).

### A faire — Sécurité (prioritaire) — TOUT FAIT
- [x] Audit complet : rechercher tous les `innerHTML` avec données API _(fait — §5 du 21/05)_
- [x] Audit complet : vérifier la meta CSP dans index.html _(fait — corrections critiques du 21/05)_
- [x] Audit complet : vérifier les attributs SRI sur les scripts CDN _(fait — corrections critiques du 21/05)_
- [x] Audit complet : vérifier la validation des inputs utilisateur _(fait — §6 du 21/05)_
- [x] Audit complet : vérifier les données localStorage et leur désérialisation _(fait — §7 du 21/05)_
- [x] Audit complet : rechercher les `console.log` sensibles _(fait — 21/05, aucun log sensible, 5 objets Error filtrés en .message)_
- [x] Vérification finale avec la checklist release _(fait — 21/05, voir section "Checklist release — Vérification finale" ci-dessus)_
- [x] Vérifier securityheaders.com pour l'URL de production _(fait — 21/05, voir section ci-dessus ; recommandation : ajouter `vercel.json` avec les headers manquants)_

### Fait — Sécurité — `vercel.json` (21/05/2026)
- [x] **`vercel.json` créé à la racine du projet.** Contient 6 directives sur `source: "/(.*)"` (matche toutes les routes statiques SPA) :
  - `Content-Security-Policy` — mêmes directives que la meta `index.html:7-15` (default-src 'self', script/connect/style/font/img whitelistés, base-uri/form-action self, frame-ancestors none). La meta dans le HTML est **conservée** pour le fallback GitHub Pages (`site/`).
  - `X-Content-Type-Options: nosniff` — bloque le MIME sniffing.
  - `Referrer-Policy: strict-origin-when-cross-origin` — limite la fuite de Referer cross-origin.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()` — désactive explicitement les APIs sensibles non utilisées par GrainWatch + opt-out FLoC/cohortes.
  - `X-Frame-Options: DENY` — redondant avec `frame-ancestors 'none'` mais attendu par les scanners.
  - `Cross-Origin-Opener-Policy: same-origin` — isole le contexte de navigation.
- **Note déploiement** : à pousser sur main, Vercel applique automatiquement les headers au prochain build (~30s). Vérifier après déploiement : `curl -sI https://grainwatch.vercel.app/ | grep -iE "csp|x-content|referrer|permissions|x-frame|coop"`.
- **Note GH Pages** : `vercel.json` est ignoré sur GitHub Pages — c'est attendu, la meta CSP suffit pour ce fallback.
- **Scoring attendu** après déploiement : **A+** sur securityheaders.com (HSTS fort déjà présent + tous les headers manquants ajoutés + CSP en header HTTP).

### Fait — Inter-app — Lien GrainWatch → GrainTrack3D (25/05/2026)
- [x] **Icône globe 3D dans `.detail-price-row`** (`index.html`) — SVG inline 28×28, juste avant `#detailPrice`. Attributs sécurité : `target="_blank"` + `rel="noopener noreferrer"` (anti tab hijacking). `display: none` par défaut.
- [x] **Constante de config + builder d'URL** (`js/app.js`, en-tête) — `GRAINTRACK3D_BASE_URL = 'https://grain-track3-d.vercel.app'`, `GRAINTRACK3D_PARAM_NAME = 'grain'`, `GRAINTRACK3D_SUPPORTED_KEYS` (Set des 12 céréales acceptées côté GrainTrack3D). `buildGrainTrack3DUrl()` valide le type, normalise lowercase, vérifie l'appartenance au Set, construit l'URL via `new URL()` + `searchParams.set()` (zéro concaténation, encodage auto).
- [x] **Branchement dans `loadDetail()`** (`js/app.js`) — après mise à jour du `#detailCode`. Affiche/masque l'icône selon que `buildGrainTrack3DUrl(selectedCommodity)` retourne une URL ou `null`. Les 14 denrées non-céréalières (café, cacao, coton, palm oil, sunflower, soybean_oil, rubber, tea, orange, banana, olive_oil, coconut_oil, wool, tobacco) → icône cachée. Tooltip rafraîchi via `I18N.t('graintrack3d_tooltip')` à chaque changement de langue (ligne 218 → `loadDetail()`).
- [x] **CSS dédié** (`css/style.css`, fin du fichier) — `.graintrack3d-link` utilise `var(--terracotta)` qui bascule auto en dark mode (cf. `[data-theme="dark"]` ligne 35-36). Hover scale + background terracotta 12%, focus-visible outline 2px, active scale down.
- [x] **i18n** (`js/i18n.js`) — clé `graintrack3d_tooltip` ajoutée FR/EN.
- [x] **Synchro `site/`** — `index.html`, `css/style.css`, `js/i18n.js`, `js/app.js` recopiés.
- **Test manuel à faire après déploiement** :
  - Ouvrir https://grainwatch.vercel.app/ → sélectionner "Blé" → icône globe visible à gauche du prix → clic ouvre https://grain-track3-d.vercel.app/?grain=wheat dans un nouvel onglet → GrainTrack3D doit pré-sélectionner le blé dans son GrainSelector
  - Sélectionner "Café" → icône cachée (denrée non supportée par GrainTrack3D)
  - Basculer FR↔EN → tooltip mis à jour
  - Mode sombre → couleur de l'icône bascule en `--terracotta` dark (#E07B5A)
- **Format paramètre URL vérifié Phase 0** : GrainTrack3D `src/App.jsx:30-36` lit `URLSearchParams.get('grain')` puis valide via `GRAIN_LIST.some(g => g.key === grainParam)` — keys lowercase (`wheat`, `corn`, `rice`, `soybean`, `sugar`, `barley`, `oats`, `sorghum`, `rapeseed`, `groundnut`, `lentils`, `millet`). GrainWatch utilise déjà ces mêmes IDs lowercase → aucune transformation requise, juste un filtre de whitelist.
- **CSP** : pas de modification nécessaire. La meta CSP couvre fetch/connect/script, mais une navigation `<a target="_blank">` ouvre un nouveau contexte de navigation non couvert par `connect-src`/`default-src` (et la directive `navigate-to` n'est pas définie). Vérifié OK.
- Rapport détaillé : `tasks/RAPPORT_LINK_GRAINTRACK3D_v1.md`.

### Fait — Correctifs visuels post-déploiement (25/05/2026)
- [x] **Visibilité icône globe — cause racine bug structurel** : tout le bloc CSS `.graintrack3d-link` du commit `bb77883` était piégé à l'intérieur du `@media (max-width: 768px)` (accolade fermante mal placée). Résultat : sur desktop, le lien tombait sur le style `<a>` par défaut du navigateur (couleur bleue navigateur). Bloc CSS sorti du `@media`, et améliorations visuelles ajoutées :
  - Background discret au repos (`rgba(192,57,43,0.10)`, hover `0.22`) — l'icône a maintenant du corps sans hover
  - `stroke-width: 2.2` forcé via CSS (au lieu de l'attribut SVG `1.8`, trop fin aux 28×28 px UI)
  - Override dark mode dédié : `var(--terracotta-light)` (#F09070, plus lumineux que `--terracotta` dark #E07B5A) + background remonté à `rgba(240,144,112,0.18)` (hover `0.32`)
- [x] **Unité sucre `c/kg` → `¢/kg`** (U+00A2) — `js/commodities.js` : 7 denrées concernées (sugar, coffee, cotton, rubber, tea, orange, wool), `unit` et `unitWB` mis à jour. `js/app.js:409` : `.replace("c/", "ct/")` → `.replace("¢/", "ct/")` pour que la conversion EUR continue de produire `ct/kg` (centimes d'euro).
- [x] **Tooltips dark mode illisibles** — `.tooltip-bubble` utilisait `background: var(--black)` qui en dark mode vaut `#E8E4DB` (cream) → fond cream sur page cream = invisible. Override dans la section "DARK MODE — Component-specific overrides" (ligne 1856+) :
  - `.tooltip-bubble` dark : `background: var(--grey-light)` (#333355 distinct du fond `--creme` #1A1A2E et des cards `--white` #242444) + `color: #F5F0E5` (ratio ~10:1, WCAG AA) + bord `1px solid rgba(255,255,255,0.10)` + shadow renforcée
  - `.tooltip-arrow` dark : même `--grey-light` pour rester aligné avec la bulle
  - `.trend-tooltip` dark : harmonisé sur le même fond, on garde le bord olive distinctif
  - Chart.js tooltip : déjà géré dynamiquement dans `js/chart.js:68` (`dark ? '#333355' : '#2C2C2C'`) — pas touché
- [x] **État désactivé icône globe** — nouvelle logique 3 états dans `loadDetail()` :
  - **ACTIF** : denrée ∈ `GRAINTRACK3D_SUPPORTED_KEYS` → icône colorée cliquable
  - **DÉSACTIVÉ** : denrée hors catalogue (café, cacao, coton, tournesol, huile palme, huile soja, caoutchouc, thé, jus orange, banane, huile olive, huile coco, laine, tabac) → icône grisée (opacity 0.45 light / 0.55 dark) + barre diagonale superposée (via `::after` + `linear-gradient`) + tooltip explicatif "Denrée non suivie par GrainTrack3D (céréales et oléagineux uniquement)"
  - **MASQUÉ** : aucune denrée sélectionnée → `display: none`
- [x] **CSS `.graintrack3d-link--disabled`** — **volontairement SANS `pointer-events: none`** (Option A du spec) : sinon le `title` natif ne s'afficherait pas au survol. Le clic est neutralisé en JS via `e.preventDefault()` quand la classe est présente, dans un click handler one-shot ajouté à `bindEvents()` (ligne 250+).
- [x] **Accessibilité** — `aria-disabled="true"` posé/retiré dynamiquement avec la classe, en complément du `title` pour les lecteurs d'écran.
- [x] **i18n** — nouvelle clé `graintrack3d_tooltip_disabled` FR/EN ajoutée à `js/i18n.js` (à côté de `graintrack3d_tooltip`).
- [x] **Bump version footer** — `index.html:559` : `v0.8.1` → `v0.8.2`.
- [x] **Synchro `site/`** — `index.html`, `css/style.css`, `js/app.js`, `js/i18n.js`, `js/commodities.js` recopiés à chaque commit.

### Fait — v0.9.0 Refonte UX mobile (26/05/2026)
Diagnostic `DIAGNOSTIC_MOBILE_v0.8.2.md` → implémentation `tasks/RAPPORT_IMPLEMENTATION_MOBILE_UX_v1.md`. 4 features :
- [x] **F1 — Tooltips tactiles** : indicateur ⓘ (`<button class="tooltip-info">`) sur les 4 triggers (source/devise/période/tendance), visible sous `@media (hover:none)` ; bulle révélée par `:hover` OU `.tooltip-open` (tap, posée par `_initTouchTooltips()` en délégation document) ; un seul ouvert, fermeture tap-extérieur/Escape ; `role="tooltip"`/`aria-controls`/`aria-expanded`, label ⓘ traduit via `data-i18n-aria` (`applyTranslations` étendu). Suppression des 2 `display:none !important` (masquage par largeur).
- [x] **F2 — Menu hamburger + overflow** : `#menuToggle` + panneau `.menu-panel` (`role=dialog`/`aria-modal`, focus trap, Escape, scroll-lock, slide-in). 3 sections (Réglages/Sources/À propos). `setupToolbarOverflow()` = `ResizeObserver` sur `.header-right` qui **déplace** (pas clone) les contrôles excédentaires dans `#menuSettings` (ordre : refresh→alerts→thème→langue→devise→source), badge compteur, section masquée si vide. Constante `APP_VERSION`.
- [x] **F3 — Footer mobile** : `< 769px` masque le disclaimer (`.footer p`), ne garde que `.footer-version` (déplacé dans le menu À propos).
- [x] **F4 — Polices auto-hébergées** : 4 `.woff2` (Inter+JetBrains variables, latin+latin-ext) dans `/fonts`, `@font-face` en tête de `style.css`, suppression des `<link>` Google Fonts, **CSP resserrée** `font-src 'self'` + `style-src 'self' 'unsafe-inline'` (meta `index.html` + `vercel.json`).
- [x] **Synchro `site/`** : `index.html`, `css/style.css`, `js/app.js`, `js/i18n.js`, `fonts/` (4 woff2).
- _Convention actée_ : comportement tactile ciblé par `@media (hover:none)`/`(pointer:coarse)`, jamais par breakpoint de largeur (cf. `tasks/lessons.md`).
- _Déploiement_ : mergé dans `main` + push (commit `71fd3bd`, branche `feat/mobile-ux-v0.9.0` ff-only) → Vercel déployé le 26/05/2026. **Vérifié en prod** : header CSP `font-src 'self'` (plus de Google Fonts), `https://grainwatch.vercel.app/fonts/inter-latin.woff2` → 200 `font/woff2`.
- _Reste à valider_ : tests UX runtime sur device (tap tooltips, menu, overflow, focus trap) — pas de navigateur headless en env de dev. Vérif statique faite (syntaxe JS `node --check`, accolades CSS, IDs référencés présents).

### Fait — v0.9.1 Correctifs UX mobile post-test (26/05/2026)
Diagnostic `DIAGNOSTIC_MOBILE_v0.9.1.md` (P1-P4) + 2 vagues de correctifs après tests iPhone 14 (C1-C3, puis C4). Rapports : `tasks/RAPPORT_IMPL_P4_CONTRASTE_v1.md`, `RAPPORT_IMPL_P1P2P3_v1.md`, `RAPPORT_CORRECTIF_POST_TEST_v1.md`, `RAPPORT_CORRECTIF_C4_TOOLBAR_v1.md`.
- [x] **P1 — Réorg toolbar + menu** : sélecteur de source retiré de la barre mobile (`#ctrlSource` masqué `≤768px`), remplacé par la pastille `#sourcePastille` (icône source active, ouvre le menu). Sous-menu API interactif dans le hamburger (Banque Mondiale/USDA + Simulation séparée par `<hr>` + GDELT lecture seule). `setSource()` = état unique `App.state.source` synchronisant barre desktop ↔ menu mobile. `#ctrlSource` retiré de `setupToolbarOverflow`. Icône Simulation unifiée `🔬→🧪`. Clés i18n `menu_api_choice`, `menu_demo_mode`.
- [x] **P2 — Garde-fou tooltips** : custom property CSS `--tt-shift` tissée dans les `transform` des bulles ET flèches (`.tooltip-bubble`, `.tooltip-arrow`, variantes header/inline, `.trend-tooltip`). `_clampTooltip()` mesure puis pose le décalage ; centrage `translateX(-50%)` préservé (vs un override direct de `transform` qui l'aurait cassé). Reset dans `_closeAllTooltips()`.
- [x] **P3 → C2 — GrainTrack3D tactile** : message « denrée non suivie » rendu accessible au tap. v1 (P3) plaçait un ⓘ frère → jamais remarqué ; **C2** a fait de **l'icône grisée elle-même le déclencheur** (lien enveloppé dans `.selector-with-tooltip#gt3dWrap`, tap → bulle, `stopPropagation` anti-fermeture par la délégation `document`). Desktop : survol → bulle (désactivé) / `title` natif (actif). Construction DOM `createElement`/`textContent`.
- [x] **P4 — Contraste page Sources (dark)** : `#444`/`#555`/`#4C1D95`/`#6D28D9` → `var(--black)`/`var(--terracotta)` (ratio ~1.7:1 → ~13:1, WCAG AA).
- [x] **C1 — Pastille** : ouvre le menu **avec focus sur la section Sources** (raccourci ergo). Masquage `#ctrlSource` déjà correct (vérifié).
- [x] **C3 — Contraste alerte déclenchée (dark)** : fond rose clair fixe `#FEF2F2` + texte `var(--black)` clair = illisible → override `[data-theme="dark"] .alert-card.triggered` (fond rouge sombre translucide). On assombrit le **fond**, pas le texte. Light inchangé.
- [x] **C4 — Sélecteur API encore visible portrait mobile** : masquage durci `#ctrlSource, .source-selector { display:none !important }` (`@media ≤768px`) + nettoyage des règles `.source-btn` de compactage mobile devenues mortes. **Investigation** : CSS déployé vérifié correct (`curl`), aucun override CSS/JS, viewport meta OK → pas de cause racine reproductible côté code ; symptôme cohérent avec un cache device / décalage de déploiement. Hardening défensif appliqué par sécurité.
- [x] **Bump v0.9.1** : `APP_VERSION`, footer/menu, CHANGELOG `[0.9.1]`, ce tableau.
- _Déploiement_ : commits `f9c9293` (P4), `9cde1fa` (P1-P3), `f8437f5` (bump), `904e3c3` (C1-C3), `a083f6f` (C4), `442d094` (changelog) → `main` + Vercel.
- _Reste à valider_ : tests UX runtime sur device (vider le cache Safari avant re-test C4) — pas de navigateur en env de dev.

### Fait — C4-bis : masquage forcé du sélecteur API via JS (26/05/2026)
Le CSS `!important` (C4) n'a pas suffi : Safari iOS continuait d'afficher `#ctrlSource` en portrait. Double verrouillage CSS (conservé) + JS. Rapport : `tasks/RAPPORT_CORRECTIF_C4bis_FORCE_JS_v1.md`.
- [x] **Méthode `App.enforceSourceHiding()`** (`js/app.js`, après `setupToolbarOverflow`) : `matchMedia('(max-width: 768px)')` pilote un style inline. Mobile → `#ctrlSource.style.display='none'`, pastille `''` (CSS reprend). Desktop → `#ctrlSource` inline retiré (`''`), pastille `'none'`. Listener `change` (avec fallback `addListener` pour Safari < 14) pour la rotation portrait↔paysage. Adapté en **méthode** de l'objet `App` (le codebase n'a pas de fonctions standalone) vs le snippet du prompt — même logique.
- [x] **Appel dans `init()`** après `this.setupToolbarOverflow()`.
- [x] **Pourquoi ça tient** : si la règle CSS `!important` n'est pas appliquée (cache/rendu WebKit), le style inline `display:none` masque quand même `#ctrlSource` — aucune autre règle ne le ré-affiche.
- [x] **Conformité** : zéro `innerHTML`/donnée externe ; ne touche que `display` → neutre dark mode.
- [x] **Synchro `site/`** : `js/app.js` → `site/js/app.js` (`node --check` OK sur les deux).
- _Reste à valider_ : test device réel (vider cache Safari) — pas de navigateur en env de dev.

### Fait — C6 : toolbar overflow cassé par flex-end (26/05/2026)
Diagnostic (lecture seule) `tasks/RAPPORT_DIAGNOSTIC_C6_TOOLBAR_MOBILE_v1.md` → correctif `tasks/RAPPORT_CORRECTIF_C6_TOOLBAR_OVERFLOW_v1.md`. Cause racine **unique** des symptômes toolbar mobile.
- [x] **Cause racine** : `.header-right { justify-content: flex-end }` (`css/style.css:2278`) faisait déborder le contenu vers la **gauche** en LTR. `scrollWidth` ne mesurant pas l'overflow côté start, la condition `scrollWidth > clientWidth` de `relayout()` (`app.js:1248`) restait **toujours fausse** → `moved=0` → aucun contrôle déplacé dans le menu (S1). Les éléments débordant à gauche se peignaient par-dessus le logo (S2, `#sourcePastille` 1ᵉʳ enfant visible). S3 (clic pastille → menu) = comportement voulu C1, non touché.
- [x] **Fix Option A (CSS, zéro JS)** : retrait de `justify-content: flex-end` + spacer `.header-right::before { content:''; flex:1 1 0 }`. Le spacer pousse les contrôles à droite quand tout tient, et se réduit à 0 au débordement → overflow vers la **droite** → `scrollWidth` redevient fiable → `relayout()` déplace enfin les contrôles. Spacer non ciblé par `.header-right > * { flex-shrink:0 }` (pseudo-élément non matché par le combinateur enfant).
- [x] **Bonus** : `.update-time` → `display:none` en mobile (libère l'espace de `.header-left` qui ne rétrécit pas).
- [x] **Scope** : les 2 modifs sont dans `@media (max-width:768px)` → desktop intact (alignement via `.header { justify-content: space-between }`). Neutre dark mode (layout only). Accolades CSS équilibrées (622/622).
- [x] **Synchro `site/`** : `css/style.css` → `site/css/style.css`.
- [x] **✅ Validé device** (iPhone 14, 27/05/2026) : toolbar correcte en portrait, débordement vers le menu fonctionnel, plus de chevauchement logo. C6 = succès. Repli Option B (mesure JS par somme `offsetWidth`) non nécessaire.

### Fait — C7 : tooltip devise dynamique selon la monnaie active (28/05/2026)
Rapport : `RAPPORT_CORRECTIF_C7_TOOLTIP_DEVISE_v1.md`. Le tooltip ⓘ devise affichait un texte statique (« cours de base en dollars US, convertis selon le taux du jour ») quelle que soit la devise — incohérent quand EUR est sélectionné.
- [x] **Cause racine** : clé i18n unique `tooltip_currency` (`i18n.js`) fixée une seule fois par `applyTranslations()` (`app.js:990`), jamais ré-évaluée au changement de devise. Le tooltip était déjà traduit FR/EN mais pas piloté par `App.state.currency`.
- [x] **i18n** : `tooltip_currency` scindée en `tooltip_currency_usd` (« Les cours sont en dollars US (devise de référence des marchés) ») et `tooltip_currency_eur` (« Les cours de base (USD) sont convertis en euros selon le taux du jour »), FR + EN.
- [x] **Helper `App.updateCurrencyTooltip()`** (`app.js`, entre `updateLangButton` et `applyTranslations`) : choisit la clé selon `state.currency` et pose `#tooltipCurrencyText.textContent`. Appelé (a) à l'init et au changement de langue via `applyTranslations()` (remplace l'ancien set statique), (b) dans le handler de clic `.currency-btn` après mise à jour de `state.currency` → MAJ immédiate sans rechargement, devise ET langue prises en compte.
- [x] **`index.html:73`** : fallback statique aligné sur la variante USD (devise par défaut).
- [x] **Conformité** : zéro `innerHTML`, `textContent` sur strings internes (i18n) → XSS nul ; aucune modif CSS → dark mode neutre ; desktop + mobile (même `#tooltipCurrencyText`).
- [x] **Vérifs** : `node --check` OK (i18n.js, app.js) ; 0 occurrence résiduelle de `tooltip_currency` ; synchro `site/` (`index.html`, `js/i18n.js`, `js/app.js`) confirmée par `diff -q`.
- _Reste à valider_ : test device réel (tap ⓘ devise + bascule USD↔EUR et FR↔EN) — pas de navigateur en env de dev.

### Fait — C8 : panneau « Contexte géopolitique » toujours vide (28/05/2026)
Diagnostic lecture seule `RAPPORT_DIAGNOSTIC_C8_CONTEXTE_GEOPOLITIQUE_v1.md` (6 inspections + tests live `curl`) → correctif `RAPPORT_CORRECTIF_C8_CONTEXTE_GEOPOLITIQUE_v1.md`. Tout dans `js/news.js` (le prompt situait à tort `NEWS_KEYWORDS` dans `sources.js`).
- [x] **Cause racine (confirmée live)** : les chaînes `NEWS_KEYWORDS` (`news.js:7-35`) contenaient des `OR` **non parenthésés** (`wheat price OR wheat export OR …`). GDELT DOC 2.0 répond alors **HTTP 200 + texte brut** `Queries containing OR'd terms must be surrounded by ().` → `response.ok` vrai → `response.json()` (`news.js:62`) lève → `catch` (`:98-100`) `console.warn`+`return []` → « Aucune actualité » pour les **24 denrées**.
- [x] **Fix 1a — requêtes restructurées** : pattern **ancre + groupe OR parenthésé** `wheat (price OR export OR harvest OR shortage OR tariff OR crop)` pour les 24 denrées (même groupe OR ; enrichissement par denrée renvoyé à C8-bis). Ancres multi-mots **quotées** en chaînes JS à apostrophes : `"palm oil"`, `"sunflower oil"`, `"soybean oil"`, `"orange juice"`, `"olive oil"`, `"coconut oil"`. Règles GDELT découvertes en test : OR obligatoirement dans `()`, **AND interdit dans `()`** (`Parentheses may only be used around OR'd statements`), phrase exacte = guillemets (mais bigramme `"wheat price"` → 0 résultat, trop strict).
- [x] **Fix 1b — `sort=datedesc` retiré** (`news.js:61`) → tri par pertinence (défaut GDELT). `datedesc` renvoyait le plus récent sans rapport (tech/finance) ; le tri pertinence donne des articles on-topic.
- [x] **Fix 2 — parsing défensif** (`news.js:62→76`) : `response.text()` puis `JSON.parse` dans un try/catch ; sur échec, `console.warn("[GDELT] Réponse non-JSON (HTTP …)", body.substring(0,200))` + `return []`. Catch réseau harmonisé `[GDELT] Erreur réseau`. Le traitement aval (`json.articles`) inchangé. Ne masque plus une erreur de syntaxe derrière un « 0 article » muet.
- [x] **Vérif live (curl, URL finale exacte)** : blé=8, maïs=8, riz=8, `"palm oil"`=7 articles, tous pertinents (autosuffisance blé Égypte, Bayer corn seed, prix riz Égypte, export huile de palme Indonésie). `timespan=3months` confirmé valide. `node --check js/news.js` OK.
- [x] **Sécurité** : `render()` inchangé (échappement `_escapeHtml`/`_safeUrl`, `rel="noopener noreferrer"` préservés). Dark mode neutre (ni CSS ni rendu modifiés). `const`/`let` conservés (style fichier).
- [x] **Synchro `site/`** : `js/news.js` → `site/js/news.js` (`diff -q` identique).
- [x] **Met à jour « État actuel »** : item 1 (fix GDELT) marqué fait, reste C8-bis (mots-clés enrichis, cache/fallback, timespan adaptatif).
- _Reste à valider_ : test runtime navigateur réel (affichage panneau, dark, console) — pas de navigateur en env de dev.
- _Hors périmètre / non touché_ : `parseInt` sans radix (`news.js:84-86`, pré-existant), nom français mono-mot du test GDELT page Sources (`sources.js`).
