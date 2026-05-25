# Rapport — Lien inter-app GrainWatch → GrainTrack3D (v1)

**Date** : 25 mai 2026
**Projet** : GrainWatch v0.8.1
**Feature** : Bouton globe 3D dans le header du détail denrée → ouvre GrainTrack3D avec la denrée pré-sélectionnée via paramètre URL.
**Statut** : ✅ Implémenté et synchronisé `site/`. À tester après déploiement Vercel.

---

## Phase 0 — Vérification du paramètre URL côté GrainTrack3D

**Source consultée (lecture seule)** :
`/mnt/c/JobDirectory/CLAUDE_PROJECTS/_WEB/GrainTrack3D/GrainTrack3D/GrainTrack3D/`

**Mécanisme trouvé** — `src/App.jsx` lignes 30-36 :

```jsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const grainParam = params.get('grain')
  if (grainParam && GRAIN_LIST.some((g) => g.key === grainParam)) {
    setSelectedGrain(grainParam)
  }
}, [setSelectedGrain])
```

**Format exact** :
- **Nom du paramètre** : `grain` (et **non** `commodity` comme suggéré dans le spec initial)
- **Casse** : minuscules strictes (`wheat`, pas `WHEAT`)
- **Validation** : la valeur doit exister dans `GRAIN_LIST` (`src/data/grainList.js`)

**Valeurs acceptées (12 céréales/oléagineux)** :
`wheat`, `corn`, `rice`, `soybean`, `sugar`, `barley`, `oats`, `sorghum`, `rapeseed`, `groundnut`, `lentils`, `millet`

**Documentation interne GrainTrack3D** : `CLAUDE.md` du repo cible, section "Étape 6", confirme l'intention :
> `src/App.jsx` : lecture du parametre URL `?grain=xxx` au montage pour integration GrainWatch.

→ La feature côté GrainTrack3D est **prête depuis l'étape 6**. Aucune modification du repo GrainTrack3D nécessaire.

---

## Mapping GrainWatch ↔ GrainTrack3D

GrainWatch utilise déjà des `id` lowercase identiques aux `key` de `GRAIN_LIST` pour les denrées communes. **Aucune transformation requise**.

| GrainWatch `id` | GrainTrack3D `key` | Supporté |
|---|---|---|
| `wheat` | `wheat` | ✅ |
| `corn` | `corn` | ✅ |
| `rice` | `rice` | ✅ |
| `soybean` | `soybean` | ✅ |
| `sugar` | `sugar` | ✅ |
| `barley` | `barley` | ✅ |
| `oats` | `oats` | ✅ |
| `sorghum` | `sorghum` | ✅ |
| `rapeseed` | `rapeseed` | ✅ |
| `groundnut` | `groundnut` | ✅ |
| `lentils` | `lentils` | ✅ |
| `millet` | `millet` | ✅ |
| `coffee`, `cocoa`, `palm_oil`, `cotton`, `sunflower`, `soybean_oil`, `rubber`, `tea`, `orange`, `banana`, `olive_oil`, `coconut_oil`, `wool`, `tobacco` | — | ❌ (pas de port vraquier céréalier) |

→ Pour les 14 denrées non-supportées, l'icône globe est **cachée** (`buildGrainTrack3DUrl()` retourne `null`, le code de visibilité bascule `display: none`).

---

## Modifications fichier par fichier

### 1. `index.html`
Ajout d'un `<a id="graintrack3d-link">` dans `.detail-price-row`, juste avant `#detailPrice`. SVG globe inline 28×28, viewBox 0 0 24 24 (cercle + équateur + méridien + arc d'ombre). Attributs sécurité : `target="_blank"`, `rel="noopener noreferrer"`, `aria-label`. `display: none` par défaut.

### 2. `css/style.css`
Ajout d'un bloc à la fin du fichier (après les rules `@media` mobile) :
- `.graintrack3d-link` — flex center, color `var(--terracotta)` (bascule auto dark mode), transitions hover/active
- `.graintrack3d-link:hover` — background terracotta 12%, scale 1.1
- `.graintrack3d-link:focus-visible` — outline 2px
- `.graintrack3d-icon` — width/height 28px

Aucune nouvelle variable CSS. Aucune media query. Aucune dépendance externe.

### 3. `js/i18n.js`
Ajout d'une clé dans `translations` :
- `graintrack3d_tooltip` — FR: "Voir le transit maritime mondial sur GrainTrack3D" / EN: "View global maritime transit on GrainTrack3D"

### 4. `js/app.js`
**A — En-tête du fichier** (avant `const App = {`) :
- Constante `GRAINTRACK3D_BASE_URL = 'https://grain-track3-d.vercel.app'`
- Constante `GRAINTRACK3D_PARAM_NAME = 'grain'`
- Constante `GRAINTRACK3D_SUPPORTED_KEYS` (Set des 12 céréales)
- Fonction `buildGrainTrack3DUrl(commodityId)` :
  - Vérifie type string non vide
  - Normalise en lowercase
  - Vérifie l'appartenance à `GRAINTRACK3D_SUPPORTED_KEYS`
  - Construit l'URL via `new URL()` + `searchParams.set()` (pas de concaténation)
  - Retourne `null` si denrée non supportée

