# RAPPORT_CORRECTIF_C5 — Input prix alertes illisible en dark mode

**Projet** : GrainWatch · **Version** : v0.9.1 · **Date** : 26/05/2026
**Type** : Correctif a11y / contraste · **Test de référence** : iPhone 14, Safari iOS, 26/05/2026

---

## 1. Cause racine (confirmée par lecture)

`.alerts-input` (`css/style.css`) ne déclarait **aucun `background`**. En dark mode,
`color: var(--black)` devient `#E8E4DB` (crème clair) tandis que le navigateur conserve
le fond blanc par défaut (`#FFFFFF`) → texte clair sur fond blanc = invisible.
Aucune règle `::placeholder` n'existait non plus.

Comparaison interne confirmée : `.alerts-select` déclare bien `background: var(--white)`
et fonctionne correctement → `.alerts-input` devait suivre le même pattern.

## 2. Modifications CSS effectuées

### Correction 1 — `background` ajouté à `.alerts-input`

Bloc `.alerts-input` (anciennement lignes ~3636-3644, désormais 3636-3647) :

```css
.alerts-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--grey-light);
  border-radius: var(--radius);
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--black);
  /* Fond explicite obligatoire : sans lui le navigateur garde #FFF en dark,
     rendant le texte clair (--black=#E8E4DB) illisible. Aligné sur .alerts-select. */
  background: var(--white);   /* ← AJOUT */
}
```

### Correction 2 — règle `::placeholder` ajoutée

Nouveau bloc inséré juste après `.alerts-input` (lignes 3649-3652) :

```css
.alerts-input::placeholder {
  color: var(--grey);
  font-weight: 400;
}
```

Le bloc `.alerts-input:focus` (3654-3658) est resté intact (vérifié).

## 3. Vérification des autres inputs du projet

Inventaire complet réalisé via `grep` sur `index.html` et `css/style.css`.

| Input / classe | Localisation | Fond explicite ? | `::placeholder` ? | Action |
|---|---|---|---|---|
| `.alerts-input` (`#alertValueInput`) | `index.html:471` | ❌ → ✅ corrigé | ❌ → ✅ ajouté | **Corrigé (C5)** |
| `.range-input` (8 occurrences : `#rangeMonthStart`, `#rangeYearStart`, `#rangeMonthEnd`, `#rangeYearEnd`, `#exportMonthStart`, …) | `index.html:240-251, 369-380` | ✅ `background: var(--creme)` (L929) + override dark `[data-theme="dark"] .range-input { background: var(--grey-lighter) }` (L1911-1915) | ✅ `.range-input::placeholder` (L943) | Aucune — déjà conforme |
| `.customize-item input[type="checkbox"]` | `css/style.css:541` | n/a (checkbox, pas de texte/placeholder) | n/a | Aucune |

**Conclusion** : seul `.alerts-input` était en défaut. `.range-input` gérait déjà
correctement fond clair + override dark + placeholder. Aucun autre input à corriger.

## 4. Résultat attendu (light / dark)

> ⚠️ Pas de navigateur dans l'environnement de dev (cf. CLAUDE.md « Validation en attente »).
> Vérification **statique** effectuée (variables CSS, accolades, cohérence avec `.alerts-select`
> et `.range-input`). Test visuel device à confirmer par JC.

- **Dark mode** : fond `#242444` (`--white`), texte saisi `#E8E4DB` (`--black`),
  placeholder `#A0A0B0` (`--grey`). Contraste texte ~estimé conforme WCAG AA.
- **Light mode** : fond `#FFFFFF`, texte `#2C2C2C`, placeholder `#6B6B6B`. Aucune régression
  (le fond blanc explicite est identique au comportement par défaut antérieur).
- **`.alerts-select` et `.range-input`** : non touchés → aucune régression.

## 5. Synchronisation `site/`

`css/style.css` recopié vers `site/css/style.css` ; `diff` final vide → synchronisé.
(Note : `site/` est gitignoré à la racine et possède son propre dépôt git — fallback
GitHub Pages. La prod Vercel se déploie depuis la racine.)

## 6. Observations complémentaires

- Aucun `innerHTML` introduit — construction DOM inchangée, contrainte sécurité respectée.
- Le commentaire CSS ajouté explique le POURQUOI (piège fond/`var(--black)` en dark),
  conforme à la politique de commentaires.
- Pattern récurrent du projet : tout composant utilisant `var(--black)`/`var(--white)`
  sans fond explicite risque le bug d'inversion en dark (déjà rencontré sur les tooltips).
  `.alerts-input` était le dernier input concerné.

## 7. Commit suggéré

```
fix(a11y): contraste input prix alertes en dark mode (C5 v0.9.1)
```
