import type {
  ComplianceFinding,
  DiscoveredLegalLinks,
  EcommercePlatform,
  EmpCoGreenClaimsCheckResult,
  OdrLinkCheckResult,
  OmnibusPricingCheckResult,
  RecommendedNextActor,
  RemediationPack,
  RiskTier,
  WithdrawalButtonCheckResult,
} from './types.js';

interface LocaleCopy {
  step1Button: string;
  modalHeading: string;
  orderLabel: string;
  emailLabel: string;
  nameLabel: string;
  step2ConfirmButton: string;
  cancelButton: string;
  confirmationNotice: string;
  omnibusLabel: string;
}

const LOCALE_DICTIONARY: Record<string, LocaleCopy> = {
  de: {
    step1Button: 'Vertrag hier widerrufen',
    modalHeading: 'Elektronischer Vertragswiderruf (BGB § 356a / EU Art. 11a)',
    orderLabel: 'Bestell- oder Vertragsnummer',
    emailLabel: 'E-Mail-Adresse (für die Eingangsbestätigung auf dauerhaftem Datenträger)',
    nameLabel: 'Vollständiger Name (optional)',
    step2ConfirmButton: 'Widerruf bestätigen',
    cancelButton: 'Abbrechen',
    confirmationNotice:
      'Vielen Dank. Ihr Widerruf wurde mit Zeitstempel erfasst. Eine Bestätigung auf einem dauerhaften Datenträger (E-Mail) wurde versendet.',
    omnibusLabel: 'Niedrigster Gesamtpreis der letzten 30 Tage vor der Preisermäßigung:',
  },
  fr: {
    step1Button: 'Se rétracter du contrat',
    modalHeading: 'Formulaire électronique de rétractation (Directive UE 2023/2673 Art. 11 bis)',
    orderLabel: 'Numéro de commande ou de contrat',
    emailLabel: 'Adresse e-mail (pour accusé de réception sur support durable)',
    nameLabel: 'Nom complet (facultatif)',
    step2ConfirmButton: 'Confirmer la rétractation',
    cancelButton: 'Annuler',
    confirmationNotice:
      'Votre demande de rétractation a été enregistrée. Un accusé de réception immédiat vous est envoyé par e-mail.',
    omnibusLabel: 'Prix le plus bas pratiqué au cours des 30 derniers jours avant la réduction :',
  },
  es: {
    step1Button: 'Desistir del contrato',
    modalHeading: 'Desistimiento electrónico del contrato (Directiva UE 2023/2673 Art. 11 bis)',
    orderLabel: 'Número de pedido o contrato',
    emailLabel: 'Correo electrónico (para acuse de recibo en soporte duradero)',
    nameLabel: 'Nombre completo (opcional)',
    step2ConfirmButton: 'Confirmar desistimiento',
    cancelButton: 'Cancelar',
    confirmationNotice:
      'Su solicitud de desistimiento ha sido registrada. Recibirá confirmación inmediata por correo electrónico.',
    omnibusLabel: 'Precio más bajo en los últimos 30 días previos a la reducción:',
  },
  it: {
    step1Button: 'Recedere dal contratto',
    modalHeading: 'Recesso elettronico dal contratto (Direttiva UE 2023/2673 Art. 11 bis)',
    orderLabel: 'Numero d’ordine o di contratto',
    emailLabel: 'Indirizzo e-mail (per conferma di ricezione su supporto durevole)',
    nameLabel: 'Nome completo (facoltativo)',
    step2ConfirmButton: 'Conferma il recesso',
    cancelButton: 'Annulla',
    confirmationNotice:
      'La richiesta di recesso è stata registrata. Riceverai conferma immediata via e-mail.',
    omnibusLabel: 'Prezzo più basso applicato negli ultimi 30 giorni prima della riduzione:',
  },
  nl: {
    step1Button: 'Overeenkomst herroepen',
    modalHeading: 'Elektronische herroepingsfunctie (EU-richtlijn 2023/2673 Art. 11a)',
    orderLabel: 'Bestel- of contractnummer',
    emailLabel: 'E-mailadres (voor ontvangstbevestiging op duurzame gegevensdrager)',
    nameLabel: 'Volledige naam (optioneel)',
    step2ConfirmButton: 'Herroeping bevestigen',
    cancelButton: 'Annuleren',
    confirmationNotice:
      'Uw herroeping is geregistreerd. U ontvangt direct een bevestiging per e-mail.',
    omnibusLabel: 'Laagste prijs van de afgelopen 30 dagen vóór de prijsverlaging:',
  },
  pl: {
    step1Button: 'Odstąp od umowy',
    modalHeading: 'Elektroniczne odstąpienie od umowy (Dyrektywa UE 2023/2673 Art. 11a)',
    orderLabel: 'Numer zamówienia lub umowy',
    emailLabel: 'Adres e-mail (potwierdzenie na trwałym nośniku)',
    nameLabel: 'Imię i nazwisko (opcjonalnie)',
    step2ConfirmButton: 'Potwierdź odstąpienie',
    cancelButton: 'Anuluj',
    confirmationNotice:
      'Oświadczenie o odstąpieniu od umowy zostało zarejestrowane. Potwierdzenie wysłano na adres e-mail.',
    omnibusLabel: 'Najniższa cena z 30 dni przed obniżką:',
  },
  en: {
    step1Button: 'Withdraw from contract',
    modalHeading: 'Electronic Contract Withdrawal (EU Directive 2023/2673 Art. 11a)',
    orderLabel: 'Order or contract reference',
    emailLabel: 'Email address (for immediate durable-medium acknowledgement)',
    nameLabel: 'Full name (optional)',
    step2ConfirmButton: 'Confirm withdrawal',
    cancelButton: 'Cancel',
    confirmationNotice:
      'Your contract withdrawal has been timestamped and recorded. An acknowledgement receipt has been sent to your email.',
    omnibusLabel: 'Lowest price in the last 30 days prior to discount:',
  },
};

