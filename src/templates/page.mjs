import { esc } from './util.mjs';
import { stage, chrome } from './scenes/chrome.mjs';
import { hero } from './scenes/hero.mjs';
import { anatomy } from './scenes/anatomy.mjs';
import { prices } from './scenes/prices.mjs';
import { works } from './scenes/works.mjs';
import { mileage } from './scenes/mileage.mjs';
import { ask, dock } from './scenes/ask.mjs';
import { finish, footer } from './scenes/finish.mjs';
import { buildFaq } from './faq.mjs';

function jsonLd(b) {
  const offers = b.services.flatMap((s) =>
    s.prices
      .filter((p) => p.amount != null)
      .map((p) => ({
        '@type': 'Offer',
        name: `${s.title}: ${p.label}`,
        itemOffered: { '@type': 'Service', name: s.title, description: s.desc },
        priceSpecification: {
          '@type': 'PriceSpecification',
          priceCurrency: 'RUB',
          ...(p.from ? { minPrice: p.amount } : { price: p.amount }),
        },
        areaServed: { '@type': 'City', name: b.city },
      }))
  );
  const business = {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    '@id': b.siteUrl + '#business',
    name: b.name,
    url: b.siteUrl,
    image: [b.ogImage, ...b.photos.map((p) => b.remoteImageBase + p.src)],
    telephone: b.phone.e164,
    description: b.seo.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: b.address.street,
      addressLocality: b.address.locality,
      addressRegion: b.address.region,
      addressCountry: b.address.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: b.geo.lat, longitude: b.geo.lon },
    hasMap: b.links.yandexMaps,
    sameAs: [b.links.yandexMaps, b.links.avito],
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: b.hours.open,
        closes: b.hours.close,
      },
    ],
    areaServed: { '@type': 'City', name: b.city },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Услуги и цены',
      itemListElement: offers,
    },
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: buildFaq(b).map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  const s = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${s(business)}</script>\n<script type="application/ld+json">${s(faq)}</script>`;
}

/**
 * opts.css     — '<link …>' или '<style>…</style>'
 * opts.js      — '<script …>' (в конце body)
 * opts.preload — строки <link rel=preload>
 */
export function page(b, opts) {
  const s = b.seo;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(s.title)}</title>
<meta name="description" content="${esc(s.description)}">
<meta name="keywords" content="${esc(s.keywords)}">
<meta name="author" content="${esc(b.name)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="${b.siteUrl}">
<meta name="yandex-verification" content="${s.yandexVerification}">
<meta name="geo.region" content="${b.address.regionCode}">
<meta name="geo.placename" content="${esc(b.city)}">
<meta name="geo.position" content="${b.geo.lat};${b.geo.lon}">
<meta name="ICBM" content="${b.geo.lat}, ${b.geo.lon}">
<meta name="theme-color" content="${s.themeColor}">
<meta name="color-scheme" content="dark light">
<meta name="format-detection" content="telephone=yes">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta property="og:site_name" content="${esc(b.name)}">
<meta property="og:title" content="${esc(s.ogTitle)}">
<meta property="og:description" content="${esc(s.ogDescription)}">
<meta property="og:url" content="${b.siteUrl}">
<meta property="og:image" content="${b.ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(b.name)} — Сарапул">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(s.ogTitle)}">
<meta name="twitter:description" content="${esc(s.twitterDescription)}">
<meta name="twitter:image" content="${b.ogImage}">
<meta name="twitter:url" content="${b.siteUrl}">
<link rel="icon" href="/favicon.ico" type="image/x-icon">
<link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/images/favicon/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
${opts.preload || ''}
${opts.css}
<script>document.documentElement.classList.add('js');try{if(sessionStorage.getItem('yd-intro'))document.documentElement.classList.add('seen')}catch(e){}</script>
${jsonLd(b)}
${opts.metrika === false ? '' : `<!-- Yandex.Metrika counter -->
<script type="text/javascript">
    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=106113716', 'ym');

    ym(106113716, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/106113716" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->`}
</head>
<body>
${stage()}
${chrome(b)}
<main id="main">
${hero(b)}
${anatomy(b)}
${prices(b)}
${works(b)}
${mileage(b)}
${ask(b)}
${finish(b)}
</main>
${footer(b)}
${dock(b)}
${opts.js}
</body>
</html>
`;
}
