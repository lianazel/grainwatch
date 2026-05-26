# DIAGNOSTIC — Refonte UX mobile v0.9.1

**Projet** : GrainWatch
**Type** : Diagnostic (Phase 1 — **aucune modification de code**)
**Version analysée** : v0.9.0 (déployée sur grainwatch.vercel.app)
**Version cible** : v0.9.1
**Date** : 26 mai 2026
**Test de référence** : iPhone 14 (Safari iOS)

---

## ⚠️ Rectification préalable — stack réelle

Le prompt mentionne en « Rappels architecturaux » une stack **Next.js / React / Recharts**. **C'est inexact.** Le code réel est :

- **Vanilla JS** (10 modules dans `js/`, pas de framework, pas de build)
- **HTML statique** mono-page (`index.html`, ~620 lignes)
- **CSS unique** (`css/style.css`, ~3 900 lignes, variables CSS + `[data-theme="dark"]`)
- **Chart.js** (pas Recharts) chargé via CDN
- Déploiement statique Vercel

**Conséquences pour l'implémentation v0.9.1** :
- Aucune notion de composant React, de state management, de `dangerouslySetInnerHTML`. Les contraintes sécurité applicables sont : **pas de `innerHTML` avec données externes**, construction DOM via `createElement`/`textContent` (cf. `CLAUDE.md` §3).
- **Tout fichier modifié doit être recopié dans `site/`** (mirror déploiement GitHub Pages — convention projet).
- Le comportement tactile se cible par `@media (hover:none)` / `(pointer:coarse)`, **jamais** par un breakpoint de largeur (leçon projet actée).

---

## 🔗 Insight transversal majeur — P2 est une conséquence de P1

L'analyse révèle un **lien de causalité direct entre P1 et P2** qui doit guider la séquence d'implémentation :

> Le tooltip « Simulation » illisible (P2) est tronqué **parce que** son élément déclencheur (`#ctrlSource`) est poussé hors de l'écran à gauche par le débordement de la toolbar (P1).

Le tooltip est ancré à son trigger (`right: 0` relatif à `#ctrlSource`). Quand la toolbar déborde, `#ctrlSource` (élément le plus à gauche de `.header-right` en `justify-content: flex-end`) sort de l'écran à gauche → le tooltip part avec lui hors viewport.

**Implication** : retirer le sélecteur de source de la toolbar (P1) **fait disparaître l'instance signalée de P2**. Mais le bug de positionnement reste **latent** pour les tooltips devise (`#ctrlCurrency`) et période (`#ctrlPeriod`). Il faut donc corriger P1 **et** ajouter un garde-fou générique de positionnement tooltip (P2), sinon la même classe de bug ressurgira.

**Séquence recommandée** : P1 → P2 (garde-fou générique) → P3 → P4. P3 et P4 sont indépendants.

---

# P1 — Réorganisation toolbar mobile et menu hamburger

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `index.html` | Markup toolbar (`.header-right`, l.41-114), sélecteur source (`#ctrlSource`, l.43-62), menu hamburger (`#menuPanel`, l.573-605), liste sources statique (`.menu-sources`, l.588-593), badge source (`#sourceBadge`, l.262-265) |
| `js/app.js` | État source (`state.source`, l.43), handler de switch (l.171-183), `setupToolbarOverflow()` (l.1108-1173), `updateSourceBadge()` (l.559-599) |
| `js/api.js` | Routage données réelles vs simulées (`getPriceHistory`, l.86-94), métadonnées sources (`getSourceInfo`, l.55-77) |
| `js/commodities.js` | Génération des données simulées (`generatePriceHistory`, l.73-119) |
| `css/style.css` | Styles `.source-selector` / `.source-btn` (l.1269+), `.menu-sources` / `.menu-panel`, breakpoint mobile (`@media max-width:768px`, l.2230+) |

## Comportement actuel

**Le sélecteur de source est implémenté comme un groupe de 3 boutons inline dans la toolbar** (`index.html:50-61`) :

