# CLAUDE.md — GrainWatch

## Contexte projet

**GrainWatch** est une application web mono-page (SPA) de suivi en temps réel des prix des matières premières agricoles. Déployée sur GitHub Pages, elle ne nécessite aucun backend et consomme exclusivement des APIs publiques gratuites.

- **Version actuelle** : 0.8.1 (21 mai 2026)
- **URL de production** : https://grainwatch.vercel.app/ (déploiement actuel via Vercel)
- **Stack** : Vanilla JS / HTML5 / CSS3 / Chart.js — Hébergement statique pur
- **Hébergement** : Vercel en production. Le sous-dossier `site/` est conservé pour un déploiement GitHub Pages alternatif (cf. `DEPLOY_GITHUB.md`).
- **Codebase** : ~3 500 lignes de code, 10 modules JS
- **Auteur** : lianazel
- Aucun backend, aucun compte utilisateur, aucune clé API dans le code

### Palette couleurs
| Nom        | Hex       | Usage                     |
|------------|-----------|---------------------------|
| Terracotta | `#C0392B` | Headers, accents, alertes |
| Blé        | `#D4A843` | Boutons, highlights       |
| Olive      | `#6B7C2D` | Graphiques, indicateurs   |
| Crème      | `#FDF6E3` | Fond de page, cartes      |

### Palette mode sombre
Les variables CSS sont surchargées via `[data-theme="dark"]` sur `<html>`.
Détection automatique via `prefers-color-scheme: dark` + toggle manuel (bouton lune/soleil).
Le choix utilisateur est persisté en `localStorage` sous la clé `grainwatch_theme`.
Si un choix manuel existe, les changements de l'OS sont ignorés.

### Architecture des fichiers
```
GrainWatch/
├── index.html              # Page principale (SPA)
├── css/                    # Feuilles de style (variables, dark mode)
├── js/                     # 10 modules JS (1 par domaine fonctionnel)
│   ├── app.js              # Point d'entrée, initialisation
│   ├── chart.js            # Graphiques Chart.js (adapte couleurs dark/light)
│   ├── alerts.js           # Système d'alertes de prix
│   ├── ...                 # Autres modules fonctionnels
├── site/                   # Sous-dossier déployé sur GitHub Pages
├── DEPLOY_GITHUB.md        # Procédure de déploiement
├── DEPLOY_GITHUB.bat       # Script de déploiement Windows
├── NOTE_REPRISE.md         # Notes de reprise du projet
├── README.md               # Documentation publique
├── LICENSE                 # Licence du projet
└── CLAUDE.md               # Ce fichier (mémoire projet)
```

### Sources de données
- **World Bank API** : cours des matières premières agricoles (blé, maïs, riz, soja...)
- **USDA FAS API** : données USDA sur les marchés agricoles internationaux
- **GDELT API v2** : actualités géopolitiques impactant les marchés

**Contrainte CORS** : les APIs Banque Mondiale et USDA sont bloquées par CORS depuis un navigateur. La page Sources affiche actuellement des données d'exemple avec l'URL réelle copiable pour test manuel. Ne jamais contourner avec un proxy non audité.

### Fonctionnalités implémentées (v0.8.1)
- Affichage des cours avec Chart.js (gradients adaptatifs dark/light)
- Mode sombre/clair : détection OS automatique + toggle manuel + persistance localStorage
- Alertes de prix : création, historique cliquable, détection de doublons, pré-remplissage
- Responsive mobile : header 2 lignes, bouton rafraîchir icône seule, fix iOS touchend
- Panneau géopolitique (GDELT)
- Déploiement GitHub Pages via site/

### Persistance localStorage
| Clé                          | Type     | Usage                                                  |
|------------------------------|----------|--------------------------------------------------------|
| `grainwatch_theme`           | string   | "dark" ou "light"                                      |
| `grainwatch_lang`            | string   | "fr" ou "en"                                           |
| `grainwatch_favorites`       | array    | Liste de slugs des favoris (`commodityId`)             |
| `grainwatch_alerts`          | array    | Alertes configurées (id, commodityId, type, value)     |
| `grainwatch_alerts_history`  | array    | Historique des alertes déclenchées (max 50, troncature dure côté `alerts.js`) |
| `grainwatch_active_ids`      | array    | IDs des denrées actives dans la sidebar (filtrés contre `ALL_COMMODITIES`) |
| `grainwatch_visible`         | array    | IDs des denrées cochées/visibles dans le graphique     |

