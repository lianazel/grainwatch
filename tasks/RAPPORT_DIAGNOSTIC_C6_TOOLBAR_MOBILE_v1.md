# RAPPORT DIAGNOSTIC — C6 : Toolbar mobile cassée (iPhone 14 portrait)

**Projet** : GrainWatch · **Version** : v0.9.1 · **Date** : 26 mai 2026
**Type** : Diagnostic (LECTURE SEULE — aucun fichier source modifié)
**Test de référence** : iPhone 14 portrait (~390px), Chrome iOS + Safari iOS
**Prérequis** : C4-bis commité (`4d2254f`) — vérifié présent

> ⚠️ **Limite méthodologique** : aucun navigateur dans l'environnement de dev. Le diagnostic est statique (lecture du code + raisonnement layout). Les causes racines proposées en §8 sont des **hypothèses fortes** à confirmer en runtime sur device.

---

## Inspection 1 — Structure DOM de la toolbar

### Résultats factuels (`index.html:29-121`)

`<header class="header">` (ligne 29) contient **2 conteneurs** :

**`.header-left`** (ligne 30) — statique :
| Élément | id / classe | Contenu |
|---|---|---|
| `.logo` (div) | — | SVG 32×32 + `<h1>GrainWatch</h1>` |
| `.update-time` (span) | `#updateTime` | « Mis à jour à --:-- » |

**`.header-right`** (ligne 41) — statique, dans cet ordre DOM :
| # | Élément | id | classe | Contenu |
|---|---|---|---|---|
| 1 | div | `#ctrlSource` | `.selector-with-tooltip` | ⓘ + bulle + `.source-selector` (3 `.source-btn`) |
| 2 | button | `#sourcePastille` | `.source-pastille` | 🏛️ |
| 3 | div | `#ctrlCurrency` | `.selector-with-tooltip` | ⓘ + bulle + `.currency-selector` ($ USD / € EUR) |
| 4 | button | `#themeToggle` | `.theme-toggle` | 🌙 |
| 5 | button | `#langToggle` | `.lang-toggle` | 🇫🇷 FR |
| 6 | button | `#alertsBell` | `.alerts-bell` | 🔔 + badge |
| 7 | button | `#refreshBtn` | `.refresh-btn` | 🔄 + « Rafraîchir » |
| 8 | button | `#menuToggle` | `.menu-toggle` | ☰ + `#menuBadge` |

Tous **statiques** (présents dans le HTML). Aucun élément de la toolbar n'est créé dynamiquement (cf. Inspection 6).

### Anomalies détectées
- L'ordre DOM (pastille **avant** currency/theme/lang/bell/refresh) explique l'ordre visuel constaté à l'écran une fois le débordement non géré (cf. §8).
- `#refreshBtn` porte un libellé texte « Rafraîchir » (≈ +70px) — gros contributeur de largeur sur mobile.

### Hypothèse
La structure est saine. Le problème n'est pas le DOM lui-même mais la **gestion de sa largeur sur mobile** (Inspections 2 et 5).

---

## Inspection 2 — `setupToolbarOverflow()` et ses arrays (`js/app.js:1215-1281`)

### Résultats factuels

```javascript
const ORIGINAL = ['#ctrlCurrency', '#themeToggle', '#langToggle', '#alertsBell', '#refreshBtn'];   // L1226
const PRIORITY = [                                                                                  // L1227
  { sel: '#refreshBtn',   key: 'menu_label_refresh'  },   // part en 1er
  { sel: '#alertsBell',   key: 'menu_label_alerts'   },
  { sel: '#themeToggle',  key: 'menu_label_theme'    },
  { sel: '#langToggle',   key: 'menu_label_lang'     },
  { sel: '#ctrlCurrency', key: 'menu_label_currency' },   // part en dernier
];
```

