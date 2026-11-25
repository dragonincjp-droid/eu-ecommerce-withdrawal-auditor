# EU Withdrawal Button, EmpCo & Omnibus Store Auditor (API + MCP Server)

**Bulk-audit 1,000+ European online stores in minutes via ultra-fast, zero-browser HTTP for the 4 highest-impact 2025–2026 EU e-commerce enforcement & *Abmahnung* triggers: the mandatory EU Electronic Withdrawal Button (`Directive (EU) 2023/2673 Art. 11a` / German `BGB § 356a`), abolished EU ODR platform links (`ec.europa.eu/consumers/odr`), EU EmpCo greenwashing claims (`Directive (EU) 2024/825`), and Omnibus 30-day lowest prior price disclosures (`Directive (EU) 2019/2161 Art. 6a`).**

Outputs a deterministic `complianceScore` (`0–100`), prioritized `findings[]`, e-commerce platform fingerprint (`Shopify`, `WooCommerce`, `Shopware`, `PrestaShop`, `Magento`, etc.), neutral B2B `coldOutreachHook`, and a ready-to-paste **multilingual HTML/JS 2-step Art. 11a Withdrawal Widget + Omnibus snippet**.

Zero OpenAI/LLM keys required. Built for **Clay**, **n8n**, **Make**, **Apify Dataset Chaining (Google Maps Scraper → Compliance Audit)**, and **AI Agents via MCP (`Claude Desktop`, `Cursor`, `Windsurf`)**.

---

## Why Agencies, Shopify/Shopware Partners & Legal-Tech Teams Use This Actor

Between July 2025 and September 2026, four sweeping EU consumer-law changes hit every B2C online store selling into the European Union:

1. **Mandatory Electronic Withdrawal Button — `Directive (EU) 2023/2673 Art. 11a` / German `BGB § 356a` (Mandatory since June 19, 2026)**
   Online stores concluding distance contracts must provide a continuously visible, interactive **2-step electronic withdrawal function** (*"Withdraw from contract"* / *"Vertrag widerrufen"* → *"Confirm withdrawal"* / *"Widerruf bestätigen"*). Static `Widerrufsbelehrung` prose, downloadable `.pdf` forms, or forcing guest shoppers through `/account/login` create immediate regulatory and *Abmahnung* exposure.
2. **Abolished EU ODR Link Trap — `Regulation (EU) 2024/3228` (Shut Down July 20, 2025)**
   The European Commission permanently shut down `ec.europa.eu/consumers/odr` on July 20, 2025. Tens of thousands of EU stores still leave the dead ODR link in their `Impressum` or `AGB`/`Terms` — a crystal-clear, 100% factual outreach opener for agencies.
3. **EU EmpCo Anti-Greenwashing Rules — `Directive (EU) 2024/825` (Mandatory since September 27, 2026)**
   Generic environmental claims (*"eco-friendly"*, *"climate neutral"*, *"klimaneutral"*, *"100% sustainable"*, *"éco-responsable"*) without recognized third-party certification (`EU Ecolabel`, `Blauer Engel`, `GOTS`, `OEKO-TEX`, `FSC`, `B Corp`, `ISO 14024`) — and carbon-offsetting neutrality claims — face strict enforcement across EU member states.
4. **EU Omnibus 30-Day Lowest Prior Price — `Directive (EU) 2019/2161 Art. 6a` / `PAngV § 11`**
   Strike-through and `compare-at` discounts must clearly state the lowest price applied within the preceding 30 days.

### Agency & Outbound Lead-Gen ROI Math

| Metric | Manual Storefront Review | Bulk HTTP Audit (`healthy_addax/eu-withdrawal-omnibus-auditor`) |
| :--- | :--- | :--- |
| **1,000 E-Commerce Stores Audited** | ~160 hours of manual checking | **~3–6 minutes (zero-Playwright HTTP engine)** |
| **Cost for 1,000 Stores** | €4,000+ analyst time | **`$15.005`** (audit + hooks) or **`$25.005`** (with HTML/JS fix packs) |
| **Deliverables Included** | Spreadsheet notes | **Exact broken page URLs + neutral outreach hook + localized 2-step HTML/JS widget** |
| **Apify Free Tier (`$5.00/mo` credit)** | — | **Audit ~199 to ~333 stores every month for `$0`** |

