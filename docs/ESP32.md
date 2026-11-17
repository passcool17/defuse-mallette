# Défuse la mallette — portage ESP32

Toute la logique du jeu tient dans `logic.js` : des entiers et de petites tables, sans flottants. Ce document permet de recréer **la même mallette** sur un ESP32 : le même code de partie donne la même solution, et le même manuel (`manuel.html`) sert dans les deux cas.

Référence : `logic.js` v0.1.0. Si une table de ce document diffère du code, c'est `logic.js` qui fait foi. Les tests `test/logic.test.js` et `test/manual.test.mjs` vérifient ces tables sur 5000 graines.

## 1. Matériel (kit de Pascal) et brochage proposé

ESP32-WROOM-32 DevKit, alimenté en 3,3 V logique. Les broches sont des suggestions qui évitent les broches de démarrage (0, 2, 12, 15) et la flash (6–11).

| Module | Composant | Bus | Broches ESP32 |
|---|---|---|---|
| Fils | 4 à 6 fils amovibles (bornier), chaque fil relie une GPIO à GND | GPIO, `INPUT_PULLUP` | 13, 14, 27, 26, 25, 33 (fil 1 → 6) |
| Clavier | Clavier matriciel 4×4 | 4 lignes en sortie + 4 colonnes en `INPUT_PULLUP` | lignes 19, 18, 5, 17 ; colonnes 16, 4, 32, 35* |
| Joystick | Module joystick analogique XY + bouton | ADC1 + GPIO | VRx 36 (ADC1_0), VRy 39 (ADC1_3), SW 34* (pull-up externe 10 kΩ) |
| RFID | RC522 (MFRC522) + 6 badges/cartes | SPI (VSPI) | SCK 18 ou VSPI matériel ; le clavier passe alors sur un expandeur (voir note) |
| Inclinaison | MPU-6500 (accéléro + gyro) | I²C | SDA 21, SCL 22, adresse 0x68 |
| Minuterie | Afficheur 4 chiffres 7 segments TM1637 | 2 fils | CLK 23, DIO 3** |
| OLED | SSD1306 128×64 | I²C (même bus que le MPU) | SDA 21, SCL 22, adresse 0x3C |
| Buzzer | Buzzer passif | PWM (LEDC) | 1** |
| DEL RVB | 5 rétroéclairages + DEL d'état (WS2812B conseillé) | 1 fil | 15 (avec résistance 330 Ω ; au démarrage, la broche reste basse) |
| Indice | Bouton poussoir | GPIO, `INPUT_PULLUP` | via l'expandeur |

\* 34, 35, 36 et 39 sont des entrées seules, sans pull-up interne : il faut une résistance externe.
\** 1 et 3 sont l'UART0 (TX/RX) : libres une fois le firmware chargé, mais plus de moniteur série.

**Note sur le nombre de broches.** Avec le RC522 en SPI, le kit dépasse les GPIO disponibles. Solution recommandée : un **PCF8574** ou un **MCP23017** sur le bus I²C (0x20) pour le clavier 4×4 et le bouton d'indice. Le RC522 garde alors le VSPI matériel (SCK 18, MISO 19, MOSI 23, SS 5, RST 17) et le TM1637 passe sur 16/4. La logique ne change pas : il n'y a que des événements entiers.

## 2. Code de partie et générateur pseudo-aléatoire (spécification exacte)

### 2.1 Code de partie

- Graine `seed` : un entier de **10000 à 99999**. Ses chiffres décimaux, de gauche à droite, sont D1 à D5.
- Chiffre de contrôle `C` : poids 1,3,1,3,1. On calcule `s = D1 + 3·D2 + D3 + 3·D4 + D5`, puis `C = (10 − s mod 10) mod 10`.
- Affichage : `"48213-4"`. Sur ESP32 : saisie au clavier (5 chiffres puis `#`), ou graine aléatoire `10000 + esp_random() % 90000`.

### 2.2 mulberry32 (uint32, sans flottant)

```c
static uint32_t prng_a;
void     prng_seed(uint32_t seed) { prng_a = seed; }
uint32_t prng_next(void) {
  prng_a += 0x6D2B79F5u;                 // modulo 2^32
  uint32_t t = prng_a;
  t = (t ^ (t >> 15)) * (t | 1u);        // multiplication 32 bits, modulo 2^32
  t ^= t + ((t ^ (t >> 7)) * (t | 61u));
  return t ^ (t >> 14);
}
uint32_t pick(uint32_t n) { return prng_next() % n; }   // modulo simple (pas de rejet)
```

