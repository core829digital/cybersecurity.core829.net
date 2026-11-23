# STRIX by CORE829 — landing page

Landing page del servizio **STRIX**, l'assistente AI per i siti web delle PMI, venduto e gestito da **CORE829 SRL**.
Il cliente invia solo una richiesta dal sito; tutta la gestione avviene internamente da CORE829.

## Stack

| Parte | Scelta | Perché |
|---|---|---|
| Server | Rust + Axum | Un solo binario, risposte in meno di 1 ms |
| Template | Askama | HTML verificato e compilato insieme al codice |
| Asset | rust-embed | CSS, JS, font e immagini incorporati nel binario |
| Frontend | JS e CSS senza framework | ~34 KB compressi in totale, nessuna dipendenza |
| Font | Space Grotesk + JetBrains Mono (OFL), ospitati in locale | Nessuna chiamata a Google, nessun cookie |

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
| `SITE_URL` | `https://strix.ai` | URL pubblico (canonical, sitemap, Open Graph) |
| `WIDGET_DOMAIN` | `strix.ai` | Dominio mostrato negli esempi di installazione |
| `TRUST_PROXY` | `false` | `true` solo dietro un reverse proxy fidato (legge `X-Forwarded-For`) |

## Produzione con Docker

```bash
docker build -t strix-web .
docker run -d -p 8080:8080 -v strix-data:/data -e SITE_URL=https://strix.ai -e TRUST_PROXY=true strix-web
```

Mettere davanti un reverse proxy con HTTPS (Caddy, Nginx o Cloudflare).

## Struttura

```
src/
  main.rs       router, middleware, avvio e arresto ordinato
  config.rs     variabili d'ambiente
  pages.rs      pagine renderizzate una volta all'avvio, piani e prezzi
  requests.rs   POST /api/richieste: validazione, anti-spam, limite di frequenza, salvataggio
  assets.rs     asset incorporati con ETag e cache immutabile
  security.rs   header di sicurezza (CSP rigorosa, HSTS, ecc.)
templates/      index, privacy, 404, layout base
assets/         css, js, font, immagini
```

## API

`POST /api/richieste` (JSON) → `201` richiesta salvata · `422` errori per campo · `429` troppe richieste · `413` corpo troppo grande.

Protezioni: campo trappola invisibile, tempo minimo di compilazione, 5 richieste ogni 10 minuti per IP, corpo massimo 16 KB.
L'IP non viene salvato insieme alla richiesta (minimizzazione GDPR).

## Test

```bash
cargo test
```

## Prossima fase

- Dashboard interna CORE829 (accesso riservato) per gestire richieste, clienti e assistenti
- Archivio su PostgreSQL al posto di `richieste.jsonl` (stessa API)
- Notifica email a CORE829 a ogni nuova richiesta