```html
<div class="source-selector">
  <button class="source-btn active" data-source="worldbank" title="Banque Mondiale">
    <span class="source-dot"></span> 🏛️ Banque Mondiale
  </button>
  <button class="source-btn" data-source="usda" title="USDA">
    <span class="source-dot"></span> 🇺🇸 USDA
  </button>
  <button class="source-btn" data-source="simulated" title="Données simulées">
    <span class="source-dot"></span> 🔬 Simulation
  </button>
</div>
```

- **3 sources sélectionnables** : `worldbank`, `usda`, `simulated`. **GDELT n'en fait PAS partie** (voir alerte ci-dessous).
- État global : `App.state.source` (`app.js:43`), défaut `"worldbank"`.
- Switch (`app.js:171-183`) : retire `.active` partout, l'ajoute au bouton cliqué, met à jour `state.source`, appelle `updateSourceBadge()` + `updateSourceTooltip()`, vide le cache API, `refresh()`.
- **Simulation n'est pas une API** : c'est un mode démo. Les données réelles vs simulées sont routées dans `api.js:86-94` ; la génération simulée (marche aléatoire + retour moyenne, seedée) est dans `commodities.js:73-119`.

**Le menu hamburger existe déjà** (`index.html:573-605`) avec 3 sections :
1. **Réglages** (`#menuSettings`) — cible vide remplie dynamiquement par l'overflow.
2. **Sources de données** (`.menu-sources`, l.588-593) — **liste statique en lecture seule** affichant 4 lignes avec pastilles de statut (Banque Mondiale ● En ligne, USDA ● En ligne, GDELT ● En ligne, Simulation « Toujours disponible »). **Non interactive** — c'est purement informatif, ça ne change pas `state.source`.
3. **À propos** — version, disclaimer, mention no-tracking.

**Le pattern d'auto-overflow existe** (`setupToolbarOverflow()`, `app.js:1108-1173`) : un `ResizeObserver` sur `.header-right` **déplace** (ne clone pas) les contrôles excédentaires dans `#menuSettings`, dans l'ordre de priorité `refresh → alerts → theme → lang → currency → source`. Chaque contrôle déplacé est enveloppé dans une `.menu-setting-row` avec un label, et un badge compteur s'affiche sur le hamburger.

