# GrainWatch — Note de reprise de session

## Le projet
GrainWatch est une app web vanilla JS (zéro framework, zéro build) hébergée sur GitHub Pages : https://lianazel.github.io/grainwatch/
Elle affiche les cours de 24 denrées alimentaires via 3 sources (Banque Mondiale, USDA, GDELT).

## Version actuelle : v0.8.0

## Architecture fichiers
Le développement se fait dans :
```
C:\JobDirectory\CLAUDE_PROJECTS\_WEB\GrainWatch\GrainWatch\
├── index.html
├── css/style.css (~3400 lignes)
├── js/
│   ├── app.js (~920 lignes) — contrôleur principal
│   ├── alerts.js (~480 lignes) — système d'alertes
│   ├── chart.js (~155 lignes) — Chart.js wrapper
│   ├── i18n.js (~300 lignes) — traductions FR/EN
│   ├── api.js — appels Banque Mondiale
│   ├── api-usda.js — appels USDA
│   ├── commodities.js — catalogue 24 denrées
│   ├── export.js — export CSV/MD/JSON
│   ├── sources.js — page Sources/APIs
│   └── geopolitics.js — fil GDELT
├── README.md
└── site/ ← DÉPÔT GIT (c'est ici qu'on push)
    ├── .git/
    ├── index.html
    ├── css/
    ├── js/
    └── img/
```

## Workflow de déploiement
1. On modifie les fichiers dans le dossier racine GrainWatch\
2. On copie vers site\ avant de push :
```cmd
cd C:\JobDirectory\CLAUDE_PROJECTS\_WEB\GrainWatch\GrainWatch
copy /Y index.html site\
xcopy /Y /S css site\css\
xcopy /Y /S js site\js\
cd site
git add .
git commit -m "message"
git push
```

## IMPORTANT — Édition des fichiers
Les fichiers CSS et JS sont trop gros pour l'outil Edit de Claude (troncature au-delà de ~700-1000 chars). Il faut utiliser des scripts Python via bash pour les modifications. Seules les petites éditions ciblées peuvent passer par Edit.

## Ce qui a été fait (v0.1 → v0.8)
- Dashboard 24 denrées + Chart.js + 7 périodes + plage custom (15 ans)
- Multi-sources (Banque Mondiale, USDA, simulation)
- Contexte géopolitique GDELT
- Export CSV/Markdown/JSON
- Page Sources/APIs avec test live + JSON colorisé
- Alertes (seuil haut/bas, variation %) + toast + historique cliquable + doublon
- Mode sombre (auto OS + toggle) avec palette bleu nuit/violet
- Responsive mobile (vue liste/détail, header réorganisé)
- Traduction FR/EN complète
- Favoris + catalogue personnalisable + localStorage

## Roadmap — Prochaines features (dans l'ordre)
1. **Comparaison multi-denrées** sur un même graphique
2. **Analyse technique** (moyennes mobiles, bandes de Bollinger)
3. **PWA** : installation mobile + cache offline
4. **Carte mondiale** interactive
5. **Corrélations** entre denrées
6. *(Backend : prévu pour plus tard)*

## Dernier point en suspens
Le bouton "Toutes" (tab-btn) était invisible en dark mode. Le fix CSS est en place localement (`color: #fff` hardcodé dans `[data-theme="dark"] .tab-btn.active`). Il faut juste s'assurer que le copy + push vers site/ a bien été fait.

## Les docs techniques (DOCX) restent en local, on ne les push PAS sur GitHub.