`relayout()` (L1235-1268) :
1. **Reset** (L1238-1244) : réinsère chaque élément `ORIGINAL` dans `.header-right` avant `#menuToggle`, supprime sa `.menu-setting-row` éventuelle.
2. **Débordement** (L1247-1261) : `for (item of PRIORITY) { if (headerRight.scrollWidth <= headerRight.clientWidth) break; ... déplace l'élément dans #menuSettings }`. **La condition d'arrêt est `scrollWidth <= clientWidth`.**
3. **Badge + section** (L1262-1267) : compteur `moved`, masque la section Réglages si `moved === 0`.

`ResizeObserver` (L1271-1277) : observe **`.header-right`**, debounce via `requestAnimationFrame`, rappelle `relayout`. Fallback `window resize` (L1279).

### Présence des éléments concernés
- `#sourcePastille` : **absent** de `ORIGINAL` et `PRIORITY` → jamais déplacé, jamais touché par relayout.
- `#ctrlSource` : **absent** (volontaire, commentaire L1224-1225) → reste dans la barre en desktop, masqué en mobile par CSS + C4-bis.
- `#menuToggle` : sert d'**ancre** (`insertBefore`), reste toujours en place.

### Anomalies détectées
- **La détection de débordement repose entièrement sur `headerRight.scrollWidth > headerRight.clientWidth`.** Si cette comparaison renvoie un faux négatif, `moved = 0` et **aucun contrôle ne part dans le menu** → toute la barre reste pleine. C'est exactement le symptôme S1.
- Le `ResizeObserver` observe `.header-right`, dont la **boîte** (avec `flex: 1`, cf. Inspection 5) garde une largeur quasi constante quel que soit son contenu → un re-déclenchement de `relayout` ne corrige rien si la 1ʳᵉ passe n'a rien détecté.

### Hypothèse
`setupToolbarOverflow` est correct **algorithmiquement** mais sa mesure de débordement est fragile et dépend du contexte flex de `.header-right` (Inspection 5). Cause forte de S1.

---

## Inspection 3 — `enforceSourceHiding()` (C4-bis) (`js/app.js:1289-1315`)

### Résultats factuels
- Définie comme **méthode** de `App` (L1289), appelée dans `init()` à la L69, **après** `setupToolbarOverflow()` (L68).
- `mq = matchMedia('(max-width: 768px)')`. `apply(mobile)` :
  - mobile : `ctrlSource.style.display = 'none'` ; `sourcePastille.style.display = ''` (laisse le CSS poser `inline-flex`).
  - desktop : `ctrlSource.style.display = ''` ; `sourcePastille.style.display = 'none'`.
- Appel immédiat `apply(mq.matches)` + écoute `change` (avec fallback `addListener`).

### Anomalies détectées
- **Aucune.** La fonction est en place, appelée, et n'agit que sur `#ctrlSource` et `#sourcePastille`.
- Elle masque bien `#ctrlSource` en mobile → le sélecteur API plein (`.source-selector`) ne contribue donc PAS à la largeur. Ce n'est **pas** la cause de S1.

### Hypothèse
C4-bis fonctionne comme prévu et est hors de cause pour S1/S2/S3. Il rend la pastille visible en mobile (ce qui est voulu).

---

## Inspection 4 — Handlers de clic (pastille / menu) (`js/app.js:1124-1161`)

### Résultats factuels — `_initMenu()`
- Ouverture du menu : `toggle.addEventListener('click', () => this.openMenu())` où `toggle = #menuToggle` (L1125, L1134).
- Fermeture : `#menuClose` (L1135) et `#menuOverlay` (L1136).
- **Pastille** (L1140-1145) :
  ```javascript
  const pastille = document.getElementById('sourcePastille');
  if (pastille) pastille.addEventListener('click', () => {
    this.openMenu();
    const activeApi = document.querySelector('.menu-api-btn.active') || document.querySelector('.menu-api-btn');
    if (activeApi) activeApi.focus();
  });
  ```
