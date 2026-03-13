import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve(process.cwd(), "dist");
const indexPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("dist/index.html not found. Run build first.");
  process.exit(1);
}

const baseHtml = fs.readFileSync(indexPath, "utf8");

const routes = [
  {
    slug: "multi-clinic-provider-coding",
    title: "Multi Clinic Provider Coding Tool | DeFyb",
    description:
      "One provider login across multiple clinics. Capture underbilling and coding gaps per clinic without extra admin work.",
  },
  {
    slug: "orthopedic-coding-revenue-capture",
    title: "Orthopedic Coding Revenue Capture Software | DeFyb",
    description:
      "Detect underbilling in orthopedic encounters, including post-op global period logic like 99024, with audit-ready rationale.",
  },
  {
    slug: "small-practice-underbilling-tool",
    title: "Small Practice Underbilling Detection Tool | DeFyb",
    description:
      "A coding-first tool for small practices to find underbilling, close documentation gaps, and recover revenue quickly.",
  },
];

const ensureMetaTag = (html, matcher, tag) => (matcher.test(html) ? html.replace(matcher, tag) : html.replace("</head>", `  ${tag}\n  </head>`));

const setMeta = (html, { title, description, url }) => {
  let out = html;

  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  out = ensureMetaTag(out, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${description}" />`);
  out = ensureMetaTag(out, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${title}" />`);
  out = ensureMetaTag(out, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${description}" />`);
  out = ensureMetaTag(out, /<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="website" />`);
  out = ensureMetaTag(out, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${url}" />`);
  out = ensureMetaTag(out, /<meta\s+property=["']og:site_name["'][^>]*>/i, `<meta property="og:site_name" content="DeFyb" />`);
  out = ensureMetaTag(out, /<meta\s+name=["']twitter:card["'][^>]*>/i, `<meta name="twitter:card" content="summary_large_image" />`);
  out = ensureMetaTag(out, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${title}" />`);
  out = ensureMetaTag(out, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${description}" />`);

  const canonicalTag = `<link rel="canonical" href="${url}" />`;
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(out)) {
    out = out.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonicalTag);
  } else {
    out = out.replace("</head>", `  ${canonicalTag}\n  </head>`);
  }

  return out;
};

for (const route of routes) {
  const routeUrl = `https://defyb.org/${route.slug}`;
  const routeHtml = setMeta(baseHtml, {
    title: route.title,
    description: route.description,
    url: routeUrl,
  });

  const targetDir = path.join(distDir, route.slug);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, "index.html"), routeHtml, "utf8");
}

console.log(`Generated prerendered SEO HTML for ${routes.length} routes.`);