> **Fair Pay-Per-Event Billing Guarantee:**
> - Invalid URLs, unreachable stores, `robots.txt`-disallowed pages, and SSRF-blocked targets are **never billed (`$0`)**.
> - `remediation-pack-generated` (`$0.01`) is **only billed when `includeRemediationPack: true` AND at least one compliance gap is found** — compliant stores with zero findings are never charged for snippets they don't need!

---

## Core Checks Per Store

For every target URL (accepts both full URLs like `https://shop.example.de` and bare domains like `shop.example.de`), the Actor inspects the homepage plus up to `maxLegalPagesPerDomain` (default `3`, max `5`) auto-discovered internal same-origin pages (`Withdrawal`, `Impressum`, `AGB`/`Terms`, `Returns`, `Sale`/`Product`):

1. **Multilingual Art. 11a Electronic Withdrawal Flow (`EN`, `DE`, `FR`, `ES`, `IT`, `NL`, `PL`)**
   - Distinguishes **`compliant_2step`** (interactive trigger + Step-2 confirmation control like `Widerruf bestätigen` / `Confirm withdrawal`) vs. **`login_walled`** (redirects to `/account/login`, `/customer/account/login`, `/wp-login.php`) vs. **`partial_single_step`** vs. **`static_policy_or_pdf_only`** vs. **`missing`**.
2. **Dead EU ODR Portal Scanner (`ec.europa.eu/consumers/odr`)**
   - Pinpoints the exact `Impressum` or `Terms` subpage still linking to the abolished ODR platform.
3. **EmpCo Generic Green Claims vs. Recognized Ecolabels**
   - Quotes up to 5 matched phrases (*"climate neutral"*, *"klimaneutral"*, *"eco-friendly"*, etc.) and cross-checks against `EU Ecolabel`, `Blauer Engel`, `Nordic Swan`, `GOTS`, `OEKO-TEX`, `FSC`, `PEFC`, `B Corp`, `Cradle to Cradle`, and `ISO 14024`.
4. **Omnibus 30-Day Reference Price Verification**
   - Detects `<del>`, `<s>`, `compare-at`, `compare_at_price`, `was €`, `statt `, `UVP `, `old-price`, and `price--compare`, then verifies whether 30-day lowest price wording (`30 days`, `30 Tage`, `niedrigster Gesamtpreis`, `30 derniers jours`, `30 días`, `30 giorni`, `30 dagen`, `30 dni`) appears alongside discounts.
5. **Platform Fingerprinting & Legal Link Discovery**
   - Identifies `shopify`, `woocommerce`, `shopware`, `prestashop`, `magento`, `bigcommerce`, `wix`, `squarespace`, or `custom`, and extracts `impressumUrl`, `withdrawalPolicyUrl`, `termsUrl`, and `privacyUrl`.

---

## Input Parameters

| Field | Type | Default | Description |
| :--- | :--- | :---: | :--- |
| `urls` | `string[]` / RequestList | `["https://example.com"]` | Store URLs or bare domains (`"shop.example.de"` or `"https://shop.example.de"`). |
| `url` | `string` | *Optional* | Single store URL/domain shorthand for Clay HTTP columns, webhooks, or MCP calls. |
| `datasetId` | `string` | *Optional* | Upstream Apify Dataset ID (e.g. from **Google Maps Scraper**) to auto-import store websites and deduplicate with `urls`. |
| `datasetUrlField` | `string` | *Auto-detect* | Optional field override for `datasetId` items (auto-detects `website`, `url`, `domain`, `shopUrl`, `storeUrl`). |
| `maxLegalPagesPerDomain` | `integer` | `3` | Max discovered internal same-origin subpages fetched per store (`0–5`). |
| `includeRemediationPack` | `boolean` | `true` | Generates ready-to-paste multilingual 2-step Art. 11a HTML/JS widget + Omnibus snippet when findings exist (`+$0.01/store`). |
| `checkWithdrawalButton` | `boolean` | `true` | Audit Directive (EU) 2023/2673 Art. 11a / BGB § 356a Electronic Withdrawal Button. |
| `checkAbolishedOdrLink` | `boolean` | `true` | Audit abolished `ec.europa.eu/consumers/odr` links (Regulation (EU) 2024/3228). |
| `checkEmpCoGreenClaims` | `boolean` | `true` | Audit generic green claims vs. third-party ecolabels (Directive (EU) 2024/825). |
| `checkOmnibusPricing` | `boolean` | `true` | Audit discount indicators vs. 30-day lowest prior price wording (Directive 2019/2161 Art. 6a). |
| `respectRobotsTxt` | `boolean` | `true` | Respect domain `/robots.txt` rules before fetching pages. |
| `maxUrls` | `integer` | `100` | Safety ceiling on total stores audited in one run (`1–5000`). |
| `maxConcurrency` | `integer` | `5` | Parallel store HTTP workers (`1–20`). |
| `domainDelayMs` | `integer` | `300` | Polite delay in milliseconds between requests to the same hostname (`0–30000`). |
| `requestTimeoutMs` | `integer` | `12000` | Strict timeout per HTTP request in milliseconds (`2000–60000`). |

