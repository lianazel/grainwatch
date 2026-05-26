# todo.md — Refonte UX mobile GrainWatch v0.8.2 → v0.9.0

> Plan de référence (Phase 2). Source : `PROMPT_IMPLEMENTATION_MOBILE_UX_v1.md`, après diagnostic `DIAGNOSTIC_MOBILE_v0.8.2.md`.

## Décisions validées (JC, 2026-05-26)
- **Polices** : self-host (Option A) — `.woff2` servis depuis `/fonts`, CSP resserrée.
- **Overflow menu** : **déplacer** les vrais nœuds DOM via ResizeObserver (pas de clonage) → une seule source de vérité, zéro désync d'état.
- **Convention tactile** : `@media (hover: none)` / `(pointer: coarse)`, jamais un breakpoint de largeur (cf. `lessons.md`).

## Écarts assumés vs prompt (réconciliation spec ↔ code réel)
1. Sélecteurs réels : `.selector-with-tooltip` + `.tooltip-bubble` (source/devise/période) et `.trend-tooltip` dans `.indicator-card-trend` — **pas** de `[data-tooltip]`.
2. Toolbar réel = `.header-right` (pas `.topbar-controls`).
3. Footer disclaimer = `.footer p` (pas `.footer-disclaimer`).
4. **ⓘ = vrai `<button>`** focusable (pas un `::after`) — requis pour satisfaire les exigences a11y du prompt lui-même (aria-label + focus clavier).
5. ⓘ déclenche le tooltip sur les sélecteurs **fonctionnels** (source/devise/période) pour ne pas détourner le tap des boutons internes ; la carte tendance reste tappable en entier.
6. `APP_VERSION` constante unique (footer + menu À propos), remplace le `v0.8.2` codé en dur.

---

## Feature 1 — Tooltips tactiles + indicateur ⓘ ✅
Fichiers : `index.html`, `css/style.css`, `js/app.js`, `js/i18n.js`
- [x] Markup : `<button class="tooltip-info" aria-controls aria-expanded data-i18n-aria>ⓘ</button>` ajouté aux 4 triggers (source/devise/période + carte tendance). `role="tooltip"` sur les 4 bulles.
- [x] CSS : 2 blocs `display:none !important` (largeur) supprimés. ⓘ visible **uniquement** sous `@media (hover:none)`. Bulle révélée via `:hover` (souris) OU `.tooltip-open` (tap). Clamp largeur anti-débordement sous hover:none (pas de repositionnement JS — ancrage gauche/droite existant + max-width suffisent).
- [x] JS `_initTouchTooltips()` (délégation document, robuste aux nœuds déplacés par F2) : tap ⓘ → toggle `.tooltip-open` ; un seul ouvert ; tap ailleurs / Escape ferme ; `aria-expanded` sync. Zéro `innerHTML`.
- [x] `applyTranslations()` étendu : gère `[data-i18n-aria]` (label ⓘ traduit au switch FR/EN). i18n : clé `tooltip_info_label`.
- [x] Desktop inchangé (ⓘ masqué, hover conservé). JS validé `node --check`, CSS équilibré.

## Feature 2 — Menu hamburger + overflow (déplacement de nœuds) ✅
Fichiers : `index.html`, `css/style.css`, `js/app.js`, `js/i18n.js`
- [x] Markup : `#menuToggle` (SVG 3 barres + `#menuBadge`) en dernier dans `.header-right` ; `.menu-overlay` + `.menu-panel` (`role="dialog"`, `aria-modal`, `aria-label`) avant le footer. 3 sections : **Réglages** (cible overflow `#menuSettings`), **Sources** (4 lignes + statut + « En savoir plus » → `SourcesPage.open()`), **À propos** (version + texte + disclaimer + « pas de cookies/tracking »).
- [x] CSS : slide-in `translateX` 0.3s ease-out, `width:min(320px,85vw)`, `100dvh`, scroll interne. Overlay `rgba(0,0,0,.5)` fade. z-index overlay 1100 / panel 1101. Couleurs via variables → dark mode auto. `body.menu-open { overflow:hidden }`.
- [x] JS `_initMenu/openMenu/closeMenu` : toggle/overlay/Escape, `aria-expanded`/`aria-hidden` sync, **focus trap** (`_trapMenuFocus`) + restauration focus, lock scroll.
- [x] `setupToolbarOverflow()` : ResizeObserver sur `.header-right` (rAF-debounce), **déplace** les nœuds (reset→re-distribue, pas de clone) dans `#menuSettings` avec label i18n, les **ramène** au resize. Ordre de retrait : refresh→alerts→thème→langue→devise→source. Protégés : logo + ☰. Badge = compteur. Section Réglages masquée si vide.
- [x] Header mobile réécrit : `nowrap` + `min-width:0` + `flex-shrink:0` sur enfants (suppression du wrap 2-lignes/`order`).
- [x] i18n : 18 clés `menu_*` + `menu_label_*` (FR/EN). `data-i18n-aria` géré dans `applyTranslations`.
- _Écarts notés_ : (a) ☰ ne se transforme PAS en ✕ (l'overlay couvre le toggle → fermeture via ✕ du panneau / overlay / Escape) ; (b) section Réglages placée en 1er (contrôles = partie la plus utilisée) ; (c) refresh/alerts atterrissent aussi dans Réglages (conséquence de l'overflow priorisé), labellisés.

