import { getActiveSpace } from "./config.js";
import { t } from "./i18n.js";

export const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
export const DOMAIN_PATTERN = /^[A-Za-z0-9*_](?:[A-Za-z0-9*_.-]{0,251}[A-Za-z0-9*_])?$/;

const MODIFY_RULE_ID = 1;
const IGNORE_RULE_ID_START = 1000;

export function isValidDomainPattern(value) {
  const pattern = value.trim();
  return DOMAIN_PATTERN.test(pattern) && !pattern.includes("..");
}

export function domainPatternToRegex(value) {
  const hostname = [...value.trim().toLowerCase()]
    .map((character) => {
      if (character === "*") return "[a-z0-9._-]*";
      return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
    })
    .join("");
  return `^https?://${hostname}(?::[0-9]+)?(?:/|$)`;
}

export function buildDynamicRules(config) {
  const rules = [];
  const errors = [];
  if (!config.enabled) return { rules, errors };

  const activeSpace = getActiveSpace(config);
  const seenKeys = new Set();
  const requestHeaders = [];

  for (const header of activeSpace.headers) {
    if (!header.enabled) continue;
    const key = header.key.trim();
    const normalizedKey = key.toLowerCase();
    if (!key) continue;
    if (!HEADER_NAME_PATTERN.test(key)) {
      errors.push(t("invalidHeaderKey", [key]));
      continue;
    }
    if (seenKeys.has(normalizedKey)) {
      errors.push(t("duplicateHeaderKey", [key]));
      continue;
    }
    seenKeys.add(normalizedKey);
    requestHeaders.push({
      header: key,
      operation: "set",
      value: header.value
    });
  }

  if (requestHeaders.length > 0) {
    rules.push({
      id: MODIFY_RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders
      },
      condition: {
        regexFilter: "^https?://"
      }
    });
  }

  config.ignoredDomains.forEach((rawPattern, index) => {
    const pattern = rawPattern.trim();
    if (!pattern) return;
    if (!isValidDomainPattern(pattern)) {
      errors.push(t("invalidIgnoredDomain", [pattern]));
      return;
    }
    rules.push({
      id: IGNORE_RULE_ID_START + index,
      priority: 2,
      action: { type: "allow" },
      condition: {
        regexFilter: domainPatternToRegex(pattern)
      }
    });
  });

  return { rules, errors };
}