### Sample Input JSON

```json
{
  "urls": [
    "fashion-muster-shop.de",
    "https://maison-exemple.fr"
  ],
  "maxLegalPagesPerDomain": 3,
  "includeRemediationPack": true,
  "respectRobotsTxt": true,
  "maxConcurrency": 5
}
```

---

## Output Dataset Sample (JSON)

```json
{
  "url": "fashion-muster-shop.de",
  "normalizedInputUrl": "https://fashion-muster-shop.de",
  "finalUrl": "https://fashion-muster-shop.de/",
  "domain": "fashion-muster-shop.de",
  "auditedAt": "2026-11-24T14:25:00.000Z",
  "status": "audited",
  "httpStatus": 200,
  "pageTitle": "Muster Mode GmbH — Offizieller Online-Shop",
  "detectedLanguage": "de",
  "ecommercePlatform": "shopify",
  "loadTimeMs": 185,
  "pagesFetchedCount": 3,
  "pagesFetched": [
    "https://fashion-muster-shop.de/",
    "https://fashion-muster-shop.de/pages/impressum",
    "https://fashion-muster-shop.de/pages/widerrufsbelehrung"
  ],
  "errorMessage": null,
  "complianceScore": 5,
  "riskTier": "CRITICAL",
  "withdrawalStatus": "static_policy_or_pdf_only",
  "withdrawalButtonFound": false,
  "withdrawalTwoStepCompliant": false,
  "withdrawalLoginWallDetected": false,
  "abolishedOdrLinkFound": true,
  "unsubstantiatedGreenClaimsFound": true,
  "omnibusViolationFound": true,
  "impressumUrl": "https://fashion-muster-shop.de/pages/impressum",
  "withdrawalPolicyUrl": "https://fashion-muster-shop.de/pages/widerrufsbelehrung",
  "termsUrl": "https://fashion-muster-shop.de/pages/agb",
  "privacyUrl": "https://fashion-muster-shop.de/pages/datenschutz",
  "findingsCount": 4,
  "findings": [
    {
      "ruleId": "EU-2023-2673-ART11A-STATIC-ONLY",
      "title": "Static Withdrawal Policy / PDF Only — No Interactive Electronic Withdrawal Button",
      "regulation": "Directive (EU) 2023/2673 Art. 11a / German BGB § 356a (mandatory since June 19, 2026)",
      "severity": "HIGH",
      "pageUrl": "https://fashion-muster-shop.de/pages/widerrufsbelehrung",
      "evidence": "Static withdrawal policy prose (e.g. Widerrufsbelehrung) was found, but no interactive electronic 2-step withdrawal button or online submission form was detected.",
      "recommendation": "Supplement your static withdrawal policy with an interactive 2-step electronic withdrawal widget (\"Vertrag widerrufen\" + \"Widerruf bestätigen\") that guests can submit directly online."
    },
    {
      "ruleId": "EU-2024-3228-ABOLISHED-ODR-LINK",
      "title": "Outdated Link to Permanently Discontinued EU ODR Platform (ec.europa.eu/consumers/odr)",
      "regulation": "Regulation (EU) 2024/3228 repealing Regulation (EU) No 524/2013 (EU ODR platform shut down July 20, 2025)",
      "severity": "HIGH",
      "pageUrl": "https://fashion-muster-shop.de/pages/impressum",
      "evidence": "Found 1 reference(s) to \"https://ec.europa.eu/consumers/odr\" on: https://fashion-muster-shop.de/pages/impressum.",
      "recommendation": "Remove all links and boilerplate references to ec.europa.eu/consumers/odr from Impressum, AGB/Terms, and footer templates."
    }
  ],
  "coldOutreachHook": "While running a technical storefront check on your Shopify store (fashion-muster-shop.de), we noticed only a static withdrawal policy/PDF was detected without an interactive 2-step electronic withdrawal button, and a link to the discontinued EU ODR portal (ec.europa.eu/consumers/odr, shut down July 2025) still appears on the site (plus 2 additional storefront signals) — happy to share the technical checklist and ready-to-paste HTML/JS widget if useful for your team.",
  "remediationPackGenerated": true,
  "remediationPack": {
    "targetLocale": "de",
    "ecommercePlatform": "shopify",
    "withdrawalWidgetHtmlJs": "<!-- EU Directive (EU) 2023/2673 Art. 11a / BGB § 356a 2-Step Electronic Withdrawal Widget ... -->",
    "omnibusPriceSnippetHtml": "<!-- EU Omnibus Directive (EU) 2019/2161 Art. 6a — Shopify Liquid 30-Day Lowest Price Block ... -->",
    "odrCleanupGuidance": "Remove outdated link(s) (https://ec.europa.eu/consumers/odr)...",
    "empCoClaimsGuidance": "Review generic sustainability wording...",
    "implementationNotes": [
      "Place the Step-1 withdrawal trigger in your global storefront footer/header so guest shoppers can access it without logging into an account."
    ]
  },
  "recommendedNextActors": [
    {
      "actorSlug": "healthy_addax/wcag-eaa-ada-auditor",
      "actorUrl": "https://apify.com/healthy_addax/wcag-eaa-ada-auditor",
      "mcpEndpointUrl": "https://mcp.apify.com/?tools=healthy_addax/wcag-eaa-ada-auditor",
      "reason": "Pair your EU Withdrawal/Omnibus storefront check on fashion-muster-shop.de with a full headless Chromium WCAG 2.2 Level AA, European Accessibility Act (EAA / BFSG), and Accessibility Overlay (accessiBe/UserWay) audit with red-box visual screenshot proof."
    }
  ],
  "disclaimer": "Automated technical heuristic signals for human review only; does not constitute legal advice or formal regulatory certification."
}
```

