// ---------- helpers ----------
function isVisible(el) {
  return el && el.offsetParent !== null && !el.closest('[aria-hidden="true"]');
}
function txt(el) { return (el?.textContent || "").trim(); }
function num(s) { return Number(String(s || "").replace(/[^0-9.]/g, "")) || 0; }
function round3(v) { return Math.round(v * 1000) / 1000; }

// Heuristics to detect a title-bearing node / price presence
function hasTitle(node) {
  return !!node.querySelector('[class*="lh-title"], h3, h2, a[href*="/ip/"]');
}
function hasAnyDollar(node) {
  return Array.from(node.querySelectorAll("span,div"))
    .some(n => isVisible(n) && /^\s*\$\d/.test(txt(n)));
}
function hasQtyOrRemove(node){
  if (node.querySelector('input[type="number"][aria-label*="Quantity"], input[type="number"][name*="quantity"]')) return true;
  if (Array.from(node.querySelectorAll("button")).some(b => isVisible(b) && /^(?:\+|−|-)$/.test(txt(b)))) return true;
  if (/\bRemove\b/i.test(txt(node))) return true;
  return false;
}

// cents-per-unit like "7.1¢/oz" or "7.1c/oz"
function hasCentsPerUnit(node) {
  const re = /[\d.]+\s*[¢c]\s*\/\s*(oz|fl\s*oz|lb|g|kg|ea)/i;
  return re.test(txt(node));
}

// ---------- filter: skip non-item lines on order details ----------
function isNonItemTitle(title) {
  const t = (title || "").toLowerCase().trim();
  if (
    /^payment method\b/.test(t) ||
    /^subtotal\b/.test(t) ||
    /^total\b/.test(t) ||
    /^order total\b/.test(t) ||
    /^estimated total\b/.test(t) ||
    /^items? total\b/.test(t) ||
    /^sales tax\b/.test(t) ||
    /^tax\b/.test(t) ||
    /^delivery fee\b/.test(t) ||
    /^shipping\b/.test(t) ||
    /^pickup discount\b/.test(t) ||
    /^discount\b/.test(t) ||
    /^credits?\b/.test(t) ||
    /^refund\b/.test(t) ||
    /^tip\b/.test(t) ||
    /^gift (card|credit)\b/.test(t)
  ) return true;
  if (/(subtotal|order total|estimated total|payment method|sales tax|delivery fee|discount|credit|refund|shipping|tip)\b/.test(t))
    return true;
  return false;
}

// ---------- constrain item containers so each is one product ----------
const TITLE_SEL =
  '.lh-title span, [class*="lh-title"] span, h3, h2, a[href*="/ip/"] span, a[href*="/ip/"]';

function containsOnlyThisTitle(scope, tNode) {
  const titles = Array.from(scope.querySelectorAll(TITLE_SEL)).filter(isVisible);
  for (const n of titles) {
    if (n === tNode || n.contains(tNode) || tNode.contains(n)) continue;
    return false; // some other product title also present
  }
  return titles.some(n => n === tNode || n.contains(tNode) || tNode.contains(n));
}

function getItemCards() {
  const titleNodes = Array.from(document.querySelectorAll(TITLE_SEL)).filter(isVisible);
  const cards = new Set();
  const isOrdersPage = /\/orders\//.test(location.pathname);

  // On ORDERS pages, don't gate on price — rows like bread have only "¢/oz".
  function pricedEnough(node) {
    return isOrdersPage ? true : hasAnyDollar(node);
  }

  for (const t of titleNodes) {
    let node = t, chosen = null;

    for (let i = 0; i < 8 && node; i++, node = node.parentElement) {
      if (!node || !isVisible(node)) break;
      if (hasTitle(node) && pricedEnough(node) && containsOnlyThisTitle(node, t)) {
        chosen = node;
      }
    }
    if (!chosen) continue;

    // prefer highest ancestor that still only contains this title
    let outer = chosen, p = chosen.parentElement;
    for (let i = 0; i < 8 && p; i++, p = p.parentElement) {
      if (!isVisible(p)) break;
      if (hasTitle(p) && pricedEnough(p) && containsOnlyThisTitle(p, t)) outer = p;
    }
    cards.add(outer);
  }
  return Array.from(cards);
}

// ---------- field extractors ----------
function getTitleNode(card) {
  const cand = Array.from(card.querySelectorAll(TITLE_SEL)).filter(isVisible);
  const isBad = (s) => {
    const t = (s || "").trim();
    return (
      /^\s*\$\d/.test(t) ||
      /^\d+(\.\d+)?\s*[¢c]\//i.test(t) ||
      /^(Unit|Qty|Item total)/i.test(t) ||
      /\b(Best seller|Free 90-day returns|Remove|Save for later)\b/i.test(t)
    );
  };
  let best = null;
  for (const n of cand) {
    const t = txt(n);
    if (!t || isBad(t)) continue;
    if (!best || t.length > txt(best).length) best = n;
  }
  return best || cand[0] || null;
}
function findTitleIn(card) {
  const node = getTitleNode(card);
  return (node ? txt(node) : "").replace(/\s+/g, " ").trim();
}
function findUnitInfoIn(card) {
  const title = getTitleNode(card);
  if (!title) return "";
  const scopes = [];
  if (title.parentElement) scopes.push(title.parentElement);
  if (title.parentElement?.nextElementSibling) scopes.push(title.parentElement.nextElementSibling);
  const looksLikeUnit = s => /(\d+(?:\.\d+)?)\s*[¢c]\/[a-z]+|\$\s*\d+(?:\.\d+)?\s*\/[a-z]+/i.test(s);
  for (const scope of scopes) {
    const nodes = Array.from(scope.querySelectorAll("span,div")).filter(isVisible);
    for (const n of nodes) {
      const t = txt(n);
      if (t && looksLikeUnit(t) && t.length < 40) return t.replace(/\s+/g, " ");
    }
  }
  return "";
}

