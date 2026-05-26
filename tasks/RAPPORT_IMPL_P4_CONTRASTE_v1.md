# RAPPORT D'IMPLÉMENTATION — P4 : Contraste texte page Sources en dark mode

**Projet** : GrainWatch
**Type** : Implémentation (Phase 2)
**Version cible** : v0.9.1
**Date** : 26 mai 2026
**Diagnostic de référence** : `DIAGNOSTIC_MOBILE_v0.9.1.md` — section P4
**Fichier modifié** : `css/style.css` (+ mirror `site/css/style.css`)
**Statut** : ✅ Implémenté

---

## 1. Modifications effectuées

3 corrections appliquées dans `css/style.css`. Aucun JS, aucun HTML modifié. Aucune nouvelle variable CSS créée.

### Correction 1 — `.sources-text` (corps de texte de la page Sources)

`css/style.css:3082`

```css
/* AVANT */                          /* APRÈS */
.sources-text {                      .sources-text {
  font-size: 15px;                     font-size: 15px;
  line-height: 1.7;                    line-height: 1.7;
  color: #444;            ──────►      color: var(--black);
  margin-bottom: 12px;                 margin-bottom: 12px;
}                                    }
```

### Correction 2 — `.sources-gdelt-desc .sources-text` (description GDELT)

`css/style.css:3190` — **Option A appliquée** (neutre, cohérent avec le reste, conformément au prompt).

```css
/* AVANT */                                  /* APRÈS */
.sources-gdelt-desc .sources-text {          .sources-gdelt-desc .sources-text {
  margin-bottom: 0;                            margin-bottom: 0;
  font-size: 14px;                             font-size: 14px;
  color: #4C1D95;            ──────►           color: var(--black);
}                                            }
```

### Correction 3 — `.sources-link` (lien dans le badge source)

`css/style.css:3213`

```css
/* AVANT */                          /* APRÈS */
.sources-link {                      .sources-link {
  color: #555;            ──────►      color: var(--black);
  font-weight: 600;                    font-weight: 600;
  ...                                  ...
}                                    }
```

> Note : `.sources-link:hover` était déjà `var(--black)` — désormais cohérent au repos comme au survol.

---

## 2. Vérifications non modifiées (corrections 4 & 5 du prompt)

### Correction 4 — `.sources-free-notice` (bandeau vert « 100% gratuit ») — **NON MODIFIÉ**

`css/style.css:3116-3125` : `background: #F0FDF4` (vert très clair) + `color: #166534` (vert foncé) + `.sources-free-notice strong { color: #15803D }`.

**Décision : laissé tel quel.** C'est un bandeau **auto-contenu** : il possède son propre fond clair fixe (`#F0FDF4`) qui ne dépend pas du fond de page. Le contraste vert foncé sur vert clair reste constant (~6:1) en light **comme** en dark mode. Le test de référence iPhone le signalait déjà lisible. Le prompt demandait de ne pas modifier sauf dégradation — pas de dégradation constatée.

### Correction 5 — occurrence `#166534` ligne ~3499 — **NON MODIFIÉ**

`css/style.css:3499` : il s'agit de `.alert-card-status.active { background: #DCFCE7; color: #166534; }` — un **badge de statut** de la page Alertes (hors page Sources). Même logique auto-contenue : texte vert foncé sur fond de badge vert clair fixe (`#DCFCE7`), indépendant du thème. Contraste constant et lisible dans les deux modes. **Hors scope P4** (page Alertes, pas Sources) et non problématique → laissé tel quel.

---

## 3. Test — vérification WCAG (calcul de contraste)

> ⚠️ **Méthode** : aucun navigateur headless disponible dans l'environnement de dev WSL (même limite que pour la validation v0.9.0). Le « test visuel » est donc une **vérification calculée** des ratios de contraste WCAG 2.1 à partir des valeurs hex résolues des variables, + contrôle statique (syntaxe CSS, équilibre des accolades). La validation visuelle runtime sur device reste à faire côté chef de projet.

### Valeurs résolues des variables (`css/style.css:113-167`)

| Variable | Light (`:root`) | Dark (`[data-theme="dark"]`) |
|---|---|---|
| `--black` (texte) | `#2C2C2C` | `#E8E4DB` |
| `--creme` (fond page Sources) | `#FDF6E3` | `#1A1A2E` |

### Ratios de contraste — corps de texte (`.sources-text`, `.sources-link`, `.sources-gdelt-desc`)