**B — Dans `loadDetail()`**, juste après mise à jour de `#detailCode` et `#detailPrice` :
```js
const gt3dLink = document.getElementById('graintrack3d-link');
if (gt3dLink) {
  const gt3dUrl = buildGrainTrack3DUrl(selectedCommodity);
  if (gt3dUrl) {
    gt3dLink.href = gt3dUrl;
    gt3dLink.title = I18N.t('graintrack3d_tooltip');
    gt3dLink.style.display = 'inline-flex';
  } else {
    gt3dLink.style.display = 'none';
    gt3dLink.href = '#';
  }
}
```

→ `loadDetail()` étant appelé à chaque changement de denrée, période, devise, source et **langue** (cf. ligne 218 : le toggle langue invoque `loadDetail()`), le tooltip se rafraîchit automatiquement en bascule FR↔EN.

### 5. `site/` (fallback GitHub Pages)
Les 4 fichiers ci-dessus copiés à l'identique dans `site/`.

---

## Sécurité — Vérifications

| Règle | Statut |
|---|---|
| `rel="noopener noreferrer"` sur `<a target="_blank">` | ✅ Présent dans index.html |
| URL construite via `new URL()` + `searchParams.set()` (pas de `+`) | ✅ `buildGrainTrack3DUrl()` |
| Pas de `window.open()`, pas d'addEventListener('click') | ✅ Navigation native via `<a href>` |
| Pas de `eval()` / `innerHTML` avec données dynamiques | ✅ Aucun (URL injectée via `.href`, tooltip via `.title`) |
| SVG inline (pas de CDN tiers) | ✅ Inline dans index.html |
| Validation type + whitelist côté builder | ✅ `typeof === 'string'` + Set lookup |
| Whitelist côté URL (denrée invalide → URL non générée) | ✅ Set de 12 keys |
| Pas de donnée sensible dans l'URL | ✅ Uniquement code denrée publique |
| Aucune nouvelle dépendance npm / CDN | ✅ Zéro |
| CSP `index.html` impactée ? | ❌ Non — la navigation `<a target="_blank">` ouvre un nouveau contexte de navigation, non couvert par `connect-src`/`default-src`. La directive `navigate-to` n'est pas définie dans la meta CSP actuelle. |
| Headers Vercel `vercel.json` impactés ? | ❌ Non — `X-Frame-Options: DENY` ne s'applique qu'aux iframes ; `Referrer-Policy: strict-origin-when-cross-origin` enverra l'origine `https://grainwatch.vercel.app` à GrainTrack3D (acceptable, juste l'origine, pas le chemin). |

---

## Tests manuels à effectuer après déploiement

URL de production : **https://grainwatch.vercel.app/**

1. **Affichage icône** : ouvrir l'app → la denrée par défaut est "Blé" → l'icône globe doit être visible à gauche du prix dans le header détail.
2. **Tooltip** : survoler l'icône → tooltip "Voir le transit maritime mondial sur GrainTrack3D" (FR) doit s'afficher après ~1s.
3. **Bascule langue** : cliquer 🇫🇷→🇬🇧 → tooltip doit basculer en "View global maritime transit on GrainTrack3D".
4. **Mode sombre** : toggle 🌙 → la couleur de l'icône doit basculer du terracotta clair (#C0392B) au terracotta dark (#E07B5A). Hover background doit rester visible.
5. **Navigation** : clic sur l'icône → nouvel onglet ouvre **https://grain-track3-d.vercel.app/?grain=wheat** → GrainTrack3D doit pré-cocher "Blé 🌾" dans le `GrainSelector` (dropdown top-left) → seuls les vraquiers transitant vers des ports blé doivent être affichés.
6. **Denrée non-supportée** : sélectionner "Café" dans la sidebar → l'icône doit **disparaître** (display: none).
7. **Switch entre denrées** : sélectionner "Maïs" → icône réapparaît, href bascule sur `?grain=corn`. Tester "Riz" → `?grain=rice`. Tester "Soja" → `?grain=soybean`.
8. **Tab middle-click / clic droit → "Ouvrir dans un nouvel onglet"** : doit fonctionner (c'est un vrai `<a href>`, pas un handler JS).
9. **Mobile** : ouvrir sur mobile → l'icône doit rester visible dans le header (flex-wrap permet d'aller à la ligne si nécessaire). Tap → ouverture nouvel onglet.
10. **URL générée** : ouvrir DevTools → onglet Eléments → inspecter `#graintrack3d-link` → vérifier que `href` est bien formé : `https://grain-track3-d.vercel.app/?grain=wheat` (encodage automatique géré par URL API).

---

## Ce qui n'a PAS été fait

- Pas de header HTTP additionnel dans `vercel.json` (rien à ajouter — voir tableau sécurité)
- Pas de modification du repo GrainTrack3D (la feature côté cible est déjà prête depuis l'étape 6)
- Pas de versioning (la feature ne justifie pas un bump v0.9 à elle seule — sera incluse dans v0.9 "Page Géopolitique dédiée + Navigation" planifiée dans la roadmap)

---

## Prochaines évolutions possibles (hors scope v1)

- **Lien bidirectionnel** : ajouter dans GrainTrack3D un lien de retour vers GrainWatch quand un navire est sélectionné (avec la céréale correspondante)
- **Multi-denrées** : si GrainTrack3D supporte un jour le multi-grain dans l'URL (ex: `?grain=wheat,corn`), adapter `buildGrainTrack3DUrl()` pour accepter un array
- **Iframe embed** : intégrer GrainTrack3D dans un panneau de GrainWatch — nécessiterait de retirer `frame-ancestors 'none'` côté GrainTrack3D et de gérer la communication via `postMessage`
