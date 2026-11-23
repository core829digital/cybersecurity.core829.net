# CORE829 Cybersecurity — landing page

Landing page del servizio di **penetration test con agenti AI** di **CORE829 SRL**
(`cybersecurity.core829.net`). Il cliente invia solo una richiesta dal sito; perimetro,
autorizzazione, test, report e retest sono gestiti internamente da CORE829.

> Regola non negoziabile: nessun test parte senza **autorizzazione scritta del titolare**
> del sistema e **verifica della proprietà del dominio** (art. 615-ter c.p.).

## Stack

| Parte | Scelta | Perché |
|---|---|---|
| Server | Rust + Axum | Un solo binario, risposte in meno di 1 ms |
| Template | Askama | HTML verificato e compilato insieme al codice |
| Asset | rust-embed | CSS, JS, font e immagini incorporati nel binario |
| Frontend | JS e CSS senza framework | Nessuna dipendenza, pagina leggerissima |
| Font | Space Grotesk + JetBrains Mono (OFL), ospitati in locale | Nessuna chiamata a terzi, nessun cookie |

## Avvio in locale

```bash
cargo run --release
# → http://localhost:8080
```

## Configurazione (variabili d'ambiente)

| Variabile | Default | Descrizione |
|---|---|---|
| `PORT` | `8080` | Porta HTTP |
| `DATA_DIR` | `./data` | Cartella dove vengono salvate le richieste (`richieste.jsonl`) |
| `SITE_URL` | `https://cybersecurity.core829.net` | URL pubblico (canonical, sitemap, Open Graph) |
| `TRUST_PROXY` | `false` | `true` solo dietro un reverse proxy fidato (legge `X-Forwarded-For`) |

## Produzione con Docker

```bash
docker build -t core829-cyber .
docker run -d -p 8080:8080 -v core829-cyber-data:/data -e TRUST_PROXY=true core829-cyber
```

Mettere davanti un reverse proxy con HTTPS (Caddy, Nginx o Cloudflare).

## Struttura

```
src/
  main.rs       router, middleware, avvio e arresto ordinato
  config.rs     variabili d'ambiente
  pages.rs      pagine renderizzate all'avvio, listino dei servizi (PLANS_INFO)
  requests.rs   POST /api/richieste: validazione, anti-spam, limite di frequenza, salvataggio
  assets.rs     asset incorporati con ETag e cache immutabile
  security.rs   header di sicurezza (CSP rigorosa, HSTS, ecc.)
templates/      index, privacy, 404, layout base, console demo
assets/         css, js, font, immagini
```

## API

`POST /api/richieste` (JSON) → `201` richiesta salvata · `422` errori per campo · `429` troppe richieste · `413` corpo troppo grande.

Campi: `nome`, `azienda`, `email`, `telefono`, `target` (sistema da testare), `tipo`, `servizio`,
`messaggio`, `autorizzazione` (obbligatoria: titolare o autorizzato dal titolare), `privacy`.

Protezioni: campo trappola invisibile, tempo minimo di compilazione, 5 richieste ogni 10 minuti per IP,
corpo massimo 16 KB. L'IP non viene salvato insieme alla richiesta (minimizzazione GDPR).

## Test

```bash
cargo test
```

## Prossima fase

- Dashboard interna CORE829 (accesso riservato): richieste, incarichi, autorizzazioni firmate, campagne, report
- Verifica automatica della proprietà del dominio (record DNS TXT)
- Archivio su PostgreSQL al posto di `richieste.jsonl` (stessa API)
- Notifica email a CORE829 a ogni nuova richiesta
