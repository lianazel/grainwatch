# RAPPORT — Correctif C4 : Boutons API encore visibles sur mobile

**Projet** : GrainWatch
**Type** : Correctif (Phase 2 — second test device)
**Version** : v0.9.1
**Date** : 26 mai 2026
**Test de référence** : iPhone 14, Safari iOS, ~19h30 (portrait)
**Fichier modifié** : `css/style.css` (+ mirror `site/`)
**Statut** : ✅ Hardening appliqué + nettoyage. Validation runtime device : ⏳

---

## Investigation — les 4 hypothèses

### Hypothèse 1 — Cache / CSS déployé pas à jour → ❌ ÉCARTÉE
Fichier déployé récupéré et inspecté :
```
curl -s https://grainwatch.vercel.app/css/style.css   (87 362 octets)
→ ligne 2305 : #ctrlSource { display: none; }          ✅ PRÉSENT
→ ligne 2306 : .source-pastille { ... }                ✅ PRÉSENT (même bloc @media)
→ ligne 1314 : .source-pastille { display: none; }     ✅ règle de base desktop
```
**Le CSS déployé contient bien la règle, dans le bon bloc `@media (max-width: 768px)`.** Ce n'est donc pas un problème de cache Vercel côté serveur.

### Hypothèse 2 — Spécificité / override CSS plus bas → ❌ AUCUN TROUVÉ
Occurrences `#ctrlSource` / `.source-selector` dans `style.css` :
- `#ctrlSource` : **une seule** règle de `display` (2305, `none`, dans `@media ≤768px`).
- `.source-selector` : seulement la règle de base (1265, hors média, pas de `display:none` mais c'est l'enfant de `#ctrlSource`).
- `display: ... !important` sur un élément source : **aucun** dans tout le fichier.
- Aucune des autres `@media (max-width:768px)` (2176, 2996, 3317, 3839) ne redéclare le `display` de ces éléments.

Structure des accolades vérifiée : `#ctrlSource` (2305) et `.source-pastille` (2306) sont bien **à l'intérieur** du bloc `@media (max-width:768px)` ouvert en 2246 (pas de `}` prématurée).

### Hypothèse 3 — JS qui remet `display` inline → ❌ ÉCARTÉE
```
grep -rn "ctrlSource|source-selector|sourcePastille" js/
→ js/app.js: uniquement getElementById('sourcePastille') (×2) + un commentaire.
→ AUCUN .style.display sur #ctrlSource / .source-selector / leurs enfants.
```
`setupToolbarOverflow()`/`relayout()` exclut `#ctrlSource` de ses arrays `ORIGINAL`/`PRIORITY` → ne le déplace ni ne le re-style. `updateSourceBadge()` / `updateSourceTooltip()` ne touchent pas son `display`.

### Hypothèse 4 — Éléments source hors `#ctrlSource` → ❌ ÉCARTÉE
Dans `.header-right` (`index.html`), les seuls éléments « source » sont :
- `#ctrlSource` (l.43) → contient `.source-selector` + ses 3 `.source-btn` + le ⓘ/bulle.
- `#sourcePastille` (l.66) → la pastille (volontairement visible sur mobile).

Aucun bouton/icône de source en dehors de `#ctrlSource`.

### Viewport meta → ✅ CORRECT
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```
iPhone 14 portrait = 390px CSS → `@media (max-width: 768px)` **matche**.

---

## Analyse — pourquoi le constat est paradoxal

`#ctrlSource { display:none }` et `.source-pastille { display:inline-flex }` sont dans **le même bloc** `@media (max-width:768px)`, et toutes deux **ajoutées dans le même commit** (`9cde1fa`, P1). Conséquence logique :

| Largeur | Pastille | Sélecteur `#ctrlSource` |
|---|---|---|
| ≤768px | **visible** (inline-flex) | **masqué** (none) |
| >768px | masquée (none, base l.1314) | visible (block) |

