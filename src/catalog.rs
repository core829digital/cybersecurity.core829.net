//! Listino dei servizi mostrato in home, servizi e prezzi.

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

/// Gruppo di domande frequenti.
pub struct FaqGroup {
    pub title: &'static str,
    pub items: &'static [(&'static str, &'static str)],
}

/// Domande frequenti: usate dalla pagina FAQ e dai suoi dati strutturati.
pub const FAQ: &[FaqGroup] = &[
    FaqGroup {
        title: "Il servizio",
        items: &[
            ("Cos'è un penetration test?", "È un attacco simulato e autorizzato al tuo sito o alla tua applicazione. Serve a scoprire le vulnerabilità prima che le trovi un attaccante vero, con le prove di come si possono sfruttare e le indicazioni per correggerle."),
            ("Che differenza c'è con uno scanner automatico?", "Uno scanner segnala ciò che potrebbe essere un problema, con molti falsi allarmi. I nostri agenti invece provano a sfruttare davvero ogni falla e la riportano solo se ci riescono, con la prova. In più ragionano sulla logica del tuo sito, per esempio su come funzionano carrello, ruoli e permessi."),
            ("Sostituisce un penetration test manuale?", "Per la maggior parte di siti, e-commerce e web app offre una copertura ampia, in tempi e a costi molto più bassi. Ogni risultato è rivisto dal team CORE829. Per sistemi ad altissimo rischio possiamo affiancare verifiche manuali mirate: lo valutiamo insieme nel preventivo."),
            ("Cosa serve da parte mia?", "L'indirizzo del sistema, la firma dell'autorizzazione e un referente tecnico. Per i test con login ci servono utenti di prova. Per la revisione del codice, l'accesso in sola lettura al repository."),
        ],
    },
    FaqGroup {
        title: "Legalità e sicurezza",
        items: &[
            ("È legale attaccare un sito?", "Sì, se c'è l'autorizzazione del titolare. Per questo ogni test parte solo dopo la firma della lettera di incarico, che stabilisce cosa possiamo testare, quando e con quali limiti, e dopo aver verificato che il dominio sia tuo. Senza autorizzazione non lavoriamo."),
            ("Posso far testare un sito che non è mio?", "Solo se il titolare ti autorizza per iscritto, per esempio se sei l'agenzia che lo gestisce. In quel caso la lettera di incarico la firma anche il titolare."),
            ("Il test può bloccare o danneggiare il mio sito?", "I test sono non distruttivi: non cancelliamo dati e non facciamo attacchi di saturazione. Lavoriamo nelle finestre orarie che scegli tu e possiamo escludere le parti più delicate. Per i sistemi critici consigliamo di testare un ambiente di prova identico a quello reale."),
            ("Che fine fanno le informazioni sulle vulnerabilità?", "Sono riservate: le condividiamo solo con i referenti indicati da te, con consegna cifrata e accordo di riservatezza. I dati restano su server in UE e vengono cancellati al termine del periodo concordato."),
        ],
    },
    FaqGroup {
        title: "Tempi e costi",
        items: &[
            ("Quanto tempo ci vuole?", "Dipende dal perimetro. Un check-up si chiude in genere in pochi giorni dalla firma; un test completo su una web app richiede di più. I tempi esatti sono indicati nel preventivo."),
            ("Quanto costa?", "Il Check-up parte da 490 €, il Pentest completo da 1.490 €, la Protezione continua da 390 € al mese, IVA esclusa. Il preventivo definitivo dipende dal perimetro e te lo confermiamo per iscritto prima di iniziare."),
            ("Ogni quanto conviene ripetere il test?", "Almeno una volta l'anno e dopo ogni modifica importante, come un nuovo checkout, un'area riservata o un'integrazione. Con la Protezione continua i test seguono i tuoi rilasci."),
            ("Entro quanto mi rispondete?", "Entro 24–48 ore lavorative dalla richiesta, con una proposta di perimetro e preventivo."),
        ],
    },
];
