# RAPPORT CORRECTIF — C6 : Toolbar overflow cassé par flex-end

**Projet** : GrainWatch · **Version** : v0.9.1 · **Date** : 26 mai 2026
**Type** : Correctif (Phase 2 — fix toolbar mobile)
**Basé sur** : `RAPPORT_DIAGNOSTIC_C6_TOOLBAR_MOBILE_v1.md`
**Fichiers touchés** : `css/style.css` (+ sync `site/css/style.css`)

> ⚠️ **Limite** : aucun navigateur dans l'environnement de dev. Les 4 tests sont **raisonnés/statiques** (équilibre CSS, présence des règles, analyse du modèle flex). La validation **runtime sur device reste à faire par JC**.

---

## 1. Option choisie : **A (CSS)** — et pourquoi

L'**Option A** (CSS, retrait de `justify-content: flex-end` + spacer) corrige le problème **à la source** sans complexifier le JS, conformément au diagnostic et à la préférence du prompt. L'Option B (mesure JS par somme des `offsetWidth`) reste documentée en §6 comme repli si A échoue en runtime.

**Mécanisme** : un pseudo-élément `::before { flex: 1 1 0 }` joue le rôle de *spacer* :
- quand tout tient, il absorbe l'espace libre et **pousse les contrôles à droite** (rendu identique à `flex-end`) ;
- dès que ça déborde, il se réduit à 0 et les enfants **débordent vers la droite** (sens normal LTR) → `scrollWidth > clientWidth` redevient **vrai** → `relayout()` détecte enfin l'overflow et déplace les contrôles non prioritaires dans le menu.

Avantage vs `margin-left: auto` sur le 1ᵉʳ enfant : le spacer est **toujours le premier child** quel que soit le réordonnancement DOM opéré par `relayout()` (qui déplace des nœuds réels). Robuste, zéro couplage avec l'identité du premier élément.

---

## 2. Modifications exactes (avant / après)

### Modif 1 — `.header-right` mobile : retrait de `flex-end` + spacer (`css/style.css`, bloc `@media (max-width: 768px)`)

**AVANT** (lignes ~2275-2284) :
```css
.header-right {
  gap: 6px;
  flex-wrap: nowrap;
  justify-content: flex-end;          /* ← COUPABLE (C6) */
  flex: 1;
  min-width: 0; /* permet la mesure de débordement (scrollWidth > clientWidth) */
}

/* Pas de compression : largeur naturelle conservée pour détecter le débordement */
.header-right > * { flex-shrink: 0; }
```

**APRÈS** :
```css
.header-right {
  gap: 6px;
  flex-wrap: nowrap;
  /* C6 — `justify-content: flex-end` RETIRÉ : ... (commentaire complet dans le code) */
  flex: 1;
  min-width: 0; /* permet la mesure de débordement (scrollWidth > clientWidth) */
}

/* Spacer flex : pousse les contrôles à droite quand tout tient ; se réduit à 0
   dès que ça déborde → overflow vers la droite → scrollWidth fiable.
   Non ciblé par `.header-right > *` (le combinateur enfant ne matche pas les
   pseudo-éléments) → garde son flex-shrink. */
.header-right::before {
  content: '';
  flex: 1 1 0;
}

/* Pas de compression : largeur naturelle conservée pour détecter le débordement */
.header-right > * { flex-shrink: 0; }
```

### Modif 2 — `.update-time` masqué en mobile (bonus diagnostic) (`css/style.css`, même `@media`)

**AVANT** (lignes ~2271-2273) :
```css
.update-time {
  font-size: 10px;
}
```

**APRÈS** :
```css
/* C6 — masqué en mobile : libère de l'espace dans .header-left (flex:0 0 auto,
   ne rétrécit pas) → moins de pression de débordement sur .header-right.
   L'info de fraîcheur reste dispo dans le badge source (page/menu Sources). */
.update-time {
  display: none;
}
```

**Aucune modification JS.** `setupToolbarOverflow()` / `relayout()` / `enforceSourceHiding()` inchangés. Handler pastille (S3) intact.

---

## 3. Résultats des 4 tests de vérification

> Légende : ✅ vérifié statiquement · 🔬 à confirmer en runtime sur device (pas de navigateur en env de dev).

### Test 1 — Détection d'overflow fonctionnelle (≤390px)
- ✅ **Analyse du modèle flex** : avec le spacer `flex:1 1 0` et `justify-content` par défaut (flex-start), le contenu excédentaire déborde vers la **droite**. `headerRight.scrollWidth` inclut alors l'overflow droit → `scrollWidth > clientWidth` est **vrai** → la boucle `relayout()` (`app.js:1247-1261`) s'exécute et `moved > 0`. Les enfants ayant `flex-shrink:0`, ils gardent leur largeur naturelle (overflow réel mesurable).
- ✅ Le spacer n'est pas affecté par `.header-right > * { flex-shrink:0 }` (les pseudo-éléments ne sont pas matchés par le combinateur enfant) → il conserve sa capacité à se réduire à 0.
- 🔬 À confirmer device : la toolbar ne déborde plus visuellement ; refresh/alertes/thème/langue/devise basculent dans le menu (badge compteur > 0) ; pastille + hamburger restent visibles, alignés à droite.

