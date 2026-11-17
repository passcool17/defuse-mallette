# Défuse la mallette — fiche du jeu

**Jouer :** https://passcool17.github.io/defuse-mallette/ · **Manuel de l'expert :** https://passcool17.github.io/defuse-mallette/manuel.html · **Dépôt :** https://github.com/passcool17/defuse-mallette

## État (v0.1.0, 16 nov. 2026)
- Jouable de bout en bout sur téléphone, en portrait (412×915) comme en paysage (915×412), au toucher ou au clavier d'ordinateur.
- La mallette est **procédurale** : le modèle GLB choisi par Pascal n'est pas encore livré (voir « Modèles 3D prévus »). Le chargeur GLB est déjà prêt et tolérant (`?glb=…`).
- Tests : logique sur 5000 codes, manuel = jeu sur 5000 codes, vrai tactile CDP dans les deux orientations, 0 erreur console, moins de 100 appels de dessin partout.
- Pas encore essayé sur un vrai Galaxy S20 ni sur la vraie mallette ESP32.

## Concept
Une mallette orange de type Pelican, fictive, posée sur une table. Au début, les loquets claquent et le couvercle s'ouvre : il contient un écran qui affiche le code de partie. Le fond est divisé en **6 cases** rétroéclairées en couleur : 5 modules et un panneau de contrôle. Le **désamorceur** voit la mallette, mais pas les règles. L'**expert** a le manuel, mais ne voit pas la mallette. Les deux appareils ne communiquent pas : il faut se parler.

Chaque partie a un **code** (ex. `48213-4`) : 5 chiffres D1 à D5, puis un chiffre de contrôle C. Le code est affiché sur le couvercle, sur l'OLED et dans le brief. Un même code donne toujours la même mallette. Le manuel détecte une faute de frappe dans le code (chiffre de contrôle).

## Modules (calqués sur le kit ESP32 de Pascal)
| Case | Module | Ce que voit le désamorceur | Ce que dit le manuel |
|---|---|---|---|
| 1 | **Fils** | 4 à 6 fils de couleur | Selon le nombre de fils, la première règle vraie indique **un seul** fil à couper |
| 2 | **Clavier 4×4** | Rétroéclairage d'une couleur | Les positions des chiffres du code (Dn) selon la couleur, + le nombre de fils, modulo 10 ; valider avec `#` si C est pair, `D` s'il est impair |
| 3 | **Joystick** | Une DEL qui montre 4 couleurs en boucle | Couleur → direction (table selon la parité de D5), puis **Clic** |
| 4 | **Badge RFID** | DEL du lecteur : une couleur qui clignote N fois ; 6 badges ALPHA à FOXTROT | Badge 1 dans la table [couleur][N] ; badge 2 = décalage de D1 |
| 5 | **Inclinaison** | Bille dans une cuvette, DEL de couleur | 2 inclinaisons tenues 1 s (selon la couleur), puis (D3 mod 3)+1 secousses et 2 s sans bouger |
| — | **Contrôle** | Minuterie 4 chiffres (7 segments), OLED 128×64, buzzer, bouton **Indice**, 5 DEL d'état, DEL d'erreurs | Erreurs et score |

Les règles n'utilisent que des entiers et de petites tables. Elles sont donc reproductibles sur un ESP32 : voir [docs/ESP32.md](docs/ESP32.md) (brochage, pseudocode, spécification exacte de mulberry32, ordre des tirages, vecteurs de test).

