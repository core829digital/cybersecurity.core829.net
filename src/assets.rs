//! Asset statici incorporati nel binario, con ETag e cache immutabile.

use std::sync::OnceLock;

use axum::{
    extract::Path,
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Redirect, Response},
};
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "assets/"]
struct Assets;

/// Versione degli asset: hash combinato di tutti i file, usato per invalidare la cache (`?v=`).
pub fn version() -> &'static str {
    static VERSION: OnceLock<String> = OnceLock::new();
    VERSION.get_or_init(|| {
        // FNV-1a sugli hash SHA-256 dei file, in ordine stabile.
        let mut names: Vec<_> = Assets::iter().collect();
        names.sort();
        let mut h: u64 = 0xcbf2_9ce4_8422_2325;
        for name in names {
            if let Some(file) = Assets::get(&name) {
                for b in name.as_bytes().iter().chain(file.metadata.sha256_hash().iter()) {
                    h ^= u64::from(*b);
                    h = h.wrapping_mul(0x0100_0000_01b3);
                }
            }
        }
        format!("{:010x}", h & 0xff_ffff_ffff)
    })
}

pub async fn serve(Path(path): Path<String>, headers: HeaderMap) -> Response {
    let Some(file) = Assets::get(&path) else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let etag = format!(
        "\"{}\"",
        file.metadata.sha256_hash()[..12]
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    );

    if headers
        .get(header::IF_NONE_MATCH)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.split(',').any(|t| t.trim() == etag))
    {
        return (StatusCode::NOT_MODIFIED, [(header::ETAG, etag)]).into_response();
    }

    let mime = mime_guess::from_path(&path).first_or_octet_stream();
    let mut res = file.data.into_owned().into_response();
    let h = res.headers_mut();
    if let Ok(v) = HeaderValue::from_str(mime.essence_str()) {
        h.insert(header::CONTENT_TYPE, v);
    }
    h.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=31536000, immutable"),
    );
    if let Ok(v) = HeaderValue::from_str(&etag) {
        h.insert(header::ETAG, v);
    }
    res
}

pub async fn favicon() -> Redirect {
    Redirect::permanent("/assets/img/favicon.svg")
}
