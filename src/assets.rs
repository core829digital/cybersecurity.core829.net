//! Asset statici incorporati nel binario.
//!
//! All'avvio i moduli `css/NN-*.css` e `js/NN-*.js` vengono uniti in un unico
//! `css/core829.css` e `js/core829.js` (una sola richiesta per tipo), e ogni
//! asset testuale viene pre-compresso. La versione (`?v=`) è l'hash del
//! contenuto: gli asset possono quindi avere cache immutabile.

use std::{collections::HashMap, sync::OnceLock};

use axum::{
    extract::Path,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Redirect, Response},
};
use rust_embed::Embed;

use crate::encoded::Encoded;

#[derive(Embed)]
#[folder = "assets/"]
struct Assets;

const IMMUTABLE: &str = "public, max-age=31536000, immutable";
const SHORT: &str = "public, max-age=3600";

struct Store {
    files: HashMap<String, Encoded>,
    version: String,
}

/// Unisce in ordine alfabetico i moduli `dir/NN-*.ext`.
fn bundle(dir: &str, ext: &str) -> Vec<u8> {
    let mut parts: Vec<_> = Assets::iter()
        .filter(|p| {
            p.strip_prefix(dir)
                .is_some_and(|n| !n.contains('/') && n.ends_with(ext) && n.as_bytes()[0].is_ascii_digit())
        })
        .collect();
    parts.sort();
    let mut out = Vec::new();
    for p in parts {
        if let Some(f) = Assets::get(&p) {
            out.extend_from_slice(&f.data);
            out.push(b'\n');
        }
    }
    out
}

fn is_text(path: &str) -> bool {
    [".css", ".js", ".svg", ".json", ".txt", ".xml", ".html"]
        .iter()
        .any(|e| path.ends_with(e))
}

fn store() -> &'static Store {
    static STORE: OnceLock<Store> = OnceLock::new();
    STORE.get_or_init(|| {
        let mut raw: Vec<(String, Vec<u8>)> = Assets::iter()
            .filter(|p| {
                let name = p.rsplit('/').next().unwrap_or("");
                // i moduli numerati finiscono solo nel bundle
                !(name.as_bytes().first().is_some_and(u8::is_ascii_digit)
                    && (p.starts_with("css/") || p.starts_with("js/")))
            })
            .filter_map(|p| Assets::get(&p).map(|f| (p.to_string(), f.data.into_owned())))
            .collect();
        raw.push(("css/core829.css".into(), bundle("css/", ".css")));
        raw.push(("js/core829.js".into(), bundle("js/", ".js")));
        raw.sort_by(|a, b| a.0.cmp(&b.0));

        // FNV-1a su nomi e contenuti, in ordine stabile.
        let mut h: u64 = 0xcbf2_9ce4_8422_2325;
        for (name, data) in &raw {
            for b in name.as_bytes().iter().chain(data.iter()) {
                h = (h ^ u64::from(*b)).wrapping_mul(0x0100_0000_01b3);
            }
        }
        let version = format!("{:010x}", h & 0xff_ffff_ffff);

        let files = raw
            .into_iter()
            .map(|(path, data)| {
                let mime = if path.ends_with(".json") && path.contains("speculation") {
                    "application/speculationrules+json".to_string()
                } else {
                    mime_guess::from_path(&path).first_or_octet_stream().to_string()
                };
                let mime = if is_text(&path) && !mime.contains("charset") {
                    format!("{mime}; charset=utf-8")
                } else {
                    mime
                };
                // immagini social e regole di prefetch non sono versionate nell'URL
                let cache = if path.starts_with("img/og") || path.contains("speculation") {
                    SHORT
                } else {
                    IMMUTABLE
                };
                let enc = Encoded::new(data, &mime, cache, is_text(&path));
                (path, enc)
            })
            .collect();
        Store { files, version }
    })
}

/// Versione degli asset, da usare come `?v=` negli URL.
pub fn version() -> &'static str {
    &store().version
}

/// Dimensione in byte degli asset uniti, per il log di avvio.
pub fn bundle_sizes() -> (usize, usize) {
    let s = store();
    let len = |p: &str| s.files.get(p).map_or(0, Encoded::len);
    (len("css/core829.css"), len("js/core829.js"))
}

pub async fn serve(Path(path): Path<String>, headers: HeaderMap) -> Response {
    match store().files.get(&path) {
        Some(f) => f.respond(&headers, StatusCode::OK),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

pub async fn favicon() -> Redirect {
    Redirect::permanent("/assets/img/favicon.svg")
}