Aucune autre donnée ne doit être stockée. Jamais de données personnelles, IP, ou fingerprint.
Toutes ces clés sont des préférences UI strictement locales — aucune n'est transmise par le réseau.

---

## Security Hardening Policy

### Principes fondamentaux

Ce projet est **100% statique et public**. Il ne doit jamais :
- Collecter de données personnelles identifiantes
- Stocker autre chose que des préférences UI en localStorage
- Exposer des clés API, tokens ou secrets dans le code source ou les commits

### Règles obligatoires avant tout commit

**1. localStorage — données autorisées uniquement**

Seules les clés listées dans le tableau ci-dessus sont autorisées.
Toujours documenter ce qui est stocké avec un commentaire `// localStorage: clé = valeur attendue`.

**2. Appels API externes — sécurité CORS**

- Ne jamais contourner les restrictions CORS avec un proxy non audité
- Valider le format des réponses API avant tout rendu DOM :

```javascript
// Toujours valider avant d'utiliser
if (!data || typeof data.price !== 'number') return;
```

- Gérer explicitement les erreurs réseau (timeout, 4xx, 5xx) sans exposer les détails dans l'UI

**3. Injection XSS — règle absolue**

- **Ne jamais utiliser `innerHTML` avec des données issues d'une API externe**
- Utiliser exclusivement `textContent` ou `createElement` pour insérer du contenu dynamique
- Si `innerHTML` est absolument nécessaire, sanitiser avec DOMPurify
- **Leaflet** : échapper manuellement les strings avant `bindPopup()`

```javascript
// Interdit
element.innerHTML = apiData.title;

// Obligatoire
element.textContent = apiData.title;
```

**4. Content Security Policy**

Vérifier que `index.html` contient une balise meta CSP :

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; 
           script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
           connect-src https://api.worldbank.org https://apps.fas.usda.gov https://api.gdeltproject.org;
           style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
           font-src https://fonts.gstatic.com;">
```

Note : GitHub Pages ne supporte pas les headers HTTP personnalisés — la meta CSP dans le HTML est la seule option.

**5. Subresource Integrity (SRI)**

Pour toute dépendance CDN (Chart.js, etc.), ajouter les attributs `integrity` et `crossorigin` :

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"
        integrity="sha384-[HASH]"
        crossorigin="anonymous"></script>
```

**6. Alertes de prix — validation des seuils**

```javascript
// Toujours valider et clamper les inputs utilisateur
const threshold = parseFloat(userInput);
if (isNaN(threshold) || threshold <= 0 || threshold > 1_000_000) return;
```

**7. Désérialisation localStorage**

Valider la structure et les types des données lues depuis localStorage avant utilisation. Un fichier corrompu ne doit jamais crasher l'application.

```javascript
// Toujours entourer de try/catch et valider
try {
  const alerts = JSON.parse(localStorage.getItem('grainwatch_alerts'));
  if (!Array.isArray(alerts)) throw new Error('invalid');
} catch { return []; }
```

### Checklist avant chaque release

- [ ] Aucune clé API, token ou secret dans le code ou les commits
- [ ] `innerHTML` avec données externes : zéro occurrence
- [ ] Meta CSP présente et à jour dans `index.html`
- [ ] SRI sur toutes les dépendances CDN
- [ ] Inputs utilisateur (alertes, filtres) validés et bornés
- [ ] localStorage : uniquement les 4 clés documentées
- [ ] Désérialisation localStorage protégée par try/catch
- [ ] Pas de `console.log` contenant des données utilisateur en production
- [ ] Vérifier https://securityheaders.com pour l'URL de production

### Marqueur de dette sécurité

Si un compromis de sécurité est fait pour des raisons de rapidité, le signaler :

```javascript
// SECURITY TODO: innerHTML utilisé ici faute de temps — remplacer par DOMPurify
```

---

## Conformité RGPD

Ce site ne collecte **aucune donnée personnelle**. Les préférences localStorage restent sur l'appareil de l'utilisateur et ne sont jamais transmises.
Une mention "Pas de cookies tiers, pas de tracking" doit rester visible dans le footer.
Une page /privacy minimaliste doit être créée et liée dans le footer.

---

## Historique des versions

