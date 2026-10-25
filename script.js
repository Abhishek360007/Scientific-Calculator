'use strict';

// ===================== Calculator state =====================

const state = {
  pieces: [],          // inserted chunks, so backspace removes "sin(" in one go
  angle: 'DEG',
  second: false,
  ans: 0,
  lastExpr: '',
  justEvaluated: false,
  history: [],
};

// ===================== Math engine =====================

class CalcError extends Error {}

const NAMES = ['Ans', 'sin', 'cos', 'tan', 'log', 'ln', 'abs', 'e'];
const SIMPLE_OPS = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/', '^': '^', '(': '(', ')': ')' };

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ') { i++; continue; }

    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const text = src.slice(i, j);
      if (text === '.' || text.split('.').length > 2) throw new CalcError('Syntax error');
      tokens.push({ type: 'num', value: parseFloat(text) });
      i = j;
      continue;
    }
    if (src.startsWith('⁻¹', i)) { tokens.push({ type: 'post', value: 'inv' }); i += 2; continue; }
    if (SIMPLE_OPS[ch]) { tokens.push({ type: 'op', value: SIMPLE_OPS[ch] }); i++; continue; }
    if ('!%²³'.includes(ch)) { tokens.push({ type: 'post', value: ch }); i++; continue; }
    if (ch === 'π') { tokens.push({ type: 'const', value: Math.PI }); i++; continue; }
    if (ch === '√') { tokens.push({ type: 'func', value: 'sqrt' }); i++; continue; }
    if (ch === '∛') { tokens.push({ type: 'func', value: 'cbrt' }); i++; continue; }

    const name = NAMES.find((n) => src.startsWith(n, i));
    if (!name) throw new CalcError('Syntax error');
    i += name.length;
    if (name === 'Ans') tokens.push({ type: 'const', value: state.ans });
    else if (name === 'e') tokens.push({ type: 'const', value: Math.E });
    else if (['sin', 'cos', 'tan'].includes(name) && src.startsWith('⁻¹', i)) {
      tokens.push({ type: 'func', value: 'a' + name });
      i += 2;
    } else tokens.push({ type: 'func', value: name });
  }
  return tokens;
}

const toRad = (x) => (state.angle === 'DEG' ? (x * Math.PI) / 180 : x);
const fromRad = (x) => (state.angle === 'DEG' ? (x * 180) / Math.PI : x);
// Floating point leaves sin(180°) at ~1e-16; treat that as exactly zero.
const snap = (x) => (Math.abs(x) < 1e-12 ? 0 : x);

function applyFn(name, x) {
  switch (name) {
    case 'sin': return snap(Math.sin(toRad(x)));
    case 'cos': return snap(Math.cos(toRad(x)));
    case 'tan': {
      const r = toRad(x);
      if (snap(Math.cos(r)) === 0) throw new CalcError('Math error');
      return snap(Math.tan(r));
    }
    case 'asin': return fromRad(Math.asin(x));
    case 'acos': return fromRad(Math.acos(x));
    case 'atan': return fromRad(Math.atan(x));
    case 'ln': return Math.log(x);
    case 'log': return Math.log10(x);
    case 'sqrt': return Math.sqrt(x);
    case 'cbrt': return Math.cbrt(x);
    case 'abs': return Math.abs(x);
  }
  throw new CalcError('Syntax error');
}

function gamma(z) {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  // Shift z up with Γ(z) = Γ(z+1)/z, then use the Stirling series where it's accurate.
  let divisor = 1;
  while (z < 15) { divisor *= z; z++; }
  const z3 = z * z * z;
  const lnGamma = (z - 0.5) * Math.log(z) - z + 0.5 * Math.log(2 * Math.PI)
    + 1 / (12 * z) - 1 / (360 * z3) + 1 / (1260 * z3 * z * z) - 1 / (1680 * z3 * z3 * z);
  return Math.exp(lnGamma) / divisor;
}

function factorial(n) {
  if (Number.isInteger(n)) {
    if (n < 0) throw new CalcError('Math error');
    if (n > 170) return Infinity;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }
  return gamma(n + 1);
}

function power(base, exp) {
  // Allow real odd roots of negatives, e.g. (−8)^(1/3) = −2
  if (base < 0 && !Number.isInteger(exp)) {
    const inv = 1 / exp;
    if (Math.abs(inv - Math.round(inv)) < 1e-10 && Math.round(inv) % 2 !== 0) {
      return -Math.pow(-base, exp);
    }
  }
  return Math.pow(base, exp);
}

