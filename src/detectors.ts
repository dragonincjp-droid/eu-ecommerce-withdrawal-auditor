import type {
  DiscoveredLegalLinks,
  EcommercePlatform,
  EmpCoGreenClaimsCheckResult,
  OdrLinkCheckResult,
  OmnibusPricingCheckResult,
  ParsedAnchor,
  ParsedHtmlDocument,
  WithdrawalButtonCheckResult,
} from './types.js';

export interface InspectedPageBundle {
  requestedUrl: string;
  finalUrl: string;
  redirectChain: string[];
  doc: ParsedHtmlDocument;
}

const ASSET_EXTENSION_RE =
  /\.(?:jpg|jpeg|png|gif|webp|avif|svg|ico|css|js|mjs|woff|woff2|ttf|eot|mp4|webm|mp3|zip|tar|gz|rar|xml|json)(?:[?#]|$)/i;

const LOGIN_URL_RE =
  /(?:\/account\/login|\/customer\/account\/login|\/wp-login\.php|\/mein-konto\/login|\/konto\/login|\/konto\/anmelden|\/mon-compte\/connexion|\/mi-cuenta\/login|\/auth\/login|\/users\/sign_in|\/signin|\/sign-in|\/login)(?:[/?#]|$)/i;

/**
 * Interactive Electronic Withdrawal Button / Link triggers across 7 EU languages
 * (Directive (EU) 2023/2673 Art. 11a / German BGB § 356a, mandatory since June 19, 2026).
 * Note: Intentionally excludes static policy nouns like "Widerrufsbelehrung" or "Right of Withdrawal".
 */
const INTERACTIVE_WITHDRAWAL_PATTERNS: Array<{ lang: string; label: string; regex: RegExp }> = [
  // German (DE)
  { lang: 'de', label: 'Vertrag hier widerrufen', regex: /\bvertrag\s+hier\s+widerrufen\b/i },
  { lang: 'de', label: 'Vertrag widerrufen', regex: /\bvertrag(?:\s+online)?\s+widerrufen\b/i },
  { lang: 'de', label: 'Widerrufsbutton', regex: /\bwiderrufsbutton\b/i },
  { lang: 'de', label: 'Widerrufsfunktion', regex: /\bwiderrufsfunktion\b/i },
  { lang: 'de', label: 'Online-Widerruf', regex: /\bonline[- ]widerruf(?:sformular)?\b/i },
  { lang: 'de', label: 'Hier widerrufen', regex: /\bhier\s+(?:online\s+)?widerrufen\b/i },
  { lang: 'de', label: 'Bestellung widerrufen', regex: /\bbestellung\s+(?:online\s+)?widerrufen\b/i },
  // English (EN)
  { lang: 'en', label: 'Withdraw from contract', regex: /\bwithdraw\s+from\s+(?:the\s+|your\s+|this\s+)?contract\b/i },
  { lang: 'en', label: 'Cancel contract', regex: /\bcancel\s+(?:my\s+|your\s+|the\s+)?contract\b/i },
  { lang: 'en', label: 'Contract withdrawal button', regex: /\b(?:electronic\s+)?withdrawal\s+button\b/i },
  { lang: 'en', label: 'Online withdrawal form', regex: /\bonline\s+(?:contract\s+)?withdrawal\s+form\b/i },
  { lang: 'en', label: 'Exercise right of withdrawal online', regex: /\bexercise\s+(?:your\s+)?right\s+of\s+withdrawal\s+online\b/i },
  // French (FR)
  { lang: 'fr', label: 'Rétracter du contrat', regex: /\b(?:se\s+|me\s+)?r[ée]tracter\s+du\s+contrat\b/i },
  { lang: 'fr', label: 'Formulaire de rétractation en ligne', regex: /\bformulaire\s+de\s+r[ée]tractation\b/i },
  { lang: 'fr', label: 'Bouton de rétractation', regex: /\bbouton\s+de\s+r[ée]tractation\b/i },
  { lang: 'fr', label: 'Résilier le contrat ici', regex: /\br[ée]silier\s+le\s+contrat\b/i },
  // Spanish (ES)
  { lang: 'es', label: 'Desistir del contrato', regex: /\bdesistir\s+del\s+contrato\b/i },
  { lang: 'es', label: 'Botón de desistimiento', regex: /\bbot[óo]n\s+de\s+desistimiento\b/i },
  { lang: 'es', label: 'Formulario de desistimiento', regex: /\bformulario\s+de\s+desistimiento(?:\s+en\s+l[íi]nea)?\b/i },
  // Italian (IT)
  { lang: 'it', label: 'Recedere dal contratto', regex: /\brecedere\s+dal\s+contratto\b/i },
  { lang: 'it', label: 'Pulsante di recesso', regex: /\bpulsante\s+di\s+recesso\b/i },
  { lang: 'it', label: 'Modulo di recesso online', regex: /\bmodulo\s+di\s+recesso(?:\s+online)?\b/i },
  // Dutch (NL)
  { lang: 'nl', label: 'Overeenkomst herroepen', regex: /\b(?:overeenkomst|contract)\s+(?:hier\s+)?herroepen\b/i },
  { lang: 'nl', label: 'Herroepingsknop', regex: /\bherroepingsknop\b/i },
  { lang: 'nl', label: 'Online herroepingsformulier', regex: /\bonline\s+herroepingsformulier\b/i },
  // Polish (PL)
  { lang: 'pl', label: 'Odstąp od umowy', regex: /\bodst[ąa]p(?:i[ćc])?\s+od\s+umowy\b/i },
  { lang: 'pl', label: 'Przycisk odstąpienia od umowy', regex: /\bprzycisk\s+odst[ąa]pienia\b/i },
  { lang: 'pl', label: 'Formularz odstąpienia online', regex: /\bformularz\s+odst[ąa]pienia\s+online\b/i },
];

/**
 * Step 2 Confirmation Step triggers (Directive (EU) 2023/2673 Art. 11a(3)).
 */
const STEP2_CONFIRMATION_PATTERNS: Array<{ lang: string; label: string; regex: RegExp }> = [
  { lang: 'de', label: 'Widerruf bestätigen', regex: /\bwiderruf\s+(?:jetzt\s+|verbindlich\s+)?best[äa]tigen\b/i },
  { lang: 'de', label: 'Jetzt verbindlich widerrufen', regex: /\bjetzt\s+verbindlich\s+widerrufen\b/i },
  { lang: 'de', label: 'Vertragswiderruf bestätigen', regex: /\bvertragswiderruf\s+best[äa]tigen\b/i },
  { lang: 'en', label: 'Confirm withdrawal', regex: /\bconfirm\s+(?:contract\s+|my\s+|your\s+)?withdrawal\b/i },
  { lang: 'en', label: 'Confirm contract cancellation', regex: /\bconfirm\s+(?:contract\s+)?cancellation\b/i },
  { lang: 'fr', label: 'Confirmer la rétractation', regex: /\bconfirmer\s+(?:la\s+|ma\s+)?r[ée]tractation\b/i },
  { lang: 'es', label: 'Confirmar desistimiento', regex: /\bconfirmar\s+(?:el\s+)?desistimiento\b/i },
  { lang: 'it', label: 'Conferma il recesso', regex: /\bconferma(?:re)?\s+(?:il\s+)?recesso\b/i },
  { lang: 'nl', label: 'Herroeping bevestigen', regex: /\b(?:herroeping\s+bevestigen|bevestig\s+herroeping)\b/i },
  { lang: 'pl', label: 'Potwierdź odstąpienie', regex: /\b(?:potwierd[źz]|zatwierd[źz])\s+odst[ąa]pienie\b/i },
];

const STATIC_WITHDRAWAL_POLICY_RE =
  /\b(widerrufsbelehrung|widerrufsrecht|muster-widerrufsformular|right\s+of\s+withdrawal|withdrawal\s+policy|cancellation\s+policy|droit\s+de\s+r[ée]tractation|politique\s+de\s+r[ée]tractation|derecho\s+de\s+desistimiento|diritto\s+di\s+recesso|herroepingsrecht|prawo\s+odst[ąa]pienia)\b/i;

export function isLoginWallUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return LOGIN_URL_RE.test(`${parsed.pathname}${parsed.search}`);
  } catch {
    return LOGIN_URL_RE.test(url);
  }
}

export function detectStoreLanguage(pages: ParsedHtmlDocument[], domain: string): string {
  for (const p of pages) {
    if (p.htmlLang && /^[a-z]{2,3}$/i.test(p.htmlLang)) {
      return p.htmlLang.toLowerCase();
    }
  }
  const tld = domain.split('.').pop()?.toLowerCase() ?? '';
  const tldMap: Record<string, string> = {
    de: 'de',
    at: 'de',
    ch: 'de',
    fr: 'fr',
    es: 'es',
    it: 'it',
    nl: 'nl',
    be: 'nl',
    pl: 'pl',
  };
  if (tldMap[tld]) return tldMap[tld];

  const sampleText = pages.map((p) => p.visibleText.slice(0, 4000)).join(' ');
  if (/\b(impressum|widerrufsbelehrung|datenschutz|warenkorb|inkl\.\s*mwst)\b/i.test(sampleText)) {
    return 'de';
  }
  if (/\b(mentions\s+l[ée]gales|panier|conditions\s+g[ée]n[ée]rales)\b/i.test(sampleText)) {
    return 'fr';
  }
  if (/\b(aviso\s+legal|carrito|pol[íi]tica\s+de\s+privacidad)\b/i.test(sampleText)) {
    return 'es';
  }
  if (/\b(note\s+legali|carrello|informativa\s+sulla\s+privacy)\b/i.test(sampleText)) {
    return 'it';
  }
  if (/\b(algemene\s+voorwaarden|winkelwagen|privacybeleid)\b/i.test(sampleText)) {
    return 'nl';
  }
  if (/\b(regulamin|koszyk|polityka\s+prywatno[śs]ci)\b/i.test(sampleText)) {
    return 'pl';
  }
  return 'en';
}

export function detectEcommercePlatform(pages: ParsedHtmlDocument[]): EcommercePlatform {
  const combinedSignals = pages
    .map((p) =>
      [
        p.scriptUrls.join(' '),
        p.stylesheetUrls.join(' '),
        p.inlineScripts.join(' ').slice(0, 15_000),
        p.rawHtml.slice(0, 40_000),
      ].join('\n'),
    )
    .join('\n');

  if (/\bcdn\.shopify\.com\b|\bShopify\.shop\b|\bshopify-section\b|\bmyshopify\.com\b/i.test(combinedSignals)) {
    return 'shopify';
  }
  if (/\/wp-content\/plugins\/woocommerce\/|\bwoocommerce-Price-amount\b|\bwc-blocks\b|\bwoocommerce_params\b/i.test(combinedSignals)) {
    return 'woocommerce';
  }
  if (/\/bundles\/storefront\/|\bsw-cms\b|\bdata-shopware\b|\bshopware-storefront\b/i.test(combinedSignals)) {
    return 'shopware';
  }
  if (/\bvar\s+prestashop\s*=|\/modules\/ps_[a-z0-9_]+\/|\bprestashop\b/i.test(combinedSignals)) {
    return 'prestashop';
  }
  if (/\bmage\/cookies\b|\bMagento_[A-Za-z0-9]+\b|\bx-magento-init\b/i.test(combinedSignals)) {
    return 'magento';
  }
  if (/\bcdn\d*\.bigcommerce\.com\b|\bstencil-utils\b|\bbigcommerce\b/i.test(combinedSignals)) {
    return 'bigcommerce';
  }
  if (/\bstatic\.parastorage\.com\b|\bwix-ecommerce\b|\bwixstatic\.com\b/i.test(combinedSignals)) {
    return 'wix';
  }
  if (/\bstatic\d*\.squarespace\.com\b|\bSquarespace\.onInitialize\b/i.test(combinedSignals)) {
    return 'squarespace';
  }
  return 'custom';
}

function anchorCombinedLabel(a: ParsedAnchor): string {
  return `${a.text} ${a.ariaLabel} ${a.title} ${a.href}`.trim();
}

export function discoverLegalLinks(pages: ParsedHtmlDocument[]): DiscoveredLegalLinks {
  let impressumUrl: string | null = null;
  let withdrawalPolicyUrl: string | null = null;
  let termsUrl: string | null = null;
  let privacyUrl: string | null = null;

  for (const page of pages) {
    for (const a of page.anchors) {
      if (!a.resolvedHref || !/^https?:/i.test(a.resolvedHref)) continue;
      const label = anchorCombinedLabel(a);

      if (
        !impressumUrl &&
        /\b(impressum|imprint|legal[- ]notice|mentions[- ]l[ée]gales|aviso[- ]legal|note[- ]legali|colofon)\b/i.test(
          label,
        )
      ) {
        impressumUrl = a.resolvedHref;
      }

      if (
        !withdrawalPolicyUrl &&
        /\b(widerruf|widerrufsbelehrung|widerrufsrecht|vertrag[- ]widerrufen|widerrufsbutton|withdrawal|cancel[- ]contract|r[ée]tractation|retractation|desistimiento|recesso|herroeping|herroepingsknop|odst[ąa]pienie|retouren|returns|refund[- ]policy)\b/i.test(
          label,
        )
      ) {
        withdrawalPolicyUrl = a.resolvedHref;
      }

      if (
        !termsUrl &&
        /\b(agb|allgemeine[- ]gesch[äa]ftsbedingungen|terms[- ]of[- ](?:service|use)|terms[- ]and[- ]conditions|\bterms\b|\bcgv\b|conditions[- ]g[ée]n[ée]rales|t[ée]rminos|condizioni[- ]generali|algemene[- ]voorwaarden|regulamin)\b/i.test(
          label,
        )
      ) {
        termsUrl = a.resolvedHref;
      }

      if (
        !privacyUrl &&
        /\b(datenschutz|datenschutzerkl[äa]rung|privacy[- ]policy|\bprivacy\b|confidentialit[ée]|privacidad|privacybeleid|polityka[- ]prywatno[śs]ci)\b/i.test(
          label,
        )
      ) {
        privacyUrl = a.resolvedHref;
      }
    }
  }

  return {
    impressumUrl,
    withdrawalPolicyUrl,
    termsUrl,
    privacyUrl,
  };
}

/**
 * Selects up to `maxPages` same-origin internal subpages from the homepage to inspect,
 * prioritizing interactive withdrawal links, Impressum, AGB/Terms, Returns, and Sale/Product pages.
 */
export function selectPriorityInternalSubpages(
  homeDoc: ParsedHtmlDocument,
  homeFinalUrl: string,
  maxPages: number,
): string[] {
  if (maxPages <= 0) return [];

  let homeOrigin: string;
  let homeNormalized: string;
  try {
    const u = new URL(homeFinalUrl);
    homeOrigin = u.origin;
    u.hash = '';
    homeNormalized = u.toString();
  } catch {
    return [];
  }

  const scored = new Map<string, number>();

  for (const a of homeDoc.anchors) {
    if (!a.resolvedHref || !/^https?:/i.test(a.resolvedHref)) continue;

    let parsed: URL;
    try {
      parsed = new URL(a.resolvedHref);
    } catch {
      continue;
    }

    if (parsed.origin !== homeOrigin) continue;
    parsed.hash = '';
    const cleanUrl = parsed.toString();
    if (cleanUrl === homeNormalized) continue;

    // Do not download binary files or PDFs as HTML subpages (PDF withdrawal links are detected directly on anchor href)
    if (ASSET_EXTENSION_RE.test(parsed.pathname) || /\.pdf(?:[?#]|$)/i.test(parsed.pathname)) {
      continue;
    }

    const label = `${a.text} ${a.ariaLabel} ${a.title} ${parsed.pathname}`.toLowerCase();
    let score = 0;

    // Priority 1: Interactive withdrawal / cancellation / returns
    if (
      /\b(vertrag[-_\s]*widerrufen|widerrufsbutton|widerrufsfunktion|widerrufsformular|widerruf|withdraw|cancel[-_\s]*contract|r[ée]tractation|retractation|desistimiento|recesso|herroeping|herroepingsknop|odst[ąa]pienie)\b/i.test(
        label,
      )
    ) {
      score = Math.max(score, 100);
    } else if (/\b(retouren|returns|r[üu]ckgabe|refund)\b/i.test(label)) {
      score = Math.max(score, 75);
    }

    // Priority 2: Impressum / Legal Notice (#1 location for dead EU ODR links)
    if (
      /\b(impressum|imprint|mentions[-_\s]*l[ée]gales|aviso[-_\s]*legal|note[-_\s]*legali|colofon)\b/i.test(
        label,
      )
    ) {
      score = Math.max(score, 90);
    }

    // Priority 3: Terms / AGB (#2 location for dead EU ODR links & withdrawal text)
    if (
      /\b(agb|terms|cgv|conditions[-_\s]*g[ée]n[ée]rales|t[ée]rminos|condizioni|algemene[-_\s]*voorwaarden|regulamin)\b/i.test(
        label,
      )
    ) {
      score = Math.max(score, 80);
    }

    // Priority 4: Sustainability / Sale / Product pages (for EmpCo & Omnibus checks)
    if (
      /\b(nachhaltigkeit|sustainability|eco|klimaneutral|sale|angebot|angebote|outlet|product|produkt|products|shop)\b/i.test(
        label,
      )
    ) {
      score = Math.max(score, 40);
    }

    if (score > 0) {
      if (a.inFooter || a.inNav) score += 5;
      const prev = scored.get(cleanUrl) ?? 0;
      if (score > prev) {
        scored.set(cleanUrl, score);
      }
    }
  }

  return Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPages)
    .map(([url]) => url);
}

/**
 * Core Check #2: EU Mandatory Electronic Withdrawal Button
 * (Directive (EU) 2023/2673 Art. 11a / German BGB § 356a, mandatory since June 19, 2026)
 */
export function checkWithdrawalButton(
  pages: InspectedPageBundle[],
  enabled: boolean,
): WithdrawalButtonCheckResult {
  if (!enabled) {
    return {
      checked: false,
      status: 'not_checked',
      electronicButtonFound: false,
      twoStepConfirmationFound: false,
      interactiveFormFound: false,
      staticPolicyOrPdfOnly: false,
      pdfWithdrawalUrl: null,
      loginWallDetected: false,
      loginWallUrl: null,
      buttonUrl: null,
      buttonLabel: null,
      confirmationLabel: null,
      detectedLanguages: [],
      matchedSignals: [],
    };
  }

  const detectedLangs = new Set<string>();
  const matchedSignals: string[] = [];
  let electronicButtonFound = false;
  let buttonUrl: string | null = null;
  let buttonLabel: string | null = null;

  let twoStepConfirmationFound = false;
  let confirmationLabel: string | null = null;
  let interactiveFormFound = false;

  let loginWallDetected = false;
  let loginWallUrl: string | null = null;

  let staticPolicyFound = false;
  let pdfWithdrawalUrl: string | null = null;

  for (const bundle of pages) {
    const { doc, finalUrl, redirectChain, requestedUrl } = bundle;
    const redirectedThroughLogin =
      redirectChain.some((u) => isLoginWallUrl(u)) || isLoginWallUrl(finalUrl);

    // Check if this subpage was requested as a withdrawal page and redirected into a login wall
    if (
      redirectedThroughLogin &&
      /\b(widerruf|withdraw|cancel|retractation|r[ée]tractation|desistimiento|recesso|herroeping|odstapienie)\b/i.test(
        requestedUrl,
      )
    ) {
      loginWallDetected = true;
      loginWallUrl = redirectChain.find((u) => isLoginWallUrl(u)) ?? finalUrl;
      matchedSignals.push(`Withdrawal route "${requestedUrl}" redirected to login wall "${loginWallUrl}"`);
    }

    // 1. Inspect anchors (<a href="...">)
    for (const a of doc.anchors) {
      const combinedText = `${a.text} ${a.ariaLabel} ${a.title}`.trim();
      const targetHref = a.resolvedHref || a.href;

      // PDF withdrawal form check
      if (
        /\.pdf(?:[?#]|$)/i.test(targetHref) &&
        (STATIC_WITHDRAWAL_POLICY_RE.test(`${combinedText} ${targetHref}`) ||
          /\b(widerruf|withdrawal|retractation|desistimiento|recesso|herroeping)\b/i.test(
            `${combinedText} ${targetHref}`,
          ))
      ) {
        pdfWithdrawalUrl = pdfWithdrawalUrl ?? targetHref;
        staticPolicyFound = true;
      }

      if (STATIC_WITHDRAWAL_POLICY_RE.test(combinedText)) {
        staticPolicyFound = true;
      }

      for (const pat of INTERACTIVE_WITHDRAWAL_PATTERNS) {
        if (pat.regex.test(combinedText) || /\b(?:widerrufsbutton|herroepingsknop)\b/i.test(`${a.id} ${a.className}`)) {
          detectedLangs.add(pat.lang);
          const displayLabel = a.text || a.ariaLabel || pat.label;

          if (isLoginWallUrl(targetHref)) {
            loginWallDetected = true;
            loginWallUrl = loginWallUrl ?? targetHref;
            buttonLabel = buttonLabel ?? displayLabel;
            buttonUrl = buttonUrl ?? targetHref;
            matchedSignals.push(
              `Withdrawal link "${displayLabel}" points directly to login wall "${targetHref}"`,
            );
          } else if (!/\.pdf(?:[?#]|$)/i.test(targetHref)) {
            electronicButtonFound = true;
            buttonLabel = buttonLabel ?? displayLabel;
            buttonUrl = buttonUrl ?? (targetHref || finalUrl);
            matchedSignals.push(`Interactive withdrawal link "${displayLabel}" on ${finalUrl}`);
          }
          break;
        }
      }

      for (const cPat of STEP2_CONFIRMATION_PATTERNS) {
        if (cPat.regex.test(combinedText)) {
          detectedLangs.add(cPat.lang);
          twoStepConfirmationFound = true;
          confirmationLabel = confirmationLabel ?? (a.text || a.ariaLabel || cPat.label);
          matchedSignals.push(`Step-2 confirmation link/button "${confirmationLabel}" on ${finalUrl}`);
          break;
        }
      }
    }

    // 2. Inspect <button>, <input type="submit|button">, and [role="button"] controls
    for (const ctrl of doc.controls) {
      const combinedCtrl = `${ctrl.text} ${ctrl.ariaLabel} ${ctrl.id} ${ctrl.className} ${ctrl.dataAttributes}`;

      for (const pat of INTERACTIVE_WITHDRAWAL_PATTERNS) {
        if (pat.regex.test(combinedCtrl)) {
          detectedLangs.add(pat.lang);
          electronicButtonFound = true;
          const displayLabel = ctrl.text || ctrl.ariaLabel || pat.label;
          buttonLabel = buttonLabel ?? displayLabel;
          buttonUrl = buttonUrl ?? finalUrl;
          matchedSignals.push(`Interactive <${ctrl.tag}> "${displayLabel}" on ${finalUrl}`);
          break;
        }
      }

      for (const cPat of STEP2_CONFIRMATION_PATTERNS) {
        if (
          cPat.regex.test(combinedCtrl) ||
          /\bdata-withdrawal-step\s*=\s*["']2["']|\bconfirm-withdrawal\b|\bwiderruf-bestaetigen\b/i.test(
            combinedCtrl,
          )
        ) {
          detectedLangs.add(cPat.lang);
          twoStepConfirmationFound = true;
          const displayConfirm = ctrl.text || ctrl.ariaLabel || cPat.label;
          confirmationLabel = confirmationLabel ?? displayConfirm;
          matchedSignals.push(`Step-2 confirmation <${ctrl.tag}> "${displayConfirm}" on ${finalUrl}`);
          break;
        }
      }
    }

    // 3. Inspect <form> elements (distinguish guest-accessible withdrawal forms vs login-gated forms)
    for (const form of doc.forms) {
      const formSignals = `${form.id} ${form.className} ${form.action} ${form.buttonTexts.join(' ')} ${form.textSnippet}`;
      const isWithdrawalRelatedPageOrForm =
        /\b(widerruf|withdraw|cancel[- ]contract|r[ée]tractation|retractation|desistimiento|recesso|herroeping|odst[ąa]pienie)\b/i.test(
          `${finalUrl} ${formSignals}`,
        );

      if (isWithdrawalRelatedPageOrForm) {
        if (
          (form.hasPasswordInput || isLoginWallUrl(form.resolvedAction)) &&
          !twoStepConfirmationFound
        ) {
          loginWallDetected = true;
          loginWallUrl = loginWallUrl ?? (isLoginWallUrl(form.resolvedAction) ? form.resolvedAction : finalUrl);
          matchedSignals.push(
            `Password/account login form gating withdrawal flow at "${loginWallUrl}"`,
          );
        } else if (form.hasEmailOrOrderInput || form.buttonTexts.length > 0) {
          interactiveFormFound = true;
        }
      }
    }

    // 4. Check inline scripts for 2-step confirmation modal/widget labels rendered dynamically on click
    const inlineCombined = doc.inlineScripts.join('\n');
    if (inlineCombined) {
      for (const cPat of STEP2_CONFIRMATION_PATTERNS) {
        if (cPat.regex.test(inlineCombined)) {
          detectedLangs.add(cPat.lang);
          twoStepConfirmationFound = true;
          confirmationLabel = confirmationLabel ?? cPat.label;
          matchedSignals.push(`Step-2 confirmation trigger "${cPat.label}" in client script on ${finalUrl}`);
          break;
        }
      }
    }

    // 5. Static policy prose detection
    if (STATIC_WITHDRAWAL_POLICY_RE.test(doc.visibleText)) {
      staticPolicyFound = true;
    }
  }

  let status: WithdrawalButtonCheckResult['status'];
  if (loginWallDetected && !twoStepConfirmationFound) {
    status = 'login_walled';
  } else if (electronicButtonFound && twoStepConfirmationFound && !loginWallDetected) {
    status = 'compliant_2step';
  } else if (electronicButtonFound && loginWallDetected) {
    status = 'login_walled';
  } else if (electronicButtonFound) {
    status = 'partial_single_step';
  } else if (staticPolicyFound || pdfWithdrawalUrl !== null) {
    status = 'static_policy_or_pdf_only';
  } else {
    status = 'missing';
  }

  return {
    checked: true,
    status,
    electronicButtonFound: electronicButtonFound && !loginWallDetected,
    twoStepConfirmationFound: twoStepConfirmationFound && !loginWallDetected,
    interactiveFormFound,
    staticPolicyOrPdfOnly: status === 'static_policy_or_pdf_only',
    pdfWithdrawalUrl,
    loginWallDetected,
    loginWallUrl,
    buttonUrl,
    buttonLabel,
    confirmationLabel,
    detectedLanguages: Array.from(detectedLangs),
    matchedSignals: Array.from(new Set(matchedSignals)).slice(0, 10),
  };
}

/**
 * Core Check #3: Abolished EU ODR Link Trap
 * (Regulation (EU) 2024/3228 — EU ODR platform permanently shut down July 20, 2025)
 */
export function checkAbolishedOdrLink(
  pages: InspectedPageBundle[],
  enabled: boolean,
): OdrLinkCheckResult {
  if (!enabled) {
    return {
      checked: false,
      abolishedOdrLinkFound: false,
      odrUrls: [],
      foundOnPages: [],
      regulatoryNote: null,
    };
  }

  const odrUrls = new Set<string>();
  const foundOnPages = new Set<string>();
  const odrRegex = /https?:\/\/(?:www\.)?ec\.europa\.eu\/consumers\/odr[^\s"'<>)]*|ec\.europa\.eu\/consumers\/odr[^\s"'<>)]*/gi;

  for (const { doc, finalUrl } of pages) {
    for (const a of doc.anchors) {
      if (/ec\.europa\.eu\/consumers\/odr/i.test(`${a.href} ${a.resolvedHref}`)) {
        odrUrls.add(a.resolvedHref || a.href);
        foundOnPages.add(finalUrl);
      }
    }

    let m: RegExpExecArray | null;
    odrRegex.lastIndex = 0;
    while ((m = odrRegex.exec(doc.rawHtml)) !== null) {
      const rawMatch = m[0].replace(/[.,;]+$/, '');
      odrUrls.add(rawMatch.startsWith('http') ? rawMatch : `https://${rawMatch}`);
      foundOnPages.add(finalUrl);
      if (odrUrls.size >= 10) break;
    }
  }

  const abolishedOdrLinkFound = odrUrls.size > 0;

  return {
    checked: true,
    abolishedOdrLinkFound,
    odrUrls: Array.from(odrUrls),
    foundOnPages: Array.from(foundOnPages),
    regulatoryNote: abolishedOdrLinkFound
      ? 'Regulation (EU) 2024/3228 repealed the ODR Regulation and permanently discontinued ec.europa.eu/consumers/odr on July 20, 2025. Retaining links to the defunct ODR portal misleads consumers and is a frequent EU/German unfair-competition (Abmahnung) trigger.'
      : null,
  };
}

const GENERIC_GREEN_CLAIM_PATTERNS: Array<{ label: string; isOffsetNeutrality: boolean; regex: RegExp }> = [
  { label: 'eco-friendly', isOffsetNeutrality: false, regex: /\beco[- ]?friendly\b/i },
  { label: 'environmentally friendly', isOffsetNeutrality: false, regex: /\benvironmentally\s+friendly\b/i },
  { label: 'climate neutral', isOffsetNeutrality: true, regex: /\bclimate[- ]neutral\b/i },
  { label: 'carbon neutral', isOffsetNeutrality: true, regex: /\bcarbon[- ]neutral\b/i },
  { label: 'CO2 neutral', isOffsetNeutrality: true, regex: /\bco2[- ]neutral\b/i },
  { label: 'net zero', isOffsetNeutrality: true, regex: /\bnet[- ]zero\b/i },
  { label: '100% sustainable', isOffsetNeutrality: false, regex: /\b100\s*%\s*(?:sustainable|green|eco)\b/i },
  { label: 'biodegradable', isOffsetNeutrality: false, regex: /\bbiodegradable\b/i },
  { label: 'klimaneutral', isOffsetNeutrality: true, regex: /\bklimaneutral(?:e|er|es|en|em)?\b/i },
  { label: 'umweltfreundlich', isOffsetNeutrality: false, regex: /\bumweltfreundlich(?:e|er|es|en|em)?\b/i },
  { label: '100% nachhaltig', isOffsetNeutrality: false, regex: /\b100\s*%\s*nachhaltig(?:e|er|es|en)?\b/i },
  { label: 'biologisch abbaubar', isOffsetNeutrality: false, regex: /\bbiologisch\s+abbaubar(?:e|er|es|en)?\b/i },
  { label: 'éco-responsable', isOffsetNeutrality: false, regex: /\b[ée]co[- ]?responsables?\b/i },
  { label: 'neutre en carbone', isOffsetNeutrality: true, regex: /\bneutre\s+en\s+carbone\b/i },
  { label: 'klimaatneutraal', isOffsetNeutrality: true, regex: /\bklimaatneutraal\b/i },
  { label: 'milieuvriendelijk', isOffsetNeutrality: false, regex: /\bmilieuvriendelijk\b/i },
];

const RECOGNIZED_CERTIFICATIONS: Array<{ name: string; regex: RegExp }> = [
  { name: 'EU Ecolabel', regex: /\beu[- ]ecolabel\b/i },
  { name: 'Blauer Engel', regex: /\b(?:blauer\s+engel|blue\s+angel\s+ecolabel)\b/i },
  { name: 'Nordic Swan', regex: /\bnordic\s+swan(?:\s+ecolabel)?\b/i },
  { name: 'GOTS', regex: /\b(?:gots\b|global\s+organic\s+textile\s+standard)/i },
  { name: 'OEKO-TEX', regex: /\b(?:oeko[- ]?tex|öko[- ]?tex)\b/i },
  { name: 'FSC', regex: /\b(?:fsc[- ]certified|fsc®|fsc\s+mix|fsc\s+100%|\bfsc\b)/i },
  { name: 'PEFC', regex: /\bpefc(?:\s+certified|®)?\b/i },
  { name: 'B Corp', regex: /\b(?:certified\s+b\s+corp(?:oration)?|b[- ]corp\s+certified|\bb\s+corp\b)/i },
  { name: 'Cradle to Cradle', regex: /\bcradle\s+to\s+cradle\b/i },
  { name: 'ISO 14024', regex: /\biso\s*14024\b/i },
];

function extractPhraseContext(text: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 32);
  const end = Math.min(text.length, matchIndex + matchLength + 40);
  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = `...${snippet}`;
  if (end < text.length) snippet = `${snippet}...`;
  return snippet;
}

/**
 * Core Check #4: EU EmpCo Greenwashing Claims
 * (Directive (EU) 2024/825, mandatory across EU Member States since September 27, 2026)
 */
export function checkEmpCoGreenClaims(
  pages: InspectedPageBundle[],
  enabled: boolean,
): EmpCoGreenClaimsCheckResult {
  if (!enabled) {
    return {
      checked: false,
      genericClaimsFound: false,
      unsubstantiatedRisk: false,
      offsetNeutralityClaimFound: false,
      recognizedCertificationsFound: [],
      matchedGenericClaims: [],
      foundOnPages: [],
    };
  }

  const matchedGenericClaims: string[] = [];
  const seenQuotes = new Set<string>();
  const certifications = new Set<string>();
  const foundOnPages = new Set<string>();
  let offsetNeutralityClaimFound = false;

  for (const { doc, finalUrl } of pages) {
    const text = doc.visibleText;

    for (const cert of RECOGNIZED_CERTIFICATIONS) {
      if (cert.regex.test(text)) {
        certifications.add(cert.name);
      }
    }

    for (const pat of GENERIC_GREEN_CLAIM_PATTERNS) {
      const m = pat.regex.exec(text);
      if (m && m.index !== undefined) {
        // Skip explicit negations like "not climate neutral" or "keine klimaneutral"
        const preceding = text.slice(Math.max(0, m.index - 18), m.index).toLowerCase();
        if (/\b(not|no|never|without|kein|keine|nicht|sans)\s+$/.test(preceding)) {
          continue;
        }

        if (pat.isOffsetNeutrality) {
          offsetNeutralityClaimFound = true;
        }
        foundOnPages.add(finalUrl);

        if (matchedGenericClaims.length < 5) {
          const quote = extractPhraseContext(text, m.index, m[0].length);
          const normKey = pat.label.toLowerCase();
          if (!seenQuotes.has(normKey)) {
            seenQuotes.add(normKey);
            matchedGenericClaims.push(`${pat.label}: "${quote}"`);
          }
        }
      }
    }
  }

  const genericClaimsFound = matchedGenericClaims.length > 0;
  const recognizedCertificationsFound = Array.from(certifications);
  const unsubstantiatedRisk = genericClaimsFound && recognizedCertificationsFound.length === 0;

  return {
    checked: true,
    genericClaimsFound,
    unsubstantiatedRisk,
    offsetNeutralityClaimFound,
    recognizedCertificationsFound,
    matchedGenericClaims: matchedGenericClaims.slice(0, 5),
    foundOnPages: Array.from(foundOnPages),
  };
}

const TEXT_DISCOUNT_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'was €', regex: /\bwas\s*(?:€|eur|\$|£)\s*\d+/i },
  { label: 'statt ', regex: /\bstatt\s+(?:€\s*)?\d+[.,]?\d*\s*(?:€|eur)?/i },
  { label: 'UVP ', regex: /\buvp[:\s]+(?:€\s*)?\d+[.,]?\d*/i },
  { label: 'au lieu de ', regex: /\bau\s+lieu\s+de\s+\d+[.,]?\d*\s*(?:€|eur)/i },
  { label: 'antes ', regex: /\bantes\s*(?:€\s*)?\d+[.,]?\d*\s*(?:€|eur)/i },
];

const OMNIBUS_30_DAY_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: '30 days', regex: /\b30[- ]days?\b/i },
  { label: 'lowest price', regex: /\blowest\s+(?:prior\s+|total\s+)?price\b/i },
  { label: '30 Tage', regex: /\b30\s*tagen?\b/i },
  { label: 'niedrigster Gesamtpreis', regex: /\bniedrigste[rn]?\s+(?:gesamt)?preis\b/i },
  { label: '30 derniers jours', regex: /\b30\s*(?:derniers\s+)?jours\b/i },
  { label: 'prix le plus bas', regex: /\bprix\s+(?:ant[ée]rieur\s+)?le\s+plus\s+bas\b/i },
  { label: '30 días', regex: /\b30\s*d[íi]as\b/i },
  { label: 'precio más bajo', regex: /\bprecio\s+m[áa]s\s+bajo\b/i },
  { label: '30 giorni', regex: /\b30\s*giorni\b/i },
  { label: 'prezzo più basso', regex: /\bprezzo\s+pi[ùu]\s+basso\b/i },
  { label: '30 dagen', regex: /\b30\s*dagen\b/i },
  { label: 'laagste prijs', regex: /\blaagste\s+(?:verkoop)?prijs\b/i },
  { label: '30 dni', regex: /\b30\s*dni\b/i },
  { label: 'najniższa cena', regex: /\bnajni[żz]sza\s+cena\b/i },
];

/**
 * Core Check #5: EU Omnibus 30-Day Lowest Prior Price
 * (Directive (EU) 2019/2161 Art. 6a / German PAngV § 11)
 */
export function checkOmnibusPricing(
  pages: InspectedPageBundle[],
  enabled: boolean,
): OmnibusPricingCheckResult {
  if (!enabled) {
    return {
      checked: false,
      discountIndicatorsFound: false,
      thirtyDayPriorPriceFound: false,
      omnibusViolationRisk: false,
      matchedDiscountSignals: [],
      matchedPriorPricePhrases: [],
      foundOnPages: [],
    };
  }

  const discountSignals = new Set<string>();
  const priorPricePhrases = new Set<string>();
  const foundOnPages = new Set<string>();

  for (const { doc, finalUrl } of pages) {
    let pageHasDiscount = false;

    for (const st of doc.strikethroughTexts.slice(0, 5)) {
      discountSignals.add(st);
      pageHasDiscount = true;
    }

    for (const domSig of doc.discountDomSignals) {
      discountSignals.add(domSig);
      pageHasDiscount = true;
    }

    for (const pat of TEXT_DISCOUNT_PATTERNS) {
      const m = pat.regex.exec(doc.visibleText);
      if (m) {
        discountSignals.add(m[0].trim());
        pageHasDiscount = true;
      }
    }

    if (pageHasDiscount) {
      foundOnPages.add(finalUrl);
    }

    for (const pPat of OMNIBUS_30_DAY_PATTERNS) {
      if (pPat.regex.test(doc.visibleText) || pPat.regex.test(doc.rawHtml)) {
        priorPricePhrases.add(pPat.label);
      }
    }
  }

  const discountIndicatorsFound = discountSignals.size > 0;
  const thirtyDayPriorPriceFound = priorPricePhrases.size > 0;
  const omnibusViolationRisk = discountIndicatorsFound && !thirtyDayPriorPriceFound;

  return {
    checked: true,
    discountIndicatorsFound,
    thirtyDayPriorPriceFound,
    omnibusViolationRisk,
    matchedDiscountSignals: Array.from(discountSignals).slice(0, 8),
    matchedPriorPricePhrases: Array.from(priorPricePhrases).slice(0, 8),
    foundOnPages: Array.from(foundOnPages),
  };
}
