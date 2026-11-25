export const LEGAL_DISCLAIMER =
  'Automated technical heuristic signals for human review only; does not constitute legal advice or formal regulatory certification.';

export const PPE_EVENTS = {
  ACTOR_START: 'actor-start',
  URL_AUDITED: 'url-audited',
  REMEDIATION_PACK_GENERATED: 'remediation-pack-generated',
} as const;

export type PpeEventName = (typeof PPE_EVENTS)[keyof typeof PPE_EVENTS];

export type RiskTier = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
export type AuditStatus = 'audited' | 'blocked_ssrf' | 'blocked_robots' | 'error';

export type EcommercePlatform =
  | 'shopify'
  | 'woocommerce'
  | 'shopware'
  | 'prestashop'
  | 'magento'
  | 'bigcommerce'
  | 'wix'
  | 'squarespace'
  | 'custom';

export type WithdrawalFlowStatus =
  | 'compliant_2step'
  | 'partial_single_step'
  | 'login_walled'
  | 'static_policy_or_pdf_only'
  | 'missing'
  | 'not_checked';

export interface UrlRequestObject {
  url: string;
}

export interface RawActorInput {
  urls?: Array<string | UrlRequestObject>;
  startUrls?: Array<string | UrlRequestObject>;
  url?: string;
  datasetId?: string;
  datasetUrlField?: string;
  maxLegalPagesPerDomain?: number;
  includeRemediationPack?: boolean;
  checkWithdrawalButton?: boolean;
  checkAbolishedOdrLink?: boolean;
  checkEmpCoGreenClaims?: boolean;
  checkOmnibusPricing?: boolean;
  respectRobotsTxt?: boolean;
  maxUrls?: number;
  maxConcurrency?: number;
  domainDelayMs?: number;
  requestTimeoutMs?: number;
  maxBudgetUsd?: number;
  maxTotalChargeUsd?: number;
}

export interface NormalizedAuditInput {
  urls: string[];
  datasetId?: string;
  datasetUrlField?: string;
  maxLegalPagesPerDomain: number;
  includeRemediationPack: boolean;
  checkWithdrawalButton: boolean;
  checkAbolishedOdrLink: boolean;
  checkEmpCoGreenClaims: boolean;
  checkOmnibusPricing: boolean;
  respectRobotsTxt: boolean;
  maxUrls: number;
  maxConcurrency: number;
  domainDelayMs: number;
  requestTimeoutMs: number;
  maxBudgetUsd?: number;
}

export interface ParsedAnchor {
  href: string;
  resolvedHref: string;
  text: string;
  ariaLabel: string;
  title: string;
  id: string;
  className: string;
  inFooter: boolean;
  inNav: boolean;
}

export interface ParsedControl {
  tag: 'button' | 'input' | 'role-button';
  type: string;
  text: string;
  ariaLabel: string;
  id: string;
  className: string;
  name: string;
  dataAttributes: string;
}

export interface ParsedForm {
  action: string;
  resolvedAction: string;
  method: string;
  id: string;
  className: string;
  inputNamesAndTypes: string[];
  hasPasswordInput: boolean;
  hasEmailOrOrderInput: boolean;
  buttonTexts: string[];
  textSnippet: string;
}

export interface ParsedHtmlDocument {
  url: string;
  title: string | null;
  htmlLang: string | null;
  rawHtml: string;
  visibleText: string;
  scriptUrls: string[];
  inlineScripts: string[];
  stylesheetUrls: string[];
  jsonLdBlocks: unknown[];
  anchors: ParsedAnchor[];
  controls: ParsedControl[];
  forms: ParsedForm[];
  strikethroughTexts: string[];
  discountDomSignals: string[];
}

export interface WithdrawalButtonCheckResult {
  checked: boolean;
  status: WithdrawalFlowStatus;
  electronicButtonFound: boolean;
  twoStepConfirmationFound: boolean;
  interactiveFormFound: boolean;
  staticPolicyOrPdfOnly: boolean;
  pdfWithdrawalUrl: string | null;
  loginWallDetected: boolean;
  loginWallUrl: string | null;
  buttonUrl: string | null;
  buttonLabel: string | null;
  confirmationLabel: string | null;
  detectedLanguages: string[];
  matchedSignals: string[];
}

export interface OdrLinkCheckResult {
  checked: boolean;
  abolishedOdrLinkFound: boolean;
  odrUrls: string[];
  foundOnPages: string[];
  regulatoryNote: string | null;
}

export interface EmpCoGreenClaimsCheckResult {
  checked: boolean;
  genericClaimsFound: boolean;
  unsubstantiatedRisk: boolean;
  offsetNeutralityClaimFound: boolean;
  recognizedCertificationsFound: string[];
  matchedGenericClaims: string[];
  foundOnPages: string[];
}

export interface OmnibusPricingCheckResult {
  checked: boolean;
  discountIndicatorsFound: boolean;
  thirtyDayPriorPriceFound: boolean;
  omnibusViolationRisk: boolean;
  matchedDiscountSignals: string[];
  matchedPriorPricePhrases: string[];
  foundOnPages: string[];
}

export interface DiscoveredLegalLinks {
  impressumUrl: string | null;
  withdrawalPolicyUrl: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
}

export interface ComplianceFinding {
  ruleId: string;
  title: string;
  regulation: string;
  severity: FindingSeverity;
  pageUrl: string;
  evidence: string;
  recommendation: string;
}

export interface RemediationPack {
  targetLocale: string;
  ecommercePlatform: EcommercePlatform;
  withdrawalWidgetHtmlJs: string;
  omnibusPriceSnippetHtml: string;
  odrCleanupGuidance: string | null;
  empCoClaimsGuidance: string | null;
  implementationNotes: string[];
}

export interface RecommendedNextActor {
  actorSlug: string;
  actorUrl: string;
  mcpEndpointUrl: string;
  reason: string;
}

export interface StoreAuditReportItem {
  url: string;
  normalizedInputUrl: string;
  finalUrl: string | null;
  domain: string;
  auditedAt: string;
  status: AuditStatus;
  httpStatus: number | null;
  pageTitle: string | null;
  detectedLanguage: string | null;
  ecommercePlatform: EcommercePlatform;
  loadTimeMs: number;
  pagesFetchedCount: number;
  pagesFetched: string[];
  errorMessage: string | null;

  complianceScore: number;
  riskTier: RiskTier;

  withdrawalStatus: WithdrawalFlowStatus;
  withdrawalButtonFound: boolean;
  withdrawalTwoStepCompliant: boolean;
  withdrawalLoginWallDetected: boolean;
  withdrawalButtonCheck: WithdrawalButtonCheckResult;

  abolishedOdrLinkFound: boolean;
  odrLinkCheck: OdrLinkCheckResult;

  unsubstantiatedGreenClaimsFound: boolean;
  empCoGreenClaimsCheck: EmpCoGreenClaimsCheckResult;

  omnibusViolationFound: boolean;
  omnibusPricingCheck: OmnibusPricingCheckResult;

  impressumUrl: string | null;
  withdrawalPolicyUrl: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
  legalLinks: DiscoveredLegalLinks;

  findingsCount: number;
  findings: ComplianceFinding[];
  coldOutreachHook: string;

  remediationPackGenerated: boolean;
  remediationPack: RemediationPack | null;

  recommendedNextActors: RecommendedNextActor[];
  disclaimer: string;
}
