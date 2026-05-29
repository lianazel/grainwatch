# CLAUDE.md — GrainWatch

> 📓 **Journal détaillé des actions terminées** (corrections sécurité, inter-app, v0.9.0, v0.9.1 P1-P4 / C1-C4) :
> voir `tasks/JOURNAL_v0.9.1.md`. Ce fichier ne garde qu'une ligne par correctif dans l'historique des versions.

## Contexte projet

**GrainWatch** est une application web mono-page (SPA) de suivi en temps réel des prix des matières premières agricoles. Déployée sur Vercel, elle ne nécessite aucun backend et consomme exclusivement des APIs publiques gratuites.

- **Version actuelle** : 0.9.2 (29 mai 2026)
- **URL de production** : https://grainwatch.vercel.app/ (déploiement actuel via Vercel)
- **Stack** : Vanilla JS / HTML5 / CSS3 / Chart.js — front statique + **1 Vercel Serverless Function** (`api/gdelt.js`, depuis C9)
- **Hébergement** : Vercel en production. Le sous-dossier `site/` est conservé pour un déploiement GitHub Pages alternatif (cf. `DEPLOY_GITHUB.md`). ⚠️ Le fallback GitHub Pages **ne supporte pas** `api/` (pas de serverless) → le panneau géopolitique n'y fonctionnera pas.
- **Codebase** : ~3 500 lignes de code, 11 modules JS (dont `geo.js`) + 1 fonction serverless
- **Auteur** : lianazel
- **Plus 100 % statique depuis C9** : une unique Serverless Function (`api/gdelt.js`) sert de proxy CORS vers GDELT. Toujours : aucun compte utilisateur, aucune clé API, aucun secret dans le code.

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
├── api/                    # Vercel Serverless Functions (NON statique)
│   └── gdelt.js            # Proxy CORS vers GDELT (C9) — pas copié dans site/
├── css/                    # Feuilles de style (variables, dark mode)
├── js/                     # 10 modules JS (1 par domaine fonctionnel)
│   ├── app.js              # Point d'entrée, initialisation
│   ├── chart.js            # Graphiques Chart.js (adapte couleurs dark/light)
│   ├── alerts.js           # Système d'alertes de prix
│   ├── news.js             # Panneau géopolitique GDELT (via proxy /api/gdelt)
│   ├── ...                 # Autres modules fonctionnels
├── site/                   # Sous-dossier déployé sur GitHub Pages (sans api/)
├── tasks/                  # Journal détaillé, rapports, leçons, todo
├── DEPLOY_GITHUB.md        # Procédure de déploiement
├── README.md               # Documentation publique
└── CLAUDE.md               # Ce fichier (mémoire projet)
```

### Sources de données
- **World Bank API** : cours des matières premières agricoles (blé, maïs, riz, soja...)
- **USDA FAS API** : données USDA sur les marchés agricoles internationaux
- **GDELT API v2** : actualités géopolitiques impactant les marchés

**Contrainte CORS** : les APIs Banque Mondiale, USDA et GDELT n'envoient pas d'`Access-Control-Allow-Origin` → bloquées en fetch direct depuis le navigateur.
- **Banque Mondiale / USDA** : page Sources affiche des données d'exemple + URL réelle copiable pour test manuel (inchangé).
- **GDELT (depuis C9)** : contourné par un **proxy first-party audité** `api/gdelt.js` (Vercel Serverless). Le front appelle `/api/gdelt` (même origine, donc pas de CORS), la fonction relaie côté serveur vers GDELT. **Pattern proxy** : hôte/chemin figés (pas de SSRF), whitelist stricte de paramètres (`query`, `mode`, `maxrecords`, `format`, `timespan`), validation `query` ≤ 500 car., aucun credential, timeout 10 s, cache Edge `s-maxage=900`.
- ⚠️ La règle « jamais de proxy **non audité** » reste absolue. Le proxy GDELT est first-party, à code lisible et audité — c'est l'exception conforme, pas un contournement par service tiers.

### Fonctionnalités implémentées (v0.9.x)
- Affichage des cours avec Chart.js (gradients adaptatifs dark/light)
- Mode sombre/clair : détection OS automatique + toggle manuel + persistance localStorage
- Alertes de prix : création, historique cliquable, détection de doublons, pré-remplissage
- Responsive mobile : barre d'outils une-ligne avec débordement auto vers le menu (`ResizeObserver`), tooltips tactiles (indicateur ⓘ tap-to-show sous `@media (hover:none)`), menu hamburger (panneau latéral À propos/Sources/Réglages, focus trap), footer mobile allégé
- Polices auto-hébergées (Inter + JetBrains Mono en `/fonts`, CSP `font-src 'self'`)
- Lien inter-app vers GrainTrack3D (icône globe, 3 états actif/désactivé/masqué)
- Panneau géopolitique (GDELT)
- Déploiement Vercel depuis `main` (fallback GitHub Pages via `site/`)

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
           connect-src 'self' https://api.worldbank.org https://apps.fas.usda.gov https://api.gdeltproject.org;
           style-src 'self' 'unsafe-inline';
           font-src 'self';">
```

