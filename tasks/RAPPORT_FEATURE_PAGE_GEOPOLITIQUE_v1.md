# RAPPORT FEATURE — Page géopolitique dédiée (chargement à la demande)

**Projet** : GrainWatch
**Version** : 0.9.2 (minor — feature rétrocompatible)
**Date** : 29 mai 2026
**Auteur exécution** : Claude Code

---

## 1. Objectif

Sortir le contexte géopolitique (GDELT) du dashboard (où il déclenchait un appel GDELT
**automatique** à chaque sélection de denrée → tapait le rate-limit 1 req/5 s, cf. C10) et
en faire une **page dédiée** accessible via le menu, avec **chargement à la demande**
(1 denrée = 1 requête, sur clic explicite).

---

## 2. Fichiers modifiés / créés

| Fichier | Action |
|---------|--------|
| `js/geo.js` | **CRÉÉ** — contrôleur `GeoPage` (calqué sur `ExportPage`) |
| `index.html` | Supprimé `#geoPanel` (dashboard) ; ajouté `#geoPage` après `#sourcesPage` ; lien menu `#openGeoPage` ; `<script src="js/geo.js">` avant `app.js` ; version menu → v0.9.2 |
| `js/news.js` | `render(articles, name, opts={})` — conteneurs paramétrables (`articlesEl`/`subtitleEl`), rétrocompatible, sécurité inchangée |
| `js/app.js` | Init `GeoPage.init()` ; suppression de l'appel auto `loadNews()` ET de la méthode `loadNews()` (zéro code mort) ; câblage `#openGeoPage` → `GeoPage.open()` |
| `js/sources.js` | `SourcesPage.open()` masque aussi `#geoPage` (anti-empilement) |
| `js/export.js` | `ExportPage.open()` masque aussi `#geoPage` (symétrie) |
| `js/i18n.js` | 9 clés FR/EN (`menu_geo`, `menu_geo_open`, `geo_back`, `geo_page_title`, `geo_step1_title`, `geo_step2_title`, `geo_load_btn`, `geo_page_hint` ; `geo_loading` réutilisée) |
| `css/style.css` | Override scopé `#geoPage .geo-subtitle` (contraste sur fond crème) + `#geoPage .geo-articles` (max-height auto sur page dédiée) |
| `site/` | Miroir synchronisé (`index.html`, `css/style.css`, `js/*` dont `geo.js`) — **PAS** `api/` |

**Non touchés (périmètre respecté)** : `api/gdelt.js`, `vercel.json`, la CSP.

---

## 3. Décisions notables

- **Anti-empilement des pages** : Sources ET Géo sont désormais tous deux atteignables
  depuis le menu hamburger. `GeoPage.open()` masquait déjà Export+Sources ; j'ai rendu
  `SourcesPage.open()` et `ExportPage.open()` symétriques (masquage de `#geoPage`) pour
  éviter le chemin Géo → menu → Sources qui aurait empilé deux pages. Ajout minimal (une
  garde `if (el) el.style.display='none'`), sans impact sur le comportement existant.
- **`_populateDropdown()` rejoué dans `open()`** (comme `ExportPage`) : le dropdown suit la
  langue même si elle a changé pendant que la page était fermée ; la pré-sélection de la
  denrée courante est posée juste après.
- **Pas de `catch` dans `_loadSelected()`** : `NewsManager.fetchNews()` gère ses erreurs en
  interne (retourne `[]` sur échec réseau / rate-limit / non-JSON) → `render()` affiche
  alors l'état vide. Le `finally` suffit (réactive le bouton, masque le spinner).

---

## 4. Sécurité

- XSS : `NewsManager.render()` conserve `_safeUrl()` / `_escapeHtml()` / `rel="noopener
  noreferrer"`. Le dropdown utilise `textContent` (via `createElement`). ✅
- Proxy `api/gdelt.js` inchangé → garde-fous C9/C10 intacts.
- Rate-limit : 1 denrée = 1 requête sur clic ; `_loading` bloque le double-clic ; cache
  15 min de `NewsManager` absorbe les re-sélections. **C'est l'objectif de la feature.**
- localStorage : **aucune nouvelle clé** (la page n'a pas d'état persistant).

---

## 5. Tests

### Statique / structure (env de dev, sans navigateur)
| Test | Résultat |
|------|----------|
| T1 — `node -c` geo.js / news.js / app.js / i18n.js / sources.js / export.js | ✅ tous OK |
| T2 — `grep loadNews\|geoPanel js/ index.html` | ✅ aucune référence (pas de code mort) ; `geoArticles`/`geoSubtitle` ne subsistent que comme **défauts** de `news.js render()` (protégés par `if (!container) return`) |
| T3 — `js/geo.js` chargé avant `app.js` et après `news.js`/`export.js` | ✅ (news 695 → export 698 → geo 699 → app 700) |
| Intégrité — `<section>` 8/8 équilibrés ; accolades CSS 625/625 | ✅ |
| IDs nouveaux présents (geoPage, geoBackBtn, geoCommoditySelect, geoLoadBtn, geoPageSubtitle, geoPageLoading, geoPageArticles, openGeoPage) | ✅ 8/8 |
| Clés i18n nouvelles présentes | ✅ 8/8 (+ `geo_loading` réutilisée) |

### Fonctionnel (navigateur — À VÉRIFIER PAR JC SUR DEVICE / EN PROD)
> ⚠️ Pas de navigateur dans l'env de dev (cf. CLAUDE.md « Validation en attente »).
> Tests à exécuter sur `https://grainwatch.vercel.app/` après auto-deploy.
- [ ] T4 — Dashboard : plus de panneau géopolitique sous le graphique.
- [ ] T5 — Navigation entre denrées : **zéro** requête `/api/gdelt` (onglet Réseau DevTools).
- [ ] T6 — Menu → « 🌍 Contexte géopolitique » ouvre la page dédiée.
- [ ] T7 — Page : choisir une denrée (dropdown groupé) → clic bouton → spinner → articles ; bouton désactivé pendant le chargement.
- [ ] T8 — « Retour au tableau de bord » → dashboard intact.
- [ ] T9 — Thème clair + sombre OK ; FR + EN OK.
- [ ] T10 — Aucune erreur console.
- [ ] T11 — Pages Export et Sources toujours fonctionnelles (anti-régression du partage de classes / masquage des pages).

---

## 6. Note déploiement

`site/` est **gitignoré** (`.gitignore:16`, 0 fichier tracké) : la prod Vercel déploie
depuis la **racine** (`vercel.json` + `api/` à la racine). La synchro `site/` est faite
pour le miroir documenté (fallback GitHub Pages) mais n'a **aucun effet** sur la prod.
⚠️ Sur le fallback GitHub Pages, la page Géo restera vide (pas de `/api/gdelt` serverless),
comportement attendu et déjà documenté.

---

## 7. Hors périmètre (backlog, NON faits ici)

C8-bis (mots-clés enrichis par denrée), filtre/badge de langue, dédoublonnage des articles
syndiqués, mode « toutes denrées » (OR-group d'ancres GDELT — à valider au `curl`), message
UX dédié 429, comparateur multi-denrées (graphique).
