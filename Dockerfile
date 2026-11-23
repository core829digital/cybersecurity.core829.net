# ---- build ----
FROM rust:1.97-slim AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY templates ./templates
COPY assets ./assets
RUN cargo build --release --locked

# ---- runtime: immagine minima, utente non root ----
FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=build /app/target/release/strix-web /strix-web
ENV PORT=8080 DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/strix-web"]
