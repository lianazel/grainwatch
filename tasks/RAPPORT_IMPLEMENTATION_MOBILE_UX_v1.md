# Rapport d'implémentation — Refonte UX mobile GrainWatch

**Version** : 0.8.2 → **0.9.0**
**Date** : 26/05/2026
**Source** : `PROMPT_IMPLEMENTATION_MOBILE_UX_v1.md` (Phase 2), après `DIAGNOSTIC_MOBILE_v0.8.2.md`
**Décisions JC** : polices **self-host** ; overflow menu par **déplacement de nœuds** (pas de clone).

---

## Résumé

Les 4 features du prompt sont implémentées. Aucune dépendance ajoutée, aucune clé localStorage nouvelle, zéro `innerHTML` avec données dynamiques. Convention actée : tout comportement tactile est ciblé par `@media (hover: none)` / `(pointer: coarse)`, jamais par un breakpoint de largeur (`tasks/lessons.md`).

Fichiers touchés : `index.html`, `css/style.css`, `js/app.js`, `js/i18n.js`, `vercel.json`, nouveau dossier `fonts/` (4 `.woff2`), + miroir `site/`.

---

## Feature 1 — Tooltips tactiles + indicateur ⓘ

**Problème (diagnostic)** : les bulles d'aide (source/devise/période) et la tendance n'étaient accessibles qu'au survol et étaient même masquées sur mobile (`display:none !important`). Aucun fallback tactile.

