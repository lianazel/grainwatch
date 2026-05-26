# Lessons — GrainWatch (local)

## 2026-05-26 — Comportement tactile : feature queries plutôt que breakpoints de largeur
**Type** : Erreur (anti-pattern identifié dans le code existant)
**Contexte** : Diagnostic mobile v0.8.2. Les tooltips étaient masqués sur mobile via `@media (max-width: 768px) { display: none !important }` (`css/style.css:2121` et `2315`), et la « détection tactile » reposait sur `window.matchMedia('(max-width: 768px)')` (`js/app.js:990`).
**Erreur/Approche** : Utiliser la largeur de viewport comme proxy de la capacité tactile. Angle mort : une tablette tactile large (> 768 px) est traitée comme un desktop (tooltips au survol inexistants), et un petit écran branché à une souris perd les tooltips alors qu'il peut survoler.
**Correction/Pattern** : Pour TOUT comportement lié au tactile/hover (masquage de tooltip, cibles tactiles, fallback tap), utiliser `@media (hover: none)` et/ou `@media (pointer: coarse)` — **jamais** un breakpoint de largeur. **Convention du projet GrainWatch, validée par JC le 26/05/2026.**
**Applicable globalement ?** : Oui — promu dans `~/.claude/lessons.md` (bonne pratique web universelle).
