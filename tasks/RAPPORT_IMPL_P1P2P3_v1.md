# RAPPORT D'IMPLÉMENTATION — P1 + P2 + P3 (v0.9.1)

**Projet** : GrainWatch
**Type** : Implémentation (Phase 2)
**Version cible** : v0.9.1
**Date** : 26 mai 2026
**Diagnostic de référence** : `DIAGNOSTIC_MOBILE_v0.9.1.md` (P1, P2, P3)
**Prérequis** : P4 (contraste Sources) — ✅ terminé (commit `f9c9293`)
**Séquence respectée** : P1 → P2 → P3, vérification après chaque étape.
**Statut** : ✅ Implémenté (vérification statique). Validation runtime sur device : ⏳ à faire.

> Méthode de vérification : `node --check` sur chaque module JS, contrôle d'équilibre des accolades CSS, grep de cohérence des références (méthodes/IDs/classes). Pas de navigateur dans l'environnement WSL → les tests UX runtime restent à valider sur device (cf. §Tests).

---

## ÉTAPE 1 — P1 : Réorganisation toolbar mobile + menu hamburger

### Fichiers et lignes touchés

| Fichier | Modification |
|---|---|
| `index.html` | Toolbar source-btn 🔬→🧪 (l.57) ; **pastille `#sourcePastille`** ajoutée après `#ctrlSource` (l.63-66) ; section `.menu-sources` (ancienne `<ul>` statique) **remplacée** par sous-menu interactif : `menu-subsection-title` + `.menu-api-list` (worldbank/usda) + `<hr class="menu-source-separator">` + bouton démo `.menu-api-btn--demo` + GDELT `.menu-source-readonly` (lecture seule) |
| `js/app.js` | Nouveau **`setSource(source)`** (whitelist + sync barre↔menu + badge/tooltip/cache/refresh/closeMenu) ; handler de clic unifié `'.source-btn, .menu-api-btn'` ; **pastille** mise à jour dans `updateSourceBadge()` ; clic pastille → `openMenu()` dans `_initMenu()` ; `#ctrlSource` retiré de `ORIGINAL`/`PRIORITY` de `setupToolbarOverflow()` ; `sourceIcons` 🔬→🧪 dans `applyTranslations()` |
| `js/api.js` | `SOURCE_INFO.simulated.icon` 🔬→🧪 (l.75) — source unique pour badge + pastille |
| `css/style.css` | `.source-pastille` (base masquée desktop) ; en `@media (max-width:768px)` : `#ctrlSource { display:none }` + style pastille ; bloc sous-menu (`.menu-subsection-title`, `.menu-api-list`, `.menu-api-btn[.active][--demo]`, `.menu-source-separator`, `.menu-source-readonly`) |
| `js/i18n.js` | Clés `menu_api_choice` (FR « Choix API » / EN « API choice ») et `menu_demo_mode` (FR « Mode démo (Simulation) » / EN « Demo mode (Simulation) ») |

### Logique retenue
- **Source de vérité unique** : `App.state.source`. `setSource()` synchronise `.active` sur **les deux** UI (`.source-btn` barre desktop + `.menu-api-btn` menu mobile) → §1.3/1.4 du prompt couverts.
- **GDELT** : `.menu-source-readonly` sans `data-source` ni handler → non cliquable, purement informatif (décision chef de projet respectée).
- **Simulation** : séparée des APIs par `<hr class="menu-source-separator">`, bouton `--demo` au statut « Toujours disponible » (réutilise la clé existante `menu_status_always`).
- **Pastille** : `<button>` cliquable (ouvre le menu), affiche l'icône de la source active via `getSourceInfo().icon`. Visible uniquement `≤768px`. Mise à jour dans `updateSourceBadge()` (déjà appelée à l'init, au switch et au changement de langue).
- **Desktop** : `#ctrlSource` reste dans la barre (masqué seulement `≤768px`), retiré de l'overflow pour ne plus jamais migrer dans le menu.

### Vérifications P1
- `node --check` : `app.js`, `api.js`, `i18n.js` → OK.
- CSS équilibré (626/626 accolades en fin de chantier).
- Plus aucun 🔬 résiduel (`index.html`/`js/`), `🧪` cohérent partout (toolbar, badge, pastille, menu).
- Ancienne `<ul class="menu-sources">` supprimée ; 7 occurrences des nouvelles classes présentes.

---

## ÉTAPE 2 — P2 : Garde-fou générique de positionnement tooltip

### Fichiers et lignes touchés