Les deux états sont **mutuellement exclusifs**. « Pastille visible **ET** boutons visibles » est impossible avec n'importe quel état déployé de notre CSS (aucun commit n'a jamais affiché la pastille sans masquer `#ctrlSource`).

**Conclusion** : il n'existe pas de cause racine reproductible au niveau du code — le CSS déployé est correct et masque bien le sélecteur à ≤768px. Le symptôme observé est très probablement :
- un **artefact de cache/rendu côté device** (Safari iOS combinant un ancien HTML/CSS partiellement mis en cache), ou
- une **interprétation** de la pastille `🏛️` comme « bouton Banque Mondiale » (la pastille affiche l'icône de la source active).

Faute de device en environnement de dev, je ne peux pas reproduire/trancher. → J'applique le **durcissement défensif** demandé par le prompt, qui garantit le comportement quelle que soit la cause.

---

## Modifications appliquées (`css/style.css`)

### 1. Règle durcie (défensive) — dans `@media (max-width: 768px)`
```css
/* AVANT */
.source-btn { padding: 5px 8px; font-size: 10px; gap: 3px; }
.source-btn svg { display: none; }
#ctrlSource { display: none; }

/* APRÈS */
#ctrlSource,
.source-selector { display: none !important; }
```
- `!important` + ciblage **direct** de `.source-selector` : double verrou. Même si le `display` de `#ctrlSource` était un jour surchargé (spécificité, cache, extension), `.source-selector` resterait masqué.
- Portée **mobile uniquement** (dans `@media ≤768px`) → **desktop intact** (le sélecteur `#ctrlSource` reste visible et fonctionnel >768px).

### 2. Nettoyage des vestiges (demandé par le prompt)
- Supprimé `.source-btn { padding/font-size/gap }` et `.source-btn svg { display:none }` du bloc `@media ≤768px` (mortes : le sélecteur est masqué sur mobile ; et les `.source-btn` ne contiennent pas de `<svg>`, c'était un copier-coller vestige).
- Supprimé `.source-btn { padding:4px 6px; font-size:9px }` du bloc `@media (max-width:380px)` (idem, morte).
- `.source-btn` ne conserve donc que ses règles **de base** (hors média, l.1273/1289/1294/1307) qui pilotent l'affichage **desktop** — aucune régression desktop.

---

## Vérifications
- **CSS déployé** contient bien `#ctrlSource { display:none }` (confirmé par `curl`, l.2305) → l'objectif « la règle est dans le fichier livré » était déjà atteint ; le hardening la rend incontournable.
- Accolades équilibrées : **621/621**.
- `.source-btn` : plus aucune règle dans les médias mobiles ; uniquement les règles de base desktop.
- `site/css/style.css` recopié et **identique** (`cmp`).
- Aucun JS/HTML modifié (la cause n'y était pas).

## Comportement attendu (après déploiement)
- **≤768px** : seule `#sourcePastille` visible ; `#ctrlSource` + `.source-selector` masqués (`!important`).
- **>768px** : sélecteur complet visible et fonctionnel (inchangé).
- Light + dark : inchangé (la règle ne touche que `display`).

## Observations / recommandations
1. **Re-test sur device avec cache vidé** : sur l'iPhone, fermer l'onglet et recharger (ou Réglages Safari → Effacer historique/données) pour éliminer un cache CSS/HTML mixte. Le `!important` devrait de toute façon trancher.
2. **Si le symptôme persiste après ce déploiement + cache vidé** : il faudrait une capture DOM live (Web Inspector branché sur l'iPhone) pour voir le `getComputedStyle(#ctrlSource).display` réel — c'est le seul moyen de départager « cache » vs « rendu Safari » vs « interprétation pastille ». Mais le hardening `!important` rend ce scénario hautement improbable.
3. **Pas de régression desktop** : la règle est strictement sous `@media (max-width:768px)`.