**Breakpoint mobile** : `@media (max-width: 768px)` (`style.css:2230+`). La toolbar passe en `flex-wrap: nowrap`, `.header-right` en `justify-content: flex-end`, `flex: 1`, `min-width: 0` (active la détection d'overflow). Les `.source-btn svg` sont masqués, le refresh passe en icône seule.

## Pourquoi le bug visuel (toolbar illisible) survient

Deux facteurs combinés :
1. **Le `.source-selector` est un seul nœud large** contenant 3 boutons textuels (« 🏛️ Banque Mondiale » + « 🇺🇸 USDA » + « 🔬 Simulation »). À lui seul il occupe l'essentiel de la largeur sur un iPhone 14 (390 px CSS).
2. **L'overflow déplace le sélecteur source en DERNIER** (priorité 6/6). Donc refresh, alerts, theme, lang, currency partent dans le menu avant lui — mais le `.source-selector` reste le plus large et, tant qu'il est dans la toolbar avec `justify-content: flex-end`, **sa partie gauche est clippée hors écran** (« Simulation coincé à l'extrême gauche, presque hors champ »).

→ Même quand l'overflow fonctionne, **déverser le `.source-selector` brut (3 boutons inline) dans `#menuSettings` ne produit pas l'UX cible** (sous-menu vertical avec pastilles + séparateur avant Simulation). Le mécanisme générique d'overflow est inadapté à ce contrôle précis.

## ⚠️ Alerte produit — GDELT n'est pas une source de prix

L'architecture cible du prompt liste `🌍 GDELT` sous le sous-menu « Choix API », au même niveau que Banque Mondiale et USDA. **Or GDELT n'est pas une source de données de prix** : c'est l'API d'actualités géopolitiques (`getSourceInfo` n'expose que worldbank/usda/simulated comme sources de prix ; GDELT est consommé séparément par `js/news.js`). Le mettre dans le sélecteur « Choix API » laisserait croire qu'on peut afficher des prix « via GDELT », ce qui est faux.

**Recommandation** : conserver GDELT dans la section informative « Sources de données » (lecture seule, statut en ligne), mais **ne pas l'inclure dans le sous-menu sélecteur d'API** (qui ne doit contenir que worldbank + usda). À valider avec le chef de projet avant implémentation.

## Comportement attendu (cible validée)

- Sélecteur d'API (worldbank/usda) **retiré de la toolbar mobile**, transformé en sous-menu vertical interactif dans le hamburger.
- Bouton Simulation **retiré de la toolbar**, placé sous le sous-menu API, **séparé par un `<hr>`/bordure**, libellé « 🧪 Mode démo (Simulation) — Toujours disponible ».
- Une **pastille discrète** dans la toolbar indique l'API active (ex. icône 🏛️ / 🇺🇸 / 🔬).

## Approche de correction proposée (sans implémenter)

1. **Unifier les deux représentations de sources** : aujourd'hui il y a (a) le sélecteur fonctionnel dans la toolbar et (b) la liste statique `.menu-sources`. La cible fusionne : rendre la liste du menu **interactive** (chaque ligne pose `state.source` + `.active`, réutilise le handler de `app.js:171-183`), et supprimer le `.source-selector` de la toolbar.
2. **Sortir `#ctrlSource` de la `PRIORITY`/`ORIGINAL` de `setupToolbarOverflow()`** (`app.js:1108-1124`) : il ne doit plus participer à l'overflow générique puisqu'il est désormais natif dans le menu. Vérifier que le reste de l'overflow (refresh/alerts/theme/lang/currency) continue de fonctionner.
3. **Ajouter une pastille d'API active dans la toolbar** : un petit élément (icône emoji de la source active) mis à jour dans `updateSourceBadge()`/le handler de switch. Le mécanisme `updateSourceBadge()` (`app.js:559-599`) existe déjà et construit du DOM en `createElement` (pas d'`innerHTML`) — la pastille suivra ce pattern.
4. **Séparation visuelle Simulation** : `<hr class="menu-source-separator">` + section dédiée. CSS à ajouter, compatible dark mode (utiliser `var(--grey-light)` pour la bordure).
5. **i18n** : libellés du sous-menu (« Choix API », « Mode démo », statuts) — ajouter les clés FR/EN dans `js/i18n.js`.
6. **Desktop** : décider si le sélecteur reste dans la toolbar en desktop (largeur suffisante) ou bascule aussi dans le menu. Recommandation : conserver le comportement desktop actuel via `@media (hover:hover)` ou le breakpoint, pour ne pas régresser l'UX souris.

## Complexité : **Complexe**
Refonte structurelle (HTML + JS + CSS + i18n), touche le state management des sources, interagit avec `setupToolbarOverflow`. C'est le chantier central de v0.9.1.

## Risques de régression
- **Élevé** : casser le switch de source si le handler n'est pas correctement re-câblé sur la nouvelle liste interactive.
- Casser `setupToolbarOverflow` en retirant `#ctrlSource` de ses tableaux (vérifier que `ORIGINAL` et `PRIORITY` restent cohérents).
- Régression desktop si le sélecteur disparaît aussi sur grand écran sans alternative.
- Désynchronisation `site/` si oubli de recopie.
- Pastille active : veiller à la mettre à jour sur changement de langue (`app.js:222-223` rappelle déjà `updateSourceTooltip`).

---