Vecteur de test : `prng_seed(48213)` donne `1436899660, 3285982858, 2603564073, 260109684`. Ces valeurs ont été vérifiées avec une compilation gcc de ce code C.

### 2.3 Ordre exact des tirages

Il faut respecter cet ordre exact : changer l'ordre change toute la mallette.

```
nWires      = 4 + pick(3)                           // 4, 5 ou 6
wire[i]     = WIRE_COLORS[pick(6)]  pour i = 0..nWires-1
keypadColor = LIGHT_COLORS[pick(4)]
joySeq[i]   = LIGHT_COLORS[pick(4)] pour i = 0..3
rfidColor   = LIGHT_COLORS[pick(4)]
rfidBlinks  = 1 + pick(4)                           // 1..4
tiltColor   = LIGHT_COLORS[pick(4)]
```

```
WIRE_COLORS  = Rouge(0) Bleu(1) Jaune(2) Blanc(3) Noir(4) Vert(5)
LIGHT_COLORS = Rouge(0) Vert(1) Bleu(2) Jaune(3)
```

Sur la vraie mallette, `nWires` et les couleurs des fils sont **affichés sur l'OLED** au début de la partie (« BRANCHER : NOIR BLANC ROUGE VERT JAUNE »). Le joueur branche alors les fils de ces couleurs dans cet ordre, ou l'arbitre le fait. Les DEL RVB affichent les couleurs tirées.

### 2.4 Vecteurs de partie complets

| Code | Fils | Clavier | Joystick (séquence) | RFID | Inclinaison | Solution |
|---|---|---|---|---|---|---|
| 48213-4 | Noir Blanc Rouge Vert Jaune | Jaune | Rouge Vert Jaune Bleu | Jaune ×2 | Jaune | fil 1 · `7839 #` · Bas Gauche Droite Haut Clic · badges 2 puis 6 · Avant, Arrière, 3 secousses |
| 10000-9 | Blanc Vert Rouge Noir | Vert | Vert Vert Rouge Jaune | Vert ×2 | Rouge | fil 1 · `4444 D` · Droite Droite Haut Gauche Clic · 4 puis 5 · Gauche, Avant, 1 secousse |
| 99999-9 | Blanc Blanc Jaune Rouge Jaune Rouge | Bleu | Vert Rouge Jaune Vert | Bleu ×4 | Bleu | fil 4 · `5555 D` · Gauche Bas Droite Gauche Clic · 5 puis 2 · Droite, Gauche, 1 secousse |
| 31415-2 | Bleu Noir Vert Jaune Blanc | Jaune | Vert Vert Vert Jaune | Rouge ×1 | Bleu | fil 1 · `9068 #` · Gauche Gauche Gauche Droite Clic · 3 puis 6 · Droite, Gauche, 2 secousses |

Pour produire d'autres vecteurs : `node -e "console.log(JSON.stringify(require('./logic.js').generate(48213)))"`.

## 3. Règles et pseudocode par module

Chaque module renvoie un résultat : `OK` (bonne étape), `RESOLU`, `ERREUR` ou `IGNORE`. Une `ERREUR` incrémente `mistakes`. Si `mistakes >= maxMistakes` (1–9, 3 par défaut), ou si la minuterie atteint 0, la mallette explose.

### 3.1 Fils (GPIO en pull-up : un fil coupé ou débranché fait passer la broche à HIGH)

Les fils sont numérotés de 1 (en haut) à N. Pour N fils, on prend **la première règle vraie** de la table, et on coupe **un seul** fil.

| N | Règle | Condition | Fil à couper |
|---|---|---|---|
| 4 | 1 | aucun fil Rouge | fil 2 |
| 4 | 2 | le dernier fil est Blanc | le dernier |
| 4 | 3 | plus d'un fil Bleu | le dernier fil Bleu |
| 4 | 4 | sinon | fil 1 |
| 5 | 1 | le dernier fil est Noir ET D5 impair | fil 4 |
| 5 | 2 | exactement un Rouge ET plus d'un Jaune | fil 1 |
| 5 | 3 | aucun fil Noir | fil 2 |
| 5 | 4 | sinon | fil 1 |
| 6 | 1 | aucun Jaune ET D5 impair | fil 3 |
| 6 | 2 | exactement un Jaune ET plus d'un Blanc | fil 4 |
| 6 | 3 | aucun Rouge | le dernier |
| 6 | 4 | sinon | fil 4 |