export function buildFindingsAndScore(params: {
  homeUrl: string;
  legalLinks: DiscoveredLegalLinks;
  withdrawal: WithdrawalButtonCheckResult;
  odr: OdrLinkCheckResult;
  empCo: EmpCoGreenClaimsCheckResult;
  omnibus: OmnibusPricingCheckResult;
}): {
  findings: ComplianceFinding[];
  complianceScore: number;
  riskTier: RiskTier;
} {
  const { homeUrl, legalLinks, withdrawal, odr, empCo, omnibus } = params;
  const findings: ComplianceFinding[] = [];
  let deductions = 0;

  // 1. EU Withdrawal Button (Directive (EU) 2023/2673 Art. 11a / BGB § 356a)
  if (withdrawal.checked) {
    if (withdrawal.status === 'missing') {
      deductions += 40;
      findings.push({
        ruleId: 'EU-2023-2673-ART11A-MISSING',
        title: 'Missing Mandatory Electronic Withdrawal Button (Widerrufsbutton)',
        regulation:
          'Directive (EU) 2023/2673 Art. 11a (amending Consumer Rights Directive 2011/83/EU; German BGB § 356a, mandatory since June 19, 2026)',
        severity: 'CRITICAL',
        pageUrl: homeUrl,
        evidence:
          'No interactive electronic withdrawal button or link ("Withdraw from contract" / "Vertrag widerrufen") was detected on the homepage or inspected legal pages.',
        recommendation:
          'Add a continuously visible, clearly labeled 2-step electronic withdrawal function ("Withdraw from contract" -> "Confirm withdrawal") accessible without requiring customer account login, and send an automated durable-medium receipt.',
      });
    } else if (withdrawal.status === 'static_policy_or_pdf_only') {
      deductions += 35;
      findings.push({
        ruleId: 'EU-2023-2673-ART11A-STATIC-ONLY',
        title: 'Static Withdrawal Policy / PDF Only — No Interactive Electronic Withdrawal Button',
        regulation:
          'Directive (EU) 2023/2673 Art. 11a / German BGB § 356a (mandatory since June 19, 2026)',
        severity: 'HIGH',
        pageUrl: withdrawal.pdfWithdrawalUrl || legalLinks.withdrawalPolicyUrl || homeUrl,
        evidence: withdrawal.pdfWithdrawalUrl
          ? `Static PDF withdrawal form detected (${withdrawal.pdfWithdrawalUrl}), without an interactive electronic 2-step withdrawal button.`
          : 'Static withdrawal policy prose (e.g. Widerrufsbelehrung) was found, but no interactive electronic 2-step withdrawal button or online submission form was detected.',
        recommendation:
          'Supplement your static withdrawal policy with an interactive 2-step electronic withdrawal widget ("Vertrag widerrufen" + "Widerruf bestätigen") that guests can submit directly online.',
      });
    } else if (withdrawal.status === 'login_walled') {
      deductions += 30;
      findings.push({
        ruleId: 'EU-2023-2673-ART11A-LOGIN-WALL',
        title: 'Electronic Withdrawal Link Gated Behind Mandatory Account Login',
        regulation:
          'Directive (EU) 2023/2673 Art. 11a(1)-(2) / German BGB § 356a (guest checkout accessibility requirement)',
        severity: 'HIGH',
        pageUrl: withdrawal.loginWallUrl || withdrawal.buttonUrl || homeUrl,
        evidence:
          withdrawal.matchedSignals[0] ||
          `Withdrawal link redirects to or requires authentication (${withdrawal.loginWallUrl || '/login'}).`,
        recommendation:
          'Ensure guest customers can exercise their electronic withdrawal right directly via order number + email lookup without creating or logging into an account.',
      });
    } else if (withdrawal.status === 'partial_single_step') {
      deductions += 20;
      findings.push({
        ruleId: 'EU-2023-2673-ART11A-NO-CONFIRM-STEP',
        title: 'Withdrawal Trigger Detected Without Explicit Step-2 Confirmation Control',
        regulation: 'Directive (EU) 2023/2673 Art. 11a(3) (mandatory 2-step confirmation button)',
        severity: 'MODERATE',
        pageUrl: withdrawal.buttonUrl || homeUrl,
        evidence: `Found withdrawal trigger "${withdrawal.buttonLabel || 'withdrawal'}", but did not detect a clearly labeled Step-2 confirmation control (e.g. "Confirm withdrawal" / "Widerruf bestätigen").`,
        recommendation:
          'Verify that submitting the withdrawal statement uses an explicit second confirmation button ("Confirm withdrawal" / "Widerruf bestätigen") and triggers an automated durable-medium email receipt.',
      });
    }
  }

  // 2. Abolished EU ODR Link Trap (Regulation (EU) 2024/3228)
  if (odr.checked && odr.abolishedOdrLinkFound) {
    deductions += 25;
    findings.push({
      ruleId: 'EU-2024-3228-ABOLISHED-ODR-LINK',
      title: 'Outdated Link to Permanently Discontinued EU ODR Platform (ec.europa.eu/consumers/odr)',
      regulation:
        'Regulation (EU) 2024/3228 repealing Regulation (EU) No 524/2013 (EU ODR platform shut down July 20, 2025)',
      severity: 'HIGH',
      pageUrl: odr.foundOnPages[0] || legalLinks.impressumUrl || homeUrl,
      evidence: `Found ${odr.odrUrls.length} reference(s) to "${odr.odrUrls[0]}" on: ${odr.foundOnPages.join(', ')}.`,
      recommendation:
        'Remove all links and boilerplate references to ec.europa.eu/consumers/odr from Impressum, AGB/Terms, and footer templates, retaining only valid national ADR disclosures (e.g. VSBG § 36 in Germany) where applicable.',
    });
  }

  // 3. EU EmpCo Greenwashing Claims (Directive (EU) 2024/825)
  if (empCo.checked && empCo.unsubstantiatedRisk) {
    deductions += 20;
    findings.push({
      ruleId: 'EU-2024-825-EMPCO-UNSUBSTANTIATED-GREEN-CLAIM',
      title: 'Generic Environmental / Climate Claims Detected Without Recognized Certification Signals',
      regulation:
        'Directive (EU) 2024/825 (Empowering Consumers for the Green Transition / EmpCo, applicable since September 27, 2026)',
      severity: 'HIGH',
      pageUrl: empCo.foundOnPages[0] || homeUrl,
      evidence: `Matched generic environmental claims (${empCo.matchedGenericClaims.join('; ')}) with zero recognized Type I / third-party certification signals (EU Ecolabel, Blauer Engel, GOTS, OEKO-TEX, FSC, B Corp) detected on inspected pages.`,
      recommendation:
        'Replace generic environmental claims ("eco-friendly", "climate neutral", "klimaneutral") with specific, verifiable product attributes backed by recognized third-party certification schemes (ISO 14024 / EU Ecolabel), and remove carbon-offsetting neutrality claims.',
    });
  }

  // 4. EU Omnibus 30-Day Lowest Prior Price (Directive (EU) 2019/2161 Art. 6a)
  if (omnibus.checked && omnibus.omnibusViolationRisk) {
    deductions += 15;
    findings.push({
      ruleId: 'EU-2019-2161-OMNIBUS-PRIOR-PRICE-MISSING',
      title: 'Strike-Through / Compare-At Discount Indicators Without 30-Day Lowest Price Disclosure',
      regulation:
        'Directive (EU) 2019/2161 Art. 6a (Omnibus Price Indication Directive / German PAngV § 11)',
      severity: 'MODERATE',
      pageUrl: omnibus.foundOnPages[0] || homeUrl,
      evidence: `Detected discount/strike-through price signals (${omnibus.matchedDiscountSignals.slice(0, 4).join(', ')}) without accompanying 30-day lowest prior price wording.`,
      recommendation:
        'Display the lowest total price applied during the 30 days prior to the price reduction directly adjacent to every strike-through or percentage discount.',
    });
  }

  const severityOrder: Record<ComplianceFinding['severity'], number> = {
    CRITICAL: 0,
    HIGH: 1,
    MODERATE: 2,
    LOW: 3,
  };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const complianceScore = Math.max(0, Math.min(100, 100 - deductions));

  let riskTier: RiskTier;
  if (complianceScore <= 35) {
    riskTier = 'CRITICAL';
  } else if (complianceScore <= 70) {
    riskTier = 'HIGH';
  } else if (complianceScore <= 85) {
    riskTier = 'MODERATE';
  } else {
    riskTier = 'LOW';
  }

  return { findings, complianceScore, riskTier };
}

