//! Richieste dei clienti inviate dal modulo della landing.
//!
//! Fase attuale: ogni richiesta valida viene aggiunta come riga JSON a
//! `DATA_DIR/richieste.jsonl` (scrittura serializzata + fsync). Nella fase
//! successiva lo stesso `RequestStore` passerà a PostgreSQL e alimenterà la
//! dashboard interna CORE829, senza cambiare il contratto dell'API.

use std::{
    collections::{BTreeMap, HashMap},
    net::{IpAddr, SocketAddr},
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

use axum::{
    Json,
    extract::{ConnectInfo, State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use tokio::{fs::OpenOptions, io::AsyncWriteExt, sync::Mutex};
use uuid::Uuid;

use crate::AppState;

pub const SECTORS: &[(&str, &str)] = &[
    ("hotel", "Hotel, B&B e turismo"),
    ("ristorazione", "Ristorante o bar"),
    ("sanita", "Studio medico o clinica"),
    ("professionisti", "Studio legale o commercialista"),
    ("ecommerce", "E-commerce"),
    ("b2b", "Azienda B2B o manifattura"),
    ("agenzia", "Agenzia web o freelance"),
    ("altro", "Altro"),
];

pub const PLANS: &[(&str, &str)] = &[
    ("da-definire", "Non lo so ancora"),
    ("start", "Start"),
    ("pro", "Pro"),
    ("business", "Business"),
    ("agency", "Agency"),
    ("enterprise", "Enterprise"),
];

#[derive(Debug, Deserialize)]
pub struct RequestInput {
    #[serde(default)]
    nome: String,
    #[serde(default)]
    azienda: String,
    #[serde(default)]
    email: String,
    #[serde(default)]
    telefono: String,
    #[serde(default)]
    sito: String,
    #[serde(default)]
    settore: String,
    #[serde(default)]
    piano: String,
    #[serde(default)]
    messaggio: String,
    #[serde(default)]
    privacy: bool,
    /// Campo trappola invisibile: se compilato, è un bot.
    #[serde(default)]
    fax: String,
    /// Millisecondi trascorsi tra il caricamento della pagina e l'invio.
    #[serde(default)]
    elapsed_ms: u64,
}

#[derive(Debug, Serialize)]
struct StoredRequest<'a> {
    id: Uuid,
    received_at: String,
    status: &'static str,
    source: &'static str,
    nome: &'a str,
    azienda: &'a str,
    email: &'a str,
    telefono: &'a str,
    sito: &'a str,
    settore: &'a str,
    piano: &'a str,
    messaggio: &'a str,
    privacy_accepted: bool,
}

/// Normalizza e valida l'input; restituisce gli errori per campo, in italiano.
fn validate(mut i: RequestInput) -> Result<RequestInput, BTreeMap<&'static str, &'static str>> {
    let clean = |s: &str, max: usize| -> String {
        s.chars()
            .filter(|c| !c.is_control() || *c == '\n')
            .collect::<String>()
            .trim()
            .chars()
            .take(max)
            .collect()
    };
    i.nome = clean(&i.nome, 120);
    i.azienda = clean(&i.azienda, 160);
    i.email = clean(&i.email, 254).to_lowercase();
    i.telefono = clean(&i.telefono, 40);
    i.sito = clean(&i.sito, 300);
    i.messaggio = clean(&i.messaggio, 2000);

    let mut errors = BTreeMap::new();
    if i.nome.chars().count() < 2 {
        errors.insert("nome", "Inserisci nome e cognome.");
    }
    if i.azienda.chars().count() < 2 {
        errors.insert("azienda", "Inserisci il nome dell'azienda.");
    }
    if !is_email(&i.email) {
        errors.insert("email", "Inserisci un indirizzo email valido.");
    }
    if !i.telefono.is_empty()
        && !i
            .telefono
            .chars()
            .all(|c| c.is_ascii_digit() || " +()-./".contains(c))
    {
        errors.insert("telefono", "Il numero può contenere solo cifre, spazi e +.");
    }
    if !is_site(&i.sito) {
        errors.insert("sito", "Inserisci l'indirizzo del sito, es. www.tuosito.it");
    }
    if !SECTORS.iter().any(|(k, _)| *k == i.settore) {
        errors.insert("settore", "Seleziona il tuo settore.");
    }
    if i.piano.is_empty() {
        i.piano = "da-definire".into();
    }
    if !PLANS.iter().any(|(k, _)| *k == i.piano) {
        errors.insert("piano", "Seleziona un piano valido.");
    }
    if !i.privacy {
        errors.insert("privacy", "Per inviare la richiesta serve il consenso all'informativa.");
    }
    if errors.is_empty() { Ok(i) } else { Err(errors) }
}

fn is_email(e: &str) -> bool {
    let Some((local, domain)) = e.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
        && !e.chars().any(char::is_whitespace)
        && !domain.contains('@')
}

fn is_site(s: &str) -> bool {
    let host = s
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .split(['/', '?', '#'])
        .next()
        .unwrap_or("");
    host.len() >= 4
        && host.contains('.')
        && host
            .chars()
            .all(|c| c.is_alphanumeric() || c == '.' || c == '-' || c == ':')
}

/// Archivio append-only delle richieste.
pub struct RequestStore {
    path: PathBuf,
    lock: Mutex<()>,
}

impl RequestStore {
    pub async fn open(dir: &Path) -> std::io::Result<Self> {
        tokio::fs::create_dir_all(dir).await?;
        Ok(Self {
            path: dir.join("richieste.jsonl"),
            lock: Mutex::new(()),
        })
    }

    async fn append(&self, line: &str) -> std::io::Result<()> {
        let _guard = self.lock.lock().await;
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .await?;
        f.write_all(line.as_bytes()).await?;
        f.write_all(b"\n").await?;
        f.sync_data().await
    }
}

/// Limite semplice a finestra fissa per IP (in memoria).
pub struct RateLimiter {
    max: u32,
    window: Duration,
    hits: std::sync::Mutex<HashMap<IpAddr, (u32, Instant)>>,
}

impl RateLimiter {
    pub fn new(max: u32, window: Duration) -> Self {
        Self { max, window, hits: Default::default() }
    }

    fn allow(&self, ip: IpAddr) -> bool {
        let now = Instant::now();
        let mut hits = self.hits.lock().unwrap_or_else(|e| e.into_inner());
        if hits.len() > 10_000 {
            hits.retain(|_, (_, t)| now.duration_since(*t) < self.window);
        }
        let entry = hits.entry(ip).or_insert((0, now));
        if now.duration_since(entry.1) >= self.window {
            *entry = (0, now);
        }
        entry.0 += 1;
        entry.0 <= self.max
    }
}

fn client_ip(addr: SocketAddr, headers: &HeaderMap, trust_proxy: bool) -> IpAddr {
    if trust_proxy
        && let Some(ip) = headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.split(',').next())
            .and_then(|v| v.trim().parse().ok())
    {
        return ip;
    }
    addr.ip()
}

fn accepted() -> Response {
    (
        StatusCode::CREATED,
        Json(json!({ "ok": true, "message": "Richiesta ricevuta." })),
    )
        .into_response()
}

pub async fn create(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Result<Json<RequestInput>, JsonRejection>,
) -> Response {
    let Ok(Json(input)) = body else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "ok": false, "message": "Richiesta non valida." })),
        )
            .into_response();
    };

    if !state
        .limiter
        .allow(client_ip(addr, &headers, state.config.trust_proxy))
    {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({ "ok": false, "message": "Troppe richieste. Riprova tra qualche minuto." })),
        )
            .into_response();
    }

    // Bot: rispondiamo "ok" senza salvare, per non dare indizi.
    if !input.fax.is_empty() || input.elapsed_ms < 2500 {
        tracing::warn!("richiesta scartata dai filtri anti-spam");
        return accepted();
    }

    let input = match validate(input) {
        Ok(i) => i,
        Err(errors) => {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({ "ok": false, "message": "Controlla i campi evidenziati.", "errors": errors })),
            )
                .into_response();
        }
    };

    let record = StoredRequest {
        id: Uuid::new_v4(),
        received_at: OffsetDateTime::now_utc()
            .format(&Rfc3339)
            .unwrap_or_default(),
        status: "nuova",
        source: "landing",
        nome: &input.nome,
        azienda: &input.azienda,
        email: &input.email,
        telefono: &input.telefono,
        sito: &input.sito,
        settore: &input.settore,
        piano: &input.piano,
        messaggio: &input.messaggio,
        privacy_accepted: input.privacy,
    };

    let line = match serde_json::to_string(&record) {
        Ok(l) => l,
        Err(e) => {
            tracing::error!("serializzazione richiesta fallita: {e}");
            return server_error();
        }
    };

    if let Err(e) = state.store.append(&line).await {
        tracing::error!("salvataggio richiesta fallito: {e}");
        return server_error();
    }

    tracing::info!(id = %record.id, settore = record.settore, piano = record.piano, "nuova richiesta");
    accepted()
}

