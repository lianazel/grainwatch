# RAPPORT — Correctifs post-test mobile v0.9.1

**Projet** : GrainWatch
**Type** : Correctif (Phase 2 — ajustements après test device)
**Version** : v0.9.1
**Date** : 26 mai 2026
**Test de référence** : iPhone 14, Safari iOS, 26 mai 2026 18h24
**Fichiers modifiés** : `index.html`, `css/style.css`, `js/app.js` (+ mirror `site/`)
**Statut** : ✅ Implémenté (vérif statique). Validation runtime device : ⏳

---

## Correctif 1 — Sélecteur API encore visible dans la toolbar mobile

### Diagnostic
Le code de v0.9.1 (commit `9cde1fa`) masque **déjà** correctement tout le sélecteur sur mobile :

```css
/* css/style.css:2297 — dans @media (max-width: 768px) */
#ctrlSource { display: none; }
```

`#ctrlSource` **englobe** les 3 boutons `.source-selector` **ET** l'indicateur ⓘ + la bulle source. Le masquer en `display:none` retire donc l'intégralité du sélecteur de la barre mobile. Vérification de la cascade : aucune règle `@media` ultérieure (2959, 3280, 3802) ne ré-affiche `#ctrlSource` / `.source-selector` / `.selector-with-tooltip`. La pastille `#sourcePastille` est le **seul** indicateur de source visible `≤768px`.

### Cause la plus probable des remnants observés sur la photo
**Décalage de déploiement.** Le commit `9cde1fa` (P1) n'a atteint `origin/main` qu'avec le push final (`f9c9293..f8437f5`). Si le test de 18h24 a été réalisé sur un déploiement Vercel ne contenant encore que `f9c9293` (P4), la barre affichait toujours l'ancien `.source-selector` (et le ⓘ P3 n'existait pas — cf. Correctif 2). → **Re-tester sur le déploiement courant** (post-`f8437f5`).

### Modification appliquée (amélioration demandée par C1)
La pastille ouvrait déjà le menu. Ajout : à l'ouverture via la pastille, le focus est porté sur le bouton API actif → la **section « Sources de données » est amenée à l'écran** (raccourci ergonomique demandé).

```js
// js/app.js — _initMenu()
if (pastille) pastille.addEventListener('click', () => {
  this.openMenu();
  const activeApi = document.querySelector('.menu-api-btn.active') || document.querySelector('.menu-api-btn');
  if (activeApi) activeApi.focus();
});
```

### Résultat
- Mobile ≤768px : seule la pastille (🏛️/🇺🇸/🧪) reste dans la barre ; tap → menu ouvert sur la section Sources.
- Desktop >768px : sélecteur complet inchangé.
- **Aucune autre modification nécessaire** : le masquage était déjà correct.

---

## Correctif 2 — Tooltip GrainTrack3D non fonctionnel (bug P3)

### Cause racine identifiée
L'implémentation P3 d'origine plaçait l'indicateur ⓘ dans un **élément frère** (`#gt3dInfo`), distinct de l'icône GrainTrack3D. Or l'utilisateur tape **l'icône elle-même** (le geste naturel) — pas le petit ⓘ qu'il ne remarque pas. L'icône désactivée ne faisait que `e.preventDefault()` → **aucun retour visuel**. (Les pistes « timing » et « delegation » du prompt n'étaient pas en cause : `_initTouchTooltips` utilise bien la délégation sur `document` ; et le ⓘ n'était pas enfant du lien, donc pas de souci de `preventDefault`. Le vrai problème était **ergonomique** : mauvais élément déclencheur.)

