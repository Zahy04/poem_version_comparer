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

Badge s kategorií změny (a u `LLM` i stručným vysvětlením v tooltipu)
se zobrazí **jen tam, kde je předpočítané hodnocení** – viz
`data/labels.json`. V hlavičce difu vidíš, kolik změn je ohodnoceno
a kolik ne (`Ohodnoceno: X / Y změn`).

K dispozici jsou tři motory, přepíná se v hlavičce difu:

| Motor | Co dělá | Pokrytí |
|---|---|---|
| **LLM** | generativní model, multi-tag + české vysvětlení v tooltipu | předpočítáno na *Maryčka Magdonova* |
| **Jev** | kalibrovaný klasifikátor (TypeSafe System One), top‑1 + pravděpodobnost | předpočítáno na *Maryčka Magdonova* |
| **Pravidlo** | deterministická „Vrstva 0" — čistě znaková analýza ortografických změn (interpunkce, velikost písmen, diakritika, typografie). Žádné API, multi-tag. | 2 940 z 8 886 dvojic |

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

`?poem=4695&a=5600&b=5601` rovnou otevře báseň a konkrétní diff.

## Struktura

```
index.html          rozvržení
style.css           styly
app.js              logika: LCS diff (port difflib), skládání alignace, vykreslení
data/index.json     seznam básní
data/poem/<id>.json verze, hrany, texty veršů, slokové mapy
data/labels.json    předpočítané AI štítky (klíč = dvojice veršů)
```
