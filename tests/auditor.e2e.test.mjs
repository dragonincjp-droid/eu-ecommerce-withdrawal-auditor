import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

const execFileAsync = promisify(execFile);

import { ApifyRuntimeAdapter } from '../dist/apifyRuntime.js';
import { coerceUrlCandidate, normalizeAuditInput, runBatchAudit } from '../dist/auditor.js';
import { DEFAULT_MAX_RESPONSE_BYTES, fetchSafeHttp } from '../dist/httpClient.js';
import { startStandbyServer } from '../dist/server.js';
import { classifyIpAddress, validateUrlAgainstSsrf } from '../dist/ssrf.js';
import { LEGAL_DISCLAIMER } from '../dist/types.js';

const NON_COMPLIANT_HOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>UrbanGlow Berlin — Official Shopify Store</title>
  <script src="https://cdn.shopify.com/s/files/1/0001/t/1/assets/theme.js"></script>
</head>
<body>
  <header>
    <nav>
      <a href="/collections/all">Shop All</a>
      <a href="/pages/impressum">Impressum</a>
      <a href="/pages/terms">Terms &amp; Conditions</a>
      <a href="/pages/privacy">Privacy Policy</a>
    </nav>
  </header>
  <main class="shopify-section">
    <h1>100% Sustainable &amp; Climate Neutral Streetwear</h1>
    <p>Every hoodie is eco-friendly and shipped completely carbon neutral across Europe.</p>
    <div class="product-card">
      <h2>Organic Oversized Hoodie</h2>
      <span class="sale-price">€59.00</span>
      <del class="compare-at-price">€89.00</del>
    </div>
  </main>
  <footer>
    <a href="/pages/impressum">Impressum</a> |
    <a href="/pages/terms">Terms</a> |
    <a href="/pages/privacy">Privacy</a>
  </footer>
</body>
</html>`;

const NON_COMPLIANT_IMPRESSUM_HTML = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>Impressum — UrbanGlow Berlin</title></head>
<body>
  <h1>Impressum</h1>
  <p>UrbanGlow GmbH, Musterstraße 12, 10115 Berlin</p>
  <p>Online-Streitbeilegung gemäß Art. 14 Abs. 1 ODR-VO: Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit, die Sie unter
    <a href="https://ec.europa.eu/consumers/odr">https://ec.europa.eu/consumers/odr</a> finden.
  </p>
</body>
</html>`;

const COMPLIANT_HOME_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>AlpenWerk Naturtextilien — Shopware Store</title>
  <link rel="stylesheet" href="/bundles/storefront/assets/css/all.css">
</head>
<body class="sw-cms">
  <header>
    <nav>
      <a href="/kollektion">Kollektion</a>
      <a href="/vertrag-widerrufen">Vertrag hier widerrufen</a>
    </nav>
  </header>
  <main>
    <h1>Umweltfreundliche Merinowolle — Zertifiziert mit dem EU Ecolabel</h1>
    <p>Unsere Produkte tragen das offizielle EU Ecolabel (ISO 14024 Typ I Umweltzeichen) sowie GOTS.</p>
    <section class="product-box">
      <h2>Merino Strickjacke</h2>
      <span class="price-current">39,90 €</span>
      <del>49,90 €</del>
      <p class="omnibus-note">Niedrigster Gesamtpreis der letzten 30 Tage vor der Preisermäßigung: 44,90 €</p>
    </section>
  </main>
  <footer>
    <a href="/impressum">Impressum</a> |
    <a href="/agb">AGB</a> |
    <a href="/datenschutz">Datenschutz</a> |
    <a href="/vertrag-widerrufen" class="widerrufsbutton">Vertrag hier widerrufen</a>
  </footer>
