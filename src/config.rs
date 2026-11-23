use std::path::PathBuf;

/// Configurazione da variabili d'ambiente, con valori di default sensati per lo sviluppo.
#[derive(Debug, Clone)]
pub struct Config {
    /// Porta HTTP (`PORT`, default 8080).
    pub port: u16,
    /// Cartella dove salvare le richieste (`DATA_DIR`, default `./data`).
    pub data_dir: PathBuf,
    /// URL pubblico del sito, senza slash finale (`SITE_URL`).
    pub site_url: String,
    /// Se `true`, l'IP del client viene letto da `X-Forwarded-For` (solo dietro un proxy fidato).
    pub trust_proxy: bool,
}

impl Config {
    pub fn from_env() -> Self {
        let env = |k: &str| std::env::var(k).ok().filter(|v| !v.trim().is_empty());
        Self {
            port: env("PORT").and_then(|p| p.parse().ok()).unwrap_or(8080),
            data_dir: env("DATA_DIR").map(PathBuf::from).unwrap_or_else(|| "data".into()),
            site_url: env("SITE_URL")
                .unwrap_or_else(|| "https://cybersecurity.core829.net".into())
                .trim_end_matches('/')
                .to_owned(),
            trust_proxy: env("TRUST_PROXY").is_some_and(|v| v == "1" || v.eq_ignore_ascii_case("true")),
        }
    }
}