// Recursive-descent parser:
//   expr    := term (('+' | '-') term)*
//   term    := unary (('*' | '/' | implicit) unary)*
//   unary   := ('-' | '+') unary | power
//   power   := postfix ('^' unary)?
//   postfix := primary ('!' | '%' | '²' | '³' | '⁻¹')*
//   primary := number | constant | func primary | '(' expr ')'?
function evaluate(src) {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (t, v) => t && t.type === 'op' && t.value === v;
  const startsOperand = (t) => t && (t.type === 'num' || t.type === 'const' || t.type === 'func' || isOp(t, '('));

  function parseExpr() {
    let v = parseTerm();
    while (isOp(peek(), '+') || isOp(peek(), '-')) {
      const op = tokens[pos++].value;
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }

  function parseTerm() {
    let v = parseUnary();
    for (;;) {
      const t = peek();
      if (isOp(t, '*')) { pos++; v *= parseUnary(); }
      else if (isOp(t, '/')) {
        pos++;
        const d = parseUnary();
        if (d === 0) throw new CalcError('Can’t divide by 0');
        v /= d;
      } else if (startsOperand(t)) v *= parseUnary(); // implicit: 2π, 3(4), 2sin(30)
      else return v;
    }
  }

  function parseUnary() {
    if (isOp(peek(), '-')) { pos++; return -parseUnary(); }
    if (isOp(peek(), '+')) { pos++; return parseUnary(); }
    return parsePower();
  }

  function parsePower() {
    const base = parsePostfix();
    if (isOp(peek(), '^')) { pos++; return power(base, parseUnary()); }
    return base;
  }

  function parsePostfix() {
    let v = parsePrimary();
    while (peek() && peek().type === 'post') {
      switch (tokens[pos++].value) {
        case '!': v = factorial(v); break;
        case '%': v /= 100; break;
        case '²': v = v * v; break;
        case '³': v = v * v * v; break;
        case 'inv':
          if (v === 0) throw new CalcError('Can’t divide by 0');
          v = 1 / v;
          break;
      }
    }
    return v;
  }

  function parsePrimary() {
    const t = tokens[pos++];
    if (!t) throw new CalcError('Syntax error');
    if (t.type === 'num' || t.type === 'const') return t.value;
    if (t.type === 'func') return applyFn(t.value, isOp(peek(), '(') ? parsePrimary() : parsePower());
    if (isOp(t, '(')) {
      const v = parseExpr();
      if (isOp(peek(), ')')) pos++;
      else if (peek()) throw new CalcError('Syntax error');
      return v;
    }
    throw new CalcError('Syntax error');
  }

  const v = parseExpr();
  if (pos < tokens.length) throw new CalcError('Syntax error');
  if (!Number.isFinite(v)) throw new CalcError('Math error');
  return v;
}

function missingParens(src) {
  let depth = 0;
  for (const ch of src) {
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
  }
  return depth;
}

const closeParens = (src) => src + ')'.repeat(missingParens(src));

function formatNumber(x) {
  if (x === 0) return '0';
  const abs = Math.abs(x);
  if (abs >= 1e15 || abs < 1e-9) {
    const [m, e] = x.toExponential(9).split('e');
    return `${parseFloat(m)}e${e.replace('+', '')}`;
  }
  return parseFloat(x.toPrecision(12)).toLocaleString('en-US', { maximumFractionDigits: 20 });
}

// A number in a form the tokenizer can read back (used when reusing results).
function rawNumber(x) {
  const s = String(parseFloat(x.toPrecision(12)));
  let out = s;
  if (s.includes('e')) {
    const [m, e] = s.split('e');
    out = `${m}×10^${e.replace('+', '').replace('-', '−')}`;
  }
  out = out.replace('-', '−');
  return x < 0 || s.includes('e') ? `(${out})` : out;
}

// ===================== UI =====================

const KEYS = [
  { label: '2nd', action: 'second', cls: 'fn', name: 'Second functions' },
  { label: 'DEG', action: 'angle', cls: 'fn', name: 'Toggle degrees/radians' },
  { label: 'x<sup>2</sup>', insert: '²', cls: 'fn', name: 'Square', alt: { label: 'x<sup>3</sup>', insert: '³', name: 'Cube' } },
  { label: 'x<sup>y</sup>', insert: '^', cls: 'fn', name: 'Power', alt: { label: 'x<sup>−1</sup>', insert: '⁻¹', name: 'Reciprocal' } },
  { label: '√', insert: '√(', cls: 'fn', name: 'Square root', alt: { label: '∛', insert: '∛(', name: 'Cube root' } },

  { label: 'sin', insert: 'sin(', cls: 'fn', alt: { label: 'sin<sup>−1</sup>', insert: 'sin⁻¹(', name: 'arcsin' } },
  { label: 'cos', insert: 'cos(', cls: 'fn', alt: { label: 'cos<sup>−1</sup>', insert: 'cos⁻¹(', name: 'arccos' } },
  { label: 'tan', insert: 'tan(', cls: 'fn', alt: { label: 'tan<sup>−1</sup>', insert: 'tan⁻¹(', name: 'arctan' } },
  { label: 'ln', insert: 'ln(', cls: 'fn', name: 'Natural log', alt: { label: 'e<sup>x</sup>', insert: 'e^(', name: 'e to the power' } },
  { label: 'log', insert: 'log(', cls: 'fn', name: 'Log base 10', alt: { label: '10<sup>x</sup>', insert: '10^(', name: '10 to the power' } },

  { label: '(', insert: '(', cls: 'fn' },
  { label: ')', insert: ')', cls: 'fn' },
  { label: 'n!', insert: '!', cls: 'fn', name: 'Factorial', alt: { label: '|x|', insert: 'abs(', name: 'Absolute value' } },
  { label: '%', insert: '%', cls: 'fn', name: 'Percent' },
  { label: 'π', insert: 'π', cls: 'fn', name: 'Pi', alt: { label: 'e', insert: 'e', name: 'Euler’s number' } },

  { label: '7', insert: '7' }, { label: '8', insert: '8' }, { label: '9', insert: '9' },
  { label: '÷', insert: '÷', cls: 'op', name: 'Divide' },
  { label: 'AC', action: 'clear', cls: 'danger', name: 'All clear' },

  { label: '4', insert: '4' }, { label: '5', insert: '5' }, { label: '6', insert: '6' },
  { label: '×', insert: '×', cls: 'op', name: 'Multiply' },
  { label: '⌫', action: 'back', cls: 'fn', name: 'Backspace' },

  { label: '1', insert: '1' }, { label: '2', insert: '2' }, { label: '3', insert: '3' },
  { label: '−', insert: '−', cls: 'op', name: 'Subtract' },
  { label: 'EXP', insert: '×10^(', cls: 'fn', name: 'Times ten to the power' },

  { label: '0', insert: '0' }, { label: '.', insert: '.', name: 'Decimal point' },
  { label: 'Ans', insert: 'Ans', cls: 'fn', name: 'Previous answer' },
  { label: '+', insert: '+', cls: 'op', name: 'Add' },
  { label: '=', action: 'equals', cls: 'eq', name: 'Equals' },
];

const KEYBOARD = {
  '*': '×', '/': '÷', '-': '−', '+': '+', '^': '^', '(': '(', ')': ')', '!': '!', '%': '%', '.': '.',
  p: 'π', e: 'e', s: 'sin(', c: 'cos(', t: 'tan(', l: 'ln(', g: 'log(', r: '√(',
};

const STARTS_WITH_OPERATOR = /^[+−×÷^!%²³⁻]/;
const HISTORY_KEY = 'sci-calc-history';
const THEME_KEY = 'sci-calc-theme';

const el = {};
const keyButtons = [];

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

function insert(text) {
  if (state.justEvaluated) {
    // Operators continue from the last answer; anything else starts fresh.
    state.pieces = STARTS_WITH_OPERATOR.test(text) ? ['Ans'] : [];
    state.justEvaluated = false;
  }
  state.pieces.push(text);
  render();
}

function backspace() {
  state.justEvaluated = false;
  state.pieces.pop();
  render();
}

function clearAll() {
  state.justEvaluated = false;
  state.pieces = [];
  render();
}

function equals() {
  if (state.justEvaluated || !state.pieces.length) return;
  const src = closeParens(state.pieces.join(''));
  try {
    const value = evaluate(src);
    state.ans = value;
    state.lastExpr = src;
    state.justEvaluated = true;
    addHistory(src, value);
    render();
  } catch (err) {
    if (!(err instanceof CalcError)) throw err;
    render();
    showResult(err.message, 'error');
  }
}

function showResult(text, kind) {
  el.result.textContent = text;
  el.result.classList.toggle('error', kind === 'error');
  const big = el.display.classList.contains('done');
  el.result.style.fontSize = big && text.length > 12 ? `${Math.max(1.4, (2.6 * 12) / text.length)}rem` : '';
}

function render() {
  const src = state.pieces.join('');
  el.display.classList.toggle('done', state.justEvaluated);
  el.display.classList.toggle('typing', !state.justEvaluated);

  if (state.justEvaluated) {
    el.expr.textContent = `${state.lastExpr} =`;
    showResult(formatNumber(state.ans));
  } else {
    el.expr.textContent = src;
    const open = missingParens(src);
    if (open) {
      const ghost = document.createElement('span');
      ghost.className = 'ghost';
      ghost.textContent = ')'.repeat(open);
      el.expr.append(ghost);
    }
    let preview = '';
    if (src && !/^[\d.]+$/.test(src)) {
      try { preview = `= ${formatNumber(evaluate(closeParens(src)))}`; } catch { /* incomplete input */ }
    }
    showResult(src ? preview : '0');
  }
  el.expr.scrollLeft = el.expr.scrollWidth;
}

function renderKeys() {
  keyButtons.forEach(({ btn, def }) => {
    const face = state.second && def.alt ? def.alt : def;
    btn.innerHTML = def.action === 'angle' ? state.angle : face.label;
    btn.dataset.insert = face.insert || '';
    btn.setAttribute('aria-label', face.name || btn.textContent);
    if (def.action === 'second') btn.classList.toggle('active', state.second);
  });
  el.angleInd.textContent = state.angle;
  el.secondInd.hidden = !state.second;
}

function buildKeys() {
  KEYS.forEach((def) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `key ${def.cls || 'num'}`;
    btn.addEventListener('click', () => onKey(def));
    el.keys.append(btn);
    keyButtons.push({ btn, def });
  });
  renderKeys();
}