# P2 — Tooltip Simulation illisible sur mobile (débordement gauche)

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `css/style.css` | `.tooltip-bubble` (l.1135-1157), variante header `.header-right .tooltip-bubble { left:auto; right:0 }` (l.1188-1191), clamp mobile `max-width: min(320px, calc(100vw - 24px))` (l.1247-1251), affordance ⓘ `@media (hover:none)` (l.1215+) |
| `js/app.js` | `updateSourceTooltip()` (l.601-609) — **remplace dynamiquement le texte du tooltip par la description longue de la source**, `_positionSourceArrow()` (l.613-633), `_initTouchTooltips()` (l.978-1004) |
| `js/i18n.js` | `source_desc_wb` / `source_desc_usda` / `source_desc_sim` (descriptions longues ~200 car.), `tooltip_source` (court) |
| `index.html` | `#ctrlSource` + `#tooltipSource` (l.43-49) |

## Diagnostic précis du contenu réel

Le texte tronqué observé sur la photo (« ommodity », « ondiale. », « est la », « our les ») **n'est pas** le court tooltip `tooltip_source` (« D'où viennent les prix ? … », 99 car.). C'est la **description longue de la Banque Mondiale** :

> « Données mensuelles issues du Commodity Markets (Pink Sheet)… **C'est la** référence institutionnelle m**ondiale** pour les prix des c**ommodit**és. » (`api.js:58` / i18n `source_desc_wb`, ~230 caractères)

En effet, `updateSourceTooltip()` (`app.js:601-609`) **réécrit dynamiquement** le contenu de `#tooltipSource` avec `source_desc_wb` / `source_desc_usda` / `source_desc_sim` selon la source active. Le `#tooltipSource` n'affiche donc PAS le texte court statique du HTML, mais un paragraphe long multi-lignes.

## Mécanisme de positionnement (la cause racine)

```css
/* style.css:1135 — bulle par défaut : centrée sur le trigger */
.tooltip-bubble { position:absolute; top:calc(100% + 10px); left:50%; transform:translateX(-50%); max-width:320px; }

/* style.css:1188 — MAIS dans la toolbar : ancrée à droite */
.header-right .tooltip-bubble { left:auto; right:0; transform:none; }

/* style.css:1247 — mobile : clamp de LARGEUR uniquement */
@media (hover:none) { .tooltip-bubble { max-width: min(320px, calc(100vw - 24px)); } }
```

`#tooltipSource` est dans `.header-right` → règle l.1188 active : la bulle est **ancrée par sa droite** au bord droit de `#ctrlSource`, et s'étend vers la gauche (jusqu'à ~`100vw-24px` de large).

**Le bug** : `#ctrlSource` est l'élément le plus à gauche de `.header-right` (`justify-content: flex-end`). Quand la toolbar déborde (P1), `#ctrlSource` est partiellement poussé **hors écran à gauche**. La bulle, ancrée à son bord droit et large de ~366 px sur iPhone, a donc son bord gauche très au-delà du bord gauche du viewport → **le début de chaque ligne est clippé**.

**Le commentaire CSS l.1247-1248 contient l'hypothèse erronée** :
> « la position d'ancrage gauche/droite existante + ce clamp de largeur suffisent : pas de repositionnement JS nécessaire »

Cette hypothèse **suppose que l'élément d'ancrage reste dans le viewport**. Elle tombe dès que l'overflow toolbar pousse le trigger hors écran. **Aucune logique de flip ni de clamp viewport-relatif n'existe** : le seul `getBoundingClientRect()` (`_positionSourceArrow`, `app.js:613-633`) repositionne la **flèche**, pas la bulle.

Le fallback tactile (`_initTouchTooltips`, `app.js:978-1004`) fonctionne correctement (tap ⓘ → `.tooltip-open`, tap extérieur/Escape → fermeture) — **ce n'est pas le problème**. Le problème est purement le positionnement horizontal de la bulle.

## Comportement attendu
La bulle doit rester **entièrement dans le viewport** quelle que soit la position du trigger, avec `max-width` adapté et repositionnement automatique (clamp/flip) pour ne jamais déborder.

