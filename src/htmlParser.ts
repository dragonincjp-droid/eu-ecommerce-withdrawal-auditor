import type {
  ParsedAnchor,
  ParsedControl,
  ParsedForm,
  ParsedHtmlDocument,
} from './types.js';

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  euro: '€',
  pound: '£',
  copy: '©',
  reg: '®',
  sect: '§',
  ndash: '–',
  mdash: '—',
  laquo: '«',
  raquo: '»',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  euml: 'ë',
  Eacute: 'É',
  agrave: 'à',
  aacute: 'á',
  acirc: 'â',
  ccedil: 'ç',
  oacute: 'ó',
  ograve: 'ò',
  ocirc: 'ô',
  iacute: 'í',
  igrave: 'ì',
  uacute: 'ú',
  ugrave: 'ù',
  ntilde: 'ñ',
};

export function decodeHtmlEntities(input: string): string {
  if (!input || !input.includes('&')) return input;
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z0-9]+);/g, (full, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16);
      if (!Number.isNaN(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return full;
        }
      }
      return full;
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10);
      if (!Number.isNaN(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return full;
        }
      }
      return full;
    }
    return NAMED_HTML_ENTITIES[entity] ?? full;
  });
}

function getAttr(attrString: string, attrName: string): string {
  if (!attrString) return '';
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>` + '`' + `]+))`,
    'i',
  );
  const match = regex.exec(attrString);
  if (!match) return '';
  const raw = match[1] ?? match[2] ?? match[3] ?? '';
  return decodeHtmlEntities(raw).trim();
}

function extractDataAttributesSummary(attrString: string): string {
  if (!attrString) return '';
  const matches: string[] = [];
  const re = /\b(data-[a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrString)) !== null) {
    const key = m[1].toLowerCase();
    const val = decodeHtmlEntities(m[2] ?? m[3] ?? m[4] ?? '').slice(0, 80);
    matches.push(val ? `${key}="${val}"` : key);
    if (matches.length >= 10) break;
  }
  return matches.join(' ');
}