</body>
</html>`;

const COMPLIANT_WITHDRAWAL_PAGE_HTML = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>Elektronischer Vertragswiderruf — AlpenWerk</title></head>
<body>
  <h1>Vertrag hier widerrufen (BGB § 356a)</h1>
  <p>Sie können Ihren Vertrag hier ohne Kundenkonto elektronisch widerrufen.</p>
  <form id="widerruf-form" action="/api/widerruf" method="post">
    <label for="orderNumber">Bestellnummer</label>
    <input id="orderNumber" name="orderNumber" type="text" required>
    <label for="email">E-Mail-Adresse für die Eingangsbestätigung</label>
    <input id="email" name="email" type="email" required>
    <button type="submit" id="widerruf-bestaetigen" data-withdrawal-step="2">Widerruf bestätigen</button>
  </form>
</body>
</html>`;

const COMPLIANT_IMPRESSUM_HTML = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>Impressum — AlpenWerk</title></head>
<body>
  <h1>Impressum</h1>
  <p>AlpenWerk GmbH, München. Zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle sind wir nach § 36 VSBG nicht verpflichtet.</p>
</body>
</html>`;

const LOGIN_WALLED_HOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>LockedCart Store</title></head>
<body>
  <main><h1>Welcome to LockedCart</h1></main>
  <footer>
    <a href="/withdraw-contract">Withdraw from contract</a>
    <a href="/privacy">Privacy Policy</a>
  </footer>
</body>
</html>`;

const ACCOUNT_LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Customer Login</title></head>
<body>
  <h1>Sign in to your account</h1>
  <form action="/account/login" method="post">
    <input type="email" name="email" placeholder="Email">
    <input type="password" name="password" placeholder="Password">
    <button type="submit">Sign In</button>
  </form>
</body>
</html>`;

const STATIC_PDF_ONLY_HTML = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>Klassik Versandhaus</title></head>
<body>
  <main><h1>Willkommen</h1></main>
  <footer>
    <a href="/widerrufsformular.pdf">Widerrufsbelehrung &amp; Muster-Widerrufsformular (PDF)</a>
  </footer>
</body>
</html>`;

function listenLocalServer(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      resolve({
        server: srv,
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((r) => srv.close(r)),
      });
    });
  });
}

