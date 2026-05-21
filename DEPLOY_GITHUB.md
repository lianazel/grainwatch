# GrainWatch — Déploiement GitHub Pages

## Prérequis
- Le repo Git est dans le sous-dossier `site/`
- Les fichiers sources sont à la racine du projet

## Commandes de déploiement

Ouvrir un terminal dans le dossier du projet GrainWatch, puis :

```
cd site

copy /Y ..\index.html .
copy /Y ..\README.md .
xcopy ..\js js\ /E /Y
xcopy ..\css css\ /E /Y

git add -A
git status
git commit -m "vX.Y.Z — Description des changements"
git push origin main
```

## Notes
- `/Y` évite la question "Remplacer ? (Oui/Non/Tous)"
- `git status` permet de vérifier ce qui va être commité
- Pour inclure la doc technique : `copy /Y ..\GrainWatch_v0.7.0_Documentation_Technique.docx .`
- GitHub Pages se met à jour ~30 secondes après le push
- URL live : https://lianazel.github.io/grainwatch/