---

## Connect as an AI Agent MCP Tool (`Claude Desktop`, `Cursor`, `Windsurf`)

This Actor natively runs an **Apify Standby Streamable HTTP MCP Server** (`/mcp`) exposing the `audit_eu_ecommerce_compliance` tool, and works out-of-the-box with Apify's hosted MCP gateway:

- **Hosted Apify MCP URL**: `https://mcp.apify.com/?tools=healthy_addax/eu-withdrawal-omnibus-auditor`

### `claude_desktop_config.json` / `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "eu-ecommerce-compliance": {
      "url": "https://mcp.apify.com/?tools=healthy_addax/eu-withdrawal-omnibus-auditor",
      "headers": {
        "Authorization": "Bearer <YOUR_APIFY_TOKEN>"
      }
    }
  }
}
```

Example prompt in Claude / Cursor:
> *"Use `audit_eu_ecommerce_compliance` to check `shop.example.de` for the June 2026 EU Withdrawal Button, dead ODR links, EmpCo green claims, and Omnibus pricing, then adapt the returned German 2-step HTML/JS widget for our Shopify theme."*

---

## Zero-Code Automation Recipes (Google Maps Chaining, Clay & n8n)

### 1. Google Maps Scraper → EU Compliance Lead Pipeline (`datasetId` Chaining)
1. Run `compass/crawler-google-places` (or any e-commerce lead scraper) for *"Online Shop Berlin"*, *"Modehaus München"*, or *"Boutique Paris"*.
2. Copy the resulting `defaultDatasetId` and pass it directly into this Actor's `datasetId` input:
   ```json
   {
     "datasetId": "your_google_maps_dataset_id",
     "includeRemediationPack": true,
     "maxUrls": 500
   }
   ```
3. The Actor automatically extracts `website` / `url` / `domain` columns, deduplicates domains, audits all stores in minutes, and outputs `coldOutreachHook` + `riskTier` ready for **Smartlead** or **Instantly**.

### 2. Clay HTTP Action Column (Real-Time Row Enrichment)
Use **HTTP API** in Clay pointing to synchronous run-and-get-dataset-items:
- **Method**: `POST`
- **URL**: `https://api.apify.com/v2/acts/healthy_addax~eu-withdrawal-omnibus-auditor/run-sync-get-dataset-items?token=<YOUR_APIFY_TOKEN>`
- **Body**:
  ```json
  {
    "url": "{{domain}}",
    "includeRemediationPack": false,
    "maxLegalPagesPerDomain": 3
  }
  ```