describe('EU Withdrawal Button, EmpCo & Omnibus Store Auditor — Full Offline E2E Suite', () => {
  const servers = [];
  let badShopUrl = '';
  let compliantShopUrl = '';
  let loginWallShopUrl = '';
  let staticPdfShopUrl = '';
  let robotsBlockedShopUrl = '';
  let tempStorageDir = '';
  let previousStorageEnv;

  before(async () => {
    process.env.ALLOW_LOCALHOST_FOR_TESTS = '1';
    previousStorageEnv = process.env.APIFY_LOCAL_STORAGE_DIR;
    tempStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eu-auditor-e2e-'));
    process.env.APIFY_LOCAL_STORAGE_DIR = tempStorageDir;

    // 1. Non-compliant webshop (serves gzip-compressed homepage + dead ODR on /pages/impressum + redirect-imds + huge 3.5MB page)
    const badSrv = await listenLocalServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      if (urlPath === '/robots.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('User-agent: *\nAllow: /\n');
        return;
      }
      if (urlPath === '/') {
        const gz = zlib.gzipSync(Buffer.from(NON_COMPLIANT_HOME_HTML, 'utf8'));
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Encoding': 'gzip',
        });
        res.end(gz);
        return;
      }
      if (urlPath === '/pages/impressum') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(NON_COMPLIANT_IMPRESSUM_HTML);
        return;
      }
      if (urlPath === '/pages/terms' || urlPath === '/pages/privacy') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Legal</h1></body></html>');
        return;
      }
      if (urlPath === '/redirect-imds') {
        res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
        res.end();
        return;
      }
      if (urlPath === '/oversized') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body>' + 'A'.repeat(3.2 * 1024 * 1024) + '</body></html>');
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    });
    servers.push(badSrv);
    badShopUrl = badSrv.baseUrl;

    // 2. Compliant German webshop (serves brotli-compressed homepage + 2-step /vertrag-widerrufen)
    const goodSrv = await listenLocalServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      if (urlPath === '/robots.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('User-agent: *\nAllow: /\n');
        return;
      }
      if (urlPath === '/') {
        const br = zlib.brotliCompressSync(Buffer.from(COMPLIANT_HOME_HTML, 'utf8'));
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Encoding': 'br',
        });
        res.end(br);
        return;
      }
      if (urlPath === '/vertrag-widerrufen') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(COMPLIANT_WITHDRAWAL_PAGE_HTML);
        return;
      }
      if (urlPath === '/impressum' || urlPath === '/agb' || urlPath === '/datenschutz') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(COMPLIANT_IMPRESSUM_HTML);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    servers.push(goodSrv);
    compliantShopUrl = goodSrv.baseUrl;

    // 3. Login-walled webshop (/withdraw-contract -> 302 /account/login)
    const loginSrv = await listenLocalServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      if (urlPath === '/robots.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('User-agent: *\nAllow: /\n');
        return;
      }
      if (urlPath === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(LOGIN_WALLED_HOME_HTML);
        return;
      }
      if (urlPath === '/withdraw-contract') {
        res.writeHead(302, { Location: '/account/login?return_url=/withdraw-contract' });
        res.end();
        return;
      }
      if (urlPath === '/account/login') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(ACCOUNT_LOGIN_HTML);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body>Privacy</body></html>');
    });
    servers.push(loginSrv);
    loginWallShopUrl = loginSrv.baseUrl;

    // 4. Static PDF withdrawal only shop
    const pdfSrv = await listenLocalServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      if (urlPath === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(STATIC_PDF_ONLY_HTML);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    servers.push(pdfSrv);
    staticPdfShopUrl = pdfSrv.baseUrl;

    // 5. robots.txt Disallow: / shop
    const robotsSrv = await listenLocalServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      if (urlPath === '/robots.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('User-agent: *\nDisallow: /\n');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body>Should not be fetched</body></html>');
    });
    servers.push(robotsSrv);
    robotsBlockedShopUrl = robotsSrv.baseUrl;
  });

  after(async () => {
    for (const s of servers) {
      await s.close();
    }
    if (previousStorageEnv === undefined) {
      delete process.env.APIFY_LOCAL_STORAGE_DIR;
    } else {
      process.env.APIFY_LOCAL_STORAGE_DIR = previousStorageEnv;
    }
    if (tempStorageDir) {
      fs.rmSync(tempStorageDir, { recursive: true, force: true });
    }
  });

  it('1. Bare domain normalization & SSRF / Anti-DNS-Rebinding guard block IMDS, RFC1918, IPv6 mapped, and metadata hosts', async () => {
    assert.equal(coerceUrlCandidate('shop.example.de'), 'https://shop.example.de');
    assert.equal(coerceUrlCandidate('https://shop.example.de/agb'), 'https://shop.example.de/agb');
    assert.equal(coerceUrlCandidate('file:///etc/passwd'), 'file:///etc/passwd');

    for (const blockedTarget of [
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1/admin',
      'http://192.168.1.1/',
      'http://172.16.5.4/',
      'http://[::ffff:169.254.169.254]/latest/meta-data/',
      'http://[0:0:0:0:0:ffff:169.254.169.254]/',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://127.0.0.1:8080/',
      'http://localhost:3000/',
      'http://[::1]:4321/',
      'file:///etc/passwd',
    ]) {
      const check = await validateUrlAgainstSsrf(blockedTarget, { allowLocalhost: false });
      assert.equal(check.allowed, false, `Expected SSRF guard to block ${blockedTarget}`);
    }

    assert.equal(classifyIpAddress('93.184.216.34', false).allowed, true);
    assert.equal(classifyIpAddress('2606:4700:4700::1111', false).allowed, true);

    // DNS rebinding attempt (one public IP + one internal IP) must be rejected
    const rebind = await validateUrlAgainstSsrf('https://evil-rebind.example.com', {
      allowLocalhost: false,
      dnsLookup: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '169.254.169.254', family: 4 },
      ],
    });
    assert.equal(rebind.allowed, false);

    // 2MB hard response cap check
    const oversized = await fetchSafeHttp(`${badShopUrl}/oversized`, { allowLocalhost: true });
    assert.equal(oversized.ok, true);
    assert.equal(oversized.truncated, true);
    assert.equal(oversized.byteLength, DEFAULT_MAX_RESPONSE_BYTES);
  });

  it('2. Non-compliant webshop: flags all 4 EU violations, generates multilingual HTML/JS remediation pack & outreach hook, and bills exact PPE events', async () => {
    const runtime = new ApifyRuntimeAdapter();
    const res = await runBatchAudit(
      {
        urls: [badShopUrl],
        includeRemediationPack: true,
        maxLegalPagesPerDomain: 3,
        domainDelayMs: 0,
      },
      { runtime, allowLocalhost: true },
    );

    assert.equal(res.items.length, 1);
    const shop = res.items[0];
    assert.equal(shop.status, 'audited');
    assert.equal(shop.ecommercePlatform, 'shopify');
    assert.ok(shop.pagesFetchedCount >= 2, 'Should fetch homepage + discovered /pages/impressum');

    // Verify all 4 regulatory issues are flagged
    assert.equal(shop.withdrawalButtonFound, false);
    assert.equal(shop.withdrawalStatus, 'missing');
    assert.equal(shop.abolishedOdrLinkFound, true);
    assert.ok(shop.odrLinkCheck.odrUrls.some((u) => u.includes('ec.europa.eu/consumers/odr')));
    assert.equal(shop.unsubstantiatedGreenClaimsFound, true);
    assert.ok(
      shop.empCoGreenClaimsCheck.matchedGenericClaims.some((c) => /climate neutral/i.test(c)),
    );
    assert.equal(shop.omnibusViolationFound, true);

    const ruleIds = shop.findings.map((f) => f.ruleId);
    assert.ok(ruleIds.includes('EU-2023-2673-ART11A-MISSING'));
    assert.ok(ruleIds.includes('EU-2024-3228-ABOLISHED-ODR-LINK'));
    assert.ok(ruleIds.includes('EU-2024-825-EMPCO-UNSUBSTANTIATED-GREEN-CLAIM'));
    assert.ok(ruleIds.includes('EU-2019-2161-OMNIBUS-PRIOR-PRICE-MISSING'));

    assert.equal(shop.complianceScore, 0);
    assert.equal(shop.riskTier, 'CRITICAL');

    // Outreach hook, remediation pack, sister Actor recommendation & disclaimer
    assert.match(shop.coldOutreachHook, /Shopify store/i);
    assert.equal(shop.remediationPackGenerated, true);
    assert.ok(shop.remediationPack);
    assert.match(shop.remediationPack.withdrawalWidgetHtmlJs, /Confirm withdrawal/i);
    assert.match(shop.remediationPack.omnibusPriceSnippetHtml, /compare_at_price/);
    assert.equal(
      shop.recommendedNextActors[0].actorSlug,
      'healthy_addax/wcag-eaa-ada-auditor',
    );
    assert.equal(shop.disclaimer, LEGAL_DISCLAIMER);

    // Exact PPE billing: actor-start ($0.005) + url-audited ($0.015) + remediation-pack-generated ($0.01) = $0.03
    assert.equal(res.billing.chargedCounts['actor-start'], 1);
    assert.equal(res.billing.chargedCounts['url-audited'], 1);
    assert.equal(res.billing.chargedCounts['remediation-pack-generated'], 1);
    assert.equal(res.billing.estimatedTotalUsd, 0.03);
  });

  it('3. Compliant German webshop: detects 2-step Vertrag hier widerrufen + Widerruf bestätigen, EU Ecolabel & 30-day Omnibus price -> score 100, LOW risk', async () => {
    const runtime = new ApifyRuntimeAdapter();
    const res = await runBatchAudit(
      {
        urls: [compliantShopUrl],
        includeRemediationPack: true,
        maxLegalPagesPerDomain: 3,
        domainDelayMs: 0,
      },
      { runtime, allowLocalhost: true },
    );

    assert.equal(res.items.length, 1);
    const shop = res.items[0];
    assert.equal(shop.status, 'audited');
    assert.equal(shop.ecommercePlatform, 'shopware');
    assert.equal(shop.detectedLanguage, 'de');
    assert.equal(shop.withdrawalStatus, 'compliant_2step');
    assert.equal(shop.withdrawalButtonFound, true);
    assert.equal(shop.withdrawalTwoStepCompliant, true);
    assert.equal(shop.withdrawalLoginWallDetected, false);
    assert.equal(shop.abolishedOdrLinkFound, false);
    assert.equal(shop.unsubstantiatedGreenClaimsFound, false);
    assert.ok(shop.empCoGreenClaimsCheck.recognizedCertificationsFound.includes('EU Ecolabel'));
    assert.equal(shop.omnibusViolationFound, false);
    assert.equal(shop.complianceScore, 100);
    assert.equal(shop.riskTier, 'LOW');
    assert.equal(shop.findingsCount, 0);

    // Compliant store with 0 findings is NOT charged for remediation-pack-generated
    assert.equal(shop.remediationPackGenerated, false);
    assert.equal(res.billing.chargedCounts['remediation-pack-generated'], 0);
  });

  it('4. Login-walled (/account/login) and static-PDF-only withdrawal flows are accurately distinguished', async () => {
    const runtime = new ApifyRuntimeAdapter();
    const res = await runBatchAudit(
      {
        urls: [loginWallShopUrl, staticPdfShopUrl],
        includeRemediationPack: false,
        maxLegalPagesPerDomain: 3,
        domainDelayMs: 0,
      },
      { runtime, allowLocalhost: true },
    );

    assert.equal(res.items.length, 2);

    const loginItem = res.items[0];
    assert.equal(loginItem.withdrawalStatus, 'login_walled');
    assert.equal(loginItem.withdrawalLoginWallDetected, true);
    assert.ok(loginItem.findings.some((f) => f.ruleId === 'EU-2023-2673-ART11A-LOGIN-WALL'));
    assert.equal(loginItem.riskTier, 'HIGH');

    const pdfItem = res.items[1];
    assert.equal(pdfItem.withdrawalStatus, 'static_policy_or_pdf_only');
    assert.equal(pdfItem.withdrawalButtonFound, false);
    assert.ok(pdfItem.findings.some((f) => f.ruleId === 'EU-2023-2673-ART11A-STATIC-ONLY'));
    assert.equal(pdfItem.riskTier, 'HIGH');
  });

  it('5. robots.txt disallow and SSRF targets (including 302 redirect to IMDS) are skipped and NEVER charged url-audited', async () => {
    const runtime = new ApifyRuntimeAdapter();
    const res = await runBatchAudit(
      {
        urls: [
          robotsBlockedShopUrl,
          'http://169.254.169.254/latest/meta-data/',
          `${badShopUrl}/redirect-imds`,
        ],
        respectRobotsTxt: true,
        domainDelayMs: 0,
      },
      { runtime, allowLocalhost: true },
    );

    assert.equal(res.items.length, 3);
    assert.equal(res.items[0].status, 'blocked_robots');
    assert.equal(res.items[1].status, 'blocked_ssrf');
    assert.equal(res.items[2].status, 'blocked_ssrf');

    // Critical billing invariant: url-audited MUST be 0 for blocked targets!
    assert.equal(res.billing.chargedCounts['url-audited'], 0);
    assert.equal(res.billing.chargedCounts['remediation-pack-generated'], 0);
  });

  it('6. Budget cap (maxBudgetUsd), creator $0 run billing fix, and datasetId input chaining work cleanly', async () => {
    const runtime = new ApifyRuntimeAdapter();

    // 6a. Exact $0.03 budget ($0.005 actor-start + $0.015 url-audited + $0.01 remediation-pack = 1 store max)
    const capped = await runBatchAudit(
      {
        urls: [badShopUrl, loginWallShopUrl, staticPdfShopUrl],
        includeRemediationPack: true,
        maxBudgetUsd: 0.03,
        maxConcurrency: 1,
        domainDelayMs: 0,
      },
      { runtime, allowLocalhost: true },
    );

    assert.equal(capped.items.length, 1, 'Should stop cleanly after 1st store hits maxBudgetUsd');
    assert.equal(capped.stoppedDueToBudgetCap, true);
    assert.ok(capped.billing.estimatedTotalUsd <= 0.03 + 1e-6);

    // 6b. Creator $0 test run simulation ({ eventChargeLimitReached: false, chargedCount: 0 })
    const creatorRuntime = new ApifyRuntimeAdapter();
    creatorRuntime.sdkCharge = async () => ({ eventChargeLimitReached: false, chargedCount: 0 });
    const creatorRun = await runBatchAudit(
      {
        urls: [badShopUrl, compliantShopUrl],
        includeRemediationPack: true,
        domainDelayMs: 0,
      },
      { runtime: creatorRuntime, allowLocalhost: true },
    );
    assert.equal(creatorRun.items.length, 2, 'Creator $0 run must NOT abort prematurely');
    assert.equal(creatorRun.stoppedDueToBudgetCap, false);

    // 6c. datasetId input chaining from local dataset storage (e.g. Google Maps Scraper output)
    const gmapsDir = path.join(tempStorageDir, 'datasets', 'gmaps-leads');
    fs.mkdirSync(gmapsDir, { recursive: true });
    fs.writeFileSync(
      path.join(gmapsDir, '000000001.json'),
      JSON.stringify([
        { title: 'AlpenWerk Store', website: compliantShopUrl },
        { title: 'Duplicate Entry', url: compliantShopUrl },
      ]),
      'utf8',
    );

    const chainedRun = await runBatchAudit(
      {
        datasetId: 'gmaps-leads',
        domainDelayMs: 0,
      },
      { runtime, allowLocalhost: true },
    );
    assert.equal(chainedRun.items.length, 1);
    assert.equal(chainedRun.items[0].complianceScore, 100);

    // 6d. datasetId traversal attempts ("..", "../datasets") must be strictly rejected
    assert.deepEqual(await runtime.loadUrlsFromDataset('..'), []);
    assert.deepEqual(await runtime.loadUrlsFromDataset('../default'), []);
  });

  it('7. Standby /health, /scan, and /mcp JSON-RPC 2.0 server + CLI entrypoint pass end-to-end', async () => {
    const standby = await startStandbyServer({
      port: 0,
      host: '127.0.0.1',
      allowLocalhost: true,
    });
    const standbyBase = `http://127.0.0.1:${standby.port}`;

    try {
      // 7a. GET /health with Apify readiness header
      const healthRes = await fetch(`${standbyBase}/health`, {
        headers: { 'x-apify-container-server-readiness-probe': '1' },
      });
      assert.equal(healthRes.status, 200);
      const healthJson = await healthRes.json();
      assert.equal(healthJson.status, 'ok');
      assert.equal(healthJson.service, 'eu-withdrawal-omnibus-auditor');
      assert.equal(healthJson.endpoints.mcp, '/mcp');

      // 7b. MCP initialize
      const initRes = await fetch(`${standbyBase}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'e2e-mcp-client', version: '1.0.0' },
          },
        }),
      });
      assert.equal(initRes.status, 200);
      const initBody = await initRes.json();
      assert.equal(initBody.result.serverInfo.name, 'eu-withdrawal-omnibus-auditor');

      // 7c. MCP notifications/initialized -> 202 Accepted
      const notifRes = await fetch(`${standbyBase}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        }),
      });
      assert.equal(notifRes.status, 202);

      // 7d. MCP ping & tools/list
      const pingRes = await fetch(`${standbyBase}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }),
      });
      assert.equal(pingRes.status, 200);

      const listRes = await fetch(`${standbyBase}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }),
      });
      const listBody = await listRes.json();
      assert.deepEqual(
        listBody.result.tools.map((t) => t.name),
        ['audit_eu_ecommerce_compliance'],
      );

      // 7e. MCP tools/call (audit_eu_ecommerce_compliance)
      const callRes = await fetch(`${standbyBase}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'audit_eu_ecommerce_compliance',
            arguments: {
              url: badShopUrl,
              includeRemediationPack: true,
              maxLegalPagesPerDomain: 3,
            },
          },
        }),
      });
      assert.equal(callRes.status, 200);
      const callBody = await callRes.json();
      assert.equal(callBody.result.isError, false);
      const report = JSON.parse(callBody.result.content[0].text);
      assert.equal(report.status, 'audited');
      assert.equal(report.abolishedOdrLinkFound, true);
      assert.equal(report.remediationPackGenerated, true);

      // 7f. CLI Entrypoint (node dist/main.js)
      const cliDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eu-cli-test-'));
      try {
        const kvsDefault = path.join(cliDir, 'key_value_stores', 'default');
        fs.mkdirSync(kvsDefault, { recursive: true });
        fs.writeFileSync(
          path.join(kvsDefault, 'INPUT.json'),
          JSON.stringify({
            urls: [compliantShopUrl],
            domainDelayMs: 0,
          }),
          'utf8',
        );

        const { stdout } = await execFileAsync(process.execPath, ['dist/main.js'], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            ALLOW_LOCALHOST_FOR_TESTS: '1',
            APIFY_LOCAL_STORAGE_DIR: cliDir,
          },
          timeout: 15_000,
        });

        assert.match(stdout, /Completed batch audit/);
        const dsFiles = fs
          .readdirSync(path.join(cliDir, 'datasets', 'default'))
          .filter((f) => f.endsWith('.json'));
        assert.equal(dsFiles.length, 1);
      } finally {
        fs.rmSync(cliDir, { recursive: true, force: true });
      }
    } finally {
      await standby.close();
    }
  });

  it('8. .actor/* schemas match normalizeAuditInput defaults and live StoreAuditReportItem properties 100%', async () => {
    const actorJson = JSON.parse(fs.readFileSync('.actor/actor.json', 'utf8'));
    const inputSchema = JSON.parse(fs.readFileSync('.actor/input_schema.json', 'utf8'));
    const datasetSchema = JSON.parse(fs.readFileSync('.actor/dataset_schema.json', 'utf8'));
    const ppeJson = JSON.parse(fs.readFileSync('.actor/pay_per_event.json', 'utf8'));

    assert.equal(actorJson.name, 'eu-withdrawal-omnibus-auditor');
    assert.equal(actorJson.minMemoryMbytes, 256);
    assert.equal(actorJson.maxMemoryMbytes, 1024);
    assert.equal(actorJson.usesStandbyMode, true);
    assert.equal(actorJson.webServerMcpPath, '/mcp');

    assert.equal(ppeJson['actor-start'].eventPriceUsd, 0.005);
    assert.equal(ppeJson['url-audited'].eventPriceUsd, 0.015);
    assert.equal(ppeJson['remediation-pack-generated'].eventPriceUsd, 0.01);

    const defaults = normalizeAuditInput({});
    for (const [propName, propDef] of Object.entries(inputSchema.properties)) {
      if ('default' in propDef) {
        assert.equal(
          defaults[propName],
          propDef.default,
          `Default mismatch for input property "${propName}"`,
        );
      }
    }

    const runtime = new ApifyRuntimeAdapter();
    const sampleRun = await runBatchAudit(
      { urls: [badShopUrl], domainDelayMs: 0 },
      { runtime, allowLocalhost: true },
    );
    const liveItem = sampleRun.items[0];
    for (const key of Object.keys(datasetSchema.fields.properties)) {
      assert.equal(
        key in liveItem,
        true,
        `Dataset schema property "${key}" must exist on StoreAuditReportItem`,
      );
    }
    for (const key of Object.keys(liveItem)) {
      assert.equal(
        key in datasetSchema.fields.properties,
        true,
        `StoreAuditReportItem property "${key}" must be documented in .actor/dataset_schema.json`,
      );
    }
  });
});
