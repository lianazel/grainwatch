# CLAUDE.md — GrainWatch

## Contexte projet

**GrainWatch** est une application web mono-page (SPA) de suivi en temps réel des prix des matières premières agricoles. Déployée sur GitHub Pages, elle ne nécessite aucun backend et consomme exclusivement des APIs publiques gratuites.

- **Version actuelle** : 0.8.0 (7 mai 2026)
- **URL de production** : https://lianazel.github.io/grainwatch/
- **Stack** : Vanilla JS / HTML5 / CSS3 / Chart.js — GitHub Pages (statique pur)
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

### Fonctionnalités implémentées (v0.8.0)
- Affichage des cours avec Chart.js (gradients adaptatifs dark/light)
- Mode sombre/clair : détection OS automatique + toggle manuel + persistance localStorage
- Alertes de prix : création, historique cliquable, détection de doublons, pré-remplissage
- Responsive mobile : header 2 lignes, bouton rafraîchir icône seule, fix iOS touchend
- Panneau géopolitique (GDELT)
- Déploiement GitHub Pages via site/

### Persistance localStorage
| Clé                    | Type     | Usage                         |
|------------------------|----------|-------------------------------|
| `grainwatch_theme`     | string   | "dark" ou "light"             |
| `grainwatch_favorites` | array    | Liste de slugs des favoris    |
| `grainwatch_alerts`    | array    | Alertes configurées           |
| `grainwatch_lang`      | string   | "fr" ou "en"                  |

Aucune autre donnée ne doit être stockée. Jamais de données personnelles, IP, ou fingerprint.

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

### Fait — Sécurité MOYEN §5 — innerHTML avec interpolation (21/05/2026)
Audit complet des 17 `innerHTML` dans `app.js`, `alerts.js`, `export.js` :
- [x] **XSS historique alertes** — `js/alerts.js:333` : `h.text`/`h.time`/`h.commodityId` proviennent de `localStorage` (altérable par extension malveillante). Refactor complet en `createElement` + `textContent`. L327 (état vide) refactorisé par cohérence.
- [x] **Durcissement href source badge** — `js/app.js:484-488` (`updateSourceBadge`) : refactor complet en `createElement`. `info.url` whitelistée http(s) avant assignation à `a.href`. Pas une faille réelle aujourd'hui (URLs en dur dans `api.js`) mais aligné sur `news.js` pour la défense en profondeur.
- _Volontairement non touché_ : `app.js:810` (innerHTML d'i18n contenant `<strong>` et `<br>` voulus pour les paragraphes — confirmé dans `i18n.js`). Les 13 autres `innerHTML` interpolent uniquement i18n bundled + catalog commodities statique + nombres calculés → aucun n'est exploitable.

- [x] **Synchro `site/`** — `index.html`, `js/news.js`, `js/sources.js`, `js/app.js`, `js/alerts.js` recopiés dans `site/` (déploiement GitHub Pages prêt)

### A faire — Sécurité (prioritaire)
- [ ] Audit complet : rechercher tous les `innerHTML` avec données API
- [ ] Audit complet : vérifier la meta CSP dans index.html
- [ ] Audit complet : vérifier les attributs SRI sur les scripts CDN
- [ ] Audit complet : vérifier la validation des inputs utilisateur
- [ ] Audit complet : vérifier les données localStorage et leur désérialisation
- [ ] Audit complet : rechercher les `console.log` sensibles
- [ ] Corriger toutes les failles identifiées
- [ ] Vérification finale avec la checklist release
- [ ] Vérifier securityheaders.com pour l'URL de production

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
4. Vérifier https://lianazel.github.io/grainwatch/

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