- Échap + focus trap (L1156-1160).

### Anomalies détectées
- **`#sourcePastille` ouvre délibérément le menu** (L1141-1142) — c'est le raccourci ergonomique **C1** (commentaire L1138-1139, et `CHANGELOG [0.9.1]`). Ce **n'est pas un bug de câblage** : c'est le comportement voulu.
- Pas d'event delegation parasite sur `.header-right`. Pas de `stopPropagation` nécessaire ici car `openMenu()` est l'action attendue.

### Hypothèse
S3 (« clic 🏛️ → menu ») est **conforme au design**. Ce que l'utilisateur perçoit comme anormal vient de S2 : la pastille est mal placée (elle chevauche le logo), donc l'utilisateur clique dessus sans comprendre qu'il s'agit de la pastille source. **Corriger S1/S2 fait disparaître la confusion S3 — pas besoin de toucher au handler.**

---

## Inspection 5 — CSS mobile : qui est masqué, position, z-index

### Résultats factuels — Desktop (>768px)
| Sélecteur | Ligne | `display` | `position` | `flex` | `justify-content` |
|---|---|---|---|---|---|
| `.header` | 190 | flex | sticky (z-index **100**) | — | **space-between** |
| `.header-left` | 203 | flex | static | auto | — |
| `.header-right` | 228 | flex | static | auto | — (défaut start) |
| `.source-pastille` | **1314** | **none** | — | — | — |

### Résultats factuels — Mobile (`@media max-width:768px`, `css/style.css:2246-2317`)
| Sélecteur | Ligne | `display` | `flex` | Notes |
|---|---|---|---|---|
| `.header` | 2255 | flex | — | `flex-wrap: nowrap`, gap 8px, padding 8px 12px ; **garde `justify-content: space-between`** (non ré-écrit) |
| `.header-left` | 2261 | flex | **0 0 auto** | `min-width: 0` mais `flex-shrink:0` → **ne rétrécit pas** |
| `.logo h1` | 2267 | — | — | font 18px |
| `.update-time` | 2271 | — | — | font 10px (**reste visible**) |
| `.header-right` | 2275 | flex | **1** | `flex-wrap:nowrap`, **`justify-content: flex-end`** (L2278), `min-width:0` (L2280, commentaire « permet la mesure de débordement ») |
| `.header-right > *` | 2284 | — | **flex-shrink: 0** | largeur naturelle conservée |
| `#ctrlSource`, `.source-selector` | 2299-2300 | **none !important** | — | C4 |
| `.source-pastille` | 2301 | **inline-flex** | flex-shrink:0 | cercle 32×32 |

Aucun `z-index` ni `position` spécifique sur `.header-right`, ses enfants, ou `.source-pastille` → **tous en flux normal**, sous le `z-index:100` du `.header` sticky.

