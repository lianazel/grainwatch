# Lessons — GrainWatch (local)

## 2026-05-26 — Comportement tactile : feature queries plutôt que breakpoints de largeur
**Type** : Erreur (anti-pattern identifié dans le code existant)
**Contexte** : Diagnostic mobile v0.8.2. Les tooltips étaient masqués sur mobile via `@media (max-width: 768px) { display: none !important }` (`css/style.css:2121` et `2315`), et la « détection tactile » reposait sur `window.matchMedia('(max-width: 768px)')` (`js/app.js:990`).
**Erreur/Approche** : Utiliser la largeur de viewport comme proxy de la capacité tactile. Angle mort : une tablette tactile large (> 768 px) est traitée comme un desktop (tooltips au survol inexistants), et un petit écran branché à une souris perd les tooltips alors qu'il peut survoler.
**Correction/Pattern** : Pour TOUT comportement lié au tactile/hover (masquage de tooltip, cibles tactiles, fallback tap), utiliser `@media (hover: none)` et/ou `@media (pointer: coarse)` — **jamais** un breakpoint de largeur. **Convention du projet GrainWatch, validée par JC le 26/05/2026.**
**Applicable globalement ?** : Oui — promu dans `~/.claude/lessons.md` (bonne pratique web universelle).

## 2026-05-26 — Overflow responsive : déplacer le nœud DOM, ne pas cloner
**Type** : Succès
**Contexte** : Menu hamburger v0.9.0. Le prompt décrivait un auto-overflow de la barre d'outils par `ResizeObserver` qui **clonait** les icônes excédentaires dans le menu (avec un compteur). Les contrôles concernés portent un état (devise active, icône thème 🌙/☀️, drapeau FR/EN).
**Erreur/Approche** : Le clonage crée **deux copies** du même contrôle à garder synchronisées (état + écouteurs via délégation obligatoire) → fragile et source de désync. Choix retenu (validé JC) : `setupToolbarOverflow()` **déplace** les vrais nœuds DOM (`headerRight.insertBefore` / `menuSettings.appendChild`) selon une stratégie reset→redistribue, et les ramène au resize.
**Correction/Pattern** : Pour un overflow responsive de contrôles UI **porteurs d'état** (toggles, sélecteurs actifs), **déplacer le nœud DOM réel** plutôt que le cloner → une seule source de vérité, écouteurs préservés, zéro synchronisation. Réserver le clonage aux éléments purement statiques/sans état.
**Applicable globalement ?** : Reste local (pattern frontend spécifique). À promouvoir si le cas se représente sur un autre projet web. Lié à [[comportement-tactile-feature-queries]].

## 2026-05-26 — Bug device persistant alors que le code/déploiement est correct
**Type** : Erreur (de process, rencontrée 2× dans la même session)
**Contexte** : v0.9.1, tests iPhone 14. C1 puis C4 : « le sélecteur API est encore visible sur mobile » alors que le code masquait correctement `#ctrlSource` (`display:none` dans `@media ≤768px`). Deux fois, le symptôme était incohérent avec l'état réel du code.
**Erreur/Approche** : Risque de « corriger » du code déjà correct en se fiant à un retour device sans vérifier l'artefact réellement servi ni le **timing de déploiement** (le test C1 précédait le déploiement du commit ; pour C4, « pastille + boutons visibles ensemble » est logiquement impossible — les 2 règles CSS sont mutuellement exclusives dans le même bloc média).
**Correction/Pattern** : Avant de présumer un bug de code sur retour device : (1) **récupérer l'artefact déployé** (`curl https://.../style.css`) et y chercher la règle ; (2) vérifier que le **commit est bien déployé** (un test peut précéder le build ~30 s) ; (3) raisonner sur la **cohérence interne** (deux états mutuellement exclusifs ne coexistent pas) ; (4) si non reproductible/inexplicable, appliquer un **durcissement défensif** (`!important` + ciblage direct) plutôt que de tâtonner, et **le documenter** ; vider le cache device avant re-test.
**Applicable globalement ?** : Oui — « vérifier avant de corriger », vaut pour tout projet déployé. Promu dans `~/.claude/lessons.md`. Cohérent avec la valeur « Verification Before Done » de JC.

## 2026-05-26 — Clamp de tooltip via custom property (préserve le centrage) + déclencheur = élément évident
**Type** : Succès
**Contexte** : v0.9.1 P2/C2. (P2) Empêcher une bulle de déborder du viewport sur mobile sans casser son centrage `translateX(-50%)`. (C2) Le message d'un lien désactivé (GrainTrack3D) n'apparaissait pas au tap : un ⓘ *frère* avait été ajouté mais l'utilisateur tape l'icône, pas le petit ⓘ.
**Erreur/Approche** : (P2) Écraser `transform` en JS (`style.transform = translateX(δ)`) détruit le `translateX(-50%)` de centrage. (C2) Mettre le déclencheur sur un élément annexe que l'utilisateur ne remarque pas.
**Correction/Pattern** : (P2) Tisser une **custom property** (`--tt-shift`, défaut `0px`) dans les `transform` CSS (`translateX(calc(-50% + var(--tt-shift,0px)))` pour la bulle, signe inverse pour la flèche) ; le JS ne pose que la variable après mesure `getBoundingClientRect` → centrage de base préservé, bulle + flèche réagissent ensemble. (C2) Faire de **l'élément évident lui-même le déclencheur** (l'icône, pas un ⓘ à côté) ; penser à `stopPropagation()` quand une délégation `document` ferme les tooltips au clic extérieur (sinon le même clic rouvre puis referme).
**Applicable globalement ?** : Partiellement — la technique custom-property/`calc()` et la règle UX « déclencheur = élément évident » sont réutilisables ; reste local pour l'instant. Lié à [[comportement-tactile-feature-queries]].