## Approche de correction proposée

**Deux niveaux, complémentaires** :

1. **Court terme (subsumé par P1)** : une fois le sélecteur source retiré de la toolbar (P1), l'instance signalée disparaît — ce tooltip n'est plus dans la toolbar. **Mais ne pas s'arrêter là.**

2. **Garde-fou générique (le vrai correctif)** : ajouter un clamp viewport-relatif pour **tout** `.tooltip-bubble`, applicable aux tooltips devise (`#ctrlCurrency`) et période (`#ctrlPeriod`) qui restent vulnérables. Options :
   - **(Recommandé) Clamp JS minimal** : à l'ouverture (`tooltip-open` posé dans `_initTouchTooltips`), mesurer `bubble.getBoundingClientRect()` et appliquer un `transform: translateX(δ)` correctif si `rect.left < 8` ou `rect.right > innerWidth - 8`. ~15 lignes, réutilise le hook tactile existant. Pas d'`innerHTML`, conforme sécurité.
   - **Alternative CSS** : passer la bulle en `position: fixed` avec coordonnées calculées — plus invasif, casse l'ancrage flèche actuel.
   - **Réduire la longueur** : tronquer/raccourcir `source_desc_*` n'adresse pas la cause (le débordement horizontal vient de l'ancrage, pas de la longueur seule). À écarter.

## Complexité : **Modéré**
Si on se limite au garde-fou JS générique : modéré. La partie « instance toolbar » est gratuite (résolue par P1).

## Risques de régression
- **Faible à modéré** : un clamp JS mal borné pourrait décaler des tooltips qui s'affichent correctement (devise/période en position normale). Tester les 3 triggers (`source` post-P1 si conservé ailleurs, `currency`, `period`) + la carte tendance (`.indicator-card-trend`).
- Ne pas casser `_positionSourceArrow` (flèche) : le clamp de bulle et la flèche doivent rester cohérents (sinon flèche désalignée du trigger).
- Tester en desktop (hover) ET mobile (tap).

---

# P3 — Tooltip GrainTrack3D sur céréales non supportées (message invisible au tap)

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `js/app.js` | Config `GRAINTRACK3D_SUPPORTED_KEYS` (l.13-16), `buildGrainTrack3DUrl()` (l.25-33), logique 3 états dans `loadDetail()` (l.405-432), neutralisation clic (l.262-266) |
| `js/i18n.js` | `graintrack3d_tooltip` (l.47-49), `graintrack3d_tooltip_disabled` (l.51-53) |
| `index.html` | `#graintrack3d-link` (`<a>` avec `title=""`, l.184-198) |
| `css/style.css` | `.graintrack3d-link--disabled` (l.3866-3905) |

## Comportement actuel

La liste des céréales supportées est **hardcodée** dans un `Set` (`app.js:13-16`) :

```js
const GRAINTRACK3D_SUPPORTED_KEYS = new Set([
  'wheat','corn','rice','soybean','sugar','barley',
  'oats','sorghum','rapeseed','groundnut','lentils','millet'
]);
```

`loadDetail()` (`app.js:405-432`) gère **3 états** :
- **ACTIF** (céréale supportée) : `href` = URL GrainTrack3D, `title` = `graintrack3d_tooltip`, icône colorée cliquable.
- **DÉSACTIVÉ** (denrée hors catalogue : café, cacao, coton…) : `href="#"`, **`title = I18N.t('graintrack3d_tooltip_disabled')`**, classe `--disabled`, `aria-disabled="true"`, icône grisée + barre diagonale.
- **MASQUÉ** (aucune sélection) : `display:none`.

```js
} else if (selectedCommodity) {           // DÉSACTIVÉ
  gt3dLink.href = '#';
  gt3dLink.title = I18N.t('graintrack3d_tooltip_disabled');   // ⚠️ attribut title natif
  gt3dLink.classList.add('graintrack3d-link--disabled');
  gt3dLink.setAttribute('aria-disabled', 'true');
}
```