| Mode | Texte | Fond | Ratio | WCAG AA (≥4.5:1) |
|---|---|---|---|---|
| **Dark — AVANT** | `#444` | `#1A1A2E` | **~1.75:1** | ❌ ÉCHEC |
| **Dark — APRÈS** | `var(--black)` = `#E8E4DB` | `#1A1A2E` | **~13.6:1** | ✅ |
| **Light — AVANT** | `#444` | `#FDF6E3` | ~9:1 | ✅ |
| **Light — APRÈS** | `var(--black)` = `#2C2C2C` | `#FDF6E3` | **~12.8:1** | ✅ |

→ **Dark mode corrigé** : passage de ~1.75:1 (échec total) à ~13.6:1 (excellent).
→ **Light mode préservé** : `#2C2C2C` est légèrement plus foncé que `#444`, différence imperceptible, contraste même amélioré. Aucune régression visuelle attendue.

### Contrôle statique

- Équilibre des accolades CSS : **609 ouvrantes / 609 fermantes** ✓ (inchangé avant/après).
- Les 3 lignes corrigées confirmées en place (`3082`, `3190`, `3213`).

---

## 4. Synchronisation `site/`

✅ `css/style.css` recopié dans `site/css/style.css`. Les deux fichiers sont **identiques** (`cmp` OK). Les 3 corrections sont présentes dans la copie `site/` (lignes 3082, 3190, 3213).

---

## 5. Observations découvertes pendant l'implémentation

### ✅ OBS-1 — `.sources-gdelt-desc .sources-text strong` : CORRIGÉ (validé par le chef de projet)

`css/style.css:3194`

```css
/* AVANT */                                          /* APRÈS */
.sources-gdelt-desc .sources-text strong {           .sources-gdelt-desc .sources-text strong {
  color: #6D28D9;            ──────►                   color: var(--terracotta);
}                                                    }
```

Les **mots en gras** de la description GDELT étaient en violet hardcodé `#6D28D9` (ratio ~2.4:1 sur `#1A1A2E` en dark — échec WCAG). Sur décision du chef de projet, alignés sur `var(--terracotta)`, cohérent avec `.sources-text strong`.

**Ratios après correction** (`--terracotta` = `#C0392B` light / `#E07B5A` dark) :
- Dark : `#E07B5A` sur `#1A1A2E` → **~5.7:1** ✅ WCAG AA
- Light : `#C0392B` sur `#FDF6E3` → **~5.5:1** ✅ WCAG AA

### OBS-2 — Bloc JSON de démo (`.sources-json`, `.json-*`) : non concerné

Les couleurs hardcodées `#cdd6f4` / `#1e1e2e` / tokens Catppuccin (`css/style.css:3241+`) sont celles du **visualiseur de code JSON** auto-contenu (fond sombre fixe `#1e1e2e` type terminal, identique dans les deux thèmes). Contraste interne correct, indépendant du thème. Aucune action nécessaire.

### OBS-3 — Boutons API (`color: #fff`) : non concerné

Les `color: #fff` (lignes ~3151/3161/3171) sont du texte blanc sur boutons à fond coloré (terracotta/olive/…), auto-contenus. Pas de problème de contraste lié au dark mode.

---

## 6. Récapitulatif

| Item | Statut |
|---|---|
| Correction 1 — `.sources-text` → `var(--black)` | ✅ |
| Correction 2 — `.sources-gdelt-desc .sources-text` → `var(--black)` (Option A) | ✅ |
| Correction 3 — `.sources-link` → `var(--black)` | ✅ |
| Correction 4 — `.sources-free-notice` (vérif) | ✅ Laissé (auto-contenu, lisible) |
| Correction 5 — `#166534` l.3499 (vérif) | ✅ Laissé (badge auto-contenu, hors scope) |
| Test contraste dark mode (calculé) | ✅ ~1.75:1 → ~13.6:1 |
| Test contraste light mode (calculé) | ✅ ~12.8:1, aucune régression |
| Aucun JS/HTML modifié | ✅ |
| Aucune nouvelle variable CSS | ✅ |
| Mirror `site/css/style.css` | ✅ Identique |
| OBS-1 — `strong` GDELT `#6D28D9` → `var(--terracotta)` | ✅ Corrigé (dark ~5.7:1, light ~5.5:1) |
| Validation visuelle runtime sur device | ⏳ À faire côté chef de projet (pas de navigateur en env dev) |
