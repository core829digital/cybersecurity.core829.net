//! Header di sicurezza applicati a ogni risposta.

use axum::http::{HeaderName, HeaderValue, header};
use tower::ServiceBuilder;
use tower::layer::util::{Identity, Stack};
use tower_http::set_header::SetResponseHeaderLayer;

/// CSP rigorosa: nessuno script o stile inline, nessuna risorsa di terze parti.
const CSP: &str = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; \
font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; \
form-action 'self'; object-src 'none'";

type L = SetResponseHeaderLayer<HeaderValue>;
/// Pila dei sei layer di header applicati da [`headers`].
type HeaderStack = Stack<L, Stack<L, Stack<L, Stack<L, Stack<L, Stack<L, Identity>>>>>>;

pub fn headers() -> ServiceBuilder<HeaderStack> {
    let set = |name: HeaderName, value: &'static str| {
        SetResponseHeaderLayer::if_not_present(name, HeaderValue::from_static(value))
    };
    ServiceBuilder::new()
        .layer(set(header::CONTENT_SECURITY_POLICY, CSP))
        .layer(set(header::X_CONTENT_TYPE_OPTIONS, "nosniff"))
        .layer(set(header::REFERRER_POLICY, "strict-origin-when-cross-origin"))
        .layer(set(
            header::STRICT_TRANSPORT_SECURITY,
            "max-age=63072000; includeSubDomains",
        ))
        .layer(set(
            HeaderName::from_static("permissions-policy"),
            "camera=(), microphone=(), geolocation=(), interest-cohort=()",
        ))
        .layer(set(
            HeaderName::from_static("cross-origin-opener-policy"),
            "same-origin",
        ))
}
