//! Dati aziendali di CORE829 SRL, come pubblicati su core829.net.
//! Unica fonte per pagine, footer e dati strutturati: si aggiornano solo qui.

pub struct Contact {
    pub label: &'static str,
    pub value: &'static str,
    pub href: &'static str,
    pub note: &'static str,
}

pub struct Social {
    pub name: &'static str,
    pub url: &'static str,
}

pub struct Person {
    pub name: &'static str,
    pub initials: &'static str,
    pub role: &'static str,
}

pub struct Company {
    pub legal_name: &'static str,
    pub street: &'static str,
    pub city: &'static str,
    pub country: &'static str,
    pub country_code: &'static str,
    pub cui: &'static str,
    pub reg_com: &'static str,
    pub main_site: &'static str,
    pub email: &'static str,
    pub emails: &'static [Contact],
    pub phones: &'static [Contact],
    pub whatsapp: &'static str,
    pub whatsapp_href: &'static str,
    pub booking_url: &'static str,
    pub portal_url: &'static str,
    pub people: &'static [Person],
    pub socials: &'static [Social],
}

pub const CORE829: Company = Company {
    legal_name: "CORE829 SRL",
    street: "Str. Mihai Eminescu 10",
    city: "Roman",
    country: "România",
    country_code: "RO",
    cui: "54616345",
    reg_com: "J2026029428009",
    main_site: "https://core829.net",
    email: "hello@core829.net",
    emails: &[
        Contact {
            label: "Richieste e supporto",
            value: "hello@core829.net",
            href: "mailto:hello@core829.net",
            note: "Domande sul servizio e clienti attivi",
        },
        Contact {
            label: "Preventivi",
            value: "sales@core829.net",
            href: "mailto:sales@core829.net",
            note: "Perimetro, tempi e offerte",
        },
        Contact {
            label: "Agenzie e partner",
            value: "partnerships@core829.net",
            href: "mailto:partnerships@core829.net",
            note: "Programma partner e rivendita",
        },
        Contact {
            label: "Amministrazione",
            value: "office@core829.net",
            href: "mailto:office@core829.net",
            note: "Contratti, fatture e documenti",
        },
    ],
    phones: &[
        Contact {
            label: "Italia",
            value: "+39 375 946 8881",
            href: "tel:+393759468881",
            note: "",
        },
        Contact {
            label: "Romania",
            value: "+40 766 668 482",
            href: "tel:+40766668482",
            note: "",
        },
    ],
    whatsapp: "+40 766 231 632",
    whatsapp_href: "https://wa.me/40766231632",
    booking_url: "https://bookings.core829.net/book/intro-call?lang=it",
    portal_url: "https://portal.core829.net",
    people: &[
        Person { name: "Stefan Serban", initials: "SS", role: "Fondatore" },
        Person { name: "Vasile Serban", initials: "VS", role: "Co-fondatore" },
    ],
    socials: &[
        Social { name: "Instagram", url: "https://www.instagram.com/core829.digital/" },
        Social { name: "Facebook", url: "https://www.facebook.com/profile.php?id=61578645275966" },
        Social { name: "TikTok", url: "https://www.tiktok.com/@core829digital" },
        Social { name: "YouTube", url: "https://www.youtube.com/@core829digital" },
        Social { name: "Threads", url: "https://www.threads.com/@core829.digital" },
        Social { name: "GitHub", url: "https://github.com/core829digital" },
        Social { name: "Trustpilot", url: "https://www.trustpilot.com/review/core829.net" },
    ],
};
