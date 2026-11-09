/* Browser port of VADER (Hutto & Gilbert, 2014) — same rules and lexicon as the
   Python vaderSentiment used by fetch_sentiment.py, so live scores match the
   scheduled ones. Emoji handling is omitted (not used in headlines). */
(function (global) {
  const B_INCR = 0.293, B_DECR = -0.293, C_INCR = 0.733, N_SCALAR = -0.74;
  const NEGATE = new Set(["aint","arent","cannot","cant","couldnt","darent","didnt","doesnt","ain't","aren't","can't","couldn't","daren't","didn't","doesn't","dont","hadnt","hasnt","havent","isnt","mightnt","mustnt","neither","don't","hadn't","hasn't","haven't","isn't","mightn't","mustn't","neednt","needn't","never","none","nope","nor","not","nothing","nowhere","oughtnt","shant","shouldnt","uhuh","wasnt","werent","oughtn't","shan't","shouldn't","uh-uh","wasn't","weren't","without","wont","wouldnt","won't","wouldn't","rarely","seldom","despite"]);
  const BOOST = {};
  ["absolutely","amazingly","awfully","completely","considerable","considerably","decidedly","deeply","effing","enormous","enormously","entirely","especially","exceptional","exceptionally","extreme","extremely","fabulously","flipping","flippin","frackin","fracking","fricking","frickin","frigging","friggin","fully","fuckin","fucking","fuggin","fugging","greatly","hella","highly","hugely","incredible","incredibly","intensely","major","majorly","more","most","particularly","purely","quite","really","remarkably","so","substantially","thoroughly","total","totally","tremendous","tremendously","uber","unbelievably","unusually","utter","utterly","very"].forEach(w => BOOST[w] = B_INCR);
  ["almost","barely","hardly","just enough","kind of","kinda","kindof","kind-of","less","little","marginal","marginally","occasional","occasionally","partly","scarce","scarcely","slight","slightly","somewhat","sort of","sorta","sortof","sort-of"].forEach(w => BOOST[w] = B_DECR);
  const SPECIAL = {"the shit":3,"the bomb":3,"bad ass":1.5,"badass":1.5,"bus stop":0.0,"yeah right":-2,"kiss of death":-1.5,"to die for":3,"beating heart":3.5};
  const PUNC = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

  const isUpper = w => w !== w.toLowerCase() && w === w.toUpperCase(); // Python str.isupper()
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function stripPunc(tok) {
    let s = 0, e = tok.length;
    while (s < e && PUNC.includes(tok[s])) s++;
    while (e > s && PUNC.includes(tok[e - 1])) e--;
    const st = tok.slice(s, e);
    return st.length <= 2 ? tok : st;
  }
  function negated(words) {
    const lw = words.map(w => String(w).toLowerCase());
    for (const w of lw) if (NEGATE.has(w)) return true;
    for (const w of lw) if (w.includes("n't")) return true;
    return false;
  }
  const normalize = (s, a = 15) => Math.max(-1, Math.min(1, s / Math.sqrt(s * s + a)));
  function allcapDiff(words) {
    let caps = 0;
    for (const w of words) if (isUpper(w)) caps++;
    const diff = words.length - caps;
    return diff > 0 && diff < words.length;
  }
  function scalarIncDec(word, valence, capDiff) {
    let s = 0;
    const wl = word.toLowerCase();
    if (has(BOOST, wl)) {
      s = BOOST[wl];
      if (valence < 0) s *= -1;
      if (isUpper(word) && capDiff) s += valence > 0 ? C_INCR : -C_INCR;
    }
    return s;
  }
  function round(x, n) { const f = Math.pow(10, n); return Math.round((x + Number.EPSILON) * f) / f; }

  function Analyzer(lexicon) {
    this.lex = lexicon;
  }
  Analyzer.prototype.polarity = function (text) {
    const words = text.trim().split(/\s+/).filter(Boolean).map(stripPunc);
    const capDiff = allcapDiff(words);
    let sentiments = [];
    for (let i = 0; i < words.length; i++) {
      const item = words[i], il = item.toLowerCase();
      if (has(BOOST, il)) { sentiments.push(0); continue; }
      if (i < words.length - 1 && il === "kind" && words[i + 1].toLowerCase() === "of") { sentiments.push(0); continue; }
      sentiments = this._valence(0, words, capDiff, item, i, sentiments);
    }
    sentiments = this._butCheck(words, sentiments);
    return this._score(sentiments, text.trim());
  };
  Analyzer.prototype._valence = function (valence, words, capDiff, item, i, sentiments) {
    const lex = this.lex, il = item.toLowerCase(), lw = k => words[k].toLowerCase();
    if (has(lex, il)) {
      valence = lex[il];
      if (il === "no" && i !== words.length - 1 && has(lex, lw(i + 1))) valence = 0.0;
      if ((i > 0 && lw(i - 1) === "no") || (i > 1 && lw(i - 2) === "no") ||
          (i > 2 && lw(i - 3) === "no" && (lw(i - 1) === "or" || lw(i - 1) === "nor"))) valence = lex[il] * N_SCALAR;
      if (isUpper(item) && capDiff) valence += valence > 0 ? C_INCR : -C_INCR;
      for (let s0 = 0; s0 < 3; s0++) {
        if (i > s0 && !has(lex, lw(i - (s0 + 1)))) {
          let s = scalarIncDec(words[i - (s0 + 1)], valence, capDiff);
          if (s0 === 1 && s !== 0) s *= 0.95;
          if (s0 === 2 && s !== 0) s *= 0.9;
          valence += s;
          valence = this._negation(valence, words, s0, i);
          if (s0 === 2) valence = this._idioms(valence, words, i);
        }
      }
      valence = this._least(valence, words, i);
    }
    sentiments.push(valence);
    return sentiments;
  };
  Analyzer.prototype._least = function (v, words, i) {
    const lw = k => words[k].toLowerCase();
    if (i > 1 && !has(this.lex, lw(i - 1)) && lw(i - 1) === "least") {
      if (lw(i - 2) !== "at" && lw(i - 2) !== "very") v *= N_SCALAR;
    } else if (i > 0 && !has(this.lex, lw(i - 1)) && lw(i - 1) === "least") v *= N_SCALAR;
    return v;
  };
  Analyzer.prototype._butCheck = function (words, sentiments) {
    const lower = words.map(w => String(w).toLowerCase());
    const bi = lower.indexOf("but");
    if (bi >= 0) {
      // Mirrors the Python original, including its sentiments.index(value) quirk
      // (duplicate values resolve to the first matching index).
      const copy = sentiments.slice();
      for (const sent of copy) {
        const si = sentiments.indexOf(sent);
        if (si < bi) sentiments[si] = sent * 0.5;
        else if (si > bi) sentiments[si] = sent * 1.5;
      }
    }
    return sentiments;
  };
  Analyzer.prototype._negation = function (v, words, s0, i) {
    const l = k => String(words[k]).toLowerCase();
    if (s0 === 0) { if (negated([l(i - 1)])) v *= N_SCALAR; }
    if (s0 === 1) {
      if (l(i - 2) === "never" && (l(i - 1) === "so" || l(i - 1) === "this")) v *= 1.25;
      else if (l(i - 2) === "without" && l(i - 1) === "doubt") { /* unchanged */ }
      else if (negated([l(i - 2)])) v *= N_SCALAR;
    }
    if (s0 === 2) {
      if ((l(i - 3) === "never" && (l(i - 2) === "so" || l(i - 2) === "this")) || (l(i - 1) === "so" || l(i - 1) === "this")) v *= 1.25;
      else if (l(i - 3) === "without" && (l(i - 2) === "doubt" || l(i - 1) === "doubt")) { /* unchanged */ }
      else if (negated([l(i - 3)])) v *= N_SCALAR;
    }
    return v;
  };
  Analyzer.prototype._idioms = function (v, words, i) {
    const l = words.map(w => String(w).toLowerCase());
    const at = k => l[((k % l.length) + l.length) % l.length]; // Python negative indexing
    const onezero = at(i - 1) + " " + at(i);
    const twoonezero = at(i - 2) + " " + at(i - 1) + " " + at(i);
    const twoone = at(i - 2) + " " + at(i - 1);
    const threetwoone = at(i - 3) + " " + at(i - 2) + " " + at(i - 1);
    const threetwo = at(i - 3) + " " + at(i - 2);
    for (const seq of [onezero, twoonezero, twoone, threetwoone, threetwo]) {
      if (has(SPECIAL, seq)) { v = SPECIAL[seq]; break; }
    }
    if (l.length - 1 > i) { const z = l[i] + " " + l[i + 1]; if (has(SPECIAL, z)) v = SPECIAL[z]; }
    if (l.length - 1 > i + 1) { const z = l[i] + " " + l[i + 1] + " " + l[i + 2]; if (has(SPECIAL, z)) v = SPECIAL[z]; }
    for (const g of [threetwoone, threetwo, twoone]) if (has(BOOST, g)) v += BOOST[g];
    return v;
  };
  Analyzer.prototype._score = function (sentiments, text) {
    if (!sentiments.length) return { neg: 0, neu: 0, pos: 0, compound: 0 };
    let sum = sentiments.reduce((a, b) => a + b, 0);
    const ep = Math.min((text.match(/!/g) || []).length, 4) * 0.292;
    const qc = (text.match(/\?/g) || []).length;
    const qm = qc > 1 ? (qc <= 3 ? qc * 0.18 : 0.96) : 0;
    const amp = ep + qm;
    if (sum > 0) sum += amp; else if (sum < 0) sum -= amp;
    return { compound: round(normalize(sum), 4) };
  };
  global.VaderAnalyzer = Analyzer;
})(typeof window !== "undefined" ? window : globalThis);
