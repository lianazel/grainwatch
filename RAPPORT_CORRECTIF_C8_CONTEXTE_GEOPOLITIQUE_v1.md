# RAPPORT_CORRECTIF_C8 — Section « Contexte géopolitique » toujours vide

**Projet** : GrainWatch · **Version** : v0.9.1 · **Date** : 28/05/2026
**Type** : Correctif (basé sur `RAPPORT_DIAGNOSTIC_C8_CONTEXTE_GEOPOLITIQUE_v1.md`)
**Stack** : Vanilla JS — `createElement`/`textContent`, pas d'`innerHTML` avec données externes non échappées.

---

## 0. Écart constaté avec le prompt (important)

Le prompt situe `NEWS_KEYWORDS` et la construction d'URL dans **`js/sources.js`** avec une URL bâtie via `URLSearchParams`. **Ce n'est pas le cas dans le code réel** :
- `NEWS_KEYWORDS` est un `const` **top-level dans `js/news.js`** (lignes 7-35), pas une propriété d'objet.
- L'URL est construite par **template string** dans `NewsManager.fetchNews()` (`news.js:57`), pas via `URLSearchParams`.
- `js/sources.js` contient un **autre** appel GDELT (`_buildGDELTUrl`, page Sources), hors périmètre de ce bug.

→ Toutes les corrections ont été appliquées dans **`js/news.js`** (la vraie source du panneau intégré), conformément au diagnostic C8. Le style du fichier étant `const`/`let`, j'ai gardé `const`/`let` (pas `var`).

---

## 1. Correction 1a — Restructuration des requêtes `NEWS_KEYWORDS` (`js/news.js:6-35`)

Pattern **ancre + groupe OR parenthésé** (ancre hors `()` = AND implicite ; `()` = OR uniquement ; ancre multi-mots quotée).

**Avant** (extrait) :
```javascript
const NEWS_KEYWORDS = {
  wheat:    "wheat price OR wheat export OR wheat crisis OR wheat supply",
  corn:     "corn price OR maize price OR corn export OR corn shortage",
  palm_oil: "palm oil price OR palm oil deforestation OR palm oil export",
  ...
};
```

**Après** (extrait) :
```javascript
const NEWS_KEYWORDS = {
  wheat:    "wheat (price OR export OR harvest OR shortage OR tariff OR crop)",
  corn:     "corn (price OR export OR harvest OR shortage OR tariff OR crop)",
  palm_oil: '"palm oil" (price OR export OR harvest OR shortage OR tariff OR crop)',
  ...
};
```