### Fix appliqué — l'icône elle-même devient le déclencheur
1. **`index.html`** : le lien est désormais enveloppé dans un wrapper `.selector-with-tooltip` :
   ```html
   <span class="selector-with-tooltip graintrack3d-wrap" id="gt3dWrap" style="display:none;">
     <a id="graintrack3d-link" ... aria-label="..."> <svg .../> </a>
   </span>
   ```
   (Suppression du `title=""` et du `style="display:none"` inline du lien ; c'est le **wrapper** qui est affiché/masqué.)

2. **`js/app.js`** — la bulle (`.tooltip-bubble` : 🌍 + texte + flèche) est créée **dans le wrapper** par `_showGrainTrack3DInfo()` (état désactivé), en `createElement`/`textContent` (zéro `innerHTML`). Le ⓘ séparé est supprimé.

3. **`js/app.js`** — le handler de clic du lien désactivé **ouvre/ferme la bulle** :
   ```js
   gt3dLink.addEventListener('click', (e) => {
     if (!gt3dLink.classList.contains('graintrack3d-link--disabled')) return;
     e.preventDefault();
     const wrap = document.getElementById('gt3dWrap');
     if (!wrap || !wrap.querySelector('.tooltip-bubble')) return;
     e.stopPropagation();              // évite la fermeture immédiate par la délégation document
     const wasOpen = wrap.classList.contains('tooltip-open');
     this._closeAllTooltips();
     if (!wasOpen) { wrap.classList.add('tooltip-open'); this._clampTooltip(wrap); }
   });
   ```
   Le `stopPropagation()` est **essentiel** : sans lui, le même clic remonterait à la délégation `document` de `_initTouchTooltips` qui refermerait aussitôt la bulle (`!closest('.tooltip-bubble')` → `_closeAllTooltips`).

4. **`css/style.css`** : remplacement de l'ancien bloc `.graintrack3d-info` (+ override `.tooltip-info`) par `.graintrack3d-wrap { position: relative; display: inline-flex; align-items/align-self: center }`. La bulle utilise le positionnement `.tooltip-bubble` par défaut et **hérite du clamp P2** (`--tt-shift`).

### Comportement obtenu
| Contexte | Comportement |
|---|---|
| Mobile, denrée non supportée (Cacao) | Tap sur l'icône grisée → bulle « Denrée non suivie par GrainTrack3D (céréales et oléagineux uniquement) ». Tap ailleurs → fermeture. Clamp viewport actif (P2). |
| Mobile, denrée supportée (Blé) | Pas de bulle ; tap → ouvre GrainTrack3D (`target="_blank"`, `rel="noopener noreferrer"`). |
| Desktop, non supportée | Survol de l'icône → bulle (`.selector-with-tooltip:hover`). Plus de `title` natif en désactivé → pas de double-tooltip. |
| Desktop, supportée | `title` natif conservé au survol (pas de bulle dans cet état → aucun conflit). |

### a11y
`aria-disabled="true"` (désactivé) et `aria-label` dépendant de l'état conservés/mis à jour ; clic neutralisé ; `rel="noopener noreferrer"` intact.

---

## Correctif 3 — Contraste alerte déclenchée en dark mode

### Diagnostic
```css
.alert-card.triggered { background: #FEF2F2; }   /* rose clair, codé en dur, non adaptatif */
.alert-card-name      { color: var(--black); }    /* → #E8E4DB (clair) en dark mode */
.alert-card-detail    { color: var(--grey); }      /* → #A0A0B0 (clair) en dark mode */
```
En dark mode, le fond reste rose clair fixe mais le texte s'éclaircit (variables inversées) → **texte clair sur fond rose clair = illisible** (le nom « Blé » et le prix de déclenchement). Le badge « Déclenchée ! » (`.alert-card-status.triggered`, fond/texte fixes auto-contenus) restait lui lisible.

### Fix appliqué
Override dark-mode du **fond** (et non du texte — `var(--black)` clair convient sur fond sombre) :
```css
[data-theme="dark"] .alert-card.triggered {
  background: rgba(239, 83, 80, 0.16);   /* rouge sombre translucide */
  border-left-color: var(--red);
}
```
- Spécificité `(0,3,0)` > `[data-theme="dark"] .alert-card` `(0,2,0)` et > base `.alert-card.triggered` → l'emporte en dark.
- **Light mode inchangé** : fond rose `#FEF2F2` + texte `var(--black)=#2C2C2C` foncé → déjà lisible.
- Dark mode : texte `var(--black)=#E8E4DB` clair sur fond rouge sombre → contraste élevé (WCAG AA).

> Conformément à la mise en garde du prompt : **pas** de `var(--black)` forcé sur le texte (qui serait clair en dark) ; c'est le **fond** qu'on assombrit pour que le texte clair existant redevienne lisible.

---

## Synchronisation `site/`
✅ `site/index.html`, `site/css/style.css`, `site/js/app.js` recopiés et **identiques** (`cmp`). (`js/i18n.js` non modifié — aucun nouveau texte : les messages réutilisent les clés existantes `graintrack3d_tooltip` / `graintrack3d_tooltip_disabled`.)

---

## Vérifications statiques
- `node --check js/app.js` → OK.
- Accolades CSS équilibrées (624/624).
- Aucune référence orpheline `gt3dInfo` / `.graintrack3d-info` ; `#gt3dWrap` cohérent (HTML + JS + CSS).
- Lien GrainTrack3D : `title` plus en dur, géré par état (actif=hint / désactivé=supprimé).

## Tests runtime à valider sur device
- [ ] **C1** : re-test sur déploiement courant → barre mobile = pastille seule ; tap pastille → menu sur Sources.
- [ ] **C2** : Cacao sur iPhone → tap icône grisée → message visible ; tap ailleurs → fermeture ; Blé → lien actif ouvre GrainTrack3D ; desktop survol OK (actif + désactivé).
- [ ] **C2** : bulle ne déborde pas du viewport (clamp P2).
- [ ] **C3** : alerte déclenchée en dark mode → nom + prix lisibles ; light mode inchangé.

## Observations
1. **Hypothèse déploiement (C1/C2)** : les symptômes du test 18h24 sont cohérents avec un déploiement antérieur à `9cde1fa`. Le correctif C2 (icône = déclencheur) résout le problème **indépendamment** de cette hypothèse et améliore l'ergonomie ; C1 était déjà correct côté code (seul l'ajout focus-Sources a été fait).
2. **Desktop, état désactivé** : le tooltip passe du `title` natif à la bulle stylée (au survol). Léger changement de rendu (cohérent avec les autres tooltips), pas une régression. a11y préservée via `aria-label`.
3. **Pas de nouvelle clé i18n** nécessaire (réutilisation des clés existantes).
