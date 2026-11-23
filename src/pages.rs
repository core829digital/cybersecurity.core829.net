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
    requests::{PLANS, SECTORS},
};

/// Un piano commerciale mostrato nella sezione prezzi.
pub struct Plan {
    pub id: &'static str,
    pub name: &'static str,
    pub monthly: u32,
    pub audience: &'static str,
    pub features: &'static [&'static str],
    pub featured: bool,
}

impl Plan {
    /// Prezzo annuale: due mesi gratis.
    pub fn yearly(&self) -> u32 {
        self.monthly * 10
    }

    /// Equivalente mensile del piano annuale, formattato all'italiana (es. "24,17").
    pub fn yearly_per_month(&self) -> String {
        let cents = self.yearly() * 100 / 12;
        format!("{},{:02}", cents / 100, cents % 100)
    }
}

pub const PLANS_INFO: &[Plan] = &[
    Plan {
        id: "start",
        name: "Start",
        monthly: 29,
        audience: "Micro-imprese, B&B, professionisti",
        features: &[
            "1 sito",
            "500 conversazioni AI al mese",
            "Addestramento su sito e 20 file",
            "Raccolta contatti via email",
            "Marchio “Powered by Strix”",
        ],
        featured: false,
    },
    Plan {
        id: "pro",
        name: "Pro",
        monthly: 79,
        audience: "PMI, ristoranti, hotel, studi",
        features: &[
            "3 siti",
            "2.000 conversazioni AI al mese",
            "Senza marchio Strix",
            "Contatti su WhatsApp, email e CRM",
            "Modelli pronti per il tuo settore",
            "5 lingue",
        ],
        featured: true,
    },
    Plan {
        id: "business",
        name: "Business",
        monthly: 199,
        audience: "E-commerce e aziende B2B",
        features: &[
            "10 siti",
            "6.000 conversazioni AI al mese",
            "Passaggio a un operatore in diretta",
            "Integrazioni su misura",
            "Resoconto avanzato",
            "Modello AI superiore",
        ],
        featured: false,
    },
    Plan {
        id: "agency",
        name: "Agency",
        monthly: 349,
        audience: "Agenzie web e rivenditori",
        features: &[
            "25 siti con il tuo marchio",
            "10.000 conversazioni condivise",
            "Resoconto mensile per ogni cliente",
            "Margine sulla rivendita",
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
    widget_domain: &'a str,
    year: i32,
    plans: &'a [Plan],
    sectors: &'a [(&'a str, &'a str)],
    plan_options: &'a [(&'a str, &'a str)],
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
                widget_domain: &config.widget_domain,
                year,
                plans: PLANS_INFO,
                sectors: SECTORS,
                plan_options: PLANS,
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
