# Armadio

**Armadio** è un'applicazione web minimale, ispirata al design **Braun / Dieter Rams**, per archiviare e organizzare il proprio guardaroba diviso per abitazioni: **Milano**, **Reggio** e **Sardegna**.

L'interfaccia mostra un armadio interattivo disegnato in stile tecnico: ante apribili con animazioni 3D, appendiabiti con silhouette stilizzate dei capi appesi (giacche, camicie, felpe, maglioni, pantaloni), ripiani e cassetti con pile di capi piegati.

## Come Eseguire

L'app è scritta in vanilla **HTML5**, **CSS3** e **JavaScript** (ES6), senza dipendenze.

```bash
python3 server.py
```

Poi apri il browser su [http://localhost:8000](http://localhost:8000).

> ⚠️ Usa `server.py` e non `python3 -m http.server`: il server integrato espone le API `/api/load` e `/api/save` che leggono e scrivono il database. Senza di esse l'app funziona comunque, ma salva solo nel `localStorage` del browser.

## Il Database: `wardrobe.json`

Tutto il guardaroba vive in **un unico file JSON** nella root del progetto: [`wardrobe.json`](wardrobe.json). Il software e i dati sono completamente separati: puoi clonare il repo, sostituire o modificare a mano `wardrobe.json` e avere subito il tuo guardaroba.

Il file è una lista di capi. Ogni capo è un oggetto con questi campi:

| Campo     | Obbligatorio | Descrizione                                                       |
|-----------|--------------|-------------------------------------------------------------------|
| `id`      | sì           | Identificativo unico (qualsiasi stringa, basta che sia unica)     |
| `house`   | sì           | `Milano`, `Reggio` o `Sardegna`                                   |
| `section` | sì           | Sezione dell'armadio (vedi tabella sotto)                          |
| `name`    | sì           | Nome o descrizione del capo                                        |
| `type`    | no           | Tipo di capo: determina la silhouette disegnata (vedi sotto)      |
| `color`   | no           | Colore esadecimale, es. `#3b82f6`                                  |
| `brand`   | no           | Marca                                                              |
| `notes`   | no           | Note libere (taglia, stagione, tessuto…)                           |

Esempio:

```json
{
    "id": "m1",
    "house": "Milano",
    "section": "sec1-top-rail",
    "name": "Giacca Vintage Beige",
    "type": "jacket",
    "color": "#f5f5dc",
    "brand": "Baracuta",
    "notes": "Primaverile"
}
```

### Valori di `type`

| Valore    | Capo             | Silhouette                                  |
|-----------|------------------|---------------------------------------------|
| `jacket`  | Giacca           | Revers a V, apertura frontale, tasche       |
| `shirt`   | Camicia          | Colletto a punte, bottoni                   |
| `hoodie`  | Felpa            | Cappuccio, lacci, tasca a marsupio          |
| `sweater` | Maglione         | Girocollo, orlo a costine                   |
| `tshirt`  | T-shirt / Polo   | Maniche corte sporgenti                     |
| `pants`   | Pantalone lungo  | Cintura con passanti, due gambe lunghe      |
| `shorts`  | Pantalone corto  | Cintura con coulisse, gambe corte           |

I capi appesi (sulle aste) usano la silhouette del proprio tipo; i capi su ripiani e nei cassetti vengono disegnati come pila di capi piegati, indipendentemente dal tipo.

### Valori di `section`

| ID                                       | Zona                                |
|------------------------------------------|--------------------------------------|
| `sec1-top-rail`                          | Appendiabiti superiore (anta sx)     |
| `sec1-bottom-rail`                       | Appendiabiti inferiore (anta sx)     |
| `sec2-top-shelf`                         | Ripiano (anta dx)                    |
| `sec2-middle-rail`                       | Appendiabiti centrale (anta dx)      |
| `sec2-drawer2-col1` / `sec2-drawer2-col2`| Cassetto 2, colonne A e B            |
| `sec2-drawer3-col1` … `sec2-drawer3-col3`| Cassetto 3, colonne A, B e C         |

## Persistenza e Sicurezza dei Dati

- Ogni modifica fatta dall'interfaccia viene salvata **sia** nel `localStorage` del browser **sia** in `wardrobe.json` tramite il server.
- Ad ogni salvataggio il server crea automaticamente `wardrobe.backup.json` con la versione precedente: se qualcosa va storto, basta rinominarlo.
- Il server valida ogni salvataggio: payload non validi vengono rifiutati senza toccare il file.
- La scrittura è atomica: il file non può rimanere corrotto a metà.

## Usare Armadio con il Proprio Guardaroba

1. Fai un fork o clona il repo.
2. Modifica `wardrobe.json` con i tuoi capi (a mano o tramite l'interfaccia).
3. `python3 server.py` e via.

## Repository

[https://github.com/LukePalmDev/Armadio](https://github.com/LukePalmDev/Armadio)
