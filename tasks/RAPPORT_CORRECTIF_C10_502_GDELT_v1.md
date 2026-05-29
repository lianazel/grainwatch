# RAPPORT CORRECTIF — C10 — Proxy GDELT renvoie 502 en prod

**Projet** : GrainWatch
**Version** : 0.9.1 (patch)
**Date** : 29 mai 2026
**Fichier modifié** : `api/gdelt.js` (et lui seul)
**Auteur exécution** : Claude Code

---

## 1. Résumé exécutif

Le panneau « Contexte géopolitique » restait vide en prod : le proxy `/api/gdelt`
renvoyait un **502 immédiat**. Cause racine confirmée **en live** : l'appel `fetch()`
vers GDELT ne posait **aucun header `User-Agent`**. Depuis Vercel (Node/undici), GDELT
répond alors `HTTP 429` avec un corps **texte** (« Please limit requests to one every
5 seconds… ») → `JSON.parse` échoue → le bloc `catch` renvoyait `502`.

L'ajout d'un `User-Agent` applicatif fait passer la même requête en `HTTP 200` + JSON
`articles` peuplé. **Le fallback §6 du prompt n'a pas été nécessaire.**

---

## 2. Diff appliqué (3 modifications dans `api/gdelt.js`)

### 2.1 (A) Header `User-Agent` + `Accept` sur le fetch GDELT
```diff
-    const response = await fetch(gdeltUrl, { signal: controller.signal });
+    const response = await fetch(gdeltUrl, {
+      signal: controller.signal,
+      headers: {
+        // GDELT DOC 2.0 rejette les requêtes sans User-Agent (rate-limit/blocage
+        // des clients non identifiés). En navigateur le UA était implicite ; depuis
+        // Vercel (Node/undici) il faut le poser explicitement, sinon → échec → 502. (C10)
+        "User-Agent": "GrainWatch/0.9.1 (+https://grainwatch.vercel.app)",
+        "Accept": "application/json",
+      },
+    });
```

### 2.2 (B) Instrumentation 502 « réponse non-JSON »
```diff
       res.status(502).json({
         error: "GDELT returned non-JSON response",
-        detail: bodyText.substring(0, 200),
+        gdeltStatus: response.status,                 // statut HTTP réel renvoyé par GDELT (C10)
+        detail: bodyText.substring(0, 300),
       });
```

### 2.3 (B) Instrumentation du `catch` réseau global
```diff
-    if (error.name === "AbortError") {
+    if (error.name === "AbortError" || error.name === "TimeoutError") {
       res.status(504).json({ error: "GDELT request timeout (25s)" });
     } else {
-      console.error("[GDELT Proxy] Erreur:", error.message || error);
-      res.status(502).json({ error: "Failed to fetch from GDELT" });
+      console.error("[GDELT Proxy] Erreur:", error.name, error.message || error);
+      res.status(502).json({
+        error: "Failed to fetch from GDELT",
+        errorName: error.name,                        // ex: TypeError, FetchError (C10)
+        errorMessage: String(error.message || error).substring(0, 300),
+      });
     }
```

---

## 3. Résultats des tests

### Local (offline / structure)
| Test | Description | Résultat |
|------|-------------|----------|
| T1 | `node -c api/gdelt.js` (syntaxe) | ✅ pas d'erreur |
| T2 | `grep "User-Agent"` présent | ✅ ligne 57 |
| T3 | Requête sans `query` → 400 | ✅ logique C9 inchangée (lignes 32-35) |
| T4 | Méthode POST → 405 | ✅ logique C9 inchangée (lignes 18-21) |

### Validation live de la cause racine (curl direct vers GDELT, 29/05)
Test décisif réalisé **avant déploiement** pour confirmer le diagnostic, en reproduisant
les deux conditions sur l'URL réelle GDELT :

```
URL = https://api.gdeltproject.org/api/v2/doc/doc?query=wheat&format=json&mode=artlist&maxrecords=2&timespan=3months
```

**SANS User-Agent** (reproduit le comportement Vercel/undici) :
```
HTTP 429
Please limit requests to one every 5 seconds or contact kalev.leetaru5@gmail.com for larger queries.
```
→ corps **texte**, non-JSON → `JSON.parse` échoue → **c'est l'origine du 502**.

**AVEC User-Agent applicatif** `GrainWatch/0.9.1 (+https://grainwatch.vercel.app)` :
```
HTTP 200
{"articles": [ { "url": "https://news.ycwb.com/...", "title": "...", "seendate": "20260529T091500Z", ... } ] }
```
→ JSON `articles` peuplé. **Cause confirmée = User-Agent manquant. Fix validé.**

### T5–T7 (prod, après auto-deploy Vercel)
À exécuter après le push. La validation live ci-dessus rend le succès attendu :
- [ ] T5 — `https://grainwatch.vercel.app/api/gdelt?query=wheat&format=json&mode=artlist&maxrecords=2&timespan=3months` → JSON `articles` non vide.
- [ ] T6 — Blé / Maïs / Riz : panneau « Contexte géopolitique » peuplé.
- [ ] T7 — Console : plus de `[GDELT] Erreur réseau: HTTP 502`.

> Note : le 429 obtenu sans UA confirme aussi que le cache Edge 15 min (C9) reste utile
> pour absorber le rate-limit GDELT (1 req/5 s) côté serveur.

---

## 4. Conformité sécurité (inchangée)

- Périmètre strict : **seul `api/gdelt.js`** modifié. `js/news.js`, `site/`, `vercel.json`,
  CSP : non touchés.
- Garde-fous C9 préservés : whitelist 5 params, query ≤ 500, GET only, hôte/chemin figés
  (pas de SSRF), cache Edge 15 min, aucun credential.
- Champs de diagnostic (`gdeltStatus`, `errorName`, `errorMessage`) **sûrs** : pas de secret
  dans le projet, URL cible figée. Conservés en prod (utiles au debug futur).
- Pas de retry ni endpoint alternatif : on a corrigé la cause, pas masqué le symptôme.

---

## 5. Livrable

- `api/gdelt.js` modifié (3.1 + 3.2 + 3.3) ✅
- Commit : `fix: add User-Agent header to GDELT proxy fetch + instrument 502 (C10 v0.9.1)`
- Push `origin/main` → auto-deploy Vercel → exécuter T5–T7 en prod et cocher ci-dessus.
