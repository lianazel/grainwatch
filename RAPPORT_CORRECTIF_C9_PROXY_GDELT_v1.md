# RAPPORT_CORRECTIF_C9 — Proxy Vercel Serverless pour GDELT (CORS)

**Projet** : GrainWatch · **Version** : v0.9.1 · **Date** : 28/05/2026
**Type** : Changement d'architecture (1ʳᵉ brique non statique) · **Basé sur** : diagnostic C8 + test prod 28/05.

---

## 0. Problème résolu

C8 a corrigé la **syntaxe** des requêtes GDELT, mais en **production** le panneau « Contexte géopolitique » restait vide :

```
Access to fetch at 'https://api.gdeltproject.org/...' from origin
'https://grainwatch.vercel.app' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
→ [GDELT] Erreur réseau: Failed to fetch
```

GDELT n'envoie aucun en-tête CORS → le navigateur bloque tout `fetch` direct. La section n'avait donc **jamais** fonctionné en prod. **Solution** : proxy first-party (Vercel Serverless) — le navigateur appelle `/api/gdelt` (même origine, pas de CORS) ; la fonction relaie côté serveur (le CORS ne s'applique pas serveur→serveur).

```
AVANT :  navigateur → fetch(api.gdeltproject.org) → CORS BLOCK ✘
APRÈS :  navigateur → fetch(/api/gdelt) → Serverless Vercel → GDELT → JSON ✓
```

---

## 1. Fichier créé : `api/gdelt.js` (racine)

```javascript
// ============================================================
// GRAINWATCH — Vercel Serverless Function : proxy GDELT v2
// ============================================================
// Contournement CORS : l'API GDELT n'envoie pas d'en-tête
// Access-Control-Allow-Origin, donc le navigateur bloque tout
// fetch() direct. Le navigateur appelle /api/gdelt (même origine),
// cette fonction relaie côté serveur (pas de CORS serveur→serveur).
// GrainWatch v0.9.1 — C9. Première brique non statique du projet.

// Hôte/chemin GDELT figés ici : aucun paramètre client ne peut
// changer la cible → pas de SSRF, le proxy ne peut joindre QUE GDELT.
const GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";

// Pass-through strictement limité — aucun autre paramètre n'est relayé.
const ALLOWED_PARAMS = ["query", "mode", "maxrecords", "format", "timespan"];

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const params = new URLSearchParams();
  for (const key of ALLOWED_PARAMS) {
    const value = req.query[key];
    if (value === undefined) continue;
    // req.query[key] peut être un tableau si le paramètre est répété → on
    // ne garde que la 1re valeur pour rester sur une chaîne propre.
    params.set(key, Array.isArray(value) ? value[0] : value);
  }

  if (!params.has("query")) {
    res.status(400).json({ error: "Missing required parameter: query" });
    return;
  }
  if (params.get("query").length > 500) {
    res.status(400).json({ error: "Query too long (max 500 chars)" });
    return;
  }

  // Valeurs par défaut sûres si le client ne les fournit pas.
  if (!params.has("format")) params.set("format", "json");
  if (!params.has("mode")) params.set("mode", "artlist");
  if (!params.has("maxrecords")) params.set("maxrecords", "8");

  const gdeltUrl = `${GDELT_ENDPOINT}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // aligné sur news.js
  try {
    const response = await fetch(gdeltUrl, { signal: controller.signal });
    clearTimeout(timeout);

    // Parsing défensif (même logique que news.js C8) : GDELT renvoie ses
    // erreurs (syntaxe, rate limit) en texte brut avec un HTTP 200.
    const bodyText = await response.text();
    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (parseError) {
      console.warn("[GDELT Proxy] Réponse non-JSON:", bodyText.substring(0, 200));
      res.status(502).json({
        error: "GDELT returned non-JSON response",
        detail: bodyText.substring(0, 200),
      });
      return;
    }

    res.setHeader("Content-Type", "application/json");
    // Cache CDN Vercel 15 min : sert les requêtes identiques sans rappeler
    // GDELT → absorbe le rate limit GDELT (1 req/5s) sans cache custom.
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=300");
    res.status(200).json(data);
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === "AbortError") {
      res.status(504).json({ error: "GDELT request timeout (10s)" });
    } else {
      console.error("[GDELT Proxy] Erreur:", error.message || error);
      res.status(502).json({ error: "Failed to fetch from GDELT" });
    }
  }
};
```

**Écarts mineurs vs le snippet du prompt** (durcissements, même comportement) :
- Hôte GDELT extrait dans une constante `GDELT_ENDPOINT` (lisibilité + souligne l'absence de SSRF).
- Gestion d'un paramètre répété (`req.query[key]` tableau) → on garde la 1ʳᵉ valeur.
- `clearTimeout(timeout)` ajouté aussi dans le `catch` (évite un timer orphelin si `fetch` rejette avant `clearTimeout`).

---

## 2. Modification front : `js/news.js` (ligne 61)

**Avant** :
```javascript
const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=8&format=json&timespan=3months`;
```
**Après** :
```javascript
// Proxy Vercel /api/gdelt (même origine) → contourne le blocage CORS de GDELT (C9).
// sort omis volontairement → tri par pertinence (défaut GDELT) ; datedesc renvoyait
// les articles les plus récents sans rapport avec la denrée (cf. diagnostic C8).
const url = `/api/gdelt?query=${query}&mode=artlist&maxrecords=8&format=json&timespan=3months`;
```
`query` est déjà `encodeURIComponent(keywords)` (`news.js:58`). **Aucune autre modification** : parsing défensif C8, traitement des articles et rendu DOM inchangés (le proxy renvoie le même JSON).

