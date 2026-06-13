import { QRCode } from "./src/lib/qr.js";

const PANTRY_WORDS = new Set([
  "salt",
  "kosher salt",
  "sea salt",
  "fine sea salt",
  "table salt",
  "pepper",
  "black pepper",
  "white pepper",
  "ground black pepper",
  "freshly ground black pepper",
  "water",
  "ice",
  "cooking spray",
  "nonstick spray",
  "olive oil",
  "extra virgin olive oil",
  "vegetable oil",
  "neutral oil"
]);

const MAX_ITEM_LENGTH = 160;
const MAX_ITEMS = 100;

const state = {
  recipe: null,
  rows: [],
  lastQrText: ""
};

const $ = (id) => document.getElementById(id);

const els = {
  statusDot: $("statusDot"),
  statusText: $("statusText"),
  statusCard: $("statusCard"),
  recipeCard: $("recipeCard"),
  manualCard: $("manualCard"),
  qrCard: $("qrCard"),
  extractBtn: $("extractBtn"),
  manualBtn: $("manualBtn"),
  closeManualBtn: $("closeManualBtn"),
  manualTitle: $("manualTitle"),
  manualIngredients: $("manualIngredients"),
  useManualBtn: $("useManualBtn"),
  refreshBtn: $("refreshBtn"),
  recipeTitle: $("recipeTitle"),
  recipeMeta: $("recipeMeta"),
  keepQtyToggle: $("keepQtyToggle"),
  pantryToggle: $("pantryToggle"),
  items: $("items"),
  addItemInput: $("addItemInput"),
  addItemBtn: $("addItemBtn"),
  selectAllBtn: $("selectAllBtn"),
  clearAllBtn: $("clearAllBtn"),
  copyBtn: $("copyBtn"),
  qrBtn: $("qrBtn"),
  qrCanvas: $("qrCanvas"),
  qrNote: $("qrNote"),
  copyQrTextBtn: $("copyQrTextBtn")
};

init();

async function init() {
  bindEvents();
  const saved = await chrome.storage.local.get({ keepQty: true, hidePantry: true });
  els.keepQtyToggle.checked = saved.keepQty;
  els.pantryToggle.checked = saved.hidePantry;
  updateActionState();
}

function bindEvents() {
  els.extractBtn.addEventListener("click", extractFromActiveTab);
  els.refreshBtn.addEventListener("click", extractFromActiveTab);
  els.manualBtn.addEventListener("click", showManualCard);
  els.closeManualBtn.addEventListener("click", () => els.manualCard.classList.add("hidden"));
  els.useManualBtn.addEventListener("click", importManualIngredients);
  els.manualIngredients.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") importManualIngredients();
  });
  els.keepQtyToggle.addEventListener("change", () => {
    chrome.storage.local.set({ keepQty: els.keepQtyToggle.checked });
    rebuildRowsFromRecipe();
  });
  els.pantryToggle.addEventListener("change", () => {
    chrome.storage.local.set({ hidePantry: els.pantryToggle.checked });
    rebuildRowsFromRecipe();
  });
  els.addItemBtn.addEventListener("click", addManualItem);
  els.addItemInput.addEventListener("keydown", event => {
    if (event.key === "Enter") addManualItem();
  });
  els.selectAllBtn.addEventListener("click", () => setAllRowsIncluded(true));
  els.clearAllBtn.addEventListener("click", () => setAllRowsIncluded(false));
  els.copyBtn.addEventListener("click", copyList);
  els.qrBtn.addEventListener("click", generateQr);
  els.copyQrTextBtn.addEventListener("click", copyQrText);
}

async function extractFromActiveTab() {
  setStatus("Extracting recipe from this page...", "warn");
  els.extractBtn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("No active tab found.");
    if (!/^https?:\/\//i.test(tab.url || "")) {
      throw new Error("Open a normal recipe web page first. Browser pages and local files cannot be parsed by this extension.");
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractRecipeFromPage
    });

    const recipe = result?.result;
    if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      throw new Error("I could not find recipe ingredients on this page. Paste the ingredients manually instead.");
    }

    state.recipe = recipe;
    rebuildRowsFromRecipe();
    renderRecipe();
    setStatus(`Found ${state.rows.length} shopping item${state.rows.length === 1 ? "" : "s"}.`, "good");
  } catch (error) {
    setStatus(error.message || "Recipe extraction failed.", "bad");
    showManualCard();
  } finally {
    els.extractBtn.disabled = false;
  }
}

function showManualCard() {
  els.manualCard.classList.remove("hidden");
  if (!els.manualTitle.value && state.recipe?.title) els.manualTitle.value = state.recipe.title;
  els.manualIngredients.focus();
}

