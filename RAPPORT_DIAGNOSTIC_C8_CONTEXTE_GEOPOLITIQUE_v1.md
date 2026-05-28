# RAPPORT_DIAGNOSTIC_C8 — Section « Contexte géopolitique » toujours vide

**Projet** : GrainWatch · **Version** : v0.9.1 · **Date** : 28/05/2026
**Type** : Diagnostic LECTURE SEULE (aucun fichier source modifié) · **Test de référence** : grainwatch.vercel.app, 28/05/2026

> **Méthode** : inspection statique du code + **tests live de l'API GDELT** via `curl` (lecture seule, GET sur une API publique — aucune modification). Les requêtes ont été reproduites à l'identique de ce que le code envoie. GDELT limite à **1 requête / 5 s** (HTTP 429 sinon), d'où des essais espacés.

---

## Inspection 1 — API et endpoint

**Résultats factuels**

Deux systèmes **indépendants** appellent GDELT (même API, code séparé) :

| Système | Fichier / fonction | Rôle |
|---|---|---|
| **Panneau géo intégré** (celui qui est vide) | `js/news.js` → `NewsManager.fetchNews()` (`news.js:46`) | Alimente la section « Contexte géopolitique » sous le graphique |
| Test API page « Sources » | `js/sources.js` → `_buildGDELTUrl()` (`sources.js:100`) + `_callAPI('gdelt')` (`sources.js:163`) | Bouton « 🌍 Appeler l'API GDELT » de la page Sources (démo brute du JSON) |

Chaîne d'appel du panneau intégré :
- `app.js:499-500` — `loadDetail()` appelle `this.loadNews(selectedCommodity, I18N.commodityName(commodity))` (async, non bloquant).
- `app.js:920-923` — `loadNews()` → `NewsManager.fetchNews(commodityId)` puis `NewsManager.render(articles, commodityName)`.
- `news.js:57` — endpoint exact :
  ```
  https://api.gdeltproject.org/api/v2/doc/doc?query=<ENCODED>&mode=artlist&maxrecords=8&format=json&sort=datedesc&timespan=3months
  ```

**API** : GDELT DOC 2.0 (`api.gdeltproject.org/api/v2/doc/doc`). Gratuite, sans clé, autorisée par la CSP (`connect-src ... https://api.gdeltproject.org`, `index.html:9`).

**Anomalie** : aucune au niveau de l'endpoint lui-même (host/chemin corrects, autorisés CSP).

**Hypothèse** : le problème est dans les **paramètres `query`**, pas dans l'endpoint.

---

## Inspection 2 — Filtres / paramètres de requête (panneau intégré)

**Résultats factuels** (`news.js:57`)

