# RAPPORT — Correctif C4-bis : masquage forcé du sélecteur API via JS

**Projet** : GrainWatch · **Version** : v0.9.1 · **Date** : 26 mai 2026
**Type** : Correctif (Phase 2 — double verrouillage CSS + JS)
**Fichiers touchés** : `js/app.js`, `site/js/app.js`

---

## 1. Contexte

Le durcissement CSS de C4 (`#ctrlSource, .source-selector { display: none !important }` dans `@media (max-width: 768px)`, `css/style.css:2299-2300`) n'a pas suffi : Safari iOS continuait d'afficher les boutons du sélecteur API en portrait sur iPhone 14. La cause n'a pas pu être reproduite côté code (CSS déployé correct, viewport meta OK, aucun override). Symptôme cohérent avec un cache / rendu WebKit non déterministe.

**Décision** : double verrouillage — on garde le CSS (ceinture) et on ajoute un masquage forcé en JS (bretelles).

## 2. Implémentation

### Méthode `enforceSourceHiding()` — `js/app.js` (après `setupToolbarOverflow`)

Ajoutée comme **méthode de l'objet `App`** (le codebase n'utilise pas de fonctions standalone — adaptation par rapport au snippet du prompt, même logique).

```javascript
enforceSourceHiding() {
  const ctrl = document.getElementById('ctrlSource');
  const pastille = document.getElementById('sourcePastille');
  if (!ctrl) return;

  const mq = window.matchMedia('(max-width: 768px)');

  const apply = (mobile) => {
    if (mobile) {
      ctrl.style.display = 'none';
      if (pastille) pastille.style.display = '';
    } else {
      ctrl.style.display = '';
      if (pastille) pastille.style.display = 'none';
    }
  };

  apply(mq.matches);

  if (mq.addEventListener) {
    mq.addEventListener('change', (e) => apply(e.matches));
  } else if (mq.addListener) {
    mq.addListener((e) => apply(e.matches));  // Fallback Safari < 14
  }
}
```

### Appel — `init()` (`js/app.js`)

```javascript
this.setupToolbarOverflow();
this.enforceSourceHiding();  // C4-bis : bretelle JS pour Safari iOS
this.updateTime();
```

Placé **après** `setupToolbarOverflow()` comme demandé, donc après que la barre a fini son relayout (et `#ctrlSource` ne fait de toute façon plus partie du relayout depuis v0.9.1, `app.js:1223-1225`).

## 3. Confirmation que la fonction est en place

| Vérification | Résultat |
|---|---|
| `node --check js/app.js` | ✅ Syntaxe valide |
| `node --check site/js/app.js` | ✅ Syntaxe valide |
| Occurrences `enforceSourceHiding` dans `js/app.js` | 2 (définition + appel) |
| Occurrences `enforceSourceHiding` dans `site/js/app.js` | 2 (définition + appel) |
| Appel positionné après `setupToolbarOverflow()` | ✅ |

## 4. Comportement attendu

Logique croisée JS ↔ CSS existant (`.source-pastille` : `display:none` en desktop `style.css:1314`, `inline-flex` en mobile `style.css:2301`) :

| Contexte | `#ctrlSource` | `#sourcePastille` |
|---|---|---|
| **Mobile portrait (≤768px)** | masqué — inline `display:none` posé par JS + CSS `!important` (redondant) | visible — JS retire le style inline, le CSS mobile `inline-flex` s'applique |
| **Desktop / paysage (>768px)** | visible — JS retire le style inline, le CSS desktop reprend | masqué — JS pose `display:none` + CSS desktop `none` (redondant) |
| **Rotation portrait↔paysage** | bascule instantanée via le listener `matchMedia('change')` | idem |

**Pourquoi la bretelle JS résout le cas Safari** : si la règle CSS `!important` n'est pas appliquée (cache/rendu), le style inline `display:none` posé par JS masque quand même `#ctrlSource` — aucune autre règle `!important` ne le ré-affiche. Le verrou tient même CSS défaillant.

## 5. Tests

> ⚠️ **Pas de navigateur dans l'environnement de dev** — les tests runtime sur device réel restent à exécuter par JC. Vérification **statique** faite ici.

**Vérifié statiquement :**
- ✅ Syntaxe JS valide (`node --check`) sur les 2 fichiers
- ✅ IDs référencés (`ctrlSource`, `sourcePastille`) présents dans `index.html` (lignes 43, 66)
- ✅ Cohérence avec les règles CSS desktop/mobile de `.source-pastille` et `#ctrlSource`
- ✅ Aucun `innerHTML`, aucune donnée externe → conforme Security Hardening Policy
- ✅ Dark mode : la fonction ne touche que `display` (jamais de couleur) → neutre vis-à-vis du thème

**À tester sur device (JC)** — vider le cache Safari au préalable :
1. iPhone portrait → boutons API masqués, pastille 🏛️ visible
2. iPhone paysage / desktop → sélecteur API visible et fonctionnel, pastille masquée
3. Rotation portrait↔paysage → bascule instantanée sans rechargement
4. Light + dark → comportement identique

## 6. Périmètre respecté (non touché)

- CSS existant inchangé (ceinture CSS conservée)
- Menu hamburger et `.menu-api-btn` non affectés
- `setupToolbarOverflow()` non modifié
- Tooltips, dark mode, autres contrôles de la toolbar non touchés

## 7. Synchronisation `site/`

✅ `js/app.js` → `site/js/app.js` recopié et re-vérifié (`node --check` OK).
