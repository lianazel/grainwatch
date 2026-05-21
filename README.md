# 🌾 Cours mondiaux des denrées alimentaires

**Suivez les prix des matières premières agricoles, en temps réel.**

Une application web responsive qui agrège **3 sources de données ouvertes** — Banque Mondiale, USDA et GDELT — pour afficher les cours de 24 denrées alimentaires avec graphiques interactifs, traduction FR/EN et export CSV.

**Pas de compte. Pas de build. Pas de framework.** Juste de la donnée publique, joliment mise en forme et consultable en un clic.

🌐 [Démo en ligne](https://lianazel.github.io/grainwatch/) · ✨ [Fonctionnalités](#-fonctionnalités) · 🏗 [Stack](#-technique-dempilement) · ⚙ [Développement local](#-développement-local) · 🚀 [Déploiement](#-déploiement) · 📦 [Versions](#-historique-des-versions) · 👥 [Contribuer](#-contributeur)

---

## ✨ Fonctionnalités

### 📊 Dashboard interactif

- **24 denrées** : blé, maïs, riz, café, cacao, huile de palme, soja, thé, banane, lentilles, millet…
- **Graphiques Chart.js** avec dégradés, tooltips au survol et 7 périodes (1M à 15A) + plage personnalisée
- **Indicateurs clés** : prix actuel, variation, moyenne, plus haut, tendance
- **Conversion EUR/USD** en temps réel

### 🔄 Multi-sources de données

- **Banque Mondiale** — prix mensuels du Pink Sheet (70+ commodités, gratuit, sans clé API)
- **USDA** — données de production, stock et distribution (annuelles, gratuites)
- **Simulation** — marche aléatoire avec retour à la moyenne pour l'usage offline/démo
- Sélecteur de source avec tooltip explicatif et flèche dynamique

### 🌍 Contexte géopolitique

- Fil d'actualités **GDELT** par denrée
- Articles géopolitiques liés aux marchés alimentaires
- Dates localisées selon la langue active

### 📤 Export multi-format (v0.6.0)

- **CSV** (avec BOM UTF-8 pour Excel), **Markdown** (tableau + métadonnées), **JSON** structuré
- Sélection multi-denrées par chips cliquables
- Plage de dates personnalisable avec validation
- Copie presse-papier (Markdown) et aperçu limité à 50 lignes

### 🔔 Alertes de prix (v0.7.0+)

- **4 types** : seuil haut, seuil bas, hausse en %, baisse en %
- Notifications **toast** avec auto-disparition
- Panneau dédié avec historique des déclenchements
- **Historique cliquable** : un clic pour recréer une alerte passée
- **Détection de doublon** : confirmation avant remplacement si une alerte existe déjà
- Maximum 5 alertes simultanées, persistance localStorage

### 📡 Page Sources / APIs (v0.6.0)

- Page pédagogique expliquant chaque API utilisée
- Boutons interactifs pour tester les appels en direct (WB, USDA, GDELT)
- Affichage JSON colorisé (thème Catppuccin Mocha)
- **100% gratuit, aucune clé API dans le code**

### 🌙 Mode sombre (v0.8.0)

- **Auto-détection** : suit le thème de l'OS via `prefers-color-scheme`
- **Toggle soleil/lune** dans le header pour forcer le mode
- Palette sombre cohérente (bleu nuit, violet profond) avec les accents terracotta/olive/blé
- Graphiques Chart.js adaptés (gradients, axes, tooltips)
- Choix persisté en localStorage

### 🎨 Personnalisation

- **Traduction FR/EN** complète en un clic (persistée en localStorage)
- **Catalogue personnalisable** : ajouter/retirer des denrées depuis un catalogue de 24
- **Favoris** persistés entre les sessions
- **Responsive mobile** : vue liste/détail avec navigation tactile

---

## 🏗 Technique d'empilement

Choix délibéré : **zéro build step**, zéro framework lourd. Un simple hébergement statique (GitHub Pages) suffit.

| Couche | Technologie |
|--------|------------|
| Structure | HTML5 sémantique |
| Style | CSS3 custom properties (variables terracotta, blé, olive, crème) |
| Logique | JavaScript ES6+ (vanilla) |
| Graphiques | [Chart.js](https://www.chartjs.org/) 4.4.7 |
| Typographie | Inter · JetBrains Mono (Google Fonts) |
| Prix matières | [World Bank Commodity Markets API](https://www.worldbank.org/en/research/commodity-markets) |
| Production | [USDA FAS PSD API](https://apps.fas.usda.gov/OpenData/) |
| Actualités | [GDELT API v2](https://api.gdeltproject.org/) |
| Hébergement | **GitHub Pages** |

### Palette de couleurs

| Couleur | Hex | Usage |
|---------|-----|-------|
| Terracotta | `#C0392B` | Headers, accents, tendance baissière |
| Blé | `#D4A843` | Boutons secondaires, badges |
| Olive | `#6B7C2D` | Éléments actifs, tendance haussière |
| Crème | `#FDF6E3` | Fond de page |

---

## 📁 Structure du projet

```
grainwatch/
├── index.html              # Point d'entrée — UI complète
├── css/
│   └── style.css           # Styles (variables, responsive, animations, 3200+ lignes)
├── js/
│   ├── app.js              # Contrôleur principal — état, événements, navigation
│   ├── api.js              # Abstraction des sources (World Bank, USDA, simulation)
│   ├── alerts.js           # Système d'alertes de prix (seuil + variation)
│   ├── chart.js            # Configuration Chart.js (dégradés, tooltips, axes)
│   ├── commodities.js      # Catalogue des 24 denrées (défauts + extras)
│   ├── export.js           # Export multi-format (CSV, Markdown, JSON)
│   ├── i18n.js             # Système de traduction FR/EN (150+ clés)
│   ├── news.js             # Fil d'actualités GDELT par denrée
│   └── sources.js          # Page pédagogique sur les APIs
├── README.md
├── LICENSE
└── .gitignore
```

---

## ⚙ Développement local

Aucun outillage requis — un simple serveur HTTP statique suffit.

```bash
git clone https://github.com/lianazel/grainwatch.git
cd grainwatch

# Avec Python (déjà installé partout)
python3 -m http.server 8000

# ou avec Node
npx serve .
```

Ouvre ensuite [http://localhost:8000](http://localhost:8000).

> **Note** : les APIs Banque Mondiale et GDELT sont appelées directement depuis le navigateur (CORS autorisé). La source « Simulation » fonctionne entièrement offline.

---

## 🚀 Déploiement

### 1. Pousser sur GitHub

```bash
git init
git add .
git commit -m "feat: initial release"
git branch -M main
git remote add origin https://github.com/<ton-pseudo>/grainwatch.git
git push -u origin main
```

### 2. Activer GitHub Pages

Dans les **Paramètres** du repo → **Pages** :

- **Source** : `Deploy from a branch`
- **Branche** : `main` / `/ (root)`
- **Sauvegarder**

Le site est accessible quelques minutes plus tard à l'adresse `https://<ton-pseudo>.github.io/grainwatch/`.

---

## 👥 Contributeur

Les idées et les PR sont les bienvenues. Quelques pistes d'évolution dans l'ordre d'envie :

- [x] ~~Alertes prix : notification quand un seuil est franchi~~ ✅ v0.7.0
- [x] ~~Données historiques longues (5 ans, 10 ans)~~ ✅ v0.5.0 (jusqu'à 15 ans)
- [x] ~~Mode sombre déclenché par `prefers-color-scheme`~~ ✅ v0.8.0
- [ ] Comparaison multi-denrées sur un même graphique
- [ ] Widget embarquable (`<iframe>`) pour sites tiers
- [ ] PWA : installation mobile + cache offline
- [ ] Notifications push navigateur (Web Push API)
- [ ] Analyse technique (moyennes mobiles, bandes de Bollinger)

---

## 📦 Historique des versions

| Version | Date | Contenu |
|---------|------|---------|
| **v0.8.0** | Mai 2026 | Mode sombre (auto OS + toggle), alertes améliorées (historique cliquable, doublon), fix iOS |
| **v0.7.1** | Mai 2026 | Fix responsive mobile (header 2 lignes, bouton Appliquer tactile, géo panel visible) |
| **v0.7.0** | Mai 2026 | Système d'alertes (seuil + variation), notifications toast, historique, doc technique |
| **v0.6.0** | Mai 2026 | Export multi-format (CSV/Markdown/JSON), page Sources/APIs, JSON colorisé |
| **v0.5.0** | Mai 2026 | Plage personnalisée (jusqu'à 15 ans), contexte géopolitique GDELT, cache API |
| **v0.4.0** | Mai 2026 | Catalogue étendu (24 denrées), personnalisation, traduction FR/EN, favoris |
| **v0.3.0** | Avr 2026 | Multi-sources (Banque Mondiale, USDA, simulation), unités métriques, tooltips |
| **v0.2.0** | Avr 2026 | Graphiques Chart.js, sélecteur de période, conversion EUR/USD |
| **v0.1.0** | Avr 2026 | Prototype initial, 12 denrées, données simulées |

---

## 📄 Licence et crédits

- **Code** : MIT (voir [LICENSE](LICENSE))
- **Prix matières** : © [World Bank](https://www.worldbank.org/en/research/commodity-markets) — Creative Commons Attribution 4.0
- **Production** : © [USDA FAS](https://apps.fas.usda.gov/OpenData/) — domaine public
- **Actualités** : © [GDELT Project](https://www.gdeltproject.org/) — données ouvertes
- **Typographie** : [Inter](https://rsms.me/inter/) · [JetBrains Mono](https://www.jetbrains.com/lp/mono/)

Fait avec 🇫🇷 en France.
