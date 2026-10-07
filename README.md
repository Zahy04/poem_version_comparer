# KHE – Porovnávač verzí básní

Statická verze prohlížeče textových variant z datasetu
[Critical Hybrid Edition](https://git.ucl.cas.cz/khe/data) (ÚČL AV ČR).
Běží na GitHub Pages, **nevolá žádné API a neobsahuje žádné klíče** –
vše je předpočítané v `data/`.

## Co umí

- **97 básní** Petra Bezruče (*Slezské písně*), 2 948 verzí, 2 712 evidovaných přechodů mezi verzemi.
- **Graf verzí** – ediční genealogie, tloušťka hrany = počet evidovaných úprav.
- **Tabulka verzí** – seřaditelná, klik na řádek otevře diff.
- **Porovnání (diff)** – libovolná dvojice verzí:
  - word-level zvýraznění (`<del>`/`<ins>`) na úrovni veršů,
  - **sloková struktura** ze slokové alignace KHE (včetně tranzitivní
    složení přes BFS, když dvojice nemá přímé mapování),
  - statistiky shodných / změněných / smazaných / přidaných veršů.

## Štítky AI hodnocení

Badge s kategorií změny (a u `LLM` i stručným vysvětlením v tooltipu)
se zobrazí **jen tam, kde je předpočítané hodnocení** – viz
`data/labels.json`. V hlavičce difu vidíš, kolik změn je ohodnoceno
a kolik ne (`Ohodnoceno: X / Y změn`).

Data se doplňují skriptem `export_site.py` v soukromém repozitáři
`bachelor-thesis`, který čte KHE data a cache z API.

## Lokálně

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Cesty jsou relativní, takže to funguje i z podadresáře
(typicky `https://<user>.github.io/poem_version_comparer/`).

### Užitečné odkazy

`?poem=4677&a=6603&b=6604` rovnou oteře báseň a konkrétní diff.

## Struktura

```
index.html          rozvržení
style.css           styly
app.js              logika: LCS diff (port difflib), skládání alignace, vykreslení
data/index.json     seznam básní
data/poem/<id>.json verze, hrany, texty veršů, slokové mapy
data/labels.json    předpočítané AI štítky (klíč = dvojice veršů)
```

## Zdroj dat

Texty a alignace: KHE dataset v1.0.0, Ústav pro českou literaturu AV ČR
(<https://khe.ucl.cas.cz/bezruc/>). Veršová tokenizace: MorphoDiTa.