function formatPlatformLabel(platform: EcommercePlatform): string {
  const names: Record<EcommercePlatform, string> = {
    shopify: 'Shopify',
    woocommerce: 'WooCommerce',
    shopware: 'Shopware',
    prestashop: 'PrestaShop',
    magento: 'Magento',
    bigcommerce: 'BigCommerce',
    wix: 'Wix',
    squarespace: 'Squarespace',
    custom: 'online',
  };
  return names[platform] || 'online';
}

/**
 * Generates a neutral, factual 1-2 sentence B2B outreach observation (NOT legal advice).
 */
export function generateColdOutreachHook(params: {
  domain: string;
  platform: EcommercePlatform;
  withdrawal: WithdrawalButtonCheckResult;
  odr: OdrLinkCheckResult;
  empCo: EmpCoGreenClaimsCheckResult;
  omnibus: OmnibusPricingCheckResult;
  findings: ComplianceFinding[];
}): string {
  const { domain, platform, withdrawal, odr, empCo, omnibus, findings } = params;
  const storeDesc =
    platform === 'custom' ? `your store (${domain})` : `your ${formatPlatformLabel(platform)} store (${domain})`;

  if (findings.length === 0) {
    return `An automated technical review of ${storeDesc} detected an interactive 2-step withdrawal flow, no legacy ec.europa.eu/consumers/odr links, and consistent price/environmental disclosures.`;
  }

  const observations: string[] = [];

  if (withdrawal.status === 'missing') {
    observations.push(
      'no interactive 2-step electronic withdrawal button ("Withdraw from contract" / "Vertrag widerrufen") was detected in the public storefront navigation or footer',
    );
  } else if (withdrawal.status === 'static_policy_or_pdf_only') {
    observations.push(
      'only a static withdrawal policy/PDF was detected without an interactive 2-step electronic withdrawal button',
    );
  } else if (withdrawal.status === 'login_walled') {
    observations.push(
      `the contract withdrawal link routes to an account login page (${withdrawal.loginWallUrl || '/login'}) rather than a guest-accessible 2-step form`,
    );
  } else if (withdrawal.status === 'partial_single_step') {
    observations.push(
      'the withdrawal trigger lacks a detectable Step-2 confirmation control ("Confirm withdrawal" / "Widerruf bestätigen")',
    );
  }

  if (odr.abolishedOdrLinkFound) {
    observations.push(
      'a link to the discontinued EU ODR portal (ec.europa.eu/consumers/odr, shut down July 2025) still appears on the site',
    );
  }

  if (empCo.unsubstantiatedRisk && empCo.matchedGenericClaims.length > 0) {
    const firstClaim = empCo.matchedGenericClaims[0].split(':')[0];
    observations.push(
      `generic environmental phrasing ("${firstClaim}") appears without a detected third-party ecolabel reference`,
    );
  }

  if (omnibus.omnibusViolationRisk) {
    observations.push(
      'strike-through discount pricing appears without a visible 30-day lowest prior price label',
    );
  }

  const topTwo = observations.slice(0, 2).join(', and ');
  const extraCount = Math.max(0, observations.length - 2);
  const suffix = extraCount > 0 ? ` (plus ${extraCount} additional storefront signal${extraCount > 1 ? 's' : ''})` : '';

  return `While running a technical storefront check on ${storeDesc}, we noticed ${topTwo}${suffix} — happy to share the technical checklist and ready-to-paste HTML/JS widget if useful for your team.`;
}

