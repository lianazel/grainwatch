# Changelog

Tous les changements notables de ce projet sont documentés ici.

Le format est inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet suit le [Semantic Versioning](https://semver.org/lang/fr/).

---

## [0.9.0] - 2026-05-26

### Added
- **Tooltips tactiles** : sur appareil sans survol (`@media (hover: none)`), un indicateur ⓘ tappable révèle les bulles d'aide (source, devise, période, tendance) auparavant inaccessibles au tactile. Un seul ouvert à la fois, fermeture au tap extérieur / Escape. Bouton ⓘ focusable (`role="tooltip"`, `aria-controls`/`aria-expanded`, `aria-label` traduit via `data-i18n-aria`)
- **Menu hamburger** (`#menuToggle`) : panneau latéral coulissant (`role="dialog"`, `aria-modal`, focus trap, Escape, verrou de défilement) avec 3 sections — Réglages, Sources de données (statut + lien vers la page Sources), À propos (version, disclaimer, mention « pas de cookies / pas de tracking »)
- **Débordement automatique de la barre d'outils** : un `ResizeObserver` déplace les contrôles excédentaires (refresh → alertes → thème → langue → devise → source) dans le menu quand l'espace manque, et les ramène au redimensionnement. Déplacement de nœuds réels (pas de clonage) → une seule source de vérité. Badge compteur sur l'icône menu
- **Polices auto-hébergées** : Inter + JetBrains Mono servies en `.woff2` depuis `/fonts` (subsets latin + latin-ext), suppression de la dépendance Google Fonts
- 19 clés i18n FR/EN (`tooltip_info_label`, `menu_*`, `menu_label_*`)

### Changed
- **CSP resserrée** : `font-src 'self'` et retrait de `fonts.googleapis.com`/`fonts.gstatic.com` (meta `index.html` + header `vercel.json`) — plus aucun chargement de police tiers
- **Footer mobile allégé** (`< 769px`) : seul le numéro de version reste (disclaimer déplacé dans le menu À propos)
- **Header mobile** : passage du wrap 2-lignes à une barre une-ligne avec débordement vers le menu
- Détection tactile par feature query `@media (hover: none)` au lieu d'un breakpoint de largeur (convention projet)
- Version affichée : `v0.8.2` → `v0.9.0` (source unique `APP_VERSION`)

### Security
- Suppression d'une dépendance CDN externe (Google Fonts) → surface d'attaque réduite, conforme aux règles supply-chain ; les tooltips tactiles n'utilisent aucun `innerHTML` (texte DOM existant + `textContent`)

---

## [0.8.2] - 2026-05-25

### Added
- Lien inter-app GrainWatch → GrainTrack3D : icône globe cliquable à côté du prix, ouvre GrainTrack3D dans un nouvel onglet avec la denrée pré-sélectionnée (`?grain=<key>`)
- 12 denrées supportées pour le lien GrainTrack3D : `wheat`, `corn`, `rice`, `soybean`, `sugar`, `barley`, `oats`, `sorghum`, `rapeseed`, `groundnut`, `lentils`, `millet`
- État désactivé de l'icône globe pour les 14 denrées non couvertes par GrainTrack3D (café, cacao, coton, tournesol, huile de palme, huile de soja, caoutchouc, thé, jus d'orange, banane, huile d'olive, huile de coco, laine, tabac) : icône grisée + barre diagonale superposée + tooltip explicatif
- Traductions i18n FR/EN pour les tooltips GrainTrack3D : `graintrack3d_tooltip` (état actif) et `graintrack3d_tooltip_disabled` (état désactivé)
- Attribut `aria-disabled` sur l'icône en état désactivé pour les lecteurs d'écran
- `tasks/RAPPORT_LINK_GRAINTRACK3D_v1.md` : rapport détaillé Phase 0 + mapping commodités + sécurité + 10 tests manuels

### Fixed
- Visibilité de l'icône globe en mode clair et mode sombre — cause racine : le bloc CSS `.graintrack3d-link` du commit initial était piégé à l'intérieur d'un `@media (max-width: 768px)` (accolade fermante mal placée), donc inopérant sur desktop. Bloc CSS extrait du media query + background discret au repos + `stroke-width: 2.2` + override dark mode dédié (`var(--terracotta-light)` plus lumineux)
- Unité du sucre corrigée : `c/kg` → `¢/kg` (symbole cent Unicode U+00A2) — appliqué aux 7 denrées concernées (sugar, coffee, cotton, rubber, tea, orange, wool) dans `js/commodities.js`. La conversion EUR continue de produire `ct/kg` (centimes d'euro) via le `.replace("¢/", "ct/")` mis à jour dans `js/app.js:409`
- Lisibilité des tooltips en mode sombre — `.tooltip-bubble` utilisait `background: var(--black)` qui en dark mode vaut `#E8E4DB` (cream), rendant le tooltip invisible. Override `[data-theme="dark"]` dédié : fond `var(--grey-light)` (#333355), texte `#F5F0E5` (ratio contraste ~10:1, WCAG AA), bord subtil `rgba(255,255,255,0.10)` + shadow renforcée. Couvre `.tooltip-bubble`, `.tooltip-arrow` et `.trend-tooltip`

### Changed
- Version affichée dans le footer : `v0.8.1` → `v0.8.2`

---

## [0.8.1] - 2026-05-21

### Security
- **XSS GDELT** : validation et échappement de l'URL via `_safeUrl()` (whitelist http/https, bloque `javascript:`/`data:`), ajout `rel="noopener noreferrer"` (`js/news.js`)
- **Meta CSP** ajoutée dans `index.html` (default-src 'self', script/style/connect/font/img whitelistés, base-uri/form-action self, frame-ancestors none)
- **SRI** SHA-384 sur Chart.js 4.4.7 et chartjs-adapter-date-fns 3.0.0 + `crossorigin="anonymous"`
- **XSS `sources.js:205`** : `error.message` rendu via `textContent` au lieu de `innerHTML`
- **XSS GDELT domain** (`js/news.js:135`) : `${a.domain}` passé via `_escapeHtml()`
- **Validation inputs alertes** (`js/alerts.js:_createAlert()`) : whitelist `type` (`above`/`below`/`var_up`/`var_down`), vérification `commodityId ∈ ALL_COMMODITIES`, borne haute `value ≤ 1_000_000`
- **Désérialisation localStorage défensive** : `alerts.js`, `app.js loadFavorites/loadVisibleCommodities/_initTheme` — validation `Array.isArray` + filtres typés + whitelist
- **Radix 10** explicite sur tous les `parseInt` (4 dans `app.js`, 4 dans `export.js`, 2 dataset)
- **Filtrage `console.*`** : 5 objets `Error` entiers remplacés par `.message` (`api.js`, `app.js`, `export.js`)
- **XSS innerHTML §5** : refactor `alerts.js:333` (historique) et `app.js:484` (source badge) en `createElement` + `textContent`, whitelist http(s) sur `info.url` avant `a.href`

### Added
- `vercel.json` avec 6 headers de sécurité (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options, Cross-Origin-Opener-Policy) — scoring securityheaders.com visé **A+**

---

## [0.8.0] - 2026-05-07

### Added
- Mode sombre complet : détection OS automatique + toggle manuel + persistance localStorage
- Alertes V2 : historique cliquable, détection de doublons, pré-remplissage
- Responsive mobile : header 2 lignes, bouton rafraîchir icône seule, fix iOS touchend
- Panneau géopolitique GDELT

---

## [0.7.x] - antérieur

### Added
- Structure initiale du projet (HTML/CSS/JS, 10 modules)
- Intégration Chart.js pour les graphiques
- Système d'alertes V1
- Déploiement GitHub Pages fonctionnel