- Les **24 denrées** ont été converties (même groupe OR pour toutes — l'enrichissement par denrée est prévu en C8-bis).
- **Ancres multi-mots quotées** (6) : `palm_oil` → `"palm oil"`, `sunflower` → `"sunflower oil"`, `soybean_oil` → `"soybean oil"`, `orange` → `"orange juice"`, `olive_oil` → `"olive oil"`, `coconut_oil` → `"coconut oil"`. En JS, ces 6 valeurs sont en **chaînes à apostrophes** `'...'` pour héberger les guillemets sans échappement.
- Clés inchangées (aucune denrée renommée). Aucun `AND` dans les parenthèses.

## 2. Correction 1b — Retrait de `sort=datedesc` (`js/news.js:57→61`)

**Avant** :
```javascript
const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=8&format=json&sort=datedesc&timespan=3months`;
```
**Après** :
```javascript
// sort omis volontairement → tri par pertinence (défaut GDELT) ; datedesc renvoyait
// les articles les plus récents sans rapport avec la denrée (cf. diagnostic C8).
const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=8&format=json&timespan=3months`;
```

## 3. Correction 2 — Parsing défensif (`js/news.js:62→76` + catch `:99`)

**Avant** :
```javascript
const json = await response.json();
```
**Après** :
```javascript
// Parsing défensif : GDELT renvoie ses erreurs (syntaxe de requête, rate limit)
// en TEXTE BRUT avec un HTTP 200. response.json() lèverait alors et le catch
// masquerait la cause. On lit le texte puis on tente le parse en consignant le brut.
const bodyText = await response.text();
let json;
try {
  json = JSON.parse(bodyText);
} catch (parseError) {
  console.warn(`[GDELT] Réponse non-JSON (HTTP ${response.status}):`, bodyText.substring(0, 200));
  return [];
}
```
Le traitement aval (`if (json && json.articles) { ... }`, lignes 78-93) est **inchangé**. Le `catch` réseau externe a été harmonisé : `console.warn("[GDELT] Erreur réseau:", error.message || error)`.

---

## 4. Requête GDELT — avant / après (URL complète, blé)

**Avant** (renvoyait `HTTP 200` + texte `Queries containing OR'd terms must be surrounded by ().`) :
```
https://api.gdeltproject.org/api/v2/doc/doc?query=wheat%20price%20OR%20wheat%20export%20OR%20wheat%20crisis%20OR%20wheat%20supply&mode=artlist&maxrecords=8&format=json&sort=datedesc&timespan=3months
```

**Après** (renvoie du JSON avec articles pertinents) :
```
https://api.gdeltproject.org/api/v2/doc/doc?query=wheat%20(price%20OR%20export%20OR%20harvest%20OR%20shortage%20OR%20tariff%20OR%20crop)&mode=artlist&maxrecords=8&format=json&timespan=3months
```

---

## 5. Résultats des 6 tests de vérification

> **Limite env** : pas de navigateur dans l'environnement de dev (cf. CLAUDE.md). Les tests 1-3 ont été exécutés à l'**équivalent niveau API** via `curl` (GET public, lecture seule) en reproduisant **exactement** l'URL que le code construit désormais. Les tests 4-6 sont vérifiés statiquement (le chemin de rendu et le CSS ne changent pas).

| Test | Méthode | Résultat |
|---|---|---|
| **1 — affiche des articles** | `curl` URL finale (blé) | **HTTP 200, JSON, 8 articles** (avant : erreur texte → 0). ✅ |
| **2 — articles pertinents** | inspection des titres | Blé : Égypte autosuffisance blé, prix blé/orge (Turquie), récolte blé (Chine). On-topic. ✅ |
| **3 — plusieurs denrées** | `curl` blé / maïs / riz / huile de palme | blé=8, maïs=8 (Bayer corn seed, sécheresse cultures), riz=8 (prix riz Égypte, riz PAN Vietnam), `"palm oil"`=7 (Indonésie export, Sawit). Universel + ancre quotée OK. ✅ |
| **4 — pas de régression console** | `node --check js/news.js` | Syntaxe OK. Seul `console.warn` possible = `[GDELT]` sur réponse non-JSON (ex. rate limit). Aucune exception non catchée (le parse est protégé). ✅ (vérif statique) |
| **5 — bouton « Actualités liées »** | revue code | `#geoSubtitle` est un **libellé** (pas un bouton). Le bouton GDELT page Sources (`sources.js`) est **inchangé** → fonctionne toujours. ✅ |
| **6 — dark mode** | revue code | `NewsManager.render()` et le CSS `.geo-*` sont **inchangés** → rendu dark identique à avant (texte/liens lisibles). ✅ (vérif statique) |

**Preuves live (extraits)** — URL finale, tri pertinence, `timespan=3months` :
- **wheat** → 8 art. : *« السيسي يستبعد الاكتفاء الذاتي من القمح »*, *« Buğday ve Arpa fiyatları »*, *« 夏粮…小麦 »*
- **corn** → 8 art. : *« Bayer accused of monopolising US corn seed market »*, *« Seceta… afectează culturile »*
- **rice** → 8 art. : *« سعر الأرز في السوق المصري اليوم »*, *« PAN Group đưa gạo Việt… »*
- **"palm oil"** → 7 art. : *« Indonesia export policy shift »*, *« Harga Sawit Anjlok »*

---

## 6. Sécurité & contraintes

- **XSS** : `render()` non modifié — l'échappement existant (`_escapeHtml`/`_safeUrl`, liens en `rel="noopener noreferrer"`) est préservé. Aucune nouvelle insertion DOM.
- **`site/`** : `js/news.js` recopié dans `site/js/news.js` — `diff -q` confirme l'identité.
- **Aucune nouvelle dépendance** — Vanilla JS.
- **Style** : `const`/`let` conservés (pas de `var`, cohérent avec `news.js`).

## 7. Observations complémentaires

1. **`corn`** : l'ancien mot-clé incluait *« maize »*, désormais absent (ancre unique `corn`). Volume suffisant constaté ; à enrichir en C8-bis si besoin (`(corn OR maize) (...)` est une 2ᵉ paire de parenthèses OR, valide GDELT).
2. **Ancres génériques** : `tea`, `orange` ont été ancrés sur des termes spécifiques (`tea`, `"orange juice"`) pour limiter le bruit ; affinage possible en C8-bis.
3. **Hors périmètre (non touché)** : `parseInt` sans radix (`news.js:84-86`, pré-existant), incohérence FR du test page Sources (`sources.js` interroge GDELT avec « Blé »), cache mémoire / fallback / timespan adaptatif (prévus C8-bis).
4. **Rate limit** : GDELT impose 1 req / 5 s (HTTP 429). En usage normal (1 denrée à la fois + cache 15 min `news.js:39`), non bloquant ; le parsing défensif loggue désormais proprement un éventuel 429.

---

## 8. Reste à valider
Test runtime navigateur réel (affichage du panneau, rendu dark, console DevTools) — non réalisable en env de dev. Vérifié : syntaxe JS, URL finale live sur 4 denrées, synchro `site/`.