fn server_error() -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({
            "ok": false,
            "message": "Non siamo riusciti a registrare la richiesta. Scrivici a hello@core829.net."
        })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid() -> RequestInput {
        RequestInput {
            nome: "Mario Rossi".into(),
            azienda: "Hotel Belvedere".into(),
            email: "Mario@Example.it ".into(),
            telefono: "+39 333 123 4567".into(),
            sito: "https://www.example.it/".into(),
            settore: "hotel".into(),
            piano: String::new(),
            messaggio: "Vorrei rispondere alle domande sulle camere.".into(),
            privacy: true,
            fax: String::new(),
            elapsed_ms: 10_000,
        }
    }

    #[test]
    fn accepts_valid_input_and_normalizes() {
        let v = validate(valid()).expect("valido");
        assert_eq!(v.email, "mario@example.it");
        assert_eq!(v.piano, "da-definire");
    }

    #[test]
    fn rejects_missing_fields() {
        let mut i = valid();
        i.email = "non-una-email".into();
        i.sito = "x".into();
        i.settore = "boh".into();
        i.privacy = false;
        let e = validate(i).unwrap_err();
        assert!(e.contains_key("email"));
        assert!(e.contains_key("sito"));
        assert!(e.contains_key("settore"));
        assert!(e.contains_key("privacy"));
    }

    #[test]
    fn rate_limiter_blocks_after_max() {
        let rl = RateLimiter::new(2, Duration::from_secs(60));
        let ip: IpAddr = "1.2.3.4".parse().unwrap();
        assert!(rl.allow(ip));
        assert!(rl.allow(ip));
        assert!(!rl.allow(ip));
    }
}