| Paramètre | Valeur | Commentaire |
|---|---|---|
| `query` | `NEWS_KEYWORDS[commodityId]` encodé (`news.js:52,56`) | ex. blé : `wheat price OR wheat export OR wheat crisis OR wheat supply` |
| `mode` | `artlist` | liste d'articles |
| `maxrecords` | `8` | |
| `format` | `json` | |
| `sort` | `datedesc` | **tri par date décroissante** (le plus récent d'abord) |
| `timespan` | `3months` | fenêtre temporelle |

- Filtre denrée : **oui**, via les mots-clés (nom anglais).
- Filtre temporel : **oui**, `timespan=3months`.
- Filtre langue : **non** (`sourcelang` absent).
- Filtre géographique : **non** (`sourcecountry` absent).
- Filtre type/tone/theme : **non**.

**Anomalie détectée** : la valeur de `query` contient des opérateurs **`OR` sans parenthèses englobantes**.

**Hypothèse** : GDELT DOC 2.0 **rejette** les requêtes contenant `OR` non parenthésé. → **cause racine probable** (confirmée en Inspection 5).

> Note : `timespan=3months` est **valide** (vérifié live : une requête parenthésée avec `timespan=3months` renvoie bien 8 articles). Ce n'est donc pas le coupable.

---

## Inspection 3 — Construction des mots-clés

**Résultats factuels** (`news.js:7-35`, `NEWS_KEYWORDS`)

- Mapping `commodityId → chaîne de mots-clés`, **en anglais** (commentaire `news.js:6` : « GDELT indexes global press in EN »).
- Couverture : **les 24 denrées** de `ALL_COMMODITIES` (`commodities.js:14-41`) ont une entrée → `if (!keywords) return []` (`news.js:53`) **n'est jamais** la cause pour les denrées du catalogue.
- Forme systématique : `"<terme1> OR <terme2> OR <terme3> [OR <terme4>]"`, p. ex. :
  - `wheat`  → `wheat price OR wheat export OR wheat crisis OR wheat supply`
  - `corn`   → `corn price OR maize price OR corn export OR corn shortage`
  - `rice`   → `rice price OR rice export OR rice crisis OR rice supply`
- Chaque expression à 2 mots (`wheat price`) est **non quotée** → GDELT ne la traite **pas** comme une expression exacte mais comme deux mots.
- Pas de termes génériques agro/alimentaire (`commodity`, `food`, `agriculture`) en complément du nom.

**Anomalie détectée** : (a) `OR` non parenthésé (bloquant, cf. I5) ; (b) expressions multi-mots non quotées (problème de **pertinence**, cf. I5).

**Hypothèse** : la structure même des mots-clés est invalide pour GDELT (a) et, même corrigée, peu pertinente (b).

---

## Inspection 4 — Gestion de la réponse API

**Résultats factuels** (`news.js:59-101`)

```js
const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
if (!response.ok) throw new Error(`HTTP ${response.status}`);   // ligne 60
const json = await response.json();                              // ligne 62  ← POINT DE RUPTURE
let articles = [];
if (json && json.articles) { articles = json.articles.filter(...).map(...).slice(0,6); } // 64-93
...
} catch (error) {
  console.warn("GDELT API failed:", error.message);              // ligne 99
  return [];                                                     // ligne 100  ← retourne vide
}
```

- Format attendu : **JSON** avec clé `articles` (`news.js:65`).
- Filtre client : `a.title && a.url && a.seendate` (`news.js:67`), puis `slice(0,6)` (`news.js:92`).
- Cas 0 résultat : `render()` (`news.js:113-115`) affiche `geo_empty` → **« Aucune actualité récente trouvée pour <denrée>. »**

**Anomalie détectée — le piège** : GDELT renvoie ses **erreurs de syntaxe en `HTTP 200` + texte brut** (pas en 4xx, pas en JSON). Donc :
1. `response.ok` est **`true`** (200) → la garde ligne 60 ne déclenche pas.
2. `response.json()` ligne 62 reçoit du texte non-JSON → **lève une `SyntaxError`**.
3. Le `catch` (ligne 98) avale l'erreur (`console.warn` only) → `return []`.
4. → panneau « vide » pour **toutes** les denrées, sans message d'erreur explicite côté UI.

**Hypothèse** : le `catch` masque la vraie cause (erreur de syntaxe de requête) derrière un « 0 article » silencieux. Le `console.warn` est filtré/peu visible en prod.

> Observation complémentaire (hors périmètre C8) : `render()` utilise `innerHTML` avec des données externes (`news.js:114,122-140`), mais chaque valeur interpolée passe par `_escapeHtml()`/`_safeUrl()` (`news.js:144-154`). À garder à l'esprit si le correctif touche `render()` — ne pas régresser l'échappement (règle CLAUDE.md §3).

---

## Inspection 5 — Test direct de l'API (live, lecture seule)

### URL réellement émise par le code (blé)
```
https://api.gdeltproject.org/api/v2/doc/doc?query=wheat%20price%20OR%20wheat%20export%20OR%20wheat%20crisis%20OR%20wheat%20supply&mode=artlist&maxrecords=8&format=json&sort=datedesc&timespan=3months
```

### Résultats des tests `curl` (reproduisant le code à l'identique)

| # | `query` testé | Résultat |
|---|---|---|
| **T-exact** | `wheat price OR wheat export OR wheat crisis OR wheat supply` (= code) | **HTTP 200 + texte** : `Queries containing OR'd terms must be surrounded by ().` → **PAS de JSON** |
| T-parure | `(wheat price OR wheat export OR wheat crisis OR wheat supply)` | HTTP 200, **JSON, 8 articles** — mais peu pertinents (tech, finance, Dollar Tree) |
| T-quoté | `("wheat price" OR "wheat export" OR "wheat crisis" OR "wheat supply")` | HTTP 200, JSON, **0 article** (bigrammes exacts trop rares) |
| T-AND-paren | `(wheat AND (price OR export OR harvest OR shortage OR crop))` | **HTTP 200 + texte** : `Parentheses may only be used around OR'd statements.` |
| T-ancre+OR | `wheat (price OR export OR harvest OR shortage OR crop OR supply)` | HTTP 200, JSON, 8 articles (encore bruyants en `sort=datedesc`) |
| T-ancre+OR (tri pertinence) | `wheat (price OR export OR shortage OR harvest OR tariff OR crop)` **sans `sort`** | HTTP 200, JSON, **3 articles plus on-topic** (Food Security, exports agricoles) |

### Pourquoi la requête actuelle renvoie 0 résultat — **CONFIRMÉ**

La requête du code contient `OR` **sans parenthèses englobantes**. GDELT répond **`HTTP 200` avec le texte** :

> `Queries containing OR'd terms must be surrounded by ().`

Ce n'est pas du JSON → `response.json()` (`news.js:62`) lève une exception → `catch` → `return []` → « Aucune actualité ». **Vrai pour les 24 denrées** (même patron `OR` partout).

### Règles de syntaxe GDELT DOC 2.0 mises en évidence (live)
1. Tout `OR` doit être **entre parenthèses** : `(a OR b)`.
2. Les parenthèses ne peuvent contenir **que** des `OR` — `(x AND y)` est **interdit** (`Parentheses may only be used around OR'd statements.`).
3. Une expression multi-mots n'est traitée comme **phrase exacte** que si **quotée** (`"wheat price"`) — mais l'exact-match est souvent trop strict (0 résultat).
4. `sort=datedesc` renvoie le **plus récent** (bruyant) ; sans `sort`, GDELT trie par **pertinence** (plus on-topic).

### Proposition de requête élargie (à valider en correctif)
Forme **ancre + groupe OR** (implicit AND), parenthèses uniquement autour du OR, tri par pertinence :
```
query = wheat (price OR export OR harvest OR shortage OR tariff OR supply OR crop)
        [retirer sort=datedesc  → tri pertinence]  timespan=3months
```
→ valide syntaxiquement, ancré sur la denrée, plus pertinent. (Élargissement domaine possible : ajouter `OR food OR grain OR agriculture` au groupe.)

---

## Inspection 6 — Lien avec « Actualités liées : <denrée> »

**Résultats factuels**

- Dans le panneau géo, « Actualités liées : Blé » est le **sous-titre** `#geoSubtitle` (`index.html:314`, span — **pas** un bouton/lien), rempli par `news.js:111` : `subtitle.textContent = \`${I18N.t("geo_subtitle")} ${commodityName}\``.
- Il n'y a **aucun lien externe** ni double bouton dans le panneau géo : juste un libellé + la liste d'articles (`#geoArticles`).
- Le **vrai bouton** GDELT est ailleurs : page « Sources », `#sourcesGdeltBtn` (`index.html:546`) → `sources.js:48` → `_callAPI('gdelt')` → `_buildGDELTUrl(name)` (`sources.js:100,165`).

**Anomalie détectée** : le test page Sources utilise `const name = I18N.commodityName(commodity)` (`sources.js:164`) → en **français** cela vaut `"Blé"`. Sa requête `query=Blé&...&timespan=7d` (`sources.js:102`) **n'a pas de `OR`** → pas d'erreur de parenthèses → elle « marche » (renvoie du JSON), mais interroge GDELT avec le **mot français** (sous-optimal) et **un seul mot** (différent du panneau intégré).

**Hypothèse** : **deux systèmes divergents** visent GDELT — le panneau intégré (anglais multi-mots + `OR` cassé) et le test Sources (nom localisé mono-mot, fonctionnel). Le bug C8 ne concerne **que** le panneau intégré (`news.js`).

---

## Section 7 — Synthèse

### Cause racine (confirmée live)
> **Les chaînes `NEWS_KEYWORDS` contiennent des `OR` non parenthésés. GDELT DOC 2.0 répond alors `HTTP 200` + le texte brut `Queries containing OR'd terms must be surrounded by ().` (pas de JSON). `news.js:62` appelle `response.json()` sur ce texte → exception → le `catch` (`news.js:98-100`) retourne `[]` → la section affiche « Aucune actualité récente trouvée pour <denrée> » pour les 24 denrées.**

Le `if (!response.ok)` (`news.js:60`) ne protège pas, car GDELT renvoie l'erreur en **200**. Le `console.warn` masque la cause réelle en prod.

### Requête actuelle (documentée)
```
https://api.gdeltproject.org/api/v2/doc/doc?query=wheat price OR wheat export OR wheat crisis OR wheat supply&mode=artlist&maxrecords=8&format=json&sort=datedesc&timespan=3months
```
→ `HTTP 200` / corps = `Queries containing OR'd terms must be surrounded by ().`

### Requête proposée (élargie / valide)
```
https://api.gdeltproject.org/api/v2/doc/doc?query=wheat (price OR export OR harvest OR shortage OR tariff OR supply OR crop)&mode=artlist&maxrecords=8&format=json&timespan=3months
```
(ancre denrée + groupe `OR` parenthésé, tri par pertinence en retirant `sort=datedesc`).

### Recommandations pour le correctif (NON implémentées)

1. **Correctif minimal (risque le plus faible)** : envelopper chaque valeur `NEWS_KEYWORDS` (ou la `query` au moment du build dans `fetchNews`) entre **parenthèses**. À lui seul, ceci rétablit les actualités (JSON + non vide). *Limite* : pertinence moyenne avec `sort=datedesc`.

2. **Correctif robuste (recommandé)** : restructurer `NEWS_KEYWORDS` en forme **ancre + groupe OR** : `"<denrée_en> (term OR term OR …)"`, et **retirer `sort=datedesc`** (laisser le tri pertinence GDELT) — éventuellement élargir au domaine (`food`, `grain`, `agriculture`). Respecter la règle GDELT : **AND interdit dans les parenthèses**.

3. **Durcissement défensif (à ajouter)** : dans `fetchNews()`, ne pas faire confiance au seul `response.ok`. Avant `response.json()`, soit vérifier `content-type` ≈ `application/json`, soit lire le texte et tenter le parse en consignant le **corps brut** en cas d'échec (`console.warn(text)`), pour ne plus masquer une erreur de syntaxe GDELT derrière un « 0 article » silencieux. Optionnel : afficher un état UI « actualités indisponibles » distinct de « aucune actualité ».

4. **Cohérence (optionnel)** : aligner le test page Sources (`sources.js:_buildGDELTUrl`) — il interroge GDELT avec le **nom français** mono-mot (`"Blé"`). Envisager le nom anglais et/ou la même stratégie de mots-clés que `news.js` pour un comportement homogène.

5. **Ne PAS toucher** : l'endpoint, la CSP, `timespan=3months` (valide), l'échappement XSS de `render()`.

### Périmètre du futur correctif
Essentiellement `js/news.js` (`NEWS_KEYWORDS` + garde JSON dans `fetchNews`). Le tri (`sort`) est aussi dans `news.js:57`. `sources.js` seulement si on traite la reco #4. Penser à la synchro `site/` lors du correctif.