## Rôles et modes
- **Duo (2 appareils)** : le brief affiche le code, un **code QR** et le lien `manuel.html?code=…` pour l'expert, et l'écran du couvercle les affiche aussi. Le manuel fonctionne hors ligne et recalcule la page propre à ce code (section « Fiche de l'arbitre », repliée). Il n'y a pas de bouton manuel dans le jeu.
- **Équipe (1 appareil)** : le bouton 📖 ouvre le manuel par-dessus la mallette, et la minuterie continue de tourner.
- **Réglages** (mémorisés) : chrono de 1 à 99 min (15 par défaut), erreurs permises de 1 à 9 (3 par défaut). La mallette explose quand on atteint ce nombre d'erreurs ou quand la minuterie arrive à 0.
- **Indices** (bouton jaune 💡 ou bouton Indice de la mallette) : le 1er appui sur un module donne la ligne du manuel à lire, le 2e donne la prochaine action. Chaque indice coûte des points.
- **Score** : victoire = 5000 + 10 × secondes restantes − 500 × erreurs − 250 × indices. Explosion = 500 × modules désamorcés − 250 × indices (minimum 0). Le meilleur score est mémorisé par mode.
- Rejouer : « Rejouer ce code » ou saisir un code au menu.

## Contrôles
- **Toucher une case** de la vue d'ensemble pour zoomer dessus. **Glisser à gauche ou à droite** pour changer de module. Boutons ◀ ▶ et « Vue d'ensemble » en bas (à droite en paysage).
- Fils : toucher un fil pour le couper. Clavier : toucher les touches (`*` efface). Joystick : glisser le manche dans une direction, puis le toucher pour **Clic**. RFID : toucher un badge (il vole jusqu'au lecteur).
- Inclinaison : bouton « Activer l'inclinaison du téléphone » (gyroscope, avec demande de permission sur iOS), ou glisser la bille du doigt. Pour secouer : secouer le téléphone, ou le bouton « Secouer ».
- Clavier d'ordinateur :
  - Tab / `[` `]` / PgPréc PgSuiv : changer de module ; Échap : vue d'ensemble ; H : indice ; M : son.
  - Fils et badges : 1 à 6.
  - Clavier 4×4 : chiffres, A–D, `*`, `#`, Entrée = `#`, Retour arrière = `*`.
  - Joystick : flèches ou WASD, Entrée ou Espace = Clic.
  - Inclinaison : flèches maintenues ; S ou Espace = secousse.
- Entrée, Espace ou Échap passent les cinématiques.

## Mise en scène et son
- Ambiance : une table en bois ronde sous une lampe, des fenêtres de ville la nuit, des modules rétroéclairés en RVB, une gravure lumineuse sur chaque plaque.
- **Ouverture** : les loquets, puis le couvercle qui s'ouvre, puis la mise sous tension (accord, écran qui démarre, DEL qui s'allument).
- **Victoire** : les DEL passent au vert, confettis, mélodie, l'écran affiche « DÉSAMORCÉE ».
- **Explosion** : 1,3 s d'alarme qui s'emballe, puis flash, éclats orange et noirs, le couvercle qui s'envole.
- Tout le son est synthétisé en Web Audio : nappe de tension qui monte avec le temps, bip de la minuterie, buzzer d'erreur, clics, lecture RFID, secousses. 🔊/🔇 est mémorisé. `prefers-reduced-motion` donne une version allégée.

## Technique
- **three.js 0.187.0** hébergé avec le jeu (`vendor/`, aucun CDN). Modules ES + importmap, URL versionnées `?v=0.1.0`.
- **Service worker** maison : réseau d'abord pour HTML/JS/CSS, cache d'abord pour `vendor/` (noms versionnés). Les anciens caches sont supprimés.
- **detect-gpu 5.0.70** hébergé (`detect-gpu-benchmarks/`) : palier ≤ 1 → pixelRatio 1 et moins de particules. `?tier=2` force le mode normal. pixelRatio plafonné à 2.
- Budget S20 : pas d'ombres dynamiques (ombre de contact simulée), pas de transmission, DEL et touches instanciées, plaques en CanvasTexture. `?fps=1` affiche le compteur (fps, appels, triangles, palier, GPU).
- Logique pure dans `logic.js`, partagée par le jeu, le manuel et les tests.
- **Contrat GLB** (`loadCaseGLB` dans `js/case-model.js`) :
  - nœuds obligatoires : `Case_Body`, `Case_Lid` (origine sur la charnière), `Lid_Screen` (matériau `Screen`, UV 0–1), `Panel_1..5` (`Panel_Ctrl` est créé s'il manque).
  - nœuds facultatifs repris : `Key_0..15`, `Joystick_Base`/`Joystick_Stick`, `RFID_Reader`/`RFID_Badge`, `Timer_7Seg` (`Timer_Digits`), `OLED` (`OLED_Screen`), `Hint_Button`, `Wire_Terminals`, matériaux `LED_Backlight_1..5`/`LED_Status_1..5`.
  - s'il manque un nœud facultatif, la version procédurale le remplace. Si le chargement échoue, toute la mallette procédurale est utilisée.

### Mesures (box, Chrome + ANGLE/llvmpipe, `measure.mjs`, v0.1.0 en ligne)
La box n'est pas un S20 : les fps ci-dessous viennent d'un rendu logiciel. Regarder les appels et les triangles.

| Vue | Appels 412×915 | Triangles | Appels 915×412 | Triangles |
|---|---|---|---|---|
| Menu | 33 | 17,1 k | 33 | 17,1 k |
| Mallette fermée | 38 | 19,1 k | 38 | 19,1 k |
| Vue d'ensemble | 38 | 19,1 k | 38 | 19,1 k |
| Fils | 27 | 17,8 k | 30 | 18,0 k |
| Clavier | 28 | 17,8 k | 26 | 14,8 k |
| Joystick | 26 | 16,4 k | 26 | 14,9 k |
| Badge RFID | 27 | 15,6 k | 31 | 18,4 k |
| Inclinaison | 25 | 16,4 k | 23 | 15,8 k |
| Contrôle / OLED | 28 | 15,6 k | 30 | 15,4 k |
| Victoire | 39 | 19,3 k | 39 | 19,3 k |
| Explosion | 40 | 19,4 k | 39 | 19,4 k |

Textures environ 14 Mo, 28 programmes, aucune transmission, 0 erreur de page. Avec `tier=2` et un DPR de 3, le pixelRatio est bien plafonné à 2 (38 appels en vue d'ensemble, 44 au pic de l'explosion).

## Tests
```sh
node test/logic.test.js     # 205 022 vérifications sur 5000 codes : solubles, erreurs, BOUM, chrono, score, indices, fautes de frappe
node test/manual.test.mjs   # le manuel rendu (DOM) résout les 5000 mêmes mallettes ; fiche arbitre 200/200
node test/e2e-touch.mjs [url]   # 134 vérifications au vrai toucher en 412×915 et 915×412, 0 erreur console
```

## Ressources et licences
- Code du jeu : MIT (`LICENSE`).
- three.js 0.187.0 (MIT), detect-gpu 5.0.70 (MIT), qrcode-generator 2.0.4 (MIT) : hébergés dans `vendor/`.
- Sons : synthétisés par le code (aucun fichier audio, aucun modèle génératif).
- Mallette v0.1 : géométrie procédurale (code du jeu).
- **Modèles 3D prévus (pas encore intégrés, GLB en attente)**, choisis par Pascal, tous sous **CC BY 4.0**. Ils seront crédités dans le jeu (écran Crédits) et ici :
  - « Pelican Case » par **N8 (nathanmlange)** : https://sketchfab.com/3d-models/pelican-case-2f6f5ca0d0514baeb9b511613f7f3227
  - « Keypad » par **Spellkaze** : https://sketchfab.com/3d-models/keypad-b9968a00bc9249df927ff1969acf2f7e
  - « Arcade Joystick » par **Johannes R. (selkie3d)** : https://sketchfab.com/3d-models/arcade-joystick-cff2d3483c4a452aaa9201b2a1b7d984
  - « RFID-RC522 » par **davidg.dev** : https://sketchfab.com/3d-models/rfid-rc522-arduino-uno-compatible-16501915e98143e49930a755a87272b3
  - « 4 Digits 7 Segments Display » par **Thomp1** : https://sketchfab.com/3d-models/4-digits-7-segments-display-d36801d499a3483eb764dfa008b2f2df
  - Le GLB final, assemblé et retouché par Modélisation et Rendu (modifications à mentionner), sera livré dans `/workspace/assets3d/defuse-mallette/glb/defuse_case_v1.glb`. Il viendra avec un MANIFEST.md, selon la spec `/workspace/assets3d/defuse-mallette/SPEC.md`.
- Inspiration (aucun contenu repris) : « Defuse the Bomb » de casecoregames, une mallette Etsy (annonce 1829735775), et le genre « Keep Talking and Nobody Explodes ».

## Prochaines étapes
1. Intégrer `defuse_case_v1.glb` dès sa livraison : le charger par défaut, vérifier la course de la charnière, les touches et le manche, refaire les mesures. Garder la version procédurale en secours.
2. Essai sur un vrai Galaxy S20 : fps, gyroscope, secousse (seuil de 14 m/s²), lisibilité de l'OLED.
3. Prototype ESP32 à partir de docs/ESP32.md. Comparer les vecteurs de test (mulberry32 et parties complètes).
4. Version imprimable du manuel (le CSS d'impression existe) et peut-être un niveau « expert » avec plus de règles.