| Fichier | Modification |
|---|---|
| `js/app.js` | `_clampTooltip(wrapper)` (mesure `getBoundingClientRect`, pose `--tt-shift` si débordement, marge 8px) ; appelé dans `_initTouchTooltips()` après `tooltip-open` ; reset `--tt-shift` dans `_closeAllTooltips()` |
| `css/style.css` | 7 transforms tooltip réécrites pour intégrer `var(--tt-shift, 0px)` : `.tooltip-bubble`, `.tooltip-arrow`, `.inline-tooltip .tooltip-bubble`/`.tooltip-arrow`, `.header-right .tooltip-bubble`/`.tooltip-arrow`, `.trend-tooltip` |

### Logique retenue — pourquoi une custom property plutôt qu'un override direct de `transform`
Le diagnostic proposait `bubble.style.transform = translateX(δ)`. **Problème** : plusieurs tooltips utilisent `transform: translateX(-50%)` pour leur **centrage** (`.tooltip-bubble` par défaut, `.trend-tooltip`). Écraser `transform` en JS aurait cassé ce centrage.

**Solution retenue** : une variable CSS `--tt-shift` (défaut `0px`) intégrée dans chaque `transform` via `calc()` :
- Bulle centrée : `translateX(calc(-50% + var(--tt-shift, 0px)))` → centrage préservé, décalage additif.
- Flèche (enfant de la bulle) : compense avec le signe inverse (`- var(--tt-shift)`) → reste pointée sur le déclencheur même après décalage de la bulle.
- Variantes header/inline (base neutre) : `translateX(var(--tt-shift, 0px))`.

Le JS pose **une seule** propriété sur la bulle ; bulle **et** flèche réagissent en CSS. `--tt-shift` est héritée par la flèche (enfant). Reset = `removeProperty('--tt-shift')` (retour au défaut `0px`).

### Couverture
Tooltips protégés : source (desktop seulement désormais), devise (`#ctrlCurrency`, header), période (`#ctrlPeriod`, inline), tendance (`.trend-tooltip`), **et** le futur tooltip GrainTrack3D (P3, `.tooltip-bubble` par défaut). Aucune modif `max-width` nécessaire (le `min(320px, calc(100vw - 24px))` existant + clamp à 8px des bords suffisent).

### Vérifications P2
- `node --check app.js` → OK ; CSS équilibré.
- 7 transforms confirmées avec `var(--tt-shift)`.
- Mesure faite **après** `removeProperty` (position de base) puis pose du décalage → idempotent à chaque ouverture.

---

## ÉTAPE 3 — P3 : Tooltip tactile pour GrainTrack3D désactivé

### Fichiers et lignes touchés

| Fichier | Modification |
|---|---|
| `js/app.js` | `_showGrainTrack3DInfo(message)` / `_removeGrainTrack3DInfo()` (construction DOM `createElement`/`textContent`, zéro `innerHTML`) ; branchés dans les 3 états de `loadDetail()` (ACTIF→remove, DÉSACTIVÉ→show, MASQUÉ→remove) |
| `css/style.css` | `.graintrack3d-info` masqué par défaut ; en `@media (hover:none)` : affiché + `.tooltip-info` repositionné en flux normal (`position:static`, 20×20) |

