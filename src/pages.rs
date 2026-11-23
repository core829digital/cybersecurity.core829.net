//! Pagine HTML: renderizzate una volta all'avvio e servite dalla memoria.

use askama::Template;
use axum::{
    extract::State,
    http::{StatusCode, header},
    response::{Html, IntoResponse, Response},
};

use crate::{
    AppState, assets,
    config::Config,
    requests::{SERVICES, TARGET_TYPES},
};

/// Un servizio mostrato nella sezione prezzi.
pub struct Plan {
    pub id: &'static str,
    pub name: &'static str,
    /// Prezzo di partenza in euro, già formattato (es. "1.490").
    pub price: &'static str,
    /// Unità del prezzo (es. "una tantum", "/mese").
    pub unit: &'static str,
    pub audience: &'static str,
    pub features: &'static [&'static str],
    pub featured: bool,
}

impl Plan {
    /// Prezzo numerico senza separatori delle migliaia, per i dati strutturati (es. "1490").
    pub fn price_value(&self) -> String {
        self.price.replace('.', "")
    }
}

/// Listino proposto: prezzi "a partire da", IVA esclusa.
pub const PLANS_INFO: &[Plan] = &[
    Plan {
        id: "checkup",
        name: "Check-up",
        price: "490",
        unit: "una tantum",
        audience: "Siti aziendali e piccoli e-commerce",
        features: &[
            "1 sito o web app",
            "Test dall'esterno (black-box)",
            "OWASP Top 10 e configurazioni",
            "Prova di sfruttamento per ogni vulnerabilità",
            "Report in italiano con le correzioni",
        ],
        featured: false,
    },
    Plan {
        id: "completo",
        name: "Pentest completo",
        price: "1.490",
        unit: "una tantum",
        audience: "E-commerce, web app e piattaforme SaaS",
        features: &[
            "Web app e relative API",
            "Test con utenti autenticati",
            "Controllo accessi e logica di business",
            "Revisione del team CORE829",
            "Report tecnico e sintesi per la direzione",
            "Retest gratuito dopo le correzioni",
        ],
        featured: true,
    },
    Plan {
        id: "continuo",
        name: "Protezione continua",
        price: "390",
        unit: "/mese",
        audience: "Team che rilasciano spesso",
        features: &[
            "Test a ogni rilascio importante",
            "Integrazione con GitHub o GitLab",
            "Nuove vulnerabilità segnalate subito",
            "Resoconto mensile dei rischi",
            "Referente CORE829 dedicato",
        ],
        featured: false,
    },
];

#[derive(Template)]
#[template(path = "index.html")]
struct IndexTpl<'a> {
    v: &'a str,
    site_url: &'a str,
    year: i32,
    plans: &'a [Plan],
    target_types: &'a [(&'a str, &'a str)],
    services: &'a [(&'a str, &'a str)],
}

#[derive(Template)]
#[template(path = "privacy.html")]
struct PrivacyTpl<'a> {
    v: &'a str,
    site_url: &'a str,
    year: i32,
}

#[derive(Template)]
#[template(path = "404.html")]
struct NotFoundTpl<'a> {
    v: &'a str,
    site_url: &'a str,
    year: i32,
}

/// Pagine già renderizzate.
pub struct Pages {
    index: String,
    privacy: String,
    not_found: String,
    robots: String,
    sitemap: String,
}

impl Pages {
    pub fn render(config: &Config) -> Result<Self, askama::Error> {
        let v = assets::version();
        let year = time::OffsetDateTime::now_utc().year();
        let site_url = config.site_url.as_str();
        Ok(Self {
            index: IndexTpl {
                v,
                site_url,
                year,
                plans: PLANS_INFO,
                target_types: TARGET_TYPES,
                services: SERVICES,
            }
            .render()?,
            privacy: PrivacyTpl { v, site_url, year }.render()?,
            not_found: NotFoundTpl { v, site_url, year }.render()?,
            robots: format!("User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: {site_url}/sitemap.xml\n"),
            sitemap: format!(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
                 <urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n\
                 <url><loc>{site_url}/</loc><priority>1.0</priority></url>\n\
                 <url><loc>{site_url}/privacy</loc><priority>0.3</priority></url>\n\
                 </urlset>\n"
            ),
        })
    }
}

fn html(body: &str) -> Response {
    (
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Html(body.to_owned()),
    )
        .into_response()
}

pub async fn index(State(s): State<AppState>) -> Response {
    html(&s.pages.index)
}

pub async fn privacy(State(s): State<AppState>) -> Response {
    html(&s.pages.privacy)
}

pub async fn not_found(State(s): State<AppState>) -> Response {
    (StatusCode::NOT_FOUND, Html(s.pages.not_found.clone())).into_response()
}

pub async fn robots(State(s): State<AppState>) -> Response {
    ([(header::CONTENT_TYPE, "text/plain; charset=utf-8")], s.pages.robots.clone()).into_response()
}

pub async fn sitemap(State(s): State<AppState>) -> Response {
    ([(header::CONTENT_TYPE, "application/xml; charset=utf-8")], s.pages.sitemap.clone()).into_response()
}
