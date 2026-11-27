//! Pagine HTML: renderizzate e pre-compresse una volta all'avvio, poi servite dalla memoria.

use std::collections::HashMap;

use askama::Template;
use axum::{
    extract::State,
    http::{HeaderMap, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Redirect, Response},
};

use crate::{
    AppState, assets,
    catalog::{FAQ, FaqGroup, PLANS_INFO, Plan},
    company::{CORE829, Company},
    config::Config,
    encoded::Encoded,
    requests::{SERVICES, TARGET_TYPES},
};

/// Voce del menu principale.
pub struct NavItem {
    pub href: &'static str,
    pub label: &'static str,
}

pub const NAV: &[NavItem] = &[
    NavItem { href: "/servizi", label: "Servizi" },
    NavItem { href: "/metodo", label: "Metodo" },
    NavItem { href: "/vulnerabilita", label: "Vulnerabilità" },
    NavItem { href: "/report", label: "Report" },
    NavItem { href: "/prezzi", label: "Prezzi" },
    NavItem { href: "/chi-siamo", label: "Chi siamo" },
];

/// Contesto comune a tutte le pagine.
pub struct Ctx<'a> {
    pub v: &'a str,
    pub site_url: &'a str,
    pub year: i32,
    /// Percorso della pagina (es. "/servizi").
    pub path: &'static str,
    /// Nome breve della pagina (briciole di pane).
    pub name: &'static str,
    pub nav: &'static [NavItem],
    pub co: &'static Company,
    pub plans: &'static [Plan],
    pub target_types: &'static [(&'static str, &'static str)],
    pub services: &'static [(&'static str, &'static str)],
    pub faq: &'static [FaqGroup],
}

impl Ctx<'_> {
    /// `true` se la voce di menu corrisponde alla pagina corrente.
    pub fn is_active(&self, href: &str) -> bool {
        self.path == href
    }

    /// Dati strutturati FAQPage, già serializzati e sicuri dentro `<script>`.
    pub fn faq_jsonld(&self) -> String {
        let entities: Vec<_> = self
            .faq
            .iter()
            .flat_map(|g| g.items.iter())
            .map(|(q, a)| {
                serde_json::json!({
                    "@type": "Question",
                    "name": q,
                    "acceptedAnswer": { "@type": "Answer", "text": a }
                })
            })
            .collect();
        let json = serde_json::json!({ "@type": "FAQPage", "mainEntity": entities });
        json.to_string().replace("</", "<\\/")
    }
}

macro_rules! pages {
    ($($ty:ident => $file:literal, $route:literal, $name:literal, $prio:literal;)*) => {
        $(
            #[derive(Template)]
            #[template(path = $file)]
            struct $ty<'a> { c: &'a Ctx<'a> }
        )*

        /// (percorso, nome, priorità sitemap, renderer)
        type Render = fn(&Ctx) -> askama::Result<String>;
        const ROUTES: &[(&str, &str, &str, Render)] = &[
            $( ($route, $name, $prio, |c| $ty { c }.render()), )*
        ];
    };
}

pages! {
    Home => "index.html", "/", "Home", "1.0";
    Servizi => "servizi.html", "/servizi", "Servizi", "0.9";
    Metodo => "metodo.html", "/metodo", "Metodo", "0.8";
    Vulnerabilita => "vulnerabilita.html", "/vulnerabilita", "Vulnerabilità", "0.8";
    Report => "report.html", "/report", "Report", "0.7";
    Prezzi => "prezzi.html", "/prezzi", "Prezzi", "0.9";
    Conformita => "conformita.html", "/conformita", "Conformità e regole", "0.7";
    Faq => "faq.html", "/faq", "Domande frequenti", "0.6";
    ChiSiamo => "chi-siamo.html", "/chi-siamo", "Chi siamo", "0.6";
    Contatti => "contatti.html", "/contatti", "Contatti", "0.9";
    Privacy => "privacy.html", "/privacy", "Privacy e cookie", "0.3";
    NotFound => "404.html", "/404", "Pagina non trovata", "0";
}

const HTML: &str = "text/html; charset=utf-8";
const HTML_CACHE: &str = "public, no-cache";

/// Pagine già renderizzate e compresse.
pub struct Pages {
    by_path: HashMap<&'static str, Encoded>,
    not_found: Encoded,
    robots: Encoded,
    sitemap: Encoded,
}

impl Pages {
    pub fn render(config: &Config) -> Result<Self, askama::Error> {
        let v = assets::version();
        let year = time::OffsetDateTime::now_utc().year();
        let site_url = config.site_url.as_str();
        let mut by_path = HashMap::new();
        let mut not_found = None;
        let mut urls = String::new();

        for (path, name, prio, render) in ROUTES {
            let ctx = Ctx {
                v,
                site_url,
                year,
                path,
                name,
                nav: NAV,
                co: &CORE829,
                plans: PLANS_INFO,
                target_types: TARGET_TYPES,
                services: SERVICES,
                faq: FAQ,
            };
            let html = Encoded::new(render(&ctx)?.into_bytes(), HTML, HTML_CACHE, true);
            if *path == "/404" {
                not_found = Some(html);
                continue;
            }
            urls.push_str(&format!(
                "  <url><loc>{site_url}{path}</loc><priority>{prio}</priority></url>\n"
            ));
            by_path.insert(*path, html);
        }

        let robots = format!("User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: {site_url}/sitemap.xml\n");
        let sitemap = format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
             <urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n{urls}</urlset>\n"
        );
        Ok(Self {
            by_path,
            not_found: not_found.expect("pagina 404 presente in ROUTES"),
            robots: Encoded::new(robots.into_bytes(), "text/plain; charset=utf-8", "public, max-age=3600", false),
            sitemap: Encoded::new(sitemap.into_bytes(), "application/xml; charset=utf-8", "public, max-age=3600", true),
        })
    }

    pub fn count(&self) -> usize {
        self.by_path.len()
    }
}

/// Serve la pagina corrispondente al percorso, oppure la 404.
pub async fn serve(State(s): State<AppState>, uri: Uri, headers: HeaderMap) -> Response {
    let path = uri.path();
    if path.len() > 1 && path.ends_with('/') {
        return Redirect::permanent(path.trim_end_matches('/')).into_response();
    }
    let mut res = match s.pages.by_path.get(path) {
        Some(p) => p.respond(&headers, StatusCode::OK),
        None => s.pages.not_found.respond(&headers, StatusCode::NOT_FOUND),
    };
    res.headers_mut().insert(
        "speculation-rules",
        HeaderValue::from_static("\"/assets/speculation.json\""),
    );
    res
}

pub async fn robots(State(s): State<AppState>, headers: HeaderMap) -> Response {
    s.pages.robots.respond(&headers, StatusCode::OK)
}

pub async fn sitemap(State(s): State<AppState>, headers: HeaderMap) -> Response {
    s.pages.sitemap.respond(&headers, StatusCode::OK)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_pages_render() {
        let cfg = Config::from_env();
        let pages = Pages::render(&cfg).expect("rendering");
        assert_eq!(pages.count(), ROUTES.len() - 1);
        for (path, ..) in ROUTES.iter().filter(|r| r.0 != "/404") {
            assert!(pages.by_path.contains_key(path), "manca {path}");
        }
    }
}