// orders-specific parsers
function extractOrdersPriceQty(card) {
  const text = txt(card).replace(/\s+/g, " ");
  const m = text.match(/Unit:\s*\$([0-9.,]+)\s*\|\s*Qty:\s*([0-9]+)/i);
  if (m) return { unitPrice: round3(num(m[1])), qty: Number(m[2]) || 1 };

  const mu = text.match(/Unit:\s*\$([0-9.,]+)(?:\s*\/\w+)?/i);
  const mq = text.match(/\bQty[:\s]*([0-9]{1,3})\b/i);
  if (mu) return { unitPrice: round3(num(mu[1])), qty: mq ? Number(mq[1]) || 1 : 1 };

  const priceNode = Array.from(card.querySelectorAll("span,div"))
    .find(n => isVisible(n) && /^\s*\$\d/.test(txt(n)));
  if (priceNode) {
    const qty2 = mq ? Number(mq[1]) || 1 : 1;
    return { unitPrice: round3(num(txt(priceNode))), qty: qty2 };
  }
  return null;
}

// derive unit price from "¢/unit" + size in title (handles bread)
function derivePriceFromUnitInfo(title, unitInfo) {
  if (!unitInfo || !title) return null;
  const m = unitInfo.match(/([\d.]+)\s*[¢c]\s*\/\s*(oz|fl\s*oz|lb|g|kg|ea)/i);
  if (!m) return null;
  const cents = parseFloat(m[1]);
  const unit = m[2].toLowerCase().replace(/\s+/g, "");
  const sizeRe = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit.replace("floz","fl\\s*oz")}`, "i");
  const ms = title.match(sizeRe);
  if (!ms) return null;
  const size = parseFloat(ms[1]);
  if (!isFinite(size) || !isFinite(cents)) return null;
  return round3((cents / 100) * size);
}

// CART price/qty
function findPriceIn(card) {
  const right = Array.from(card.querySelectorAll("div.tr span"))
    .find(n => isVisible(n) && /^\s*\$\d/.test(txt(n)));
  if (right) return round3(num(txt(right)));
  const any = Array.from(card.querySelectorAll("span,div"))
    .find(n => isVisible(n) && /^\s*\$\d/.test(txt(n)));
  return any ? round3(num(txt(any))) : 0;
}
function findQtyIn(card) {
  const input = card.querySelector('input[type="number"][aria-label*="Quantity"], input[type="number"][name*="quantity"]');
  if (input && input.value) return Number(input.value) || 1;
  const m = txt(card).match(/\bQty:? (\d{1,3})\b/i);
  if (m) return Number(m[1]) || 1;
  return 1;
}

function cardScore(card, title) {
  let s = 0;
  if (hasQtyOrRemove(card)) s += 10;
  s += Math.min(title.length, 120) / 120;
  return s;
}

// ---------- main scrape ----------
function scrapeCart() {
  const cards = getItemCards();
  const raw = [];
  const isOrdersPage = /\/orders\//.test(location.pathname);

  for (const card of cards) {
    const title = findTitleIn(card);
    if (!title || isNonItemTitle(title)) continue;

    const unitInfo = findUnitInfoIn(card);
    let unitPrice, qty;

    if (isOrdersPage) {
      let parsed = extractOrdersPriceQty(card);
      if (!parsed) {
        const derived = derivePriceFromUnitInfo(title, unitInfo);
        if (derived != null) parsed = { unitPrice: derived, qty: findQtyIn(card) };
      }
      if (!parsed) continue;
      unitPrice = parsed.unitPrice;
      qty = parsed.qty;
    } else {
      unitPrice = findPriceIn(card);
      qty = findQtyIn(card);
    }

    if (/^(Free pickup|Shipping,|Pickup and delivery options)/i.test(title)) continue;

    if (title && unitPrice) {
      raw.push({ title, unitInfo, unitPrice, qty, _card: card, _score: cardScore(card, title) });
    }
  }

  // de-dupe by title+unitPrice
  const keyFor = it => `${(it.title || "").toLowerCase().trim()}@@${it.unitPrice}`;
  const byKey = new Map();
  for (const it of raw) {
    const k = keyFor(it);
    const prev = byKey.get(k);
    if (!prev || it._score > prev._score || (it._score === prev._score && it.title.length > prev.title.length)) {
      byKey.set(k, it);
    }
  }
  const items = Array.from(byKey.values()).map(({ _card, _score, ...clean }) => clean);

  // Fees (often 0 on orders page UI)
  const get = sel => {
    const el = document.querySelector(sel);
    return el && isVisible(el) ? round3(num(txt(el))) : 0;
  };
  const subtotal = get('[data-automation-id="summary-subtotal"], [data-testid*="subtotal"]')
    || round3(items.reduce((s, it) => s + it.unitPrice * it.qty, 0));
  const tax = get('[data-automation-id="summary-tax"], [data-testid*="tax"]');
  const shipping = get('[data-automation-id="summary-shipping"], [data-testid*="shipping"]');
  const discV = get('[data-automation-id*="discount"], [data-testid*="discount"]');
  const discount = discV ? -Math.abs(round3(discV)) : 0;
  const total = round3(subtotal + tax + shipping + discount);

  return { items, fees: { tax, shipping, discount }, subtotal, total };
}

// ---------- bridge to popup ----------
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req.type === "GET_CART") {
    setTimeout(() => sendResponse(scrapeCart()), 150);
    return true; // async
  }
});