function onKey(def) {
  switch (def.action) {
    case 'second':
      state.second = !state.second;
      renderKeys();
      return;
    case 'angle':
      state.angle = state.angle === 'DEG' ? 'RAD' : 'DEG';
      renderKeys();
      render();
      return;
    case 'clear': clearAll(); return;
    case 'back': backspace(); return;
    case 'equals': equals(); return;
  }
  const face = state.second && def.alt ? def.alt : def;
  insert(face.insert);
  if (state.second) {
    state.second = false;
    renderKeys();
  }
}

function flashKey(match) {
  const found = keyButtons.find(({ btn, def }) => btn.dataset.insert === match || def.action === match);
  if (!found) return;
  found.btn.classList.add('pressed');
  setTimeout(() => found.btn.classList.remove('pressed'), 120);
}

function onKeyboard(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (/^\d$/.test(k)) { insert(k); flashKey(k); }
  else if (KEYBOARD[k]) { insert(KEYBOARD[k]); flashKey(KEYBOARD[k]); }
  else if (k === 'Enter' || k === '=') { equals(); flashKey('equals'); }
  else if (k === 'Backspace') { backspace(); flashKey('back'); }
  else if (k === 'Escape' || k === 'Delete') { clearAll(); flashKey('clear'); }
  else return;
  e.preventDefault();
}

