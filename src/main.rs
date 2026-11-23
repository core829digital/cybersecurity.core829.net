//! STRIX — landing e servizio richieste.
//!
//! Un unico binario: template compilati (Askama), asset incorporati (rust-embed),
//! endpoint per le richieste dei clienti. La dashboard interna CORE829 verrà
//! montata su questo stesso router nella fase successiva.

mod assets;
mod config;
mod pages;
mod requests;
mod security;

use std::{net::SocketAddr, sync::Arc, time::Duration};

use axum::{
    Router,
    http::StatusCode,
    routing::{get, post},
};
use tower_http::{
    compression::CompressionLayer, limit::RequestBodyLimitLayer, timeout::TimeoutLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{EnvFilter, fmt};

use crate::{config::Config, pages::Pages, requests::RequestStore};

/// Stato condiviso tra gli handler.
#[derive(Clone)]
pub struct AppState {
    pub pages: Arc<Pages>,
    pub store: Arc<RequestStore>,
    pub limiter: Arc<requests::RateLimiter>,
    pub config: Arc<Config>,
}

#[tokio::main]
async fn main() {
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| "strix_web=info,tower_http=warn".into()),
        )
        .init();

    let config = Arc::new(Config::from_env());
    let pages = Arc::new(Pages::render(&config).expect("rendering dei template fallito"));
    let store = Arc::new(
        RequestStore::open(&config.data_dir)
            .await
            .expect("impossibile aprire l'archivio richieste"),
    );

    let state = AppState {
        pages,
        store,
        limiter: Arc::new(requests::RateLimiter::new(5, Duration::from_secs(600))),
        config: config.clone(),
    };

    let app = router(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .unwrap_or_else(|e| panic!("bind su {addr} fallito: {e}"));
    tracing::info!("STRIX online su http://{addr} (asset v{})", assets::version());

    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("server terminato con errore");
}

fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(pages::index))
        .route("/privacy", get(pages::privacy))
        .route("/robots.txt", get(pages::robots))
        .route("/sitemap.xml", get(pages::sitemap))
        .route("/healthz", get(|| async { "ok" }))
        .route("/favicon.ico", get(assets::favicon))
        .route("/assets/{*path}", get(assets::serve))
        .route("/api/richieste", post(requests::create))
        .fallback(pages::not_found)
        .layer(RequestBodyLimitLayer::new(16 * 1024))
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(15),
        ))
        .layer(CompressionLayer::new())
        .layer(security::headers())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut s) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            s.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! { _ = ctrl_c => {}, _ = terminate => {} }
    tracing::info!("arresto in corso…");
}