/**
 * Generates a clean, copy-pasteable multilingual HTML/JS 2-Step Art. 11a Electronic Withdrawal Widget
 * + Omnibus 30-day lowest prior price disclosure snippet.
 */
export function generateRemediationPack(params: {
  domain: string;
  locale: string;
  platform: EcommercePlatform;
  withdrawal: WithdrawalButtonCheckResult;
  odr: OdrLinkCheckResult;
  empCo: EmpCoGreenClaimsCheckResult;
}): RemediationPack {
  const { domain, locale, platform, odr, empCo } = params;
  const langKey = LOCALE_DICTIONARY[locale] ? locale : 'en';
  const copy = LOCALE_DICTIONARY[langKey];

  const withdrawalWidgetHtmlJs = `<!-- EU Directive (EU) 2023/2673 Art. 11a / BGB § 356a 2-Step Electronic Withdrawal Widget (${domain}) -->
<div id="eu-art11a-withdrawal-root" class="eu-withdrawal-widget" data-store="${domain}" data-locale="${langKey}">
  <!-- Step 1: Continuously accessible electronic withdrawal trigger (no account login required) -->
  <button type="button" id="eu-withdrawal-open-btn" aria-haspopup="dialog" aria-controls="eu-withdrawal-dialog"
    style="padding:10px 16px;border:1px solid #1f2937;background:#ffffff;color:#111827;border-radius:6px;font-weight:600;cursor:pointer;">
    ${copy.step1Button}
  </button>

  <dialog id="eu-withdrawal-dialog" aria-labelledby="eu-withdrawal-title"
    style="max-width:480px;width:92%;border:1px solid #d1d5db;border-radius:10px;padding:24px;font-family:system-ui,sans-serif;">
    <h2 id="eu-withdrawal-title" style="margin:0 0 12px;font-size:1.125rem;">${copy.modalHeading}</h2>
    <form id="eu-withdrawal-form" method="post" action="/api/eu-contract-withdrawal" novalidate>
      <label for="eu-withdrawal-order" style="display:block;font-size:0.875rem;margin-bottom:4px;font-weight:500;">${copy.orderLabel} *</label>
      <input id="eu-withdrawal-order" name="orderReference" type="text" required autocomplete="off"
        style="width:100%;padding:8px 10px;margin-bottom:12px;border:1px solid #9ca3af;border-radius:6px;box-sizing:border-box;" />

      <label for="eu-withdrawal-email" style="display:block;font-size:0.875rem;margin-bottom:4px;font-weight:500;">${copy.emailLabel} *</label>
      <input id="eu-withdrawal-email" name="customerEmail" type="email" required autocomplete="email"
        style="width:100%;padding:8px 10px;margin-bottom:12px;border:1px solid #9ca3af;border-radius:6px;box-sizing:border-box;" />

      <label for="eu-withdrawal-name" style="display:block;font-size:0.875rem;margin-bottom:4px;font-weight:500;">${copy.nameLabel}</label>
      <input id="eu-withdrawal-name" name="customerName" type="text" autocomplete="name"
        style="width:100%;padding:8px 10px;margin-bottom:16px;border:1px solid #9ca3af;border-radius:6px;box-sizing:border-box;" />

      <!-- Step 2: Mandatory explicit confirmation button per Art. 11a(3) -->
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button type="button" id="eu-withdrawal-cancel-btn"
          style="padding:9px 14px;border:1px solid #d1d5db;background:#f9fafb;color:#374151;border-radius:6px;cursor:pointer;">
          ${copy.cancelButton}
        </button>
        <button type="submit" id="eu-withdrawal-confirm-btn" data-withdrawal-step="2"
          style="padding:9px 16px;border:none;background:#111827;color:#ffffff;border-radius:6px;font-weight:600;cursor:pointer;">
          ${copy.step2ConfirmButton}
        </button>
      </div>
    </form>
    <p id="eu-withdrawal-status" role="status" aria-live="polite" hidden
      style="margin-top:14px;padding:10px;background:#ecfdf5;color:#065f46;border-radius:6px;font-size:0.875rem;">
      ${copy.confirmationNotice}
    </p>
  </dialog>
</div>
<script>
(function () {
  var openBtn = document.getElementById('eu-withdrawal-open-btn');
  var cancelBtn = document.getElementById('eu-withdrawal-cancel-btn');
  var dialog = document.getElementById('eu-withdrawal-dialog');
  var form = document.getElementById('eu-withdrawal-form');
  var statusEl = document.getElementById('eu-withdrawal-status');
  if (!openBtn || !dialog || !form) return;
  openBtn.addEventListener('click', function () { dialog.showModal(); });
  cancelBtn.addEventListener('click', function () { dialog.close(); });
  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    var payload = {
      orderReference: form.orderReference.value.trim(),
      customerEmail: form.customerEmail.value.trim(),
      customerName: form.customerName.value.trim(),
      submittedAtIso: new Date().toISOString()
    };
    await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    form.hidden = true;
    statusEl.hidden = false;
  });
})();
</script>`;

  const omnibusPriceSnippetHtml =
    platform === 'shopify'
      ? `<!-- EU Omnibus Directive (EU) 2019/2161 Art. 6a — Shopify Liquid 30-Day Lowest Price Block -->
{% if product.compare_at_price > product.price %}
  <div class="eu-omnibus-price-box" style="font-size:0.85rem;color:#4b5563;margin-top:4px;">
    <span class="price-sale" style="font-weight:700;color:#b91c1c;">{{ product.price | money }}</span>
    <del class="price-compare" style="margin-left:6px;color:#6b7280;">{{ product.compare_at_price | money }}</del>
    <div class="omnibus-30d-reference">
      ${copy.omnibusLabel}
      <strong>{{ product.selected_or_first_available_variant.metafields.omnibus.lowest_price_30d | default: product.compare_at_price | money }}</strong>
    </div>
  </div>
{% endif %}`
      : `<!-- EU Omnibus Directive (EU) 2019/2161 Art. 6a — 30-Day Lowest Prior Price Disclosure -->
<div class="eu-omnibus-price-box" style="font-size:0.85rem;color:#4b5563;margin-top:4px;">
  <span class="price-current" style="font-weight:700;color:#b91c1c;">€39.90</span>
  <del class="price-prior" style="margin-left:6px;color:#6b7280;">€49.90</del>
  <div class="omnibus-30d-reference">
    ${copy.omnibusLabel} <strong>€44.90</strong>
  </div>
</div>`;

  const odrCleanupGuidance = odr.abolishedOdrLinkFound
    ? `Remove outdated link(s) (${odr.odrUrls.join(', ')}) found on ${odr.foundOnPages.join(', ')}. Under Regulation (EU) 2024/3228, the European Commission ODR portal shut down permanently on July 20, 2025.`
    : null;

  const empCoClaimsGuidance = empCo.unsubstantiatedRisk
    ? `Review generic sustainability wording (${empCo.matchedGenericClaims.join('; ')}). Under Directive (EU) 2024/825 (EmpCo), generic environmental claims require recognized Type I ecolabel / ISO 14024 or verifiable lifecycle substantiation, and offset-based climate-neutrality claims are prohibited.`
    : null;

  return {
    targetLocale: langKey,
    ecommercePlatform: platform,
    withdrawalWidgetHtmlJs,
    omnibusPriceSnippetHtml,
    odrCleanupGuidance,
    empCoClaimsGuidance,
    implementationNotes: [
      'Place the Step-1 withdrawal trigger in your global storefront footer/header so guest shoppers can access it without logging into an account.',
      'Wire POST /api/eu-contract-withdrawal to send an immediate timestamped email confirmation (durable medium) to customerEmail per Art. 11a(4).',
      'Have qualified legal counsel review final wording against applicable national transposition rules (e.g. German BGB § 356a / PAngV § 11).',
    ],
  };
}

export function buildRecommendedNextActors(domain: string): RecommendedNextActor[] {
  return [
    {
      actorSlug: 'healthy_addax/wcag-eaa-ada-auditor',
      actorUrl: 'https://apify.com/healthy_addax/wcag-eaa-ada-auditor',
      mcpEndpointUrl: 'https://mcp.apify.com/?tools=healthy_addax/wcag-eaa-ada-auditor',
      reason: `Pair your EU Withdrawal/Omnibus storefront check on ${domain} with a full headless Chromium WCAG 2.2 Level AA, European Accessibility Act (EAA / BFSG), and Accessibility Overlay (accessiBe/UserWay) audit with red-box visual screenshot proof.`,
    },
  ];
}