function importManualIngredients() {
  const ingredients = splitManualIngredients(els.manualIngredients.value);
  if (!ingredients.length) {
    setStatus("Paste at least one ingredient first.", "bad");
    return;
  }
  state.recipe = {
    title: sanitizeText(els.manualTitle.value, 120) || "Shopping list",
    url: "",
    ingredients,
    method: "Manual",
    confidence: "user provided"
  };
  rebuildRowsFromRecipe();
  renderRecipe();
  els.manualCard.classList.add("hidden");
  setStatus(`Imported ${state.rows.length} shopping item${state.rows.length === 1 ? "" : "s"}.`, "good");
}

function splitManualIngredients(value) {
  let lines = String(value || "")
    .split(/\r?\n|[;]+/)
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ""))
    .map(line => cleanIngredientLine(line))
    .filter(Boolean);

  if (lines.length <= 1 && String(value || "").includes(",")) {
    const commaLines = String(value || "")
      .split(/,\s+(?=\d|[¼½¾⅓⅔⅛⅜⅝⅞]|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b)/i)
      .map(cleanIngredientLine)
      .filter(Boolean);
    if (commaLines.length > lines.length) lines = commaLines;
  }

  return uniqueRows(lines).slice(0, MAX_ITEMS);
}

function rebuildRowsFromRecipe() {
  if (!state.recipe) return;
  const keepQty = els.keepQtyToggle.checked;
  const hidePantry = els.pantryToggle.checked;
  const rows = [];

  for (const raw of state.recipe.ingredients) {
    const cleaned = keepQty ? cleanIngredientLine(raw) : ingredientNameOnly(raw);
    if (!cleaned) continue;
    if (hidePantry && isPantryItem(cleaned)) continue;
    rows.push(cleaned);
  }

  state.rows = uniqueRows(rows).slice(0, MAX_ITEMS).map(text => ({ text, included: true }));
  renderItems();
  invalidateQr();
}

function renderRecipe() {
  els.recipeTitle.textContent = state.recipe.title || "Shopping list";
  els.recipeMeta.textContent = `${state.recipe.method || "Detected"} parsing, ${state.recipe.confidence || "unknown"} confidence`;
  els.recipeCard.classList.remove("hidden");
  updateActionState();
}