// ---------- history ----------

function addHistory(expr, value) {
  state.history.unshift({ expr, value });
  state.history = state.history.slice(0, 50);
  storageSet(HISTORY_KEY, JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  el.historyList.replaceChildren(...state.history.map(({ expr, value }) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Insert this result';
    const ex = document.createElement('span');
    ex.className = 'h-expr';
    ex.textContent = `${expr} =`;
    const res = document.createElement('span');
    res.className = 'h-result';
    res.textContent = formatNumber(value);
    btn.append(ex, res);
    btn.addEventListener('click', () => insert(rawNumber(value)));
    li.append(btn);
    return li;
  }));
  el.historyEmpty.hidden = state.history.length > 0;
}

function loadHistory() {
  try {
    const saved = JSON.parse(storageGet(HISTORY_KEY) || '[]');
    if (Array.isArray(saved)) {
      state.history = saved.filter((h) => typeof h.expr === 'string' && Number.isFinite(h.value));
    }
  } catch { /* ignore corrupt history */ }
}

// ---------- theme ----------

function toggleTheme() {
  const root = document.documentElement;
  const current = root.dataset.theme
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  storageSet(THEME_KEY, next);
}

function init() {
  ['display', 'expr', 'result', 'keys', 'angleInd', 'secondInd', 'themeToggle', 'clearHistory', 'historyList', 'historyEmpty']
    .forEach((id) => { el[id] = document.getElementById(id); });

  const theme = storageGet(THEME_KEY);
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;

  buildKeys();
  loadHistory();
  renderHistory();
  render();

  document.addEventListener('keydown', onKeyboard);
  el.themeToggle.addEventListener('click', toggleTheme);
  el.clearHistory.addEventListener('click', () => {
    state.history = [];
    storageSet(HISTORY_KEY, '[]');
    renderHistory();
  });
}

if (typeof document !== 'undefined') init();