function stripTagsPreserveAlt(htmlFragment: string): string {
  if (!htmlFragment) return '';
  const withImgAlt = htmlFragment.replace(/<img\b([^>]*)>/gi, (_m, attrs: string) => {
    const alt = getAttr(attrs, 'alt');
    return alt ? ` ${alt} ` : ' ';
  });
  const withoutTags = withImgAlt.replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

function safeResolveUrl(rawHref: string, baseUrl: string): string {
  const trimmed = rawHref.trim();
  if (!trimmed) return '';
  if (/^(?:javascript|mailto|tel|data):/i.test(trimmed)) {
    return trimmed;
  }
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function findRegionRanges(html: string, tagName: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const re = new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
    if (ranges.length >= 25) break;
  }
  return ranges;
}

function isIndexInRanges(idx: number, ranges: Array<[number, number]>): boolean {
  for (const [start, end] of ranges) {
    if (idx >= start && idx <= end) return true;
  }
  return false;
}

export function parseHtmlDocument(rawHtml: string, pageUrl: string): ParsedHtmlDocument {
  const html = rawHtml || '';

  // 1. Remove HTML comments first
  const uncommented = html.replace(/<!--[\s\S]*?-->/g, ' ');

  // 2. <html lang="..."> & <title>
  let htmlLang: string | null = null;
  const htmlTagMatch = /<html\b([^>]*)>/i.exec(uncommented);
  if (htmlTagMatch) {
    const rawLang = getAttr(htmlTagMatch[1], 'lang');
    if (rawLang) {
      htmlLang = rawLang.split(/[-_]/)[0].toLowerCase();
    }
  }

  let title: string | null = null;
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(uncommented);
  if (titleMatch) {
    const cleanTitle = decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, ' ').trim();
    title = cleanTitle || null;
  }

  // 3. Extract <script> URLs, inline scripts, and JSON-LD blocks before stripping scripts
  const scriptUrls: string[] = [];
  const inlineScripts: string[] = [];
  const jsonLdBlocks: unknown[] = [];

  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRe.exec(uncommented)) !== null) {
    const attrs = scriptMatch[1] || '';
    const body = (scriptMatch[2] || '').trim();
    const src = getAttr(attrs, 'src');
    const type = getAttr(attrs, 'type').toLowerCase();

    if (src && scriptUrls.length < 150) {
      scriptUrls.push(safeResolveUrl(src, pageUrl));
    }
    if (type === 'application/ld+json' && body && jsonLdBlocks.length < 25) {
      try {
        jsonLdBlocks.push(JSON.parse(body));
      } catch {
        // Ignore invalid JSON-LD blocks
      }
    } else if (!src && body && inlineScripts.length < 40) {
      inlineScripts.push(body.slice(0, 6_000));
    }
  }

  // 4. Extract <link> stylesheet/resource URLs
  const stylesheetUrls: string[] = [];
  const linkRe = /<link\b([^>]*)>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRe.exec(uncommented)) !== null) {
    const href = getAttr(linkMatch[1], 'href');
    if (href && stylesheetUrls.length < 100) {
      stylesheetUrls.push(safeResolveUrl(href, pageUrl));
    }
  }

  // 5. Strip <script>, <style>, <noscript> for structural DOM inspection
  const domHtml = uncommented
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

  const footerRanges = findRegionRanges(domHtml, 'footer');
  const navRanges = [
    ...findRegionRanges(domHtml, 'nav'),
    ...findRegionRanges(domHtml, 'header'),
  ];

  // 6. Extract <a ...>...</a> anchors
  const anchors: ParsedAnchor[] = [];
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let anchorMatch: RegExpExecArray | null;
  while ((anchorMatch = anchorRe.exec(domHtml)) !== null) {
    if (anchors.length >= 500) break;
    const attrs = anchorMatch[1] || '';
    const inner = anchorMatch[2] || '';
    const href = getAttr(attrs, 'href');
    const resolvedHref = href ? safeResolveUrl(href, pageUrl) : '';
    const text = stripTagsPreserveAlt(inner).slice(0, 240);
    const ariaLabel = getAttr(attrs, 'aria-label').slice(0, 200);
    const anchorTitle = getAttr(attrs, 'title').slice(0, 200);
    const id = getAttr(attrs, 'id');
    const className = getAttr(attrs, 'class');

    anchors.push({
      href,
      resolvedHref,
      text,
      ariaLabel,
      title: anchorTitle,
      id,
      className,
      inFooter: isIndexInRanges(anchorMatch.index, footerRanges),
      inNav: isIndexInRanges(anchorMatch.index, navRanges),
    });
  }

  // 7. Extract interactive <button>, <input type="submit|button">, and [role="button"] controls
  const controls: ParsedControl[] = [];
  const buttonRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let btnMatch: RegExpExecArray | null;
  while ((btnMatch = buttonRe.exec(domHtml)) !== null) {
    if (controls.length >= 250) break;
    const attrs = btnMatch[1] || '';
    controls.push({
      tag: 'button',
      type: getAttr(attrs, 'type').toLowerCase() || 'submit',
      text: stripTagsPreserveAlt(btnMatch[2] || '').slice(0, 240),
      ariaLabel: getAttr(attrs, 'aria-label').slice(0, 200),
      id: getAttr(attrs, 'id'),
      className: getAttr(attrs, 'class'),
      name: getAttr(attrs, 'name'),
      dataAttributes: extractDataAttributesSummary(attrs),
    });
  }

  const inputBtnRe = /<input\b([^>]*)>/gi;
  let inpMatch: RegExpExecArray | null;
  while ((inpMatch = inputBtnRe.exec(domHtml)) !== null) {
    if (controls.length >= 300) break;
    const attrs = inpMatch[1] || '';
    const inpType = getAttr(attrs, 'type').toLowerCase();
    if (inpType === 'submit' || inpType === 'button') {
      controls.push({
        tag: 'input',
        type: inpType,
        text: getAttr(attrs, 'value').slice(0, 240),
        ariaLabel: getAttr(attrs, 'aria-label').slice(0, 200),
        id: getAttr(attrs, 'id'),
        className: getAttr(attrs, 'class'),
        name: getAttr(attrs, 'name'),
        dataAttributes: extractDataAttributesSummary(attrs),
      });
    }
  }

  const roleBtnRe = /<(?:div|span|label|summary)\b([^>]*\brole\s*=\s*["']button["'][^>]*)>([\s\S]*?)<\/(?:div|span|label|summary)>/gi;
  let roleMatch: RegExpExecArray | null;
  while ((roleMatch = roleBtnRe.exec(domHtml)) !== null) {
    if (controls.length >= 350) break;
    const attrs = roleMatch[1] || '';
    controls.push({
      tag: 'role-button',
      type: 'button',
      text: stripTagsPreserveAlt(roleMatch[2] || '').slice(0, 240),
      ariaLabel: getAttr(attrs, 'aria-label').slice(0, 200),
      id: getAttr(attrs, 'id'),
      className: getAttr(attrs, 'class'),
      name: getAttr(attrs, 'name'),
      dataAttributes: extractDataAttributesSummary(attrs),
    });
  }

  // 8. Extract <form> elements
  const forms: ParsedForm[] = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let formMatch: RegExpExecArray | null;
  while ((formMatch = formRe.exec(domHtml)) !== null) {
    if (forms.length >= 50) break;
    const attrs = formMatch[1] || '';
    const inner = formMatch[2] || '';
    const action = getAttr(attrs, 'action');
    const resolvedAction = action ? safeResolveUrl(action, pageUrl) : pageUrl;
    const method = (getAttr(attrs, 'method') || 'get').toLowerCase();
    const id = getAttr(attrs, 'id');
    const className = getAttr(attrs, 'class');

    const inputNamesAndTypes: string[] = [];
    let hasPasswordInput = false;
    let hasEmailOrOrderInput = false;

    const fieldRe = /<(?:input|select|textarea)\b([^>]*)>/gi;
    let fm: RegExpExecArray | null;
    while ((fm = fieldRe.exec(inner)) !== null) {
      const fAttrs = fm[1] || '';
      const fType = (getAttr(fAttrs, 'type') || 'text').toLowerCase();
      const fName = getAttr(fAttrs, 'name');
      const fId = getAttr(fAttrs, 'id');
      const fPlaceholder = getAttr(fAttrs, 'placeholder');
      const combined = `${fName} ${fId} ${fPlaceholder}`.toLowerCase();

      if (fType === 'password') {
        hasPasswordInput = true;
      }
      if (
        fType === 'email' ||
        /\b(email|e-mail|mail|order|bestell|vertrag|contract|commande|pedido|ordine|nummer|number|ref)\b/i.test(
          combined,
        )
      ) {
        hasEmailOrOrderInput = true;
      }
      inputNamesAndTypes.push(`${fName || fId || 'field'}:${fType}`);
    }

    const buttonTexts: string[] = [];
    const innerBtnRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
    let ibm: RegExpExecArray | null;
    while ((ibm = innerBtnRe.exec(inner)) !== null) {
      const t = stripTagsPreserveAlt(ibm[2] || '') || getAttr(ibm[1] || '', 'aria-label');
      if (t) buttonTexts.push(t.slice(0, 160));
    }
    const innerSubRe = /<input\b([^>]*)>/gi;
    let ism: RegExpExecArray | null;
    while ((ism = innerSubRe.exec(inner)) !== null) {
      const tType = getAttr(ism[1] || '', 'type').toLowerCase();
      if (tType === 'submit' || tType === 'button') {
        const val = getAttr(ism[1] || '', 'value');
        if (val) buttonTexts.push(val.slice(0, 160));
      }
    }

    forms.push({
      action,
      resolvedAction,
      method,
      id,
      className,
      inputNamesAndTypes,
      hasPasswordInput,
      hasEmailOrOrderInput,
      buttonTexts,
      textSnippet: stripTagsPreserveAlt(inner).slice(0, 500),
    });
  }

  // 9. Extract strike-through tags (<del>, <s>, <strike>) and Omnibus discount DOM signals
  const strikethroughTexts: string[] = [];
  const strikeRe = /<(del|s|strike)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let strikeMatch: RegExpExecArray | null;
  while ((strikeMatch = strikeRe.exec(domHtml)) !== null) {
    if (strikethroughTexts.length >= 30) break;
    const txt = stripTagsPreserveAlt(strikeMatch[2] || '');
    if (txt && /\d/.test(txt) && txt.length <= 120) {
      strikethroughTexts.push(`<${strikeMatch[1].toLowerCase()}>${txt}</${strikeMatch[1].toLowerCase()}>`);
    }
  }

  const discountDomSignals: string[] = [];
  const domClassPatterns: Array<{ label: string; regex: RegExp }> = [
    { label: 'compare-at', regex: /\bcompare-at(?:-[a-z0-9_-]+)?\b/i },
    { label: 'compare_at_price', regex: /"compare_at_price"\s*:\s*(?:[1-9]\d*|"[1-9][^"]*")|\bcompare_at_price\b/i },
    { label: 'old-price', regex: /\bold-price\b/i },
    { label: 'price--compare', regex: /\bprice--compare(?:-[a-z0-9_-]+)?\b/i },
    { label: 'was-price', regex: /\bwas-price\b/i },
  ];

  for (const pat of domClassPatterns) {
    if (pat.regex.test(uncommented)) {
      discountDomSignals.push(pat.label);
    }
  }

  // 10. Clean visible text (strip remaining SVG bodies, keep img[alt])
  const withoutSvg = domHtml.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ');
  const visibleText = stripTagsPreserveAlt(withoutSvg);

  return {
    url: pageUrl,
    title,
    htmlLang,
    rawHtml: html,
    visibleText,
    scriptUrls,
    inlineScripts,
    stylesheetUrls,
    jsonLdBlocks,
    anchors,
    controls,
    forms,
    strikethroughTexts,
    discountDomSignals,
  };
}