function renderItems() {
  els.items.replaceChildren();
  if (!state.rows.length) {
    const div = document.createElement("div");
    div.className = "empty-state";
    div.textContent = "No ingredients left after cleanup. Turn off pantry filtering, keep quantities, or add items manually.";
    els.items.append(div);
    updateActionState();
    return;
  }

  state.rows.forEach((row, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "item-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = row.included;
    checkbox.setAttribute("aria-label", `Include ${row.text}`);
    checkbox.addEventListener("change", () => {
      row.included = checkbox.checked;
      invalidateQr();
      updateActionState();
    });

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = MAX_ITEM_LENGTH;
    input.value = row.text;
    input.addEventListener("input", () => {
      state.rows[index].text = sanitizeText(input.value, MAX_ITEM_LENGTH);
      invalidateQr();
      updateActionState();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary icon-btn";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${row.text}`);
    remove.addEventListener("click", event => {
      event.preventDefault();
      state.rows.splice(index, 1);
      renderItems();
      invalidateQr();
      updateActionState();
    });

    wrapper.append(checkbox, input, remove);
    els.items.append(wrapper);
  });
  updateActionState();
}

function addManualItem() {
  const text = cleanIngredientLine(els.addItemInput.value);
  if (!text) {
    setStatus("Type an item to add.", "bad");
    return;
  }
  if (state.rows.length >= MAX_ITEMS) {
    setStatus(`This list is limited to ${MAX_ITEMS} items so the QR stays scannable.`, "bad");
    return;
  }
  const key = normalizeKey(text);
  if (state.rows.some(row => normalizeKey(row.text) === key)) {
    setStatus("That item is already on the list.", "warn");
    return;
  }
  if (!state.recipe) {
    state.recipe = { title: "Shopping list", url: "", ingredients: [], method: "Manual", confidence: "user provided" };
    renderRecipe();
  }
  state.rows.push({ text, included: true });
  els.addItemInput.value = "";
  renderItems();
  invalidateQr();
  setStatus("Item added.", "good");
}

function setAllRowsIncluded(included) {
  state.rows.forEach(row => { row.included = included; });
  renderItems();
  invalidateQr();
  setStatus(included ? "All items selected." : "All items cleared.", "good");
}

function getIncludedItems() {
  return state.rows
    .filter(row => row.included && row.text.trim())
    .map(row => sanitizeText(row.text, MAX_ITEM_LENGTH))
    .filter(Boolean);
}

function makePlainList() {
  const title = state.recipe?.title || "Shopping list";
  const items = getIncludedItems();
  return `${title}\n\nShopping list:\n${items.map(item => `- ${item}`).join("\n")}`;
}

function buildQrText() {
  return makePlainList();
}

function generateQr() {
  try {
    const items = getIncludedItems();
    if (!items.length) throw new Error("Select at least one item first.");
    const text = buildQrText();
    const matrix = QRCode.toCanvas(els.qrCanvas, text, { margin: 4, scale: 7, ecc: "M" });
    state.lastQrText = text;
    const densityNote = matrix.version >= 25 ? " Dense QR. Shorter item names may scan better." : "";
    els.qrNote.textContent = `Scan with your phone camera. Version ${matrix.version}, ${matrix.ecc} correction.${densityNote}`;
    els.qrCard.classList.remove("hidden");
    setStatus("QR is ready.", "good");
    return text;
  } catch (error) {
    state.lastQrText = "";
    els.qrCard.classList.add("hidden");
    clearQrCanvas();
    setStatus(error.message || "Could not generate QR.", "bad");
    return null;
  }
}

async function copyList() {
  try {
    const items = getIncludedItems();
    if (!items.length) throw new Error("Select at least one item first.");
    await navigator.clipboard.writeText(makePlainList());
    setStatus("Shopping list copied.", "good");
  } catch (error) {
    setStatus(error.message || "Could not copy to clipboard.", "bad");
  }
}

async function copyQrText() {
  try {
    const text = state.lastQrText || generateQr();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setStatus("QR content copied.", "good");
  } catch {
    setStatus("Could not copy QR content.", "bad");
  }
}

function invalidateQr() {
  state.lastQrText = "";
  els.qrCard.classList.add("hidden");
  clearQrCanvas();
}

function clearQrCanvas() {
  const ctx = els.qrCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.qrCanvas.width, els.qrCanvas.height);
  els.qrNote.textContent = "";
}

function updateActionState() {
  const hasIncluded = getIncludedItems().length > 0;
  els.copyBtn.disabled = !hasIncluded;
  els.qrBtn.disabled = !hasIncluded;
  els.copyQrTextBtn.disabled = !hasIncluded;
}

function setStatus(message, kind) {
  els.statusText.textContent = message;
  els.statusDot.className = `status-dot ${kind || ""}`;
}

function cleanIngredientLine(input) {
  let s = sanitizeText(input, MAX_ITEM_LENGTH);
  if (!s) return "";

  s = s
    .replace(/^[-•*]\s*/, "")
    .replace(/\s*\((?:optional|for serving|to serve|if desired|to taste|as needed|plus more[^)]*)\)\s*/gi, " ")
    .replace(/\s*,?\s*\b(?:optional|for serving|to serve|if desired|to taste|as needed)\b\s*$/gi, "")
    .replace(/\s*,\s*(?:drained and rinsed|rinsed and drained|at room temperature|room temperature)\b/gi, "")
    .replace(/\s*,\s*(?:divided|minced|finely minced|chopped|finely chopped|roughly chopped|diced|sliced|thinly sliced|crushed|grated|peeled|rinsed|drained|cooked|packed|melted|softened|beaten|zested|juiced)\b/gi, "")
    .replace(/\s*,\s*and\s*(?:rinsed|drained|chopped|diced|sliced|minced)\b/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([,.)])/g, "$1")
    .replace(/([,(])\s+/g, "$1")
    .replace(/\s*,\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return s;
}

function ingredientNameOnly(input) {
  let s = cleanIngredientLine(input).toLowerCase();
  if (!s) return "";

  s = s
    .replace(/^[\d\s¼½¾⅓⅔⅛⅜⅝⅞.,/+-]+/, "")
    .replace(/^\([^)]*\)\s*/, "")
    .replace(/^\(?\d+(?:\.\d+)?(?:\s*(?:oz|g|kg|ml|l))?\)?\s*/, "")
    .replace(/^\([^)]*\)\s*/, "")
    .replace(/^(?:cups?|c|tbsp|tablespoons?|tsp|teaspoons?|pounds?|lbs?|ounces?|oz|grams?|g|kg|milliliters?|ml|liters?|litres?|l|cloves?|cans?|jars?|bunch(?:es)?|pinch(?:es)?|dash(?:es)?|slices?|pieces?|sprigs?|heads?|stalks?|packages?|packets?)\b\s+(?:of\s+)?/, "")
    .replace(/^\([^)]*\)\s*/, "")
    .replace(/,.*$/, "")
    .replace(/\b(?:fresh|freshly|large|small|medium|extra virgin|virgin|ground|whole|boneless|skinless|low sodium|low-sodium|unsalted|salted|fine|finely|roughly|thinly)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return "";
  return titleCase(s);
}