Le clic est neutralisé en JS (`app.js:262-266`, `e.preventDefault()` si `--disabled`). Le CSS est **volontairement sans `pointer-events:none`** (`style.css:3866-3869`) — le commentaire dit explicitement que c'est pour laisser le `title` natif s'afficher au survol.

## Cause racine du bug

**Le message désactivé est délivré via l'attribut `title` natif HTML.**

> Sur appareil tactile, **l'attribut `title` ne s'affiche jamais au tap** — il ne se déclenche qu'au survol souris (`hover`), qui n'existe pas sur iPhone.

Résultat : l'utilisateur iPhone qui tape l'icône grisée ne voit **aucune explication**. L'icône est barrée mais le « pourquoi » est inaccessible. C'est exactement le bug signalé (« le problème persiste »).

C'est la **même classe de bug** que P2/P3 dans son principe (hover-only sur tactile), sauf qu'ici le projet possède déjà un système de tooltip tactile (`.tooltip-info` ⓘ + `.tooltip-bubble` + `_initTouchTooltips`) **qui n'a pas été utilisé** pour le lien GrainTrack3D. Le lien utilise le `title` natif au lieu du système maison tap-to-show.

La liste des 12 clés est **stable mais susceptible d'évoluer** (si GrainTrack3D ajoute des denrées). Elle est centralisée dans un seul `Set` — facile à maintenir.

## Comportement attendu
Message explicite, non technique, **visible sans hover** : « GrainTrack3D n'est pas encore disponible pour cette denrée. » (le texte i18n actuel « Denrée non suivie par GrainTrack3D (céréales et oléagineux uniquement) » convient, formulation à ajuster si souhaité).

## Approche de correction proposée

1. **Brancher le lien GrainTrack3D sur le système tooltip tactile du projet** plutôt que sur `title` :
   - Envelopper/associer un `.tooltip-info` ⓘ + `.tooltip-bubble` au lien désactivé, réutilisant `_initTouchTooltips()` (`app.js:978-1004`) et la classe `.tooltip-open`. Le texte vient de `graintrack3d_tooltip_disabled` (déjà traduit FR/EN).
   - Conserver le `title` en complément pour le desktop/lecteurs d'écran (pas de régression souris).
2. **Ce tooltip héritera du garde-fou de positionnement de P2** — d'où l'intérêt de traiter P2 d'abord. L'icône GrainTrack3D est dans la zone détail (pas la toolbar), donc moins exposée au débordement, mais le clamp générique la couvre.
3. **Accessibilité** : `aria-disabled` déjà posé. Si on ajoute un ⓘ, lui donner `aria-label` traduit (pattern `data-i18n-aria` existant).
4. **Alternative plus simple** (si on ne veut pas de ⓘ) : afficher le message dans un petit texte inline sous le prix quand la denrée est non supportée, plutôt qu'un tooltip. Moins élégant mais zéro dépendance au survol. À arbitrer avec le chef de projet.

## Complexité : **Modéré**
Réutilise des briques existantes (tooltip tactile, i18n déjà en place). Pas de nouvelle logique métier.

## Risques de régression
- **Faible** : ne pas casser l'état ACTIF (lien cliquable vers GrainTrack3D) ni la neutralisation du clic en désactivé (`app.js:262-266`).
- Veiller à rafraîchir le tooltip au changement de langue (`loadDetail` est déjà rappelé, cf. `app.js:218`).
- Conserver `rel="noopener noreferrer"` + `target="_blank"` sur l'état actif (sécurité anti tab-hijacking, déjà en place).
- Dépend de P2 pour le positionnement propre du tooltip.

---

# P4 — Contraste texte insuffisant sur la page Sources en mode sombre

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `css/style.css` | Variables light `:root` (l.106-128) / dark `[data-theme="dark"]` (l.135-153), styles page Sources (l.3042-3290) |
| `index.html` | Markup page Sources (`#sourcesPage`, l.497-565) — texte statique |
| `js/sources.js` | Rend uniquement la sortie JSON de démo, **ne touche pas** au texte courant |

