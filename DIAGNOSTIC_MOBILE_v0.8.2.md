# Diagnostic Mobile — GrainWatch v0.8.2

> **Type** : Diagnostic Phase 1 — audit pur, **aucune modification de code**.
> **Périmètre** : `index.html`, `css/style.css`, `js/*.js` (le sous-dossier `site/` — miroir de déploiement GitHub Pages — est exclu pour éviter les doublons).
> **Cible de test** : iPhone 14 / Safari (viewport ~390 × 664 px CSS).
> **Date** : 26/05/2026.

---

## Résumé exécutif

GrainWatch est correctement structuré pour le mobile sur les fondamentaux (meta viewport sain qui n'interdit pas le zoom, breakpoints à 1024 / 768 / 380 px, système à deux vues sidebar↔détail, cibles tactiles à 44 px sur l'essentiel, posture de sécurité forte). **Mais deux problèmes d'UX tactile sont confirmés et structurels :**

1. **Tooltips inaccessibles au tactile.** Toute l'information contextuelle passe par du `:hover` CSS et des attributs `title=""` natifs — deux mécanismes qui n'existent pas sur écran tactile. Pire : le projet **masque explicitement** les bulles d'aide sur mobile (`display: none !important`, lignes 2121 et 2315) **sans aucun fallback** (tap/click). Sur mobile, l'utilisateur perd définitivement les explications « D'où viennent les prix ? », « Quelle devise ? », « Quelle période ? » et la méthode de calcul de tendance. Il n'existe **aucune** détection tactile par feature query (`@media (hover: none)` / `pointer: coarse`) — seul un proxy `max-width: 768px` tient lieu de détection.

2. **Footer surdimensionné en hauteur.** Le footer est en flux normal (ni fixe ni sticky), avec un disclaimer de ~60-70 caractères qui se replie sur 2-3 lignes + une ligne de version. Hauteur estimée **90-100 px**, soit **~14-15 %** du viewport iPhone 14, hors zone graphique utile — ce qui contribue à comprimer le contenu central.