function isPantryItem(text) {
  const keys = new Set([
    normalizeKey(text),
    normalizeKey(ingredientNameOnly(text))
  ]);

  for (const key of keys) {
    if (!key) continue;
    if (PANTRY_WORDS.has(key)) return true;
    if (/^(?:kosher |sea |fine sea |table )?salt(?: and (?:freshly ground )?(?:black )?pepper)?$/.test(key)) return true;
    if (/^(?:freshly ground )?(?:black |white )?pepper$/.test(key)) return true;
  }
  return false;
}

function uniqueRows(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const text = sanitizeText(row, MAX_ITEM_LENGTH);
    const key = normalizeKey(text);
    if (!text || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function sanitizeText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeKey(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleCase(value) {
  return value.replace(/\b\w/g, char => char.toUpperCase());
}

// This function is injected into the active tab. Keep it self-contained.
function extractRecipeFromPage() {
  function text(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function flattenJsonLd(node, out = []) {
    if (!node) return out;
    if (Array.isArray(node)) {
      node.forEach(item => flattenJsonLd(item, out));
      return out;
    }
    if (typeof node === "object") {
      out.push(node);
      if (node["@graph"]) flattenJsonLd(node["@graph"], out);
      if (node.mainEntity) flattenJsonLd(node.mainEntity, out);
      if (node.itemListElement) flattenJsonLd(node.itemListElement, out);
    }
    return out;
  }

  function typeIncludesRecipe(node) {
    const type = node && node["@type"];
    if (Array.isArray(type)) return type.some(typeIncludesRecipeValue);
    return typeIncludesRecipeValue(type);
  }

  function typeIncludesRecipeValue(value) {
    return String(value || "").toLowerCase().includes("recipe");
  }

  function ingredientValues(value, out = []) {
    if (!value) return out;
    if (Array.isArray(value)) {
      value.forEach(item => ingredientValues(item, out));
      return out;
    }
    if (typeof value === "string") {
      const cleaned = text(value);
      if (cleaned) out.push(cleaned);
      return out;
    }
    if (typeof value === "object") {
      const candidate = text(value.text || value.name || value.value || value.description);
      if (candidate) out.push(candidate);
    }
    return out;
  }

  function pageTitle() {
    return text(document.querySelector("h1")?.innerText) || text(document.title).replace(/\s+[|\-–—].*$/, "");
  }

  const jsonRecipes = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const parsed = JSON.parse(script.textContent || "{}");
      flattenJsonLd(parsed).forEach(node => {
        if (typeIncludesRecipe(node)) jsonRecipes.push(node);
      });
    } catch {
      // Ignore invalid structured data.
    }
  });

  const structured = jsonRecipes
    .map(recipe => ({
      title: text(recipe.name) || pageTitle(),
      url: location.href,
      ingredients: ingredientValues(recipe.recipeIngredient),
      method: "JSON-LD",
      confidence: "high"
    }))
    .filter(recipe => recipe.ingredients.length)
    .sort((a, b) => b.ingredients.length - a.ingredients.length);

  if (structured.length) return structured[0];

  const selectors = [
    '[itemprop="recipeIngredient"]',
    'li[itemprop="recipeIngredient"]',
    '[data-ingredient-name]',
    '[data-ingredient]',
    '[class*="recipe-ingredient" i]',
    '[class*="ingredient-item" i]',
    '[class*="ingredient-list" i] li',
    '[class*="ingredients" i] li',
    '[id*="ingredients" i] li',
    '.wprm-recipe-ingredient',
    '.tasty-recipes-ingredients li',
    '.mv-create-ingredients li',
    '.structured-ingredients li',
    '.ingredients li'
  ];

  const candidates = [];
  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      const value = text(el.innerText || el.textContent);
      if (looksLikeIngredient(value)) candidates.push(value);
    });
  });

  const seen = new Set();
  const ingredients = candidates.filter(value => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 100);

  return {
    title: pageTitle(),
    url: location.href,
    ingredients,
    method: "DOM fallback",
    confidence: ingredients.length >= 4 ? "medium" : "low"
  };

  function looksLikeIngredient(value) {
    const s = text(value);
    if (s.length < 2 || s.length > 180) return false;
    if (/^(ingredients?|for the|shopping list|nutrition|instructions?|directions?)$/i.test(s)) return false;
    if (/advertisement|subscribe|sign up|print recipe|cook mode/i.test(s)) return false;
    if (/\d|[¼½¾⅓⅔⅛⅜⅝⅞]/.test(s)) return true;
    return /\b(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|ounce|ounces|oz|gram|grams|kg|ml|liter|litre|clove|cloves|can|cans|jar|jars|bunch|pinch|dash|salt|pepper|oil|butter|flour|sugar|onion|garlic|egg|eggs|milk|cream|cheese|lemon|lime|parsley|cilantro|tomato|tomatoes|chicken|beef|pork|fish|rice|pasta|beans)\b/i.test(s);
  }
}