### Logique retenue
- L'attribut `title` natif **ne s'affiche jamais au tap** sur tactile (cause racine du bug). On ajoute un **ⓘ tactile** réutilisant `.selector-with-tooltip` → pris en charge automatiquement par la délégation `_initTouchTooltips()` (écoute sur `document`, robuste aux nœuds créés dynamiquement) et par le clamp P2.
- **Desktop inchangé** : `title` conservé (hover + lecteurs d'écran) ; le wrap ⓘ est `display:none` hors tactile.
- Construction sécurisée : `createElement` + `textContent`, message via `I18N.t('graintrack3d_tooltip_disabled')` (texte conservé tel quel, décision respectée). Mis à jour au changement de langue (loadDetail re-exécuté).
- `aria-disabled="true"` et neutralisation du clic (`e.preventDefault`) déjà en place — conservés. `rel="noopener noreferrer"` + `target="_blank"` sur l'état ACTIF — conservés.

### Vérifications P3
- `node --check app.js` → OK ; CSS équilibré (626/626).
- Helpers définis + appelés dans les 3 branches ; `gt3dInfo` créé/supprimé proprement (pas de doublon).

---

## Synchronisation `site/`

✅ 5 fichiers recopiés et **identiques** (`cmp`) : `site/index.html`, `site/css/style.css`, `site/js/app.js`, `site/js/api.js`, `site/js/i18n.js`.

---

## Tests à effectuer sur device (runtime — non automatisables ici)

**P1**
- [ ] Mobile : sélecteur absent de la barre ; pastille visible, change au switch (🏛️/🇺🇸/🧪).
- [ ] Mobile : menu → sous-menu API interactif + séparateur + Mode démo ; clic change la source et rafraîchit.
- [ ] Mobile : GDELT non cliquable.
- [ ] Desktop : sélecteur dans la barre, fonctionne ; menu reflète la source active (sync via `state.source`).
- [ ] FR/EN : libellés du sous-menu mis à jour ; light + dark OK.
- [ ] `setupToolbarOverflow` déplace toujours refresh/alerts/theme/lang/currency.

**P2**
- [ ] Mobile : ouvrir chaque ⓘ (devise, période, tendance) près d'un bord → aucune bulle ne déborde.
- [ ] Flèche reste alignée sur le déclencheur après clamp ; fermeture tap-extérieur/Escape OK.
- [ ] Desktop : tooltips hover inchangés (pas de décalage).

**P3**
- [ ] Mobile, denrée non supportée (ex. Cacao) : ⓘ visible ; tap → message « Denrée non suivie… » ; pas de débordement (clamp P2).
- [ ] Mobile, denrée supportée (ex. Blé) : pas de ⓘ, lien cliquable.
- [ ] Desktop : title au survol toujours présent pour les non-supportées ; clic désactivé neutralisé.
- [ ] FR/EN : message mis à jour.

---

## Observations / ajustements vs prompt (avec justification)

1. **Emoji Simulation unifié 🔬 → 🧪** (api.js + toolbar + applyTranslations + menu).
   *Justification* : le prompt impose 🧪 pour le « Mode démo » dans le menu et la pastille. Pour éviter une incohérence 🔬(barre/badge) vs 🧪(menu/pastille), l'icône a été harmonisée à 🧪 dans la source unique (`SOURCE_INFO`) + les 2 rendus de la barre. Cohérent partout, 3 edits ciblés.

2. **`#ctrlSource` masqué en entier sur mobile** (et non `.source-selector` seul comme suggéré au §1.2).
   *Justification* : masquer seulement `.source-selector` aurait laissé un ⓘ orphelin dans la barre (et maintenu l'instance P2 que le diagnostic prévoyait de supprimer). Masquer tout `#ctrlSource` est plus propre et élimine le tooltip source de la barre mobile, comme anticipé.

3. **`menu_demo_always` non créée — réutilisation de `menu_status_always`.**
   *Justification* : texte strictement identique (« Toujours disponible » / « Always available »). DRY ; une clé en moins. Le prompt la listait comme « éventuel ». Seules `menu_api_choice` + `menu_demo_mode` ont été ajoutées.

4. **P2 via custom property `--tt-shift`** au lieu de l'override direct de `transform` du pseudo-code.
   *Justification* : préserve le centrage `translateX(-50%)` des tooltips concernés (cf. §Logique P2). Plus robuste, gère bulle + flèche d'un seul réglage.

5. **Pastille cliquable (ouvre le menu)** plutôt que simple indicateur.
   *Justification* : meilleure affordance mobile ; le sélecteur vit dans le menu, la pastille y donne accès directement. Risque nul (`openMenu` existant).

6. **CSS/i18n désormais inutilisés laissés en place** : `.menu-sources`/`.menu-sources li` (CSS) et la clé `menu_label_source` (overflow). Volontairement non supprimés (impact minimal, hors périmètre de refactor). Suppression possible dans une passe de nettoyage ultérieure.

7. **Point à valider runtime** : la bulle GrainTrack3D (P3) s'affiche sous l'ⓘ dans `.detail-price-row`. Si un ancêtre scrollable la rognait, prévoir un ajustement de positionnement — à confirmer sur device.

8. **Zone tablette 769-1024px** : `#ctrlSource` reste dans la barre (pas de pastille), retiré de l'overflow → dans une fenêtre desktop très étroite (>768px), le sélecteur ne migre plus dans le menu. Conforme à la décision « le sélecteur reste dans la barre sur desktop ». Comportement attendu.

---

## Récapitulatif

| Étape | Statut | JS `node --check` | CSS accolades | `site/` |
|---|---|---|---|---|
| P1 — toolbar + menu | ✅ | OK | 622/622 | ✅ |
| P2 — clamp tooltips | ✅ | OK | 622/622 | ✅ |
| P3 — GrainTrack3D tactile | ✅ | OK | 626/626 | ✅ |
| Validation runtime device | ⏳ | — | — | — |
