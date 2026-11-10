# KHE – Porovnávač verzí básní

Prohlížeč textových variant. Běží na GitHub Pages, **nevolá žádné API
a neobsahuje žádné klíče** – vše je předpočítané v `data/`.

## Co umí

- **97 básní** Petra Bezruče (*Slezské písně*), 2 948 verzí, 2 712 evidovaných přechodů mezi verzemi.
- **Graf verzí** – ediční genealogie, tloušťka hrany = počet evidovaných úprav.
- **Tabulka verzí** – seřaditelná, klik na řádek otevře diff.
- **Porovnání (diff)** – libovolná dvojice verzí:
  - word-level zvýraznění (`<del>`/`<ins>`) na úrovni veršů,
  - **sloková struktura** ze slokové alignace KHE (včetně tranzitivní
    složení přes BFS, když dvojice nemá přímé mapování),
  - mapování umí 1:N i N:1 (rozdělené / sloučené sloky); čistě číslovací
    sloky se v diffu nezobrazují a při neúplné mapě se použije plochý
    veršový diff,
  - statistiky shodných / změněných / smazaných / přidaných veršů.

## Štítky AI hodnocení

Badge s kategorií změny se zobrazí **jen tam, kde má zvolený motor
předpočítané hodnocení**. U LLM je v tooltipu stručné vysvětlení, u Jeva
pravděpodobnost. V hlavičce difu vidíš, kolik změn je ohodnoceno
a kolik ne (`Ohodnoceno: X / Y změn`).

Model (Jev nebo jedno z LLM) se vybírá v roletě v hlavičce difu (celé jméno, výrobce a logo), pravidlo
se zapíná a vypíná čudlíkem **Pravidlo** a ukazuje se souběžně s modelem
(odznak s přerušovaným rámečkem). Vypnutý čudlík = čistě model.
Každý motor má vlastní sadu štítků,
nic se mezi motory neslučuje. Jev i všechna LLM dostala stejné zadání
a stejné definice 26 kategorií (prompt v2); LLM smí vrátit víc
kategorií, seřazených od převažující.

| Motor | Co dělá | Štítek má (z 8 886 dvojic veršů) |
|---|---|---|
| **Pravidlo** | deterministická „Vrstva 0" — čistě znaková analýza ortografických změn (interpunkce, velikost písmen, diakritika, typografie) a celých smazaných a přidaných veršů (prázdná strana páru). Žádné API, multi-tag. | 5 699 |
| **Jev** | kalibrovaný klasifikátor (TypeSafe System One), top‑1 + pravděpodobnost; vidí jen dvojici veršů, bez kontextu sloky | 8 882 (u zbylých 4 žádná kategorie nedosáhla P ≥ 0,20) |
| **GPT-6 Luna** | `gpt-6-luna` (OpenAI), multi-tag + vysvětlení | 3 183 |
| **DeepSeek V4.1 Flash** | `deepseek-v4.1-flash` (DeepSeek, přes CERIT-SC), multi-tag + vysvětlení | 3 183 |
| **Qwen3.8 27B** | `qwen3.8-27b` (Alibaba, přes CERIT-SC), multi-tag + vysvětlení | 3 185 |
| **gpt-oss-120b** | `gpt-oss-120b` (OpenAI, přes CERIT-SC), multi-tag + vysvětlení | 3 186 |
| **Mistral Medium 3.5** | `mistral-medium-3.5` (Mistral AI, přes CERIT-SC), multi-tag + vysvětlení | 3 182 |
| **Gemma 4** | `gemma4` (Google, přes CERIT-SC), multi-tag + vysvětlení | 3 177 |
| **Kimi K3.1 Pro** | `kimi-k3.1-pro` (Moonshot AI, přes CERIT-SC), multi-tag + vysvětlení | 3 185 |
| **GLM 5.3** | `glm-5.3` (Z.ai, přes CERIT-SC), multi-tag + vysvětlení | 3 184 |

LLM hodnotí jen **těžké páry** (3 186): oba verše mají text a pravidlo se
nevyjádří, změnila se tedy samotná slova. Pravopisné změny a celé
smazané a přidané verše pokrývá Pravidlo. Těch pár párů, které u modelu
chybí do 3 186, nedostalo platnou kategorii ani na třetí pokus.

Data se doplňují skripty v soukromém repozitáři
`bachelor-thesis`, které čtou KHE data a cache z API.

## Lokálně

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Cesty jsou relativní, takže to funguje i z podadresáře
(typicky `https://<user>.github.io/poem_version_comparer/`).

### Užitečné odkazy

`?poem=4695&a=5600&b=5601` rovnou otevře báseň a konkrétní diff,
`&m=deepseek-v4.1-flash` k tomu zapne model (id z `data/engines.json`),
`&r=0` vypne pravidlo.

## Struktura

```
index.html          rozvržení
style.css           styly
app.js              logika: LCS diff (port difflib), skládání alignace, vykreslení
data/index.json     seznam básní
data/poem/<id>.json verze, hrany, texty veršů, slokové mapy
data/engines.json   motory v pořadí přepínače (id, model, verze promptu, počet štítků)
data/labels/<id>.json  štítky jednoho motoru (klíč = dvojice veršů), stahují se až při zapnutí
logos/<logo>.svg    loga modelů v roletě (@lobehub/icons-static-svg 1.70.0, MIT; ochranné známky patří výrobcům)
```
