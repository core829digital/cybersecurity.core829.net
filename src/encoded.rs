//! Risposte pre-compresse: ogni pagina e asset testuale viene compresso una sola
//! volta all'avvio (brotli e gzip), poi servito dalla memoria senza costi per richiesta.

use std::io::Write;

use axum::{
    body::Bytes,
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};

/// Un contenuto con le sue varianti compresse e un ETag.
pub struct Encoded {
    raw: Bytes,
    br: Option<Bytes>,
    gz: Option<Bytes>,
    etag: HeaderValue,
    content_type: HeaderValue,
    cache_control: HeaderValue,
}

impl Encoded {
    /// `compress` va disattivato per formati già compressi (woff2, png…).
    pub fn new(data: Vec<u8>, content_type: &str, cache_control: &'static str, compress: bool) -> Self {
        let etag = HeaderValue::from_str(&format!("\"{:016x}\"", fnv1a(&data)))
            .expect("etag esadecimale sempre valido");
        let (br, gz) = if compress && data.len() > 512 {
            (Some(brotli(&data)), Some(gzip(&data)))
        } else {
            (None, None)
        };
        Self {
            raw: Bytes::from(data),
            br,
            gz,
            etag,
            content_type: HeaderValue::from_str(content_type)
                .unwrap_or(HeaderValue::from_static("application/octet-stream")),
            cache_control: HeaderValue::from_static(cache_control),
        }
    }

    pub fn len(&self) -> usize {
        self.raw.len()
    }

    /// Risposta con la codifica migliore accettata dal client, oppure 304.
    pub fn respond(&self, req: &HeaderMap, status: StatusCode) -> Response {
        if status == StatusCode::OK && etag_matches(req, &self.etag) {
            let mut res = StatusCode::NOT_MODIFIED.into_response();
            res.headers_mut().insert(header::ETAG, self.etag.clone());
            res.headers_mut().insert(header::CACHE_CONTROL, self.cache_control.clone());
            return res;
        }
        let accept = req
            .get(header::ACCEPT_ENCODING)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let (body, encoding) = match (&self.br, &self.gz) {
            (Some(b), _) if accepts(accept, "br") => (b.clone(), Some("br")),
            (_, Some(g)) if accepts(accept, "gzip") => (g.clone(), Some("gzip")),
            _ => (self.raw.clone(), None),
        };
        let mut res = (status, body).into_response();
        let h = res.headers_mut();
        h.insert(header::CONTENT_TYPE, self.content_type.clone());
        h.insert(header::CACHE_CONTROL, self.cache_control.clone());
        h.insert(header::ETAG, self.etag.clone());
        if self.br.is_some() {
            h.insert(header::VARY, HeaderValue::from_static("accept-encoding"));
        }
        if let Some(enc) = encoding {
            h.insert(header::CONTENT_ENCODING, HeaderValue::from_static(enc));
        }
        res
    }
}

fn accepts(header: &str, coding: &str) -> bool {
    header.split(',').any(|part| {
        let mut it = part.split(';');
        let name = it.next().unwrap_or("").trim();
        let q_zero = it.any(|p| {
            let p = p.trim();
            p == "q=0" || p == "q=0.0" || p == "q=0.00" || p == "q=0.000"
        });
        name.eq_ignore_ascii_case(coding) && !q_zero
    })
}

fn etag_matches(req: &HeaderMap, etag: &HeaderValue) -> bool {
    let Ok(tag) = etag.to_str() else { return false };
    req.get(header::IF_NONE_MATCH)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.split(',').any(|t| t.trim().trim_start_matches("W/") == tag))
}

fn fnv1a(data: &[u8]) -> u64 {
    data.iter().fold(0xcbf2_9ce4_8422_2325, |h, b| {
        (h ^ u64::from(*b)).wrapping_mul(0x0100_0000_01b3)
    })
}

fn brotli(data: &[u8]) -> Bytes {
    let mut out = Vec::with_capacity(data.len() / 4);
    {
        let mut w = brotli::CompressorWriter::new(&mut out, 4096, 11, 22);
        w.write_all(data).expect("compressione in memoria");
    }
    Bytes::from(out)
}

fn gzip(data: &[u8]) -> Bytes {
    let mut e = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::best());
    e.write_all(data).expect("compressione in memoria");
    Bytes::from(e.finish().expect("compressione in memoria"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accept_encoding_parsing() {
        assert!(accepts("gzip, deflate, br", "br"));
        assert!(accepts("br;q=1.0, gzip;q=0.8", "gzip"));
        assert!(!accepts("gzip, br;q=0", "br"));
        assert!(!accepts("identity", "gzip"));
    }

    #[test]
    fn serves_brotli_and_304() {
        let e = Encoded::new(vec![b'a'; 4000], "text/css", "no-cache", true);
        let mut req = HeaderMap::new();
        req.insert(header::ACCEPT_ENCODING, HeaderValue::from_static("gzip, br"));
        let res = e.respond(&req, StatusCode::OK);
        assert_eq!(res.headers()[header::CONTENT_ENCODING], "br");
        req.insert(header::IF_NONE_MATCH, res.headers()[header::ETAG].clone());
        assert_eq!(e.respond(&req, StatusCode::OK).status(), StatusCode::NOT_MODIFIED);
    }
}