| Version | Date       | Nouveautés principales                                           |
|---------|------------|------------------------------------------------------------------|
| 0.8.1   | 21/05/2026 | Security hardening : XSS GDELT, meta CSP, SRI CDN, innerHTML §5 (historique alertes, source badge), validation inputs alertes (whitelist type + bornes), désérialisation localStorage défensive (alerts/favorites/visible/theme), radix 10 parseInt, filtrage console.* (.message uniquement) |
| 0.8.0   | 07/05/2026 | Mode sombre, alertes améliorées (historique, doublons), fix mobile |
| 0.7.x   | antérieur  | Structure de base, graphiques, alertes V1                        |

---

## Suivi du projet — Journal des actions

### Fait
- [x] Structure initiale du projet (HTML/CSS/JS, 10 modules)
- [x] Intégration Chart.js pour les graphiques (adaptatif dark/light)
- [x] Mode sombre/clair complet (détection OS + toggle + persistance)
- [x] Système d'alertes V2 (historique cliquable, détection doublons, pré-remplissage)
- [x] Responsive mobile (header 2 lignes, fix iOS touchend, scroll clavier)
- [x] Panneau géopolitique GDELT
- [x] Déploiement GitHub Pages fonctionnel
- [x] Rédaction de la note technique sécurité (OWASP Top 10)
- [x] Rédaction des règles Security Hardening Policy
- [x] Création DEPLOY_GITHUB.md et script .bat
- [x] Mise en place du README.md