> Depuis v0.9.0 : polices auto-hébergées (`/fonts/*.woff2`, `@font-face` dans `css/style.css`) — plus aucune dépendance Google Fonts, d'où `font-src 'self'` et `style-src` sans `fonts.googleapis.com`. Mêmes directives dupliquées en header HTTP dans `vercel.json`.

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
- [ ] localStorage : uniquement les clés documentées
- [ ] Désérialisation localStorage protégée par try/catch
- [ ] Pas de `console.log` contenant des données utilisateur en production
- [ ] Vérifier https://securityheaders.com pour l'URL de production

> État de la dernière vérification (21/05/2026) : 9/9 items OK, headers HTTP via `vercel.json`, scoring attendu A+. Détail dans `tasks/JOURNAL_v0.9.1.md`.

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

## Référence — Dark mode (mécanisme du projet)

Tout le dark mode est piloté par l'attribut `[data-theme]` sur `<html>` (`document.documentElement`), posé par `App._initTheme()` (`js/app.js:983+`) :
- Lecture stricte de `localStorage.getItem('grainwatch_theme')` (whitelist `'dark'|'light'` uniquement)
- Sinon, lecture de `window.matchMedia('(prefers-color-scheme: dark)')` → pose `data-theme="dark"`
- Sinon, pas d'attribut (= light par défaut)
- Le toggle 🌙/☀️ écrit dans localStorage et bascule l'attribut
- Écouteur `matchMedia.change` : ne touche à rien si l'utilisateur a fait un choix manuel (cohérence whitelist)

**Variables CSS** (`css/style.css:6-75`) : `:root` (light) et `[data-theme="dark"]` (dark) redéfinissent les mêmes noms (`--terracotta`, `--white`, `--black`, `--grey`, etc.) **avec inversion sémantique** :
- `--black` = `#2C2C2C` (light) → `#E8E4DB` (dark) — donc `color: var(--black)` reste lisible quel que soit le mode
- `--white` = `#FFFFFF` (light) → `#242444` (dark) — idem pour les fonds

**Pièges connus** : si un composant utilise `var(--black)` comme **background** (au lieu de `color`), il devient cream sur cream en dark. C'était le bug des tooltips. Pour tout composant inversé (fond sombre/texte clair en light mode), prévoir un override `[data-theme="dark"]` dédié.

**Mirror prefers-color-scheme** : la duplication dans `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }` (lignes 55-75) ne concerne **que** les variables CSS. Les overrides composant (lignes 1739-1885) utilisent uniquement `[data-theme="dark"]` car `_initTheme()` pose toujours l'attribut.

**Convention tactile** : comportement tactile ciblé par `@media (hover:none)`/`(pointer:coarse)`, jamais par breakpoint de largeur (cf. `tasks/lessons.md`).

---

## Historique des versions

> Une ligne par version. Détail technique complet de chaque correctif dans `tasks/JOURNAL_v0.9.1.md`.

