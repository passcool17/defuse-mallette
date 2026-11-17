# Défuse la mallette

Jeu 3D à deux en français, dans l'esprit de « Keep Talking », sur une mallette orange de type Pelican. Le désamorceur a la mallette sous les yeux et l'expert lit le manuel. Il y a 5 modules (fils, clavier 4×4, joystick, badge RFID, inclinaison), une minuterie, un OLED et un buzzer. Ces modules reprennent le kit ESP32 qui servira à fabriquer une vraie mallette.

**Jouer :** https://passcool17.github.io/defuse-mallette/
**Manuel de l'expert :** https://passcool17.github.io/defuse-mallette/manuel.html

- **Duo** : deux appareils. La mallette s'ouvre sur l'un (téléphone conseillé) et le manuel sur l'autre, via le QR code ou le lien. Les deux appareils ne communiquent pas : c'est à vous de parler.
- **Équipe** : un seul appareil. Le manuel s'ouvre par-dessus le jeu avec 📖, et la minuterie continue de tourner.
- Chaque partie a un **code** (ex. `48213-4`) affiché sur la mallette. Le même code donne la même mallette, et le manuel peut afficher la page propre à ce code.

## Développement

Le site est entièrement statique, sans étape de build. three.js 0.187.0, detect-gpu 5.0.70 et qrcode-generator 2.0.4 sont hébergés dans `vendor/` : aucun CDN.

```sh
node test/serve.mjs 8080         # http://127.0.0.1:8080/defuse-mallette/
node test/logic.test.js          # 5000 graines : solvabilité, erreurs, score, indices
node test/manual.test.mjs        # le manuel rendu résout les 5000 mêmes mallettes
node test/e2e-touch.mjs          # vrai tactile CDP en 412×915 et 915×412 (Chrome requis)
sh tools/build-vendor.sh         # reconstruit vendor/ depuis npm
```

Paramètres d'URL : `?fps=1` (compteur), `?tier=0..3` (force le palier GPU), `?glb=chemin.glb` (modèle de mallette, voir le contrat dans `js/case-model.js`). Manuel : `manuel.html?code=48213-4`.

Portage matériel : [docs/ESP32.md](docs/ESP32.md). Fiche de suivi : [GAME.md](GAME.md).

## Licences

Code : MIT. three.js, detect-gpu et qrcode-generator : MIT (licences dans `vendor/`). Les sons sont générés en Web Audio par le code. La mallette v0.1 est procédurale. Pour les modèles 3D prévus (CC BY 4.0), voir les crédits dans GAME.md.