- Map `[0].complianceScore`, `[0].withdrawalStatus`, `[0].abolishedOdrLinkFound`, and `[0].coldOutreachHook` straight into your outbound sequence!

### 3. n8n Scheduled Lead-Gen + Full Visual EAA Upsell Pipeline
1. **Trigger / Lead Source** → `POST` batch of 200 store domains to `healthy_addax/eu-withdrawal-omnibus-auditor` (`$0.015/store` fast HTTP pre-qualification).
2. **Filter Node** → Keep stores where `riskTier == "CRITICAL"` or `abolishedOdrLinkFound == true`.
3. **Visual Proof Step (Sister Actor)** → Pass high-value prospects to **[WCAG 2.2, EAA & ADA Accessibility Auditor (Overlay + MCP)](https://apify.com/healthy_addax/wcag-eaa-ada-auditor)** (`healthy_addax/wcag-eaa-ada-auditor`) to capture a real Chromium **red-box annotated PNG screenshot** + EAA `Barrierefreiheitserklärung` & `accessiBe`/`UserWay` overlay audit!

---

## Pair With Our Sister Actor for Full EU Digital Compliance Coverage

| Compliance Layer | Actor | Engine & Speed |
| :--- | :--- | :--- |
| **EU Withdrawal Button (`Art. 11a`), Dead ODR Links, EmpCo Green Claims & Omnibus Pricing** | **`healthy_addax/eu-withdrawal-omnibus-auditor`** *(This Actor)* | **Zero-Playwright Pinned HTTP** (~150–400ms/store, `$0.015`/store) |
| **WCAG 2.2 Level AA, European Accessibility Act (EAA / BFSG), Overlay Widgets & Red-Box Visual Screenshots** | **[`healthy_addax/wcag-eaa-ada-auditor`](https://apify.com/healthy_addax/wcag-eaa-ada-auditor)** | **Headless Chromium + `axe-core`** (Red-box PNG visual proof + HTML diffs) |

---

## Security & Operational Guarantees

- **Zero-Browser Attack Surface & Low Memory**: Runs on `apify/actor-node:22` (`256 MB` min RAM) with zero headless browser overhead and deterministic parsing.
- **Anti-DNS-Rebinding & 128-Bit IPv6 SSRF Protection**: Every hostname is validated against private IPv4/IPv6 ranges and cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`, IPv4-mapped/NAT64/6to4 IPv6), with resolved safe IPs **pinned directly at the Node TCP socket `lookup` layer** and validated across every HTTP redirect hop (max 5 hops).
- **Bounded Memory & Polite Crawling**: Responses are capped at `2 MB` (both wire and decompressed gzip/deflate/brotli) with `12s` strict timeouts, `robots.txt` compliance, and per-domain rate limiting.

---

## Legal Disclaimer

> **Automated technical heuristic signals for human review only; does not constitute legal advice or formal regulatory certification.**
>
> Static/HTTP HTML inspection identifies publicly visible markup, links, forms, and text patterns on inspected pages. Dynamic client-rendered SPAs, post-checkout customer portals, or jurisdiction-specific legal exemptions require human verification and review by qualified legal counsel.