| Version | Date       | Résumé                                                                |
|---------|------------|-----------------------------------------------------------------------|
| 0.9.2   | 29/05/2026 | **Page géopolitique dédiée + chargement GDELT à la demande** : le panneau dashboard `#geoPanel` (appel GDELT auto à chaque sélection de denrée → tapait le rate-limit 1 req/5 s) est remplacé par une page dédiée `#geoPage` accessible via le menu hamburger (section « Géopolitique »). Nouveau module `js/geo.js` (contrôleur `GeoPage` calqué sur `ExportPage` : dropdown groupé par catégorie, classes `.export-*` réutilisées). L'appel GDELT ne part **que** sur clic du bouton « Afficher les infos géopolitiques » (1 denrée = 1 requête, anti double-clic via `_loading`, cache 15 min de `NewsManager`). `NewsManager.render()` généralisé (conteneurs paramétrables `opts.articlesEl`/`subtitleEl`, rétrocompatible, sécurité `_safeUrl`/`_escapeHtml` intacte). `App.loadNews()` et l'appel auto supprimés (zéro code mort). `SourcesPage.open()`/`ExportPage.open()` masquent `#geoPage` (anti-empilement des pages, toutes deux atteignables via menu). 9 clés i18n FR/EN. Aucune nouvelle clé localStorage. `api/gdelt.js`/`vercel.json`/CSP non touchés. |
| 0.9.1   | 26/05/2026 | Refonte UX mobile (P1-P4) + correctifs post-test iPhone 14 (C1-C4, C4-bis) : sélecteur de source → sous-menu API + pastille `#sourcePastille`, garde-fou anti-débordement tooltips (`--tt-shift`), tooltip GrainTrack3D tactile, contraste dark mode (Sources + alerte déclenchée, WCAG AA), `setSource()` état unique barre↔menu, masquage forcé du sélecteur API via JS (`enforceSourceHiding()` / `matchMedia`) pour Safari iOS, fix overflow toolbar mobile (C6 : `justify-content:flex-end` cassait la détection `scrollWidth` → spacer `::before`), contraste input prix alertes dark mode (C5 : `background: var(--white)` + `::placeholder` manquants sur `.alerts-input`, WCAG AA), tooltip devise dynamique selon la monnaie active (C7 : clé i18n unique → `tooltip_currency_usd`/`tooltip_currency_eur` FR/EN, helper `updateCurrencyTooltip()` appelé à l'init + au clic devise + au changement de langue), panneau géopolitique GDELT réparé (C8 : requêtes `OR` non parenthésées → erreur texte HTTP 200 ; pattern ancre+groupe OR `wheat (price OR export OR …)`, retrait `sort=datedesc` → tri pertinence, parsing défensif `text()`+`JSON.parse` dans `news.js`), **proxy CORS GDELT** (C9 : GDELT bloqué CORS en prod → 1ʳᵉ Serverless Function `api/gdelt.js`, front appelle `/api/gdelt` ; whitelist params, validation query ≤500, timeout 10 s, cache Edge 15 min ; GrainWatch n'est plus 100 % statique), timeout GDELT relevé end-to-end (C9-bis : prod timeoutait à 10 s ; chaîne cohérente proxy 25 s + `vercel.json` `maxDuration:30` + abort navigateur `news.js` 30 s), **panneau GDELT enfin fonctionnel en prod** (C10 : le 502 venait du `fetch()` proxy sans header `User-Agent` → GDELT répondait `HTTP 429` texte → `JSON.parse` échouait → 502 ; ajout `User-Agent: GrainWatch/0.9.1` + `Accept` ; cause confirmée en live curl avec/sans UA ; instrumentation du 502 — `gdeltStatus`/`errorName`/`errorMessage` — pour diagnostic concluant ; T5 prod OK : `articles` peuplé) |
| 0.9.0   | 26/05/2026 | Refonte UX mobile : tooltips tactiles (ⓘ, `@media (hover:none)`), menu hamburger (focus trap), débordement auto barre d'outils (`ResizeObserver`), footer allégé. Polices auto-hébergées (`/fonts`), CSP `font-src 'self'` |
| 0.8.2   | 25/05/2026 | Lien inter-app GrainTrack3D (icône globe, 3 états, 12 céréales via `?grain=<key>`), unité sucre `c/kg`→`¢/kg`, lisibilité tooltips dark mode |
| 0.8.1   | 21/05/2026 | Security hardening : XSS GDELT, meta CSP, SRI CDN, innerHTML §5, validation inputs alertes, désérialisation localStorage défensive, radix 10 parseInt, filtrage console.* |
| 0.8.0   | 07/05/2026 | Mode sombre, alertes améliorées (historique, doublons), fix mobile    |
| 0.7.x   | antérieur  | Structure de base, graphiques, alertes V1                             |

---

## État actuel — Ce qui reste à faire

### v0.9 — Restant
1. ✅ **Actualités géopolitiques (GDELT) — RÉSOLU EN PROD le 29/05 (C10)**. Cause racine finale : le `fetch()` du proxy `api/gdelt.js` n'envoyait pas de header `User-Agent` → depuis Vercel (Node/undici), GDELT répondait `HTTP 429` (corps texte « limit requests to one every 5 seconds ») → `JSON.parse` échouait → 502. Fix : `User-Agent: GrainWatch/0.9.1` + `Accept: application/json`. Confirmé en live (curl avec UA = 200 + articles, sans UA = 429). T5 prod OK. Les couches C8/C9/C9-bis n'étaient pas la cause mais restent en place. **Reste possible (C8-bis, optionnel) : mots-clés enrichis par denrée, fallback en cascade, timespan adaptatif.** ⚠️ Limite connue (hors C10, §6.2) : GDELT rate-limite à 1 req/5 s par IP → un 502 transitoire `gdeltStatus:429` peut apparaître si plusieurs denrées sont chargées coup sur coup ; le cache Edge 15 min (par requête, seuls les 200 sont cachés) l'absorbe en usage normal.
2. ✅ **Page géopolitique dédiée — FAIT en v0.9.2 (29/05)**. Contenu géopolitique sorti du dashboard vers une page dédiée `#geoPage` (module `js/geo.js`), accessible via le menu, avec sélecteur de denrée et chargement à la demande (1 denrée = 1 requête → respecte le rate-limit GDELT). **Reporté après v0.9.2** (backlog) : le mode « Toutes les denrées » (vue globale sans filtre, via OR-group d'ancres GDELT — à valider d'abord au `curl`).