### Fait — Sécurité (corrections appliquées 21/05/2026)
- [x] **XSS GDELT** — `js/news.js` : validation et échappement de l'URL via `_safeUrl()` (whitelist http(s), bloque `javascript:`, `data:`, etc.) ; ajout `rel="noopener noreferrer"`
- [x] **Meta CSP** — `index.html` : ajout balise `<meta http-equiv="Content-Security-Policy">` (default-src 'self', script/style/connect/font/img whitelisted, base-uri/form-action self, frame-ancestors none)
- [x] **SRI CDN** — `index.html` : ajout `integrity` SHA-384 + `crossorigin="anonymous"` sur Chart.js 4.4.7 et chartjs-adapter-date-fns 3.0.0
- [x] **XSS sources.js** — ligne 205 : `error.message` rendu via `textContent` au lieu de `innerHTML` (créa span + appendChild)
- [x] **XSS GDELT domain** — `js/news.js:135` : `${a.domain}` passé via `_escapeHtml()` (même classe de bug que l'URL)

### Fait — Sécurité §6 — Validation inputs alertes (21/05/2026)
- [x] **Validation `_createAlert()`** — `js/alerts.js:161-172` : ajout (1) whitelist du `type` parmi `['above','below','var_up','var_down']`, (2) vérification que `commodityId` existe dans `ALL_COMMODITIES` (évite IDs forgés via DOM altéré ou extension), (3) borne haute `value <= 1_000_000` (cf. CLAUDE.md §6 — anti-overflow et anti-DoS sur le rendu). La validation existante (`!commodityId`, `isNaN`, `value <= 0`) est conservée.

### Fait — Sécurité §7 — Désérialisation localStorage défensive (21/05/2026)
- [x] **`alerts.js:_load()`** — refactor complet. `_alerts` filtré par `Array.isArray` + validation par item (`id`/`commodityId` strings, `type` whitelisté, `value` number fini dans `]0, 1_000_000]`). `_history` filtré par `Array.isArray` + validation `text`/`time` strings, slice(-50) pour borne dure. En cas de `JSON.parse` qui throw, fallback sur tableau vide explicite.
- [x] **`app.js:loadFavorites()`** — validation `Array.isArray` + filtre `typeof id === 'string'` avant `new Set(...)`. Évite qu'un JSON `{}` ou un objet non-array fasse exploser `Set` ou injecte des entrées non-string.
- [x] **`app.js:loadVisibleCommodities()`** — validation `Array.isArray` sur `grainwatch_active_ids` et `grainwatch_visible`. Bonus défense en profondeur : `activeCommodityIds` filtré contre `ALL_COMMODITIES` (un ID inconnu est silencieusement ignoré).
- [x] **`app.js:_initTheme()`** — whitelist stricte `'dark'|'light'` sur `grainwatch_theme` à la lecture initiale ET dans le listener `matchMedia` (sinon `data-theme="foo"` aurait été accepté tel quel — non exploitable XSS mais incohérent avec la politique de validation).
- _Volontairement non touché_ : `i18n.js:20` déjà conforme (`=== "en" || === "fr"` à la lecture).

### Fait — Sécurité §6 — Radix 10 sur tous les parseInt (21/05/2026)
Défense en profondeur (pas d'exploit connu sur `<input type="number">`, mais aligne sur la politique "validation stricte des conversions") :
- [x] **`app.js:_applyCustomRange()`** — 4 `parseInt` sur les inputs date custom passés à radix 10.
- [x] **`export.js:_validateDates()`** — 4 `parseInt` sur les inputs date custom passés à radix 10.
- [x] **`app.js:60`** — `parseInt(btn.dataset.period, 10)` (dataset interne mais cohérence).
- [x] **`alerts.js:409`** — `parseInt(el.dataset.histIdx, 10)` (idem).
- _Note_ : `parseFloat` n'a pas de notion de radix — `alerts.js:186` reste tel quel (déjà entouré de bornes 0 < x ≤ 1_000_000).

- [x] **Synchro `site/`** (21/05/2026 — 2e batch) — `js/alerts.js`, `js/app.js`, `js/export.js` recopiés dans `site/js/`.

### Fait — Sécurité — console.* en prod (21/05/2026)
Audit complet : 10 occurrences de `console.warn/error` dans `api.js`, `app.js`, `export.js`, `news.js`. **Aucune** ne loggue de données personnelles, clé API, valeur d'alerte, prix ou input utilisateur. Le seul risque réel : 5 d'entre elles loggaient l'objet `Error` entier (stack + URL fetch potentielle visibles dans DevTools).
- [x] **`api.js:116, 346`** — `console.warn(..., e)` → `console.warn(..., e.message)` (loadAll standard + custom range).
- [x] **`export.js:323`** — `console.error('Export fetch error:', error)` → `error.message`.
- [x] **`export.js:590`** — `console.error('Clipboard copy failed:', err)` → `err.message`.
- [x] **`app.js:410`** — `console.error("Error loading detail:", error)` → `error.message`.
- _Inchangés_ : les 5 autres (`api.js:228/289/453/509`, `news.js:99`) loggaient déjà `error.message` uniquement.
- [x] **Synchro `site/`** (3e batch) — `js/api.js`, `js/app.js`, `js/export.js` recopiés.

### Fait — Sécurité MOYEN §5 — innerHTML avec interpolation (21/05/2026)
Audit complet des 17 `innerHTML` dans `app.js`, `alerts.js`, `export.js` :
- [x] **XSS historique alertes** — `js/alerts.js:333` : `h.text`/`h.time`/`h.commodityId` proviennent de `localStorage` (altérable par extension malveillante). Refactor complet en `createElement` + `textContent`. L327 (état vide) refactorisé par cohérence.
- [x] **Durcissement href source badge** — `js/app.js:484-488` (`updateSourceBadge`) : refactor complet en `createElement`. `info.url` whitelistée http(s) avant assignation à `a.href`. Pas une faille réelle aujourd'hui (URLs en dur dans `api.js`) mais aligné sur `news.js` pour la défense en profondeur.
- _Volontairement non touché_ : `app.js:810` (innerHTML d'i18n contenant `<strong>` et `<br>` voulus pour les paragraphes — confirmé dans `i18n.js`). Les 13 autres `innerHTML` interpolent uniquement i18n bundled + catalog commodities statique + nombres calculés → aucun n'est exploitable.

- [x] **Synchro `site/`** — `index.html`, `js/news.js`, `js/sources.js`, `js/app.js`, `js/alerts.js` recopiés dans `site/` (déploiement GitHub Pages prêt)

### Fait — Checklist release — Vérification finale (21/05/2026)
Parcours systématique des 9 items de la checklist `Security Hardening Policy`. Aucune régression détectée.

| # | Item checklist | Statut | Détail |
|---|---|---|---|
| 1 | Aucune clé API/token/secret dans code/commits | ✅ | `grep -rEn "(api[_-]?key|token|secret|password|bearer)"` → 0 hit légitime |
| 2 | `innerHTML` avec données externes : zéro occurrence | ✅ | Audit des 19 `innerHTML` restants : tous interpolent uniquement i18n bundlé, `ALL_COMMODITIES` (catalogue statique), ou nombres calculés. `sources.js:196` (`_colorizeJSON`) échappe `&<>` avant le regex highlighting. `export.js:404` (`r.date`) est safe : les dates sont reconstruites via `toISOString().split('T')[0]` dans `api.js:214,439`, jamais raw API. `app.js:855` (`el.innerHTML = text`) interpole `I18N.t(key)` → bundle statique. |
| 3 | Meta CSP présente et à jour dans `index.html` | ✅ | Lignes 6-15. `default-src 'self'`, script/style/connect/font/img whitelistés, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. |
| 4 | SRI sur toutes les dépendances CDN | ✅ | Chart.js 4.4.7 et chartjs-adapter-date-fns 3.0.0 : `integrity="sha384-..."` + `crossorigin="anonymous"` (`index.html:21-26`). |
| 5 | Inputs utilisateur validés et bornés | ✅ | Cf. §6 du 21/05 : whitelist type, validation `commodityId ∈ ALL_COMMODITIES`, borne haute `value ≤ 1_000_000`. |
| 6 | localStorage : uniquement les clés documentées | ⚠️→✅ | Écart constaté : 7 clés réellement utilisées vs 4 documentées. Toutes légitimes (préférences UI). Tableau "Persistance localStorage" mis à jour ce jour pour refléter la réalité (`grainwatch_alerts_history`, `grainwatch_active_ids`, `grainwatch_visible` ajoutées). |
| 7 | Désérialisation localStorage protégée par try/catch | ✅ | Cf. §7 du 21/05 : `alerts.js:_load()`, `app.js:loadFavorites/loadVisibleCommodities/_initTheme`, `i18n.js:20`. |
| 8 | Pas de `console.log` contenant des données utilisateur en prod | ✅ | 10 `console.warn/error` audités, aucun ne loggue prix/alerte/input utilisateur. 5 objets `Error` entiers filtrés en `.message` le 21/05. |
| 9 | Vérifier securityheaders.com pour l'URL de production | ✅ | Voir section ci-dessous. |

### Fait — Vérification securityheaders.com / headers HTTP prod (21/05/2026)
URL prod réelle : **https://grainwatch.vercel.app/** (hébergement Vercel, et non GitHub Pages comme initialement supposé dans CLAUDE.md — corrigé).
securityheaders.com refuse les requêtes automatisées (403). Audit fait directement via `curl -sIL` sur l'URL prod.

**Headers présents :**
- ✅ `strict-transport-security: max-age=63072000; includeSubDomains; preload` (HSTS très fort — 2 ans + preload)
- ✅ `Content-Security-Policy` délivrée via `<meta>` HTML (vérifié dans la réponse).

**Headers manquants** (cause attendue : pas de `vercel.json` dans le repo) :
- ❌ `X-Content-Type-Options: nosniff`
- ❌ `Referrer-Policy: strict-origin-when-cross-origin` (ou `no-referrer`)
- ❌ `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- ❌ `X-Frame-Options: DENY` (redondant avec CSP `frame-ancestors 'none'` mais attendu par les scanners)
- ❌ `Cross-Origin-Opener-Policy: same-origin`
- ❌ CSP en **header HTTP** (uniquement présente en `<meta>` aujourd'hui — perte de points scoring)

**Scoring estimé sans correction : B**. Pour atteindre A/A+ → ajout d'un `vercel.json` (nouvelle tâche enregistrée ci-dessous). À noter : GitHub Pages ne supportant pas les headers HTTP custom, la meta CSP reste indispensable pour le fallback `site/`.

**Recommandation `vercel.json` minimal** :
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    }
  ]
}
```
La CSP en header peut être migrée dans un second temps (mêmes directives que la meta — copier-coller depuis `index.html:7-15`).

### A faire — Sécurité (prioritaire)
- [x] Audit complet : rechercher tous les `innerHTML` avec données API _(fait — §5 du 21/05)_
- [x] Audit complet : vérifier la meta CSP dans index.html _(fait — corrections critiques du 21/05)_
- [x] Audit complet : vérifier les attributs SRI sur les scripts CDN _(fait — corrections critiques du 21/05)_
- [x] Audit complet : vérifier la validation des inputs utilisateur _(fait — §6 du 21/05)_
- [x] Audit complet : vérifier les données localStorage et leur désérialisation _(fait — §7 du 21/05)_
- [x] Audit complet : rechercher les `console.log` sensibles _(fait — 21/05, aucun log sensible, 5 objets Error filtrés en .message)_
- [x] Vérification finale avec la checklist release _(fait — 21/05, voir section "Checklist release — Vérification finale" ci-dessous)_
- [x] Vérifier securityheaders.com pour l'URL de production _(fait — 21/05, voir section ci-dessous ; recommandation : ajouter `vercel.json` avec les headers manquants)_

### Fait — Sécurité — `vercel.json` (21/05/2026)
- [x] **`vercel.json` créé à la racine du projet.** Contient 6 directives sur `source: "/(.*)"` (matche toutes les routes statiques SPA) :
  - `Content-Security-Policy` — mêmes directives que la meta `index.html:7-15` (default-src 'self', script/connect/style/font/img whitelistés, base-uri/form-action self, frame-ancestors none). La meta dans le HTML est **conservée** pour le fallback GitHub Pages (`site/`).
  - `X-Content-Type-Options: nosniff` — bloque le MIME sniffing.
  - `Referrer-Policy: strict-origin-when-cross-origin` — limite la fuite de Referer cross-origin.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()` — désactive explicitement les APIs sensibles non utilisées par GrainWatch + opt-out FLoC/cohortes.
  - `X-Frame-Options: DENY` — redondant avec `frame-ancestors 'none'` mais attendu par les scanners.
  - `Cross-Origin-Opener-Policy: same-origin` — isole le contexte de navigation.
- **Note déploiement** : à pousser sur main, Vercel applique automatiquement les headers au prochain build (~30s). Vérifier après déploiement : `curl -sI https://grainwatch.vercel.app/ | grep -iE "csp|x-content|referrer|permissions|x-frame|coop"`.
- **Note GH Pages** : `vercel.json` est ignoré sur GitHub Pages — c'est attendu, la meta CSP suffit pour ce fallback.
- **Scoring attendu** après déploiement : **A+** sur securityheaders.com (HSTS fort déjà présent + tous les headers manquants ajoutés + CSP en header HTTP).

### Fait — Inter-app — Lien GrainWatch → GrainTrack3D (25/05/2026)
- [x] **Icône globe 3D dans `.detail-price-row`** (`index.html`) — SVG inline 28×28, juste avant `#detailPrice`. Attributs sécurité : `target="_blank"` + `rel="noopener noreferrer"` (anti tab hijacking). `display: none` par défaut.
- [x] **Constante de config + builder d'URL** (`js/app.js`, en-tête) — `GRAINTRACK3D_BASE_URL = 'https://grain-track3-d.vercel.app'`, `GRAINTRACK3D_PARAM_NAME = 'grain'`, `GRAINTRACK3D_SUPPORTED_KEYS` (Set des 12 céréales acceptées côté GrainTrack3D). `buildGrainTrack3DUrl()` valide le type, normalise lowercase, vérifie l'appartenance au Set, construit l'URL via `new URL()` + `searchParams.set()` (zéro concaténation, encodage auto).
- [x] **Branchement dans `loadDetail()`** (`js/app.js`) — après mise à jour du `#detailCode`. Affiche/masque l'icône selon que `buildGrainTrack3DUrl(selectedCommodity)` retourne une URL ou `null`. Les 14 denrées non-céréalières (café, cacao, coton, palm oil, sunflower, soybean_oil, rubber, tea, orange, banana, olive_oil, coconut_oil, wool, tobacco) → icône cachée. Tooltip rafraîchi via `I18N.t('graintrack3d_tooltip')` à chaque changement de langue (ligne 218 → `loadDetail()`).
- [x] **CSS dédié** (`css/style.css`, fin du fichier) — `.graintrack3d-link` utilise `var(--terracotta)` qui bascule auto en dark mode (cf. `[data-theme="dark"]` ligne 35-36). Hover scale + background terracotta 12%, focus-visible outline 2px, active scale down.
- [x] **i18n** (`js/i18n.js`) — clé `graintrack3d_tooltip` ajoutée FR/EN.
- [x] **Synchro `site/`** — `index.html`, `css/style.css`, `js/i18n.js`, `js/app.js` recopiés.
- **Test manuel à faire après déploiement** :
  - Ouvrir https://grainwatch.vercel.app/ → sélectionner "Blé" → icône globe visible à gauche du prix → clic ouvre https://grain-track3-d.vercel.app/?grain=wheat dans un nouvel onglet → GrainTrack3D doit pré-sélectionner le blé dans son GrainSelector
  - Sélectionner "Café" → icône cachée (denrée non supportée par GrainTrack3D)
  - Basculer FR↔EN → tooltip mis à jour
  - Mode sombre → couleur de l'icône bascule en `--terracotta` dark (#E07B5A)
- **Format paramètre URL vérifié Phase 0** : GrainTrack3D `src/App.jsx:30-36` lit `URLSearchParams.get('grain')` puis valide via `GRAIN_LIST.some(g => g.key === grainParam)` — keys lowercase (`wheat`, `corn`, `rice`, `soybean`, `sugar`, `barley`, `oats`, `sorghum`, `rapeseed`, `groundnut`, `lentils`, `millet`). GrainWatch utilise déjà ces mêmes IDs lowercase → aucune transformation requise, juste un filtre de whitelist.
- **CSP** : pas de modification nécessaire. La meta CSP couvre fetch/connect/script, mais une navigation `<a target="_blank">` ouvre un nouveau contexte de navigation non couvert par `connect-src`/`default-src` (et la directive `navigate-to` n'est pas définie). Vérifié OK.
- Rapport détaillé : `tasks/RAPPORT_LINK_GRAINTRACK3D_v1.md`.

### A faire — Conformité
- [ ] Implémenter une page /privacy minimaliste et la lier dans le footer

### A faire — Fonctionnalités (post-sécurité)
- [ ] Sparklines dans la sidebar (mini-graphiques par denrée)
- [ ] Comparateur multi-denrées sur un même graphique
- [ ] Analyse technique (moyennes mobiles, bandes de Bollinger)
- [ ] PWA (Progressive Web App) pour usage hors-ligne
- [ ] Carte mondiale des pays producteurs
- [ ] Tableau de corrélation entre matières premières
- [ ] Internationalisation FR/EN
- [ ] Backend léger (Firebase/Supabase) pour alertes push

---

## Workflow de déploiement

1. Copier les fichiers source dans le sous-dossier `site/`
2. `git add . && git commit -m "description" && git push`
3. GitHub Pages se met à jour automatiquement (~30 secondes)
4. Vérifier https://grainwatch.vercel.app/

---
## Roadmap fonctionnelle — Prochaines étapes
v0.9 — Page Géopolitique dédiée + Navigation
1. Fix actualités géopolitiques (GDELT)
Le panneau "Actualités géopolitiques" ne charge jamais de données.
Cause probable : l'appel à l'API GDELT ne filtre pas sur la céréale sélectionnée (ex. "wheat", "corn").
→ Passer le slug de la céréale en cours comme terme de recherche GDELT.
2. Page géopolitique dédiée
Déplacer le contenu géopolitique dans une page/vue dédiée (pas juste un panneau dans le dashboard).
Cette page contiendra un sélecteur de contexte avec deux modes :

Céréale en cours : filtre GDELT sur la denrée actuellement analysée
Toutes les denrées : aucun filtre sur le code céréale — vue globale

3. Menu hamburger
Remplacer les boutons et liens dispersés dans l'application par un menu hamburger centralisé.
Objectif : navigation propre et scalable à mesure que de nouvelles pages/fonctionnalités s'ajoutent.
4. vercel.json — Headers de sécurité
Quick win : ajouter un vercel.json avec les headers manquants identifiés lors de l'audit (X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy) pour viser un score A+ sur securityheaders.com.

---

 ## Organisation de l'équipe

JC : chef de projet, guide le développement, fournit les idées et la vision produit
Cowork (Claude Opus) : rédige les prompts techniques ultra-précis pour Claude Code, conseille sur l'architecture et la sécurité
Claude Code : ingénieur d'exécution, implémente les modifications dans le code

---


## Instructions pour Claude Code

Quand tu travailles sur ce projet :
1. **Lis ce fichier en entier** avant chaque session de travail
2. **Mets à jour la section "Suivi du projet"** après chaque action terminée (coche les tâches faites, ajoute les nouvelles)
3. **Respecte strictement les règles de sécurité** — ne jamais introduire de régression
4. **Documente tes changements** avec des commentaires clairs dans le code
5. **Demande confirmation** avant toute modification structurelle (ajout de dépendance, changement d'architecture)
6. **Contrainte CORS** : ne jamais proposer de proxy non audité pour contourner les blocages API
7. **Teste le mode sombre** : tout changement visuel doit fonctionner dans les deux thèmes