**Implémenté** :
- Markup (`index.html`) : un `<button class="tooltip-info" aria-controls="…" aria-expanded="false" data-i18n-aria="tooltip_info_label">ⓘ</button>` ajouté aux 4 triggers (`#ctrlSource`, `#ctrlCurrency`, période, carte tendance). `role="tooltip"` ajouté aux 4 bulles.
- CSS (`css/style.css`) :
  - ⓘ masqué par défaut ; visible **uniquement** sous `@media (hover: none)` (cercle 18px, blé, ancré en haut-droite du trigger).
  - Bulle révélée par `.selector-with-tooltip:hover` **OU** `.selector-with-tooltip.tooltip-open` ; idem `.indicator-card-trend`.
  - Suppression des 2 blocs `display:none !important` (masquage par largeur).
  - Anti-débordement : `max-width: min(320px, calc(100vw - 24px))` sous hover:none (l'ancrage gauche/droite existant suffit, pas de repositionnement JS).
- JS (`js/app.js` `_initTouchTooltips()`) : délégation `click` sur `document` → tap ⓘ bascule `.tooltip-open` ; un seul ouvert ; tap extérieur / Escape ferme ; `aria-expanded` synchronisé. Délégation = robuste aux ⓘ **déplacés dans le menu** par F2.
- i18n : `tooltip_info_label` (FR « Afficher l'aide » / EN « Show help ») ; `applyTranslations()` étendu pour traiter `[data-i18n-aria]`.

**Sécurité** : contenu = texte DOM déjà présent, aucun `innerHTML`.

**Écart vs prompt** : le prompt proposait un `::after` pour le ⓘ ; un **vrai `<button>`** a été retenu car un pseudo-élément ne peut être ni focusable ni porteur d'`aria-label` — or le prompt exige les deux (focus clavier + `aria-label`). Le ⓘ déclenche la bulle sur les sélecteurs **fonctionnels** (pour ne pas détourner le tap des boutons source/devise) ; la carte tendance reste tappable.

---

## Feature 2 — Menu hamburger + débordement de la barre d'outils

**Implémenté** :
- Markup : `#menuToggle` (SVG 3 barres + `#menuBadge`) en dernier dans `.header-right` ; `#menuOverlay` + `#menuPanel` (`role="dialog"`, `aria-modal="true"`, `aria-label`) avant le footer. Sections : **Réglages** (`#menuSettings`, cible d'overflow), **Sources de données** (4 lignes + statut + « En savoir plus » → `SourcesPage.open()`), **À propos** (version, texte, disclaimer, « pas de cookies/tracking »).
- CSS : panneau `position:fixed`, `width:min(320px,85vw)`, `100dvh`, slide-in `transform: translateX` 0.3s ease-out ; overlay `rgba(0,0,0,.5)` en fondu ; z-index overlay **1100** / panel **1101** (au-dessus du header 100 ; toasts 2000 restent au-dessus). Couleurs via variables sémantiques → **dark mode automatique**. `body.menu-open { overflow:hidden }`.
- JS (`js/app.js`) :
  - `_initMenu / openMenu / closeMenu` : ouverture (toggle), fermeture (✕, overlay, Escape), `aria-expanded`/`aria-hidden` synchronisés, **focus trap** (`_trapMenuFocus`), restauration du focus sur le déclencheur, verrou de défilement.
  - `setupToolbarOverflow()` : `ResizeObserver` sur `.header-right` (debounce `requestAnimationFrame`). Stratégie **reset → redistribue** : tous les contrôles reviennent dans la barre (ordre d'origine), puis on déplace vers le menu tant que `scrollWidth > clientWidth`, dans l'ordre de priorité **refresh → alertes → thème → langue → devise → source**. Chaque contrôle déplacé est encapsulé dans une ligne labellisée (`menu_label_*`). Protégés : logo + ☰. Badge = nombre déplacé ; section Réglages masquée si vide.
  - Déplacement de **nœuds réels** (pas de clone) → les écouteurs (thème, langue, devise, alertes, refresh) restent attachés, **aucune désync d'état**.
- Header mobile réécrit : `flex-wrap: nowrap` + `min-width:0` + `flex-shrink:0` sur les enfants (remplace l'ancien wrap 2-lignes / `order`).
- i18n : `menu_title`, `menu_open_label`, `menu_close_label`, `menu_settings`, `menu_sources`, `menu_status_online/always`, `menu_sources_more`, `menu_about`, `menu_about_text`, `menu_no_tracking`, `menu_label_{source,currency,lang,theme,alerts,refresh}`.

**Sécurité** : panneau construit en HTML statique ; lignes de réglage créées via `createElement`/`textContent` ; aucune ressource externe.

**Écarts vs prompt (assumés)** :
1. **Pas de morph ☰→✕** sur le toggle : l'overlay couvre le header donc le toggle n'est plus cliquable une fois ouvert → fermeture via le ✕ du panneau / overlay / Escape (UX standard).
2. **Section Réglages placée en premier** (et non en dernier) : c'est la partie la plus utilisée (devise/langue/thème déplacés y vivent).
3. **refresh + alertes** atterrissent aussi dans Réglages (conséquence de l'overflow priorisé du prompt) — labellisés « Rafraîchir » / « Alertes ».

---

## Feature 3 — Footer allégé sur mobile

- `@media (max-width: 768px)` : `.footer p { display:none }` (disclaimer désormais dans le menu À propos), `.footer-version` seul (centré, `0.75rem`, blé, `opacity:.6`), `.footer { padding: 4px 0 }`. Desktop **inchangé**.
- Version `v0.9.0` via constante unique `APP_VERSION` (`_setVersions()` met à jour footer + menu) ; fallback statique `v0.9.0` dans le HTML.

---

## Feature 4 — Polices auto-hébergées + CSP

- 4 fichiers `.woff2` téléchargés dans `/fonts` : Inter (latin, latin-ext) et JetBrains Mono (latin, latin-ext). Ces polices sont **variables** → un seul fichier par subset couvre tous les poids (400/500/600/700 et 400/500). Total **176 Ko**, magic bytes `wOF2` vérifiés.
- `@font-face` (12 règles, `font-display: swap`, `unicode-range` préservé) en tête de `css/style.css`. Variables `--font`/`--font-mono` inchangées.
- `index.html` : suppression des 2 `<link>` Google Fonts (preconnect + css2).
- **CSP resserrée** (meta `index.html` **et** header `vercel.json`) : `style-src 'self' 'unsafe-inline'` (retrait `fonts.googleapis.com`), `font-src 'self'` (retrait `fonts.gstatic.com`). Vérifié : zéro référence Google Fonts restante.

**Bénéfice sécurité** : suppression d'une dépendance CDN tierce → surface d'attaque réduite, conforme aux règles supply-chain. `'unsafe-inline'` conservé (styles inline existants — dette connue, hors scope).

**Note SRI** : non applicable au CSS Google Fonts (variable selon user-agent) — le self-host rend le point caduc (fichiers servis en `'self'`, intégrité garantie par l'origine).

---

## Vérification

| Vérif | Résultat |
|---|---|
| `node --check js/app.js`, `js/i18n.js` | ✅ OK |
| Accolades CSS équilibrées | ✅ 609/609 |
| 4 ⓘ + 4 `role="tooltip"` dans `index.html` | ✅ |
| Tous les IDs référencés par le JS présents dans le markup | ✅ (16/16) |
| Zéro réf `fonts.googleapis`/`fonts.gstatic` (root + site) | ✅ |
| Noms `@font-face` ↔ fichiers `/fonts` | ✅ |
| `site/` identique au root (4 fichiers) + `site/fonts/` | ✅ |

**Tests runtime / device — à réaliser par JC** (aucun navigateur headless dans l'env de dev) :
1. Desktop Chrome/Firefox : hover tooltips intacts, footer complet, ☰ ouvre un menu avec Sources + À propos (Réglages vide → section masquée).
2. iPhone Safari : ⓘ visibles, tap ouvre/ferme la bulle, menu coulissant, contrôles déplacés dans Réglages, footer réduit.
3. Android Chrome / iPad : idem + vérifier le seuil de débordement.
4. Clavier : Tab piégé dans le menu, Escape ferme, focus restauré sur ☰.
5. Mode sombre : panneau et bulles lisibles.
6. Rotation portrait↔paysage : le `ResizeObserver` redistribue correctement.

---

## Commits suggérés (à faire sur demande JC)
```
security: self-host fonts (Inter, JetBrains Mono) + CSP font-src 'self'
feat: tooltips tactiles tap-to-show avec indicateur ⓘ (@media hover:none)
feat: menu hamburger + débordement auto de la barre d'outils (ResizeObserver, déplacement de nœuds)
refactor: footer allégé sur mobile — disclaimer déplacé dans le menu À propos
```