```c
// lecture : antirebond de 50 ms ; on réagit au front LOW→HIGH, une seule fois par fil
on_wire_cut(i):                      // i de 0 à N-1
  if (over || solved[FILS] || cut[i]) return IGNORE;
  cut[i] = true;
  return (i == wireToCut) ? RESOLU : ERREUR;
```

### 3.2 Clavier 4×4 (disposition `1 2 3 A / 4 5 6 B / 7 8 9 C / * 0 # D`)

Le rétroéclairage (DEL RVB) prend la couleur `keypadColor`. Le code comporte 4 chiffres : on prend, dans l'ordre, les chiffres Dn aux positions ci-dessous, et on ajoute à chacun le nombre de fils N, modulo 10.

| Couleur | Positions |
|---|---|
| Rouge | D1 D2 D3 D4 |
| Vert | D5 D4 D3 D2 |
| Bleu | D2 D4 D1 D5 |
| Jaune | D3 D5 D2 D1 |

On valide avec `#` si C est pair, et avec `D` si C est impair. `*` efface la saisie. `A`, `B` et `C` n'ont aucun effet. La saisie garde au plus 4 chiffres.

```c
on_key(k):
  if (k=='*') { buf_len=0; return OK; }
  if (k=='#' || k=='D') { ok = (buf == code) && (k == enter); buf_len=0; return ok ? RESOLU : ERREUR; }
  if (isdigit(k) && buf_len < 4) buf[buf_len++] = k;
  return OK;
```

### 3.3 Joystick (ADC 12 bits + bouton)

Une DEL RVB affiche en boucle 4 couleurs (`joySeq`) : 600 ms allumée, 200 ms éteinte, puis une pause de 1,5 s. On convertit chaque couleur en direction avec la table qui correspond à la parité de D5.

| Couleur | D5 pair | D5 impair |
|---|---|---|
| Rouge | Haut | Bas |
| Vert | Droite | Gauche |
| Bleu | Bas | Haut |
| Jaune | Gauche | Droite |

On pousse les 4 directions, puis on **clique** (SW). Une erreur remet la séquence à zéro.

```c
// x,y = (adc - centre) / 2048, entre -1 et 1 ; centre mesuré au démarrage
L = max(|x|,|y|);
if (L < 0.30) armed = true;                          // retour au centre obligatoire
if (L > 0.62 && armed) { armed=false; dir = |x|>|y| ? (x>0?DROITE:GAUCHE) : (y<0?HAUT:BAS); step(dir); }
if (sw_pressed_edge) step(CLIC);
step(d): if (d==CLIC) return pos==4 ? RESOLU : (pos=0, ERREUR);
         if (dirs[pos]==d) { pos++; return OK; } pos=0; return ERREUR;
```

Le jeu web utilise la même hystérésis (0,62 pour déclencher, 0,30 pour réarmer).

### 3.4 Badge RFID (RC522)

Il y a 6 badges fixes, et chaque UID est enregistré une fois dans une table en flash : 1 ALPHA (Rouge), 2 BRAVO (Bleu), 3 CHARLIE (Jaune), 4 DELTA (Vert), 5 ECHO (Blanc), 6 FOXTROT (Noir). La DEL du lecteur prend la couleur `rfidColor` et clignote `rfidBlinks` fois (250 ms allumée, 250 ms éteinte), puis fait une pause de 1,5 s.

| Couleur | 1 clign. | 2 | 3 | 4 |
|---|---|---|---|---|
| Rouge | 3 | 5 | 1 | 6 |
| Vert | 2 | 4 | 6 | 1 |
| Bleu | 6 | 1 | 3 | 5 |
| Jaune | 4 | 2 | 5 | 3 |

On calcule `b1 = table[couleur][clign − 1]`, puis `b2 = ((b1 − 1 + D1) mod 6) + 1`. Si `b2 == b1`, alors `b2 = (b1 mod 6) + 1`. Il faut présenter b1, puis b2.