---

## 3. Synchronisation `site/`
- `cp js/news.js site/js/news.js` → `diff -q` identique. ✅
- `api/gdelt.js` **NON** copié dans `site/` (les Serverless vivent à la racine ; GitHub Pages ne les supporte pas). `site/api` absent — conforme. ✅

---

## 4. `vercel.json` — pas d'interférence (inchangé)
`vercel.json` ne contient qu'un bloc `headers` avec `source: "/(.*)"` — **aucun `rewrites`/`routes`**. Une règle `headers` n'intercepte pas le routage : elle ajoute juste des en-têtes à toutes les réponses (y compris `/api/gdelt`). La Serverless Function s'exécute donc normalement. Les en-têtes CSP s'appliquent aussi à la réponse JSON (sans effet sur le JSON). **Aucune modification nécessaire.** `connect-src` garde `api.gdeltproject.org` (encore utilisé par le `fetch` direct de `sources.js`).

---

## 5. Résultats des 7 tests de vérification

> **Env de dev sans navigateur** : les tests « navigateur » (T1-T4, T6, T7) seront à confirmer **après déploiement Vercel**. Validation locale réalisée : harnais Node (mock `req`/`res`) exerçant le handler + `curl` GDELT (C8).

| Test | Statut | Détail |
|---|---|---|
| **T1 — endpoint répond** | ⏳ post-déploiement | Localement : handler renvoie 200 + JSON `{articles:[…]}` quand GDELT répond du JSON (harnais). URL exacte construite : `…/doc/doc?query=wheat+%28price+OR+export%29&maxrecords=4&timespan=3months&format=json&mode=artlist`. |
| **T2 — section affiche des articles** | ⏳ post-déploiement | Requête finale prouvée en C8 (curl) : `wheat (price OR export OR …)` → **8 articles pertinents**. Le proxy relaie cette requête à l'identique. |
| **T3 — plusieurs denrées** | ⏳ post-déploiement | C8 (curl) : blé=8, maïs=8, riz=8, `"palm oil"`=7, tous on-topic. |
| **T4 — console propre** | ⏳ post-déploiement | Appel `/api/gdelt` = même origine → plus d'erreur CORS attendue. `node --check` OK ; aucun chemin ne lève (parse protégé). |
| **T5 — params rejetés** | ✅ **validé local** | POST→**405** ; sans `query`→**400** ; `query`>500→**400** ; `?query=…&evil=true`→`evil` **absent** de l'URL relayée (whitelist), défauts `format=json`/`mode=artlist` forcés. |
| **T6 — dark mode** | ⏳ post-déploiement | `render()` + CSS `.geo-*` inchangés → rendu identique à C8. |
| **T7 — « Actualités liées »** | ⏳ post-déploiement | `#geoSubtitle` est un libellé (pas un bouton) ; non impacté. |

**Chemins d'erreur du proxy — validés live (harnais)** : rate limit GDELT → **502** (+ log `[GDELT Proxy] Réponse non-JSON`), timeout → **504**, échec réseau → **502**. Comportement gracieux confirmé.

---

## 6. Sécurité
- **Pas de SSRF** : hôte/chemin figés ; seuls 5 paramètres whitelistés peuvent varier.
- **Validation** : `query` obligatoire, ≤ 500 caractères ; méthode GET only.
- **Pas de credentials** relayés ; pas de header d'auth.
- **Timeout** 10 s ; **parsing défensif** (502 explicite, pas de crash).
- **Cache Edge** `s-maxage=900` : absorbe le rate limit GDELT, réponses instantanées.
- **Front** : `render()` inchangé → échappement XSS (`_escapeHtml`/`_safeUrl`) et `rel="noopener noreferrer"` préservés. Zéro `innerHTML` avec données externes non échappées.
- **Aucune dépendance ajoutée** ; `fetch` natif (Node 22 sur Vercel) ; pas de `package.json` requis.

---

## 7. CLAUDE.md — mises à jour effectuées
- **Stack** : « front statique + 1 Serverless Function » ; mention « plus 100 % statique depuis C9 ».
- **Hébergement** : avertissement fallback GitHub Pages (pas de serverless → panneau géo KO).
- **Arbre fichiers** : ajout `api/gdelt.js` (+ note « pas copié dans site/ »).
- **Contrainte CORS** : documentation du **pattern proxy first-party audité** (vs proxy tiers non audité, toujours interdit).
- **Historique versions** : ligne C9.

---

## 8. Observations complémentaires
1. **Page Sources** : le bouton « Appeler l'API GDELT » (`sources.js`) fait encore un `fetch` **direct** → même blocage CORS en prod. Pourrait être routé via `/api/gdelt` dans un futur correctif (hors périmètre C9).
2. **Fallback GitHub Pages** (`site/`) : `api/` n'y existe pas → le panneau géo n'y fonctionnera pas. Acceptable (prod = Vercel) ; documenté dans CLAUDE.md.
3. **Rate limit en dev** : mes tests répétés ont saturé le quota GDELT (1 req/5 s) sur l'IP de dev ; sans incidence en prod (cache Edge + 1 denrée à la fois + cache mémoire 15 min de `news.js`).
4. **C8-bis (à venir)** : mots-clés enrichis par denrée, fallback en cascade, timespan adaptatif, rate limiting custom (non nécessaire — cache Edge suffit).

## 9. Reste à valider
Confirmer T1-T4, T6, T7 sur **grainwatch.vercel.app après déploiement** (navigateur). T5 + chemins d'erreur déjà validés localement.