### Test 2 — Alignement desktop préservé (>768px)
- ✅ **Les deux modifs sont scopées dans `@media (max-width: 768px)`.** La règle desktop `.header-right` (`style.css:228-232`, sans `justify-content`, sans `::before`) est **inchangée**. L'alignement à droite desktop provient de `.header { justify-content: space-between }` (`style.css:193`), non touché.
- ✅ `#ctrlSource` (sélecteur API) reste visible/fonctionnel en desktop (masqué uniquement par le CSS mobile + C4-bis, qui ne s'appliquent pas >768px).
- 🔬 À confirmer device/DevTools : rendu desktop identique à l'avant-correctif.

### Test 3 — Pastille source en mobile (≤768px)
- ✅ `#sourcePastille` : CSS mobile `display: inline-flex` (`style.css:2301`) + `enforceSourceHiding` pose `display:''` → visible. `updateSourceBadge()` (`app.js:634-639`) y met l'icône de l'API active.
- ✅ `#ctrlSource` : masqué (`display:none !important` ligne 2299 + inline `none` via C4-bis).
- ✅ Clic pastille → `openMenu()` (`app.js:1141-1142`) : handler **non touché** → comportement C1 préservé.
- 🔬 À confirmer device.

### Test 4 — Dark mode (light ET dark)
- ✅ Les deux modifs ne touchent **que** des propriétés de layout (`display`, `flex`, pseudo-spacer) — **aucune couleur, aucun background**. Neutres vis-à-vis du thème. Aucune variable CSS de thème impliquée.
- 🔬 Confirmation visuelle device en dark recommandée par principe (régression improbable).

### Vérifications statiques exécutées
| Vérif | Résultat |
|---|---|
| Équilibre accolades `css/style.css` | ✅ 622 `{` / 622 `}` |
| Présence `.header-right::before` + commentaires C6 | ✅ lignes 2271, 2281, 2295 |
| Modifs bien dans le `@media (max-width:768px)` | ✅ |
| Règle desktop `.header-right` (228-232) intacte | ✅ |
| JS inchangé (`git diff` ne montre que `css/style.css`) | ✅ |

---

## 4. Synchronisation `site/`

✅ `css/style.css` → `site/css/style.css` recopié (`diff -q` → IDENTIQUES).
ℹ️ **Note** : `site/` est dans `.gitignore` (« Old deploy folder », jamais commité). La synchro est faite localement pour cohérence, mais `site/css/style.css` n'apparaît pas dans `git status` et **ne sera pas versionné** — c'est attendu. La prod Vercel sert depuis la racine.

---

## 5. Problèmes / observations complémentaires

- **Validation runtime indispensable** : l'Option A repose sur le comportement de `scrollWidth` avec un spacer flex. Le raisonnement est solide mais non testé en navigateur ici. Tester sur iPhone 14 portrait, **Chrome ET Safari iOS**.
- **`relayout()` après chargement des polices** : `.header-left` (logo) change de largeur quand les polices auto-hébergées (v0.9.0) finissent de charger. Le `ResizeObserver` observe `.header-right`, dont la **boîte** (flex:1) ne change pas forcément → le re-layout pourrait ne pas se redéclencher au bon moment. **Non bloquant** (la 1ʳᵉ passe en `init()` devrait déjà détecter l'overflow maintenant que `scrollWidth` fonctionne), mais si un flottement est observé device, ajouter `document.fonts.ready.then(() => relayout())` (Option B §6 ou simple appel). Laissé hors scope de ce correctif pour rester minimal.
- **`.update-time` masquée** : choix bonus demandé par le prompt. Si JC préfère la conserver en mobile, il suffit de remettre `font-size: 10px` à la place de `display: none` — le fix S1/S2 tient **sans** cette modif (le retrait de `flex-end` + spacer suffit), c'est de la défense en profondeur.

---

## 6. Repli — Option B (si A échoue en runtime)

Si, contre toute attente, la détection ne fonctionne toujours pas device, remplacer dans `relayout()` (`app.js:1248`) la condition `scrollWidth > clientWidth` par une mesure indépendante du `justify-content` :

```javascript
const overflowing = () => {
  let total = 0, n = 0;
  for (const el of headerRight.children) {
    if (getComputedStyle(el).display === 'none') continue;
    total += el.offsetWidth; n++;
  }
  total += Math.max(0, n - 1) * 6; // gaps mobiles (6px)
  return total > headerRight.clientWidth;
};
// ... if (!overflowing()) break;  dans la boucle PRIORITY
```

Non appliqué : l'Option A est préférable (corrige la cause, pas le symptôme) et devrait suffire.

---

*Correctif minimal : 2 règles CSS dans le `@media (max-width:768px)`. Aucun JS modifié.*