*(Items déjà faits : menu hamburger ✅ v0.9.0 ; `vercel.json` headers de sécurité ✅ v0.8.2/v0.9.0.)*

### Conformité
- [ ] Implémenter une page /privacy minimaliste et la lier dans le footer

### Fonctionnalités (post-sécurité)
- [ ] Sparklines dans la sidebar (mini-graphiques par denrée)
- [ ] Comparateur multi-denrées sur un même graphique
- [ ] Analyse technique (moyennes mobiles, bandes de Bollinger)
- [ ] PWA (Progressive Web App) pour usage hors-ligne
- [ ] Carte mondiale des pays producteurs
- [ ] Tableau de corrélation entre matières premières
- [ ] Internationalisation FR/EN
- [ ] Backend léger (Firebase/Supabase) pour alertes push

### Validation en attente
**🔜 PRIORITÉ PROCHAINE SESSION (30/05) — Tests fonctionnels page géopolitique v0.9.2 (T4–T11)** : non exécutés (pas de navigateur dans l'env de dev). Checklist détaillée dans `tasks/RAPPORT_FEATURE_PAGE_GEOPOLITIQUE_v1.md` §5. À dérouler sur `https://grainwatch.vercel.app/` ou iPhone :
- T4 : plus de panneau géo sous le graphique du dashboard.
- T5 : navigation entre denrées = **zéro** requête `/api/gdelt` (onglet Réseau DevTools) — c'est le cœur de la feature.
- T6 : menu → « 🌍 Contexte géopolitique » ouvre la page.
- T7 : choisir denrée → clic bouton → spinner → articles (bouton désactivé pendant le chargement).
- T8 : « Retour au tableau de bord » → dashboard intact.
- T9 : thème clair + sombre OK ; FR + EN OK. T10 : zéro erreur console. T11 (anti-régression) : pages Export et Sources toujours OK (partage des classes `.export-*` + masquage mutuel des pages).
- ⚠️ Note rate-limit GDELT : un `502 {gdeltStatus:429}` transitoire peut apparaître si on enchaîne les requêtes (1 req/5 s par IP) — ce n'est pas un bug, le cache 15 min l'absorbe en usage normal.

Vérif statique v0.9.2 faite (syntaxe JS des 6 modules, `<section>` 8/8, accolades CSS 625/625, IDs 8/8, clés i18n 8/8, ordre scripts, zéro code mort).

_Anciens tests UX device (v0.9.0/0.9.1) restés en attente : tap tooltips, menu, overflow, focus trap, re-test C4 après vidage cache Safari._

---

## Workflow de déploiement

1. Copier les fichiers source dans le sous-dossier `site/`
2. `git add . && git commit -m "description" && git push`
3. Vercel se met à jour automatiquement (~30 secondes)
4. Vérifier https://grainwatch.vercel.app/

---

## Organisation de l'équipe

JC : chef de projet, guide le développement, fournit les idées et la vision produit
Cowork (Claude Opus) : rédige les prompts techniques ultra-précis pour Claude Code, conseille sur l'architecture et la sécurité
Claude Code : ingénieur d'exécution, implémente les modifications dans le code

---

## Instructions pour Claude Code

Quand tu travailles sur ce projet :
1. **Lis ce fichier en entier** avant chaque session de travail (et `tasks/JOURNAL_v0.9.1.md` si besoin du détail d'un correctif passé)
2. **Mets à jour l'historique des versions et l'état actuel** après chaque action terminée ; consigne le détail technique dans `tasks/JOURNAL_v0.9.1.md`
3. **Respecte strictement les règles de sécurité** — ne jamais introduire de régression
4. **Documente tes changements** avec des commentaires clairs dans le code
5. **Demande confirmation** avant toute modification structurelle (ajout de dépendance, changement d'architecture)
6. **Contrainte CORS** : ne jamais proposer de proxy non audité pour contourner les blocages API
7. **Teste le mode sombre** : tout changement visuel doit fonctionner dans les deux thèmes