## Comportement actuel — couleurs hardcodées

Le dark mode fonctionne par **inversion sémantique de variables CSS** : `--black: #2C2C2C` (light) → `#E8E4DB` (dark, crème claire) ; `--creme: #FDF6E3` (light) → `#1A1A2E` (dark, navy). Un texte en `color: var(--black)` reste donc lisible dans les deux modes.

**Le problème** : la page Sources utilise des **couleurs hexadécimales hardcodées** au lieu des variables, donc elles ne s'inversent pas en dark mode. Confirmé par grep :

| Ligne | Sélecteur | Couleur hardcodée | Fond dark `#1A1A2E` | Ratio dark | WCAG AA (4.5:1) |
|---|---|---|---|---|---|
| `style.css:3082` | `.sources-text` (corps de texte) | `#444` | navy | **~1.7:1** | ❌ ÉCHEC |
| `style.css:3190` | `.sources-gdelt-desc .sources-text` | `#4C1D95` (violet) | navy | **~1.5:1** | ❌ ÉCHEC |
| `style.css:3213` | `.sources-link` | `#555` | navy | **~1.9:1** | ❌ ÉCHEC |
| `style.css:3120` | `.sources-free-notice` (texte) | `#166534` sur fond `#F0FDF4` hardcodé | (bandeau clair) | OK light, douteux dark | ⚠️ |

Ce qui **fonctionne** (utilise les variables, lisible en dark) :
- `.sources-page` fond = `var(--creme)` ✓
- `.sources-page-title` = `var(--terracotta)` ✓ (titre lisible, confirmé par le test)
- `.sources-section-heading` = `var(--black)` ✓
- `.sources-text strong` = `var(--terracotta)` ✓
- Le bandeau vert « 100% gratuit » utilise des couleurs claires fixes → reste lisible (confirmé par le test).

**Les couleurs de marque blé `#D4A843` / olive `#6B7C2D` ne sont PAS utilisées comme couleur de texte courant** ici (elles servent de bordures/accents), donc elles ne sont pas en cause sur cette page. Bonne nouvelle : pas de refonte palette nécessaire.

## Scope — localisé à la page Sources

Le grep `color: #444|#555|#4C1D95` ne remonte que les lignes 3082, 3190, 3213 (section Sources). Les autres vues secondaires (Export, Alertes, À propos) utilisent `var(--black)` / `var(--grey)` et s'adaptent correctement au dark mode. **Le problème est isolé à la page Sources** — correctif circonscrit. (Note : `#166534` réapparaît l.3499 dans un autre contexte vert à vérifier au passage.)

## Comportement attendu
Texte courant ≥ 4.5:1 (WCAG AA) dans les deux modes. En dark, le corps de texte doit être clair (crème / gris très clair).

## Approche de correction proposée

1. **Remplacer les hardcodes par des variables** :
   - `.sources-text { color: #444 }` → `color: var(--black)` (devient `#E8E4DB` en dark, ~12:1). En light, `var(--black)` = `#2C2C2C`, légèrement plus foncé que `#444` mais visuellement équivalent et conforme.
   - `.sources-link { color: #555 }` → `var(--black)` ou une variable de texte secondaire lisible dans les deux modes.
   - `.sources-gdelt-desc .sources-text { color: #4C1D95 }` → soit `var(--black)`, soit conserver la teinte violette mais ajouter un override `[data-theme="dark"]` avec un violet clair (ex. `#C4B5FD`).
2. **Bandeau `.sources-free-notice` et autres blocs colorés fixes** : ajouter des overrides `[data-theme="dark"]` dédiés (fond sombre translucide + texte clair) si le rendu actuel en dark est jugé insuffisant. Le bandeau vert est signalé lisible — priorité basse.
3. **Vérifier `#166534` l.3499** (autre occurrence verte) pendant la passe.
4. **Tester les deux thèmes** après correctif (exigence projet : tout changement visuel doit marcher en light ET dark).