### Anomalies détectées — ★ POINT CENTRAL ★
1. **`.header-right { justify-content: flex-end }` (L2278) + détection par `scrollWidth` (Inspection 2) sont incompatibles.** En LTR, `justify-content: flex-end` fait déborder le contenu excédentaire vers le **bord gauche (start)**. Or `scrollWidth` ne comptabilise **pas** le débordement côté start (il mesure du début du contenu jusqu'au bord droit). Résultat : même barre archi-pleine, `scrollWidth ≈ clientWidth` → la condition `scrollWidth > clientWidth` de `relayout` est **fausse** → `moved = 0`.
   - Le commentaire L2280 (« min-width: 0 permet la mesure de débordement ») montre que l'auteur **comptait sur** la mesure `scrollWidth`, sans réaliser que `flex-end` (L2278) la neutralise.
2. **`.header-left { flex: 0 0 auto }` ne rétrécit jamais** et embarque le logo **+ l'`update-time` (visible, 10px)**. Sur ~366px de contenu (390px − 24px padding), `.header-left` consomme ~210-240px → `.header-right` (flex:1, min-width:0) est comprimé à ~120-150px, largement insuffisant → fort débordement.
3. **Débordement à gauche + `overflow` visible + ordre de peinture** : `.header-right` vient **après** `.header-left` dans le DOM → ses enfants qui débordent vers la gauche sont **peints par-dessus** le logo. Les premiers enfants DOM de `.header-right` (`#ctrlSource` masqué, puis **`#sourcePastille` 🏛️**, puis currency) sont ceux qui débordent le plus à gauche → 🏛️ se retrouve sur le « G ». C'est S2.

### Hypothèse
La combinaison **`justify-content: flex-end` + détection `scrollWidth`** est la cause racine de S1 (rien ne part dans le menu) ET de S2 (débordement gauche peint sur le logo).

---

## Inspection 6 — Éléments créés dynamiquement

### Résultats factuels (`js/app.js`)
- **`#sourcePastille` est statique** (HTML L66). En JS, il est seulement **lu** (`getElementById`) en 3 endroits : `updateSourceBadge` (L634, pose `textContent = info.icon`, `aria-label`, `title`), `_initMenu` (L1140, handler clic), `enforceSourceHiding` (L1291, `style.display`). **Jamais créé ni ré-inséré.**
- Les seuls `createElement` liés à la toolbar sont dans `relayout()` (L1251-1253) : création des `.menu-setting-row` / `.menu-setting-label` **dans le menu** (pas dans la barre), pour héberger les contrôles déplacés.
- Autres `createElement` (L600-631 `updateSourceBadge`, L854-862 select export, L1086-1099 tooltips) : hors toolbar, non concernés.

### Anomalies détectées
- Aucune. La pastille n'est pas dupliquée ni mal insérée par JS.

### Hypothèse
S2 (pastille sur le logo) n'est **pas** un problème d'insertion DOM dynamique : c'est purement le débordement CSS (Inspection 5).

---

## Inspection 7 — Conflit `setupToolbarOverflow` ↔ `enforceSourceHiding`

### Résultats factuels
- Ordre dans `init()` : `setupToolbarOverflow()` (L68) **puis** `enforceSourceHiding()` (L69).
- Ensembles d'éléments **disjoints** :
  - `relayout` agit sur `ORIGINAL`/`PRIORITY` = currency, theme, lang, bell, refresh (jamais ctrlSource/pastille).
  - `enforceSourceHiding` agit sur `#ctrlSource` + `#sourcePastille` uniquement.
- Le `ResizeObserver` de `setupToolbarOverflow` peut rappeler `relayout` après `enforceSourceHiding`, **mais** `relayout` ne touche ni `#ctrlSource` ni `#sourcePastille` → le masquage inline de C4-bis **n'est pas annulé**.

### Anomalies détectées
- **Aucun conflit.** Les deux fonctions ne se marchent pas dessus.
- Remarque mineure : `enforceSourceHiding` ne dépend pas de `relayout` et inversement ; leur ordre est sans incidence ici.

### Hypothèse
L'hypothèse du prompt (relayout annulerait le masquage) est **écartée** : pas de recouvrement d'éléments. Ce n'est pas la cause de S1/S2/S3.

---

## §8 — Synthèse

### Cause racine probable — S1 (toolbar compressée, rien dans le menu)
**`.header-right { justify-content: flex-end }` (`style.css:2278`) neutralise la détection de débordement de `relayout()`** (`app.js:1248`, `scrollWidth > clientWidth`). En LTR, `flex-end` fait déborder le contenu vers la **gauche**, et `scrollWidth` n'inclut pas l'overflow côté start → la condition est toujours fausse → `moved = 0` → **aucun contrôle n'est déplacé vers le menu hamburger**, la barre reste pleine. Le commentaire L2280 confirme que l'auteur s'appuyait sur la mesure `scrollWidth` sans voir l'incompatibilité avec `flex-end`. Aggravé par `.header-left { flex:0 0 auto }` (L2263) qui ne rétrécit pas et garde l'`update-time` visible, réduisant fortement la place disponible à droite.

### Cause racine probable — S2 (🏛️ écrase le logo)
**Même débordement vers la gauche.** Les enfants de `.header-right` qui ne tiennent pas débordent au-delà de son bord gauche (overflow visible, aucun `overflow:hidden`), donc **par-dessus `.header-left`**. Comme `.header-right` suit `.header-left` dans le DOM, ses éléments sont peints au-dessus du logo. Le premier enfant *visible* de `.header-right` (`#ctrlSource` est masqué) est **`#sourcePastille` 🏛️**, qui atterrit donc sur le « G ». Pas de `position`/`z-index` en jeu : pur ordre de peinture du flux normal. **S2 disparaîtra une fois S1 corrigé** (peu d'éléments restants à droite → plus de débordement).

### Cause racine — S3 (clic 🏛️ → menu)
**Comportement voulu, pas un bug** : `#sourcePastille` a un handler `click → openMenu()` (`app.js:1141-1142`), c'est le raccourci C1 documenté. La perception d'anomalie vient de S2 : la pastille mal placée (sur le logo) est cliquée par mégarde. **Aucune modification du handler n'est nécessaire** ; corriger S1/S2 lève l'ambiguïté.

### Recommandations pour le correctif (à implémenter dans un prompt séparé)

1. **Fiabiliser la détection de débordement** (cœur du fix). Deux options :
   - **Option A (la plus simple)** — retirer `justify-content: flex-end` de `.header-right` en mobile et pousser le bloc à droite autrement (ex. `.header { justify-content: space-between }` suffit déjà à coller `.header-right` à droite ; pour aligner les contrôles à droite *dans* la barre, utiliser `margin-left: auto` sur le premier élément plutôt que `justify-content: flex-end`). Le débordement repart alors vers la droite et `scrollWidth > clientWidth` redevient fiable.
   - **Option B (mesure robuste)** — dans `relayout()`, ne plus se fier à `scrollWidth`/`flex-end` : comparer la **somme des `offsetWidth` des enfants visibles + gaps** à `headerRight.clientWidth`. Indépendant de `justify-content`.
2. **Réduire la pression de `.header-left`** (défense en profondeur) : envisager de **masquer `.update-time` en mobile** (≤768px) ou de l'autoriser à rétrécir/tronquer, pour libérer de la place et éviter tout débordement résiduel.
3. **Re-déclenchement** : si Option B, s'assurer que `relayout` est rappelé après chargement des polices auto-hébergées (un `document.fonts.ready.then(relayout)` peut stabiliser la 1ʳᵉ mesure), car la largeur de `.header-left` change après le swap de police.
4. **Ne PAS toucher** : le handler de la pastille (S3 voulu), `enforceSourceHiding` (C4-bis OK), la structure DOM, les arrays `ORIGINAL`/`PRIORITY` (corrects).
5. **Validation obligatoire en runtime** sur device réel (iPhone 14 portrait, Chrome **et** Safari iOS) — vu l'historique, ne pas considérer le fix comme clos sans test device.

### Tableau récapitulatif
| Symptôme | Cause racine probable | Fichier:ligne | Correctif recommandé |
|---|---|---|---|
| S1 toolbar pleine | `justify-content: flex-end` casse la détection `scrollWidth` | `style.css:2278` ↔ `app.js:1248` | Option A ou B ci-dessus |
| S2 🏛️ sur logo | débordement gauche peint sur `.header-left` | `style.css:2278` + ordre DOM | résolu par le fix de S1 (+ masquer update-time) |
| S3 clic 🏛️ → menu | **voulu** (raccourci C1) | `app.js:1141-1142` | ne rien changer |

---

*Diagnostic en lecture seule — aucun fichier source modifié. Seul ce rapport a été créé.*
