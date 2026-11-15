# Armadio

**Armadio** è un'applicazione web minimale, ispirata al design **Braun / Dieter Rams**, per archiviare e organizzare il proprio guardaroba diviso per abitazioni: **Milano**, **Reggio** e **Sardegna**.

L'interfaccia mostra un armadio interattivo disegnato in stile tecnico: ante apribili con animazioni 3D, appendiabiti con silhouette stilizzate dei capi appesi (giacche, camicie, felpe, maglioni, pantaloni), ripiani e cassetti con pile di capi piegati.

## Come Eseguire

L'app è scritta in vanilla **HTML5**, **CSS3** e **JavaScript** (ES6), senza dipendenze.

```bash
python3 server.py
```

Poi apri il browser su [http://localhost:8000](http://localhost:8000).

Il sito pubblico è [https://armadio.byluke.org](https://armadio.byluke.org) (GitHub Pages, root del branch `main`, dietro il proxy Cloudflare). Le modifiche passano da `GET /api/load` e `POST /api/save`: le risponde un Worker Cloudflare, non questo script. Una copia resta nel `localStorage` del browser. Se l'API non risponde, l'app continua a funzionare e mostra «Modifiche salvate solo su questo dispositivo».

> ⚠️ In locale usa `server.py` e non `python3 -m http.server`: il server integrato espone `/api/load` e `/api/save` su `wardrobe.json`. Senza quell'header l'app non chiama `/api` e non sporca la console con un 404.

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

## Persistenza

Ogni modifica viene scritta nel `localStorage` e, se l'API risponde, anche sul server.

- In locale `server.py` aggiorna `wardrobe.json` e tiene la versione precedente in `wardrobe.backup.json`. La scrittura è atomica. Un salvataggio con una `version` vecchia riceve **409**: la pagina chiede se ricaricare o sovrascrivere.
- Sul sito pubblico il Worker fa lo stesso contratto, con i dati in Workers KV. Vedi sotto per il deploy.
- Il primo caricamento non sostituisce mai l'archivio sul server con uno stato locale vuoto. Se il browser ha modifiche non sincronizzate e il server ne ha di diverse, compare un dialogo (Ricarica / Sovrascrivi) invece di una scrittura silenziosa.
- Payload non validi sono rifiutati. Il corpo di un salvataggio non può superare 1 MB.

`GET /api/load` risponde `{ "items": [ ... ], "version": "<id>" }` con `Cache-Control: no-store` e `ETag`. `POST /api/save` riceve `{ "items": [ ... ], "version": "<id caricato>", "force": false }`.

## Sincronizzazione sul sito pubblico

Il Worker sta in [`worker/`](worker/). Nome `armadio-api`, route `armadio.byluke.org/api/*` sulla zona `byluke.org`, binding KV `WARDROBE`. GitHub Pages continua a servire il sito; solo `/api/*` arriva al Worker, e solo se il DNS del nome è proxato da Cloudflare (nuvola arancione).

Il nome `armadio.byluke.org` va protetto con Cloudflare Access, team `empty-pond-1e04.cloudflareaccess.com` (lo stesso di trader). Il Worker controlla di nuovo il JWT nell'header `Cf-Access-Jwt-Assertion`: firma RS256 sulle chiavi di `https://empty-pond-1e04.cloudflareaccess.com/cdn-cgi/access/certs` (tenute in cache), issuer, scadenza e audience `ACCESS_AUD`. Senza un token valido risponde 403. Se `ALLOWED_EMAILS` non è vuoto, l'email del token deve essere in quell'elenco.

### Cosa deve fare chi pubblica

Non è automatizzato. Dalla directory `worker/`, con un account che può creare KV, route e Worker sulla zona `byluke.org`:

1. Crea il namespace KV e copia l'id nel `wrangler.toml` al posto di `00000000000000000000000000000000`:

   ```bash
   npx wrangler kv namespace create armadio-wardrobe
   ```

2. In Zero Trust → Access → Applications, crea (o aggiorna) l'applicazione self-hosted per `armadio.byluke.org`, stesso team di trader. Copia l'Application Audience (AUD) in `ACCESS_AUD`. L'applicazione deve coprire l'intero hostname, così sia le pagine sia `/api/*` passano da Access.
3. Lascia `ALLOWED_EMAILS` vuoto per accettare chiunque superi Access, oppure metti le email separate da virgola.
4. Accedi e pubblica il codice:

   ```bash
   npm ci
   npx wrangler login
   npx wrangler deploy
   ```

5. Carica `wardrobe.json` come valore iniziale **una volta**, prima che qualcuno salvi dall'app. Il comando sovrascrive la chiave `current`: non rilanciarlo dopo che l'armadio è in uso.

   ```bash
   node seed.mjs
   ```

   Equivalente, dopo aver preparato un JSON `{ "items": [...], "version": "<uuid>", "updatedAt": "<iso>" }`:

   ```bash
   npx wrangler kv key put current --path current.json --binding WARDROBE --remote
   ```

6. `npm test` esegue i test del Worker (Vitest nel runtime Workers) e controlla che `wardrobe.json` rispetti il modello. `node scripts/e2e.mjs` ripete il flusso nel browser contro un Worker locale: non pubblica nulla e non tocca il KV remoto.

Finché il Worker non è pubblicato, `/api/load` sul sito risponde 404. L'app resta sul `localStorage` (e su `wardrobe.json` se il browser non ha una copia) e mostra il banner. Non invia un archivio vuoto al server.

### Conflitti, cronologia, ripristino

Ogni salvataggio riuscito sposta la versione precedente in una chiave `history:<timestamp>` e ne tiene 20. `GET /api/history` elenca `{ id, savedAt, version, count }`. `GET /api/history?id=history:<timestamp>` legge uno snapshot. `POST /api/restore` con `{ "id": "history:<timestamp>", "version": "<version corrente>", "force": false }` lo rimette come archivio attuale (la versione corrente finisce a sua volta in cronologia). Se `version` non coincide, la risposta è 409, come per un salvataggio. `force: true` è la sovrascrittura esplicita, la stessa del bottone Sovrascrivi.

Dal browser, se due dispositivi modificano insieme, il dialogo dice di ricaricare (tieni il server, perdi le modifiche locali) o di sovrascrivere (manda al server le modifiche di questo dispositivo).

### Rollback

Il rollback del Worker (`npx wrangler rollback`, oppure Deployments nel pannello) riporta il codice alla versione precedente. **Non** riporta indietro i dati in KV.

Per i dati, con un JWT di Access valido:

```bash
curl -sS -H "Cf-Access-Jwt-Assertion: $JWT" https://armadio.byluke.org/api/history
curl -sS -X POST -H "Content-Type: application/json" -H "Cf-Access-Jwt-Assertion: $JWT" \
  -d '{"id":"history:1730000000000","version":"<version da /api/load>","force":false}' \
  https://armadio.byluke.org/api/restore
```

In alternativa, senza passare dall'app: `npx wrangler kv key get <id> --binding WARDROBE --remote` e poi `npx wrangler kv key put current --path <file> --binding WARDROBE --remote`. Anche questo sovrascrive l'archivio vivo.

## Usare Armadio con il Proprio Guardaroba

1. Fai un fork o clona il repo.
2. Modifica `wardrobe.json` con i tuoi capi (a mano o tramite l'interfaccia).
3. `python3 server.py` e via.

## Repository

[https://github.com/LukePalmDev/Armadio](https://github.com/LukePalmDev/Armadio)