## Complexité : **Trivial**
Remplacement de ~3-4 valeurs `color:` par des variables existantes + éventuels overrides dark pour les blocs colorés. Pas de JS.

## Risques de régression
- **Très faible** : en light mode, `var(--black)` (#2C2C2C) est très proche de `#444`/`#555` — différence imperceptible. Vérifier juste que le contraste reste bon sur fond crème clair.
- Si on conserve une teinte de marque (violet GDELT) avec override dark, vérifier le ratio du nouveau ton clair.
- Recopier `css/style.css` dans `site/`.

---

# Tableau récapitulatif

| # | Problème | Fichiers principaux | Complexité | Risque régression |
|---|----------|---------------------|------------|-------------------|
| **P1** | Réorg toolbar + menu hamburger (sélecteur API + Simulation vers le menu, pastille active) | `index.html` (43-62, 573-605), `js/app.js` (43, 171-183, 559-599, 1108-1173), `js/api.js`, `js/commodities.js`, `css/style.css` | **Complexe** | **Élevé** (state source, overflow, desktop) |
| **P2** | Tooltip source illisible (débord. gauche) — texte = description longue WB ancrée hors viewport | `css/style.css` (1135-1191, 1247-1251), `js/app.js` (601-633, 978-1004), `js/i18n.js` | **Modéré** (garde-fou JS générique ; instance résolue par P1) | **Faible-Modéré** (clamp mal borné) |
| **P3** | Message GrainTrack3D désactivé invisible au tap (`title` natif hover-only) | `js/app.js` (13-33, 262-266, 405-432), `js/i18n.js` (47-53), `index.html` (184-198), `css/style.css` (3866-3905) | **Modéré** | **Faible** (réutilise tooltip tactile ; dépend de P2) |
| **P4** | Contraste texte page Sources en dark (couleurs hardcodées `#444`/`#555`/`#4C1D95`) | `css/style.css` (3082, 3190, 3213, 3120), `index.html` (497-565) | **Trivial** | **Très faible** |

---

# Recommandations de séquencement

1. **P4 d'abord** (trivial, isolé, gain immédiat, zéro dépendance) — quick win.
2. **P1 ensuite** (chantier central) — fait disparaître l'instance toolbar de P2.
3. **P2** (garde-fou de positionnement générique) — protège devise/période + bénéficie à P3.
4. **P3** (brancher le tooltip tactile sur le lien GrainTrack3D) — s'appuie sur le garde-fou P2.

## Points à valider avec le chef de projet avant Phase 2
- **GDELT dans le sélecteur API** : ne PAS l'inclure comme source de prix (c'est une source d'actualités). Le garder en liste informative seulement. → décision attendue.
- **Sélecteur de source en desktop** : conserver dans la toolbar ou basculer aussi dans le menu ? (recommandation : conserver desktop).
- **P3** : tooltip tactile (ⓘ) vs message inline sous le prix ? (recommandation : tooltip tactile, cohérent avec le reste).
- **Formulation du message P3** : garder « Denrée non suivie par GrainTrack3D (céréales et oléagineux uniquement) » ou adopter « GrainTrack3D n'est pas encore disponible pour cette denrée. » ?

## Rappels d'implémentation (Phase 2)
- **Sécurité** : zéro `innerHTML` avec données externes ; `createElement`/`textContent`. Conserver `rel="noopener noreferrer"`.
- **`site/`** : recopier tout fichier modifié (mirror GitHub Pages).
- **Dark mode** : tester chaque changement visuel dans les deux thèmes.
- **Tactile** : cibler par `@media (hover:none)`/`(pointer:coarse)`, jamais par largeur.
- **i18n** : toute chaîne nouvelle en FR + EN dans `js/i18n.js`.
