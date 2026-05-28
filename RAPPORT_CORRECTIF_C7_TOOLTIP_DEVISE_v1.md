# RAPPORT_CORRECTIF_C7 — Tooltip devise non dynamique

**Projet** : GrainWatch · **Version** : v0.9.1 · **Date** : 28/05/2026
**Type** : Correctif UX / cohérence i18n · **Test de référence** : iPhone 14, Safari iOS, 28/05/2026

---

## 1. Diagnostic (lecture seule)

Le tooltip devise (icône ⓘ à côté des boutons `$ USD` / `€ EUR`) affichait un texte
**statique**, identique quelle que soit la devise sélectionnée :

> « Devise d'affichage. Les cours de base sont en dollars US, convertis selon le taux du jour. »

Localisation du texte :

| Emplacement | Rôle |
|---|---|
| `index.html:73` | `<span id="tooltipCurrencyText">` — texte par défaut servi avant exécution JS |
| `js/i18n.js:85-88` | clé i18n `tooltip_currency` (FR/EN), valeur **unique** |
| `js/app.js:990` (avant) | `tooltipCurrencyText.textContent = I18N.t("tooltip_currency")` dans `applyTranslations()` |

Mécanisme devise :
- État : `App.state.currency` (`js/app.js:42`, défaut `"USD"`).
- Changement : handler de clic sur `.currency-btn` (`js/app.js:161-169`) — pose `active`,
  écrit `this.state.currency = btn.dataset.currency`, puis recalcule la liste et le détail.
- Le tooltip était déjà **piloté par i18n** (donc traduit FR/EN), mais **pas par la devise**.

**Cause racine** : une seule clé i18n pour deux situations sémantiquement distinctes
(USD = devise de référence, EUR = conversion depuis USD). Le `textContent` était fixé une
fois pour toutes par `applyTranslations()` et jamais ré-évalué au changement de devise.

## 2. Correction appliquée

Principe : rendre le texte **dynamique** selon `App.state.currency`, en restant 100 %
i18n (FR/EN) et sans `innerHTML` (uniquement `textContent` sur une string de notre propre
dictionnaire de traductions — aucune donnée externe).

### 2.1 `js/i18n.js` — clé unique → deux clés (USD / EUR)

**Avant** (`:85-88`) :
```javascript
"tooltip_currency":   {
  fr: "Devise d'affichage. Les cours de base sont en dollars US, convertis selon le taux du jour.",
  en: "Display currency. Base prices are in US dollars, converted at the current exchange rate."
},
```

**Après** (`:85-94`) :
```javascript
// Tooltip devise — texte dynamique selon la devise active (cf. App.updateCurrencyTooltip)
"tooltip_currency_usd": {
  fr: "Devise d'affichage. Les cours sont en dollars US (devise de référence des marchés).",
  en: "Display currency. Prices are in US dollars (the markets' reference currency)."
},
"tooltip_currency_eur": {
  fr: "Devise d'affichage. Les cours de base (USD) sont convertis en euros selon le taux du jour.",
  en: "Display currency. Base prices (USD) are converted to euros at the current exchange rate."
},
```

### 2.2 `js/app.js` — nouvelle méthode `updateCurrencyTooltip()`

Ajoutée entre `updateLangButton()` et `applyTranslations()` (`:969-975`) :
```javascript
// Tooltip devise : texte adapté à la devise active (USD = référence, EUR = converti depuis USD).
// Appelé à l'init via applyTranslations() et à chaque clic sur un bouton devise.
updateCurrencyTooltip() {
  const el = document.getElementById('tooltipCurrencyText');
  if (!el) return;
  const key = this.state.currency === "EUR" ? "tooltip_currency_eur" : "tooltip_currency_usd";
  el.textContent = I18N.t(key);
},
```

### 2.3 `js/app.js` — appel au changement de devise (`:166`)

```javascript
this.state.currency = btn.dataset.currency;
this.updateCurrencyTooltip();   // ← ajouté
this.renderCommodityList();
this.loadDetail();
```

### 2.4 `js/app.js` — `applyTranslations()` délègue au helper (`:999`)

**Avant** :
```javascript
const tooltipCurrencyText = document.getElementById('tooltipCurrencyText');
if (tooltipCurrencyText) tooltipCurrencyText.textContent = I18N.t("tooltip_currency");
```
**Après** :
```javascript
this.updateCurrencyTooltip();
```
→ couvre l'**init** (`applyTranslations()` appelé à `app.js:65`) et le **changement de langue**
(`app.js:215`, `sources.js:66`), en tenant compte simultanément de la devise ET de la langue actives.

### 2.5 `index.html:73` — fallback statique aligné sur USD (devise par défaut)

```html
<span id="tooltipCurrencyText">Devise d'affichage. Les cours sont en dollars US (devise de référence des marchés).</span>
```
Texte par défaut = variante USD (le bouton USD est `active` au chargement). `applyTranslations()`
le réécrit aussitôt côté JS ; cette valeur ne sert qu'avant exécution / sans JS.

## 3. Comportement dynamique confirmé (raisonnement statique)

| Action | Chemin de code | Texte attendu |
|---|---|---|
| Chargement (USD défaut) | `init()` → `applyTranslations()` → `updateCurrencyTooltip()` | USD |
| Clic `€ EUR` | handler `.currency-btn` → `updateCurrencyTooltip()` | EUR |
| Clic `$ USD` | handler `.currency-btn` → `updateCurrencyTooltip()` | USD |
| Bascule FR↔EN | `applyTranslations()` → `updateCurrencyTooltip()` | devise courante, langue courante |

Mise à jour **immédiate** (pas de rechargement) : le `textContent` est réécrit dans le même
tick que le clic devise.

## 4. Conformité aux contraintes

- **Sécurité** : zéro `innerHTML`. `textContent` uniquement, sur des strings internes (dictionnaire i18n). Vecteur XSS nul.
- **i18n FR/EN** : les deux variantes (USD/EUR) traduites dans les deux langues.
- **Dark mode** : aucune modification CSS — seul le contenu textuel change. La bulle de tooltip conserve son style existant (lisible light + dark). Neutre.
- **Desktop + mobile** : le helper agit sur le même `#tooltipCurrencyText` quel que soit le mode d'affichage de la bulle (survol desktop / tap mobile via `_initTouchTooltips`).
- **`site/`** : `index.html`, `js/i18n.js`, `js/app.js` recopiés (cf. §5).

## 5. Vérifications effectuées

- `node --check js/i18n.js` → OK
- `node --check js/app.js` → OK
- Ancienne clé `tooltip_currency` : **0 occurrence résiduelle** (grep).
- Synchro `site/` : `diff -q` confirme `index.html`, `js/i18n.js`, `js/app.js` identiques entre racine et `site/`.

## 6. Reste à valider

Test runtime sur device réel (tap ⓘ devise puis bascule USD↔EUR, et bascule FR↔EN) —
pas de navigateur en env de dev. Vérification statique faite (syntaxe JS, chemins de code,
grep clé obsolète, sync `site/`).