```c
on_uid(uid): n = badge_number(uid); if (!n) return IGNORE;   // carte inconnue : ignorée
  if (n == badges[pos]) { pos++; return pos==2 ? RESOLU : OK; }
  pos = 0; return ERREUR;
// relire le même UID seulement après 1 s sans carte (antirebond)
```

### 3.5 Inclinaison / secousses (MPU-6500, I²C 0x68)

Le web lit `deviceorientation` : ±25° correspond au bord du plateau, et une direction se déclenche à 68 % (≈ 17°). Sur ESP32, on calcule les angles de l'accéléromètre au repos, après une calibration au démarrage (la mallette posée à plat) :

```c
pitch = atan2(ax, sqrt(ay*ay+az*az)) - pitch0;   // en degrés ; +17° = Avant, -17° = Arrière
roll  = atan2(ay, az) - roll0;                   // +17° = Droite, -17° = Gauche
```

Pour éviter les flottants, on peut comparer directement `ax` et `ay` à ±0,29 g (sin 17°). Une direction compte si elle est **tenue 1 s**. Il faut ensuite revenir près de l'horizontale (moins de 7,5°) pour réarmer.

| Couleur de la DEL | 1re inclinaison | 2e inclinaison |
|---|---|---|
| Rouge | Gauche | Avant |
| Vert | Arrière | Droite |
| Bleu | Droite | Gauche |
| Jaune | Avant | Arrière |

Ensuite, il faut **secouer `(D3 mod 3) + 1` fois**. Une secousse correspond à `|a| > 14 m/s²` (≈ 1,43 g), avec au moins 380 ms entre deux secousses. Après **2 s sans secousse**, le compte est validé.

```c
on_tilt(dir): if (pos<2) { if (tilts[pos]==dir) { pos++; shakes=0; return OK; } pos=0; return ERREUR; } return IGNORE;
on_shake():   if (pos==2) shakes = min(9, shakes+1);
on_still():   if (pos==2 && shakes>0) { ok = shakes==need; shakes=0; if (ok) return RESOLU; pos=0; return ERREUR; }
```

### 3.6 Minuterie, OLED, buzzer, indices, score

- **TM1637** : affiche `MM:SS`, avec les deux-points qui clignotent à 1 Hz, puis à 4 Hz sous 10 s. La durée se règle de 1 à 99 min (15 min par défaut).
- **OLED SSD1306** : affiche le code de partie et les messages courts du jeu web (`CODE 48213-4` / `PRET`, `CODE> 78__`, `ERREUR CLAVIER` / `1/3`, `BADGE 2 LU` / `1/2`, `SECOUSSE x2`, les indices).
- **Buzzer** (LEDC, sons suggérés ; le jeu web utilise des sons Web Audio équivalents) : un bip de 1 kHz par seconde, deux bips par seconde sous 10 s, 220 Hz pendant 300 ms en cas d'erreur, et une alarme 2 kHz/1,5 kHz en cas d'explosion.
- **Bouton d'indice** : il vise le premier module non résolu. Au niveau 1, l'OLED affiche la ligne du manuel (ex. `LIGNE JAUNE +5`). Au niveau 2, il affiche la prochaine action (ex. `CODE 7839 #`). Chaque appui compte pour un indice.
- **Score** (entier) :
  - victoire : `max(0, 5000 + 10 × secondes restantes − 500 × erreurs − 250 × indices)`.
  - explosion : `max(0, 500 × modules résolus − 250 × indices)`.

## 4. Boucle principale suggérée

```c
setup(): lire graine (clavier ou aléatoire) → generate(seed) → afficher code sur OLED + DEL
loop():  dt = millis() - last; remaining -= dt; poll_fils(); poll_keypad(); poll_joy(); poll_rfid(); poll_mpu();
         sur RESOLU : DEL d'état du module en vert ; sur ERREUR : buzzer + DEL rouge + mistakes++
         fin : victoire (DEL toutes vertes, mélodie) ou explosion (alarme 1,3 s, puis tout rouge)
```

Le manuel imprimé ou `manuel.html` est le même pour la version web et la version ESP32. Il suffit d'y saisir le code affiché sur l'OLED.