## Feature 3 — Footer allégé mobile ✅
Fichiers : `css/style.css`, `index.html`
- [x] `@media (max-width:768px)` : `.footer p { display:none }`, `.footer-version` seul (centré, .75rem, blé, opacity .6), `.footer` padding 4px 0. Desktop inchangé.
- [x] Disclaimer déplacé dans le menu À propos (F2).
- [x] Version → `v0.9.0` via constante `APP_VERSION` (footer + menu via `_setVersions()`), fallback HTML statique `v0.9.0`.

## Feature 4 — Self-host polices + CSP ✅
Fichiers : `index.html` (head + CSP meta), `vercel.json` (CSP header), `css/style.css` (@font-face), `fonts/` (nouveau)
- [x] Réseau OK. Téléchargé 4 `.woff2` (Inter + JetBrains Mono sont variables → 1 fichier/subset couvre tous les poids), latin + latin-ext. Validés `wOF2`, 176K total.
- [x] 12 `@font-face` (4×latin/ext Inter 400-700 + 2×JetBrains 400/500) en tête de `style.css`, `font-display: swap`, `src: ../fonts/…`. Variables inchangées.
- [x] `index.html` : 2 `<link>` Google Fonts supprimés. CSP meta : `style-src 'self' 'unsafe-inline'`, `font-src 'self'`.
- [x] `vercel.json` : mêmes edits CSP. `'unsafe-inline'` conservé.
- [x] Vérifié : zéro réf `fonts.googleapis`/`fonts.gstatic` restante ; noms fichiers CSS ↔ disque OK.

## Finitions
- [x] Synchro `site/` : `index.html`, `css/style.css`, `js/app.js`, `js/i18n.js`, `fonts/` (4 woff2). Vérifié identique au root.
- [x] Bump v0.9.0 : footer/menu, table versions CLAUDE.md, CHANGELOG.md (entrée 0.9.0), section « Suivi du projet », CSP documentée mise à jour.
- [x] `tasks/RAPPORT_IMPLEMENTATION_MOBILE_UX_v1.md`.

## Tests (manuels — à valider par JC sur device)
- [ ] Desktop Chrome/Firefox : aucun changement (hover, footer complet, ☰ accessible).
- [ ] iPhone Safari : tooltips au tap, menu, footer réduit.
- [ ] Android Chrome / iPad 768px : idem + breakpoint.
- [ ] Clavier : Tab dans le menu, Escape, focus trap.
- [ ] Mode sombre : menu respecte le thème.

## Commits
À ne faire **que sur demande de JC** (sous-commits suggérés dans le prompt + rapport).

---
## Review
**Statut : code complet (F1-F4), vérif statique OK, runtime/device à valider par JC.**

- **Fait** : 4 features implémentées + synchro `site/` + docs (CHANGELOG, CLAUDE.md, rapport).
- **Vérif statique** : `node --check` OK (app.js, i18n.js) ; accolades CSS 609/609 ; 16/16 IDs référencés présents ; 0 réf Google Fonts ; site/ identique.
- **Non vérifié** : comportement runtime (pas de navigateur headless dans l'env) → liste de tests device ci-dessus pour JC.
- **Écarts assumés vs prompt** (détaillés dans le rapport) : ⓘ = vrai bouton (a11y) ; pas de morph ☰→✕ (overlay couvre le toggle) ; section Réglages en 1er ; refresh/alertes co-localisés dans Réglages via l'overflow priorisé.
- **Dette connue (hors scope)** : `'unsafe-inline'` CSP (style/script) conservé ; tooltips déplacés dans le menu peuvent déborder légèrement le panneau (cosmétique, dans le viewport).
- **Auto-review — leçon candidate** : voir message à JC (déplacement de nœuds vs clonage pour contrôles à état).