Le reste du diagnostic confirme une bonne hygiène de sécurité (SRI sur les CDN, CSP cohérente meta + `vercel.json`, zéro lib d'icônes externe) et identifie quelques zones de risque secondaires (boutons source/devise < 44 px à 380 px, absence de règle < 380 px et de mode paysage).

**Classement de priorité (détaillé en fin de rapport) :**
- **P0** — Fallback tactile pour les tooltips d'information (perte d'info réelle).
- **P1** — Compactage du footer sur mobile (gain d'espace graphique).
- **P2** — Cibles tactiles boutons source/devise à 380 px ; introduire des feature queries `hover`/`pointer`.
- **P3** — Mode paysage, breakpoint < 360 px, `prefers-reduced-motion`.

---

## Axe 1 — Tooltips et hover

### Éléments identifiés

GrainWatch utilise **trois** mécanismes de tooltip, tous dépendants du survol :
- **A.** Bulles CSS custom `.tooltip-bubble` révélées par `:hover` (information contextuelle riche).
- **B.** Tooltip de tendance `.trend-tooltip` révélé par `:hover` (méthodologie de calcul).
- **C.** Attributs `title=""` natifs du navigateur (10 occurrences) — n'apparaissent qu'au survol desktop, comportement tactile incohérent (long-press selon navigateur).
- **D.** Tooltip Chart.js intégré (le seul partiellement tactile).

| Fichier | Ligne(s) | Mécanisme | Contenu du tooltip | Tactile ? |
|---|---|---|---|---|
| `css/style.css` | 1034-1056 + 1100-1103 | CSS `:hover` → `opacity`/`visibility` sur `.tooltip-bubble` | Dynamique (texte i18n riche : source, devise, période) | ❌ Non — **masqué** sur mobile |
| `css/style.css` | 921-945 | CSS `:hover` → `display` sur `.trend-tooltip` | Statique i18n (méthode régression linéaire) | ❌ Non |
| `index.html` | 51 | `title="Banque Mondiale"` | Statique | ❌ Non (natif) |
| `index.html` | 54 | `title="USDA"` | Statique | ❌ Non (natif) |
| `index.html` | 57 | `title="Données simulées"` | Statique | ❌ Non (natif) |
| `index.html` | 77 | `title="Mode sombre / clair"` (toggle thème) | Statique | ❌ Non (natif) |
| `index.html` | 82 | `title="Français / English"` (toggle langue) | Statique | ❌ Non (natif) |
| `index.html` | 88 | `title="Alertes"` (cloche) | Statique | ❌ Non (natif) |
| `index.html` | 96 | `title="Rafraîchir les données"` | Statique | ❌ Non (natif) |
| `index.html` | 119 | `title="Personnaliser les denrées affichées"` | Statique | ❌ Non (natif) |
| `index.html` | 173-187 | `title` dynamique (lien GrainTrack3D) | Dynamique i18n (actif/désactivé) | ❌ Non (natif) |
| `index.html` | 281 | `title="Ouvrir la page d'export"` | Statique | ❌ Non (natif) |
| `js/app.js` | 409, 415 | Affectation JS de `title` sur `#graintrack3d-link` | `graintrack3d_tooltip` / `graintrack3d_tooltip_disabled` | ❌ Non (natif) |
| `js/chart.js` | 67-86 | Tooltip Chart.js intégré (`options.plugins.tooltip`) | Dynamique (date formatée + prix avec devise) | ⚠️ Partiel |
| `css/style.css` | 2120-2122 | `display: none !important` sur `.selector-with-tooltip .tooltip-bubble` | — (masque sur mobile) | N/A |
| `css/style.css` | 2314-2316 | `display: none !important` sur `.tooltip-bubble` (global) | — (masque sur mobile) | N/A |

> **Note** : les très nombreux `:hover` purement décoratifs (changement de couleur/fond/scale sur boutons `.currency-btn`, `.refresh-btn`, `.lang-toggle`, `.tab-btn`, `.commodity-item`, `.period-btn`, etc.) ne sont **pas** listés : ils ne révèlent aucune information, juste un feedback visuel. Leur perte au tactile est sans conséquence.

#### Snippet A — Bulle d'aide custom (information contextuelle)

```css
/* css/style.css:1034 */
.tooltip-bubble {
  position: absolute;
  top: calc(100% + 10px);
  /* ... */
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s, visibility 0.25s;
  pointer-events: none;
}
/* css/style.css:1100 — révélation au survol UNIQUEMENT */
.selector-with-tooltip:hover .tooltip-bubble {
  opacity: 1;
  visibility: visible;
}
```

Contenu réel de ces bulles (HTML statique + i18n) :
- Sélecteur **Source** (`index.html` ~45-49) : « D'où viennent les prix ? Choisissez l'organisme international… »
- Sélecteur **Devise** (`index.html` ~65-69) : « Devise d'affichage. Les cours de base sont en dollars US… »
- Sélecteur **Période** (`index.html` ~196-200) : « Fenêtre temporelle du graphique. Plus la période est longue… »

#### Snippet B — Tooltip de tendance

```css
/* css/style.css:921 */
.trend-tooltip {
  display: none;           /* caché par défaut */
  position: absolute;
  bottom: calc(100% + 8px);
  /* ... bordure olive, largeur 280px ... */
}
/* css/style.css:944 */
.indicator-card-trend:hover .trend-tooltip {
  display: block;          /* révélé au survol */
}
```
Contenu : « Calculée par régression linéaire sur l'ensemble de la période… » — **information méthodologique réellement perdue au tactile** (pas de fallback, et pas de masquage explicite non plus, donc comportement indéterminé).

#### Snippet D — Tooltip Chart.js (le seul partiellement tactile)

```javascript
/* js/chart.js:67 */
tooltip: {
  backgroundColor: dark ? '#333355' : '#2C2C2C',
  /* ... */
  callbacks: {
    title: function(items) { /* date localisée FR/EN */ },
    label: function(item) { return currencySymbol + item.formattedValue; },
  },
}
```
Chart.js v4.4.7 gère le `touch` via `interaction.mode: 'index'` (`js/chart.js:62`), mais l'apparition de la bulle sur tap reste dépendante du navigateur/device — d'où le **partiel**.

### Détection tactile existante

**OUI, mais incomplète et indirecte.** La seule détection est un proxy de **largeur de viewport**, pas de capacité tactile réelle :

```javascript
/* js/app.js:990 */
_isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}
```

Côté CSS, le masquage des tooltips repose lui aussi sur `@media (max-width: 768px)` (commentaires explicites lignes 2119 « Hide tooltips completely on mobile (touch != hover) » et 2313).

**Absents (vérifié par grep, zéro occurrence) :**
- ❌ `@media (hover: none)` / `@media (hover: hover)`
- ❌ `@media (pointer: coarse)` / `@media (pointer: fine)`
- ❌ `navigator.maxTouchPoints`
- ❌ `'ontouchstart' in window`
- ❌ user-agent sniffing

**Conséquence** : une tablette tactile large (> 768 px, ex. iPad en paysage) est traitée comme un desktop → tooltips au survol qui n'existent pas. Inversement, un petit écran branché à une souris perd les tooltips alors qu'il pourrait survoler. Le proxy largeur≠tactile est l'angle mort principal.

### Fallback tactile existant

**NON. Aucun.** Vérifié :

```css
/* css/style.css:2120 — aucune alternative tap/click n'est fournie */
.selector-with-tooltip .tooltip-bubble { display: none !important; }
/* css/style.css:2314 */
.tooltip-bubble { display: none !important; }
```

- ❌ Aucun handler `click`/`touchstart`/`touchend` pour révéler une bulle au tap (le seul `touchend` du projet, `js/app.js` ~129, est un contournement clavier iOS pour le date range — sans rapport).
- ❌ Aucune modale/popover de remplacement.
- ❌ Aucun « long-press ».

**Bilan Axe 1** : sur mobile, l'utilisateur ne peut accéder ni aux explications des sélecteurs (source/devise/période), ni à la méthodo de tendance. Les `title=""` natifs sont théoriquement déclenchables au long-press mais le comportement est incohérent entre navigateurs et n'est pas une UX fiable.

---

## Axe 2 — Footer

### Structure actuelle

HTML **100 % statique** (aucune génération JS — confirmé : la chaîne `v0.8.2` et le texte du footer sont introuvables dans `js/*.js` ; seul `data-i18n="disclaimer"` fait varier le texte via i18n) :

```html
<!-- index.html:556 -->
<!-- FOOTER / DISCLAIMER -->
<footer class="footer">
  <p data-i18n="disclaimer">⚠ Cet outil est fourni à titre éducatif uniquement. Il ne constitue en aucun cas un conseil financier ou d'investissement. Les cours affichés proviennent de sources publiques et peuvent présenter un décalage temporel.</p>
  <div class="footer-version">GrainWatch v0.8.2</div>
</footer>
```

Contenu réel :
- **Disclaimer** (ligne 558) : mention « outil éducatif », « sources publiques », « décalage temporel ».
- **Version** (ligne 559) : `GrainWatch v0.8.2` (codée en dur).

> ⚠️ **Écart avec CLAUDE.md** : la mention « Pas de cookies tiers, pas de tracking » et la **page /privacy** exigées par la section RGPD du CLAUDE.md **ne sont PAS présentes dans le footer**. À traiter avec la tâche conformité déjà ouverte (« Implémenter une page /privacy minimaliste et la lier dans le footer »).

CSS de base :

```css
/* css/style.css:1005 */
.footer {
  padding: 12px 24px;
  background: var(--white);
  border-top: 1px solid var(--grey-light);
  text-align: center;
}
.footer p {           /* :1012 */
  font-size: 11px;
  color: var(--grey);
  line-height: 1.6;
}
.footer-version {     /* :1018 */
  margin-top: 6px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--terracotta);
  letter-spacing: 0.5px;
  font-weight: 600;
}
```

**Position** : `static` (flux normal). Le footer n'est **ni `fixed` ni `sticky`**. Le `<body>` est un `display: flex; flex-direction: column`, mais le footer n'a **aucune** propriété `flex-shrink` → il ne peut pas se compresser et occupe toujours sa hauteur naturelle sous la zone `main-layout` (qui, elle, est en `height: calc(100vh - 60px); overflow: hidden` sur mobile, `css/style.css:2081`).

### Comportement responsive

Sur les 8 blocs `@media` du fichier, **un seul** touche le footer :

```css
/* css/style.css, dans @media (max-width: 768px) — bloc principal */
/* :2307 */
.footer {
  padding: 12px 16px;   /* latéral 24px → 16px */
  font-size: 11px;       /* inchangé */
}
```

Dark mode (`css/style.css:2003`) ne modifie que `border-top-color` — aucun impact sur la hauteur.

**Constat clé** : entre desktop et mobile, **seul le padding latéral** est réduit (24→16 px). La taille de police (11 px), l'interligne (1.6) et surtout le **padding vertical (12 px haut/bas)** restent identiques. Le footer n'est jamais compacté en hauteur ni tronqué/condensé sur petit écran.

### Impact sur mobile

Estimation de hauteur rendue sur iPhone 14 / Safari (viewport ~390 × 664 px) :

| Composant | Hauteur estimée | Détail |
|---|---|---|
| Padding haut | 12 px | mobile `12px 16px` |
| Disclaimer (≈ 2,5 lignes à 390 px) | ~44 px | 2,5 × (11 px × 1.6) |
| `margin-top` version | 6 px | `.footer-version` |
| Ligne version | ~15 px | 11 px × ~1.4 |
| Padding bas | 12 px | |
| **Total** | **~89-99 px** | |

→ **~90-100 px**, soit **13,5-15,1 %** du viewport 664 px (et ~15-17 % de la zone utile réelle, ~600 px une fois la chrome Safari déduite).

Comme le footer ne peut pas rétrécir et n'est pas escamotable, ces 90-100 px sont retirés en permanence à la zone graphique. Combiné au header (~60 px) et au graphique forcé à 280 px (`css/style.css:2272`), l'espace vertical devient le facteur limitant en portrait — c'est le mécanisme qui « mange » la zone utile décrit dans le brief.

---

## Axe 3 — Responsive global

### Meta viewport

```html
<!-- index.html:5 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

✅ **Correct et accessible.** `width=device-width` + `initial-scale=1.0`, **sans** `user-scalable=no` ni `maximum-scale=1` → le zoom utilisateur reste autorisé (bon pour l'accessibilité WCAG).

### Breakpoints du projet

Inventaire **complet** des 10 directives `@media` (vérifié par grep) :

| Ligne | Condition | Catégorie | Cible |
|---|---|---|---|
| 55 | `@media (prefers-color-scheme: dark)` | (c) Dark mode | Surcharge des variables CSS `:root` |
| 2007 | `@media (max-width: 768px)` | (a) Largeur | Page **Export** (padding, titre, empilement boutons) |
| 2068 | `@media (max-width: 1024px)` | (a) Largeur | Grille indicateurs 4 → 2 colonnes |
| **2077** | `@media (max-width: 768px)` | (a) Largeur | **Layout mobile PRINCIPAL** (2 vues, header replié, sidebar/détail, cibles tactiles, footer) |
| 2365 | `@media (max-width: 380px)` | (a) Largeur | Petits téléphones (header, logo, polices, indicateurs 2 → 1 colonne) |
| 2818 | `@media (max-width: 768px)` | (a) Largeur | Page **Export** (responsive table/actions) |
| 3139 | `@media (max-width: 768px)` | (a) Largeur | Page **Sources** (boutons full-width, taille JSON) |
| 3661 | `@media (max-width: 768px)` | (a) Largeur | Overlay **Alertes** (panneau 95vw, toast full-width) |
| 3794 | `@media (prefers-color-scheme: dark)` | (c) Dark mode | Couleurs lien GrainTrack3D |

- **(a) Largeur** : 3 valeurs distinctes — **1024 / 768 / 380 px**. Plus petit breakpoint = **380 px**.
- **(b) Hover/pointer** : **AUCUN** (voir ci-dessous).
- **(c) `prefers-color-scheme`** : 2 (lignes 55 et 3794).
- **(d) Autres** (orientation, print, `prefers-reduced-motion`) : **AUCUN**.

#### Feature queries hover/pointer : NON

❌ Aucun `@media (hover: hover|none)`, aucun `@media (pointer: coarse|fine)`. C'est la cause racine partagée avec l'Axe 1 : la détection « tactile » repose entièrement sur `max-width: 768px`, ce qui est un proxy imparfait (cf. Axe 1).

### Problèmes potentiels

| # | Zone | Fichier:ligne | Règle / constat | Risque |
|---|---|---|---|---|
| 1 | **Tooltips masqués sans fallback** | `css/style.css:2120-2122`, `2314-2316` | `display: none !important` via largeur, pas de feature query ni tap | **Élevé** — perte d'information (cf. Axe 1) |
| 2 | **Boutons source/devise à 380 px** | `css/style.css:2373-2376` | `padding: 4px 6px; font-size: 9px` → cible < 44 px | **Élevé** — difficiles à taper (Apple HIG / WCAG 2.5.5 = 44 px) |
| 3 | **Aucune règle < 380 px** | (absence) | Plus petit breakpoint = 380 px | Moyen — téléphones 320-360 px non optimisés |
| 4 | **Pas de mode paysage** | (absence) | Aucun `@media (orientation: landscape)` ; graphique figé à 280 px (`:2272`) | Moyen — paysage tassé |
| 5 | **Boutons période — scroll H caché** | `css/style.css:2250-2262` | `flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none` | Moyen — scrollabilité non signalée visuellement |
| 6 | **Label « Période : » mange l'espace** | `css/style.css:2246-2248` | `.period-selector { flex-wrap: nowrap }` | Moyen — label + 1 bouton ≈ 120 px sur 380 px |
| 7 | **Polices secondaires 10-11 px** | `css/style.css:2102` (`.update-time` → 10px), `:416`, `:1160` | Texte secondaire sous le seuil de confort | Faible-Moyen — lisibilité limite |
| 8 | **Bascule vue sans `reduced-motion`** | `css/style.css:2193-2199` | Toggle sidebar↔détail, pas de `prefers-reduced-motion` | Faible-Moyen — sensibilité au mouvement |
| 9 | **Padding détail figé à 380 px** | `css/style.css:2185` | `.detail-panel { padding: 12px 16px }` non réduit < 380 px | Faible-Moyen — < 360 px serré |
| 10 | **Tables Export/Sources < 380 px** | `css/style.css:2818+`, `3139+` | Pas de règle d'empilement < 380 px | Moyen — colonnes potentiellement illisibles |

**Points positifs confirmés** : `.range-input { font-size: 16px !important; min-height: 44px }` (`css/style.css:2339`) évite le zoom auto iOS et respecte la cible tactile ✅ ; bouton refresh icône-seule conserve un `title` (mitige l'accessibilité) ✅ ; `min-height: 44px` sur les items de denrées (`:2345`) ✅.

---

## Axe 4 — Assets externes

### Inventaire des icônes

~60 icônes, **0 dépendance d'icônes externe** (aucune icon font, aucune lib CDN). Deux familles :

| Élément | Type | Source | SRI | Label accessible | Risque |
|---|---|---|---|---|---|
| Logo GrainWatch (`index.html:33`) | SVG inline | Local | N/A | Non (décoratif) | Faible |
| Cloche alertes (`index.html:89`) | SVG inline | Local | N/A | Via `title="Alertes"` sur le bouton | Faible |
| Rafraîchir (`index.html:97`) | SVG inline | Local | N/A | Via `title=` | Faible |
| Engrenage personnaliser (`index.html:120`) | SVG inline | Local | N/A | Via `title=` | Faible |
| Globe GrainTrack3D (`index.html:181`) | SVG inline | Local | N/A | ✅ `aria-label` + `aria-hidden="true"` sur le SVG | Faible (modèle à suivre) |
| Flèches retour / download / presse-papier | SVG inline | Local | N/A | Non | Faible |
| 🌙/☀️, 🔔, 🌍, 📡, 🏛️, 🇺🇸, 🔬, 💱, ⚠… | Emoji Unicode | Police système | N/A | Non | Faible (rendu variable selon OS) |
| 22+ icônes denrées (`js/commodities.js:14-41`) | Emoji Unicode | Police système | N/A | Non | Faible |

**Constat sécurité** : zéro `<img>` externe, zéro `background-image` distant → surface d'attaque côté assets quasi nulle. Le seul modèle d'accessibilité exemplaire est le globe GrainTrack3D (`aria-label` + `aria-hidden`) ; les autres SVG s'appuient sur le `title` du bouton parent ou rien.

### Assets externes / CDN

| Ressource | URL (ligne) | HTTPS | SRI | `crossorigin` | CDN réputé | Version épinglée |
|---|---|---|---|---|---|---|
| Chart.js | `cdn.jsdelivr.net/npm/chart.js@4.4.7` (`index.html:21`) | ✅ | ✅ `sha384-vsrf…` | ✅ `anonymous` | ✅ jsDelivr | ✅ 4.4.7 |
| chartjs-adapter-date-fns | `cdn.jsdelivr.net/npm/…@3.0.0` (`index.html:24`) | ✅ | ✅ `sha384-cVMg…` | ✅ `anonymous` | ✅ jsDelivr | ✅ 3.0.0 |
| Google Fonts (CSS) | `fonts.googleapis.com/css2?…` (`index.html:20`) | ✅ | ⚠️ Absente | — | ✅ Google | ✅ poids figés |
| Google Fonts (preconnect) | `fonts.googleapis.com` (`index.html:19`) | ✅ | N/A | — | ✅ Google | N/A |
| Police statique | `fonts.gstatic.com` (via CSP) | ✅ | N/A (validé navigateur) | — | ✅ Google | N/A |

**APIs de données** (via `fetch`, couvertes par `connect-src`) : World Bank, USDA, GDELT — toutes HTTPS et whitelistées. Lien inter-app **GrainTrack3D** (`https://grain-track3-d.vercel.app`) ouvert en `target="_blank" rel="noopener noreferrer"` : c'est une **navigation**, pas un chargement de ressource → non couvert par `connect-src`/`default-src` et **ne viole pas** la CSP (vérifié).

#### CSP (rappel, `index.html:6-15`)

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
connect-src 'self' https://api.worldbank.org https://apps.fas.usda.gov https://api.gdeltproject.org;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com;
img-src 'self' data:;
base-uri 'self'; form-action 'self'; frame-ancestors 'none';
```

Cohérente avec le header HTTP de `vercel.json` (CSP identique + `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy`). Tous les domaines whitelistés correspondent à un asset réel et réciproquement (aucun orphelin).

**Signalements sécurité (en passant, hors périmètre mobile) :**
- ⚠️ `'unsafe-inline'` dans `script-src` **et** `style-src` : compromis connu (rendu dynamique inline). Risque **moyen**, mitigé par l'absence d'injection d'entrée utilisateur dans du code inline. Durcissement = nonces + build step.
- ⚠️ SRI absente sur le CSS Google Fonts (`index.html:20`) : risque **faible** (URL dynamique à query params, SRI difficile ; Google = haute confiance ; les `.woff2` sont validés en CORS).

### Recommandations pour ajout d'icônes

Si de nouvelles icônes sont ajoutées (ex. icône de fermeture de tooltip mobile, hamburger de la roadmap v0.9) :
1. **Privilégier le SVG inline** (déjà le standard du projet) : zéro dépendance, stylable via variables CSS (dark mode auto), zéro impact CSP/SRI. Modèle à copier : le globe GrainTrack3D avec `aria-label` sur le `<a>`/`<button>` + `aria-hidden="true"` sur le `<svg>`.
2. **Emoji Unicode** acceptable pour les icônes produit/sémantiques (denrées), mais tester le rendu iOS/Android (variabilité).
3. **Cible tactile minimale 44 × 44 px** (Apple HIG / WCAG 2.5.5) — point d'attention direct vu le problème #2 de l'Axe 3.
4. `stroke-width ≥ 2` pour les SVG affichés ≤ 28 px (sinon trop fins — leçon déjà tirée sur le globe en v0.8.2).
5. **Éviter toute lib d'icônes CDN** : imposerait de mettre à jour la CSP **dans `index.html` ET `vercel.json`** + ajouter `integrity` + `crossorigin` + version épinglée. Le gain rarement justifié face au SVG inline.

---

## Synthèse et recommandations

Classement par priorité. **Aucune action n'est prise ici** (diagnostic pur) — ce sont des pistes pour la phase suivante.

### P0 — Bloquant UX (perte d'information réelle au tactile)
- **Fallback tactile des tooltips d'information.** Les bulles `.tooltip-bubble` (source / devise / période) et `.trend-tooltip` sont inaccessibles sur mobile. Pistes : (a) révéler la bulle au `click`/`tap` avec fermeture au tap extérieur ; (b) basculer ces explications en texte/accordéon inline visible sur petit écran ; (c) intégrer une lib tactile-aware. Concerne `css/style.css:1100`, `944`, `2120-2122`, `2314-2316` et un nouveau handler JS. **C'est le problème n°1 du brief.**

### P1 — Encombrement footer
- **Compacter le footer sur mobile.** Cibler `@media (max-width: 768px)` (`css/style.css:2307`) : réduire le padding vertical (12→6-8 px), abaisser la police disclaimer (11→10 px), envisager d'abréger le disclaimer (version courte mobile via i18n) pour passer de 2-3 lignes à 1-2. Gain estimé : 30-50 px rendus au graphique. Ne **pas** passer le footer en `position: fixed` (réduirait encore la zone utile). **C'est le problème n°2 du brief.**

### P2 — Tactile & accessibilité
- **Cibles tactiles boutons source/devise à 380 px** (`css/style.css:2373-2376`) : remonter à ≥ 44 px de hauteur.
- **Introduire des feature queries** `@media (hover: none)` / `(pointer: coarse)` pour remplacer le proxy `max-width: 768px` — corrige l'angle mort tablette tactile large / petit écran + souris (base commune Axe 1 & 3).

### P3 — Finitions responsive
- Règle `@media (orientation: landscape)` (graphique figé à 280 px, `css/style.css:2272`).
- Breakpoint < 360 px pour téléphones d'entrée de gamme.
- `@media (prefers-reduced-motion: reduce)` sur la bascule de vues (`css/style.css:2193`).
- Indicateur visuel de scroll horizontal sur les boutons de période (`css/style.css:2250`).

### Hors périmètre mobile — à relier aux tâches existantes
- **RGPD/footer** : la mention « pas de cookies / pas de tracking » et la **page /privacy** (exigées par CLAUDE.md) sont absentes du footer → rejoint la tâche conformité déjà ouverte.
- **Sécurité** : `'unsafe-inline'` (CSP) et SRI manquante sur Google Fonts — risques faibles/moyens documentés, à arbitrer hors de ce diagnostic.

---

*Rapport autosuffisant — Phase 1 terminée, aucun fichier modifié. Toutes les références `fichier:ligne` portent sur les sources racine (`index.html`, `css/style.css`, `js/*.js`) de GrainWatch v0.8.2.*
