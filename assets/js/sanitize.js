/* tablica-php – czyszczenie wklejanego HTML, wykrywanie i kolorowanie kodu (MIT) */
(function () {
  'use strict';

  var ALLOWED = {
    B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, STRIKE: 1, DEL: 1, INS: 1, SUB: 1, SUP: 1, MARK: 1, SMALL: 1,
    CODE: 1, PRE: 1, KBD: 1, SAMP: 1, BR: 1, P: 1, DIV: 1, SPAN: 1, UL: 1, OL: 1, LI: 1,
    H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, BLOCKQUOTE: 1, A: 1, HR: 1,
    TABLE: 1, THEAD: 1, TBODY: 1, TFOOT: 1, TR: 1, TD: 1, TH: 1, CAPTION: 1, DL: 1, DT: 1, DD: 1
  };
  var DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, SVG: 1, MATH: 1, IMG: 1, PICTURE: 1, VIDEO: 1, AUDIO: 1,
    CANVAS: 1, META: 1, LINK: 1, TITLE: 1, HEAD: 1, NOSCRIPT: 1, TEMPLATE: 1, FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, XML: 1 };
  var BLOCK = { P: 1, DIV: 1, LI: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, PRE: 1, BLOCKQUOTE: 1, TR: 1, UL: 1, OL: 1, TABLE: 1, HR: 1, DT: 1, DD: 1 };

  var COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,20})$/i;
  var LEN_RE = /^-?\d+(\.\d+)?(px|pt|em|rem|%)?$/i;
  var MONO_RE = /mono|courier|consolas|menlo|monaco|cascadia|fira code|jetbrains|source code|inconsolata|hack/i;

  function isNeutralColor(c, kind) {
    c = c.replace(/\s+/g, '').toLowerCase();
    if (kind === 'bg') return /^(#fff(fff)?|white|transparent|rgba?\(255,255,255(,1|,1\.0)?\)|rgba\(\d+,\d+,\d+,0(\.0+)?\)|initial|inherit)$/.test(c);
    return /^(#000(000)?|black|rgba?\(0,0,0(,1)?\)|windowtext|initial|inherit|currentcolor)$/.test(c) ||
      /^rgb\((3[0-9]|[12]?[0-9]),(3[0-9]|[12]?[0-9]),(3[0-9]|[12]?[0-9])\)$/.test(c);
  }

  function cleanStyle(style, tag) {
    if (!style) return '';
    var out = [];
    style.split(';').forEach(function (decl) {
      var i = decl.indexOf(':');
      if (i < 0) return;
      var prop = decl.slice(0, i).trim().toLowerCase();
      var val = decl.slice(i + 1).trim().replace(/!important/i, '').trim();
      if (!val || /url\(|expression|javascript:|@import|[<>]/i.test(val)) return;
      switch (prop) {
        case 'color':
          if (COLOR_RE.test(val) && !isNeutralColor(val, 'fg')) out.push('color:' + val);
          break;
        case 'background-color':
        case 'background':
          if (COLOR_RE.test(val) && !isNeutralColor(val, 'bg')) out.push('background-color:' + val);
          break;
        case 'font-weight':
          if (/^(bold|bolder|normal|[1-9]00)$/.test(val)) out.push('font-weight:' + val);
          break;
        case 'font-style':
          if (/^(italic|normal|oblique)$/.test(val)) out.push('font-style:' + val);
          break;
        case 'text-decoration':
        case 'text-decoration-line':
          if (/^(underline|line-through|none|underline line-through)/.test(val)) out.push('text-decoration:' + val.split(' ').filter(function (w) { return /^(underline|line-through|none)$/.test(w); }).join(' '));
          break;
        case 'text-align':
          if (/^(left|right|center|justify|start|end)$/.test(val)) out.push('text-align:' + val);
          break;
        case 'white-space':
          if (/^(pre|pre-wrap|pre-line|break-spaces)$/.test(val)) out.push('white-space:pre-wrap');
          break;
        case 'font-family':
          if (MONO_RE.test(val)) out.push('font-family:var(--mono)');
          break;
        case 'vertical-align':
          if (/^(sub|super)$/.test(val)) out.push('vertical-align:' + val);
          break;
        case 'margin-left':
        case 'padding-left':
        case 'text-indent':
          if (LEN_RE.test(val) && parseFloat(val) !== 0 && Math.abs(parseFloat(val)) <= 400 && tag !== 'SPAN') out.push(prop + ':' + val);
          break;
      }
    });
    return out.join(';');
  }

  function cleanNode(src, doc, parent, depth) {
    if (depth > 40) return;
    for (var n = src.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        parent.appendChild(doc.createTextNode(n.nodeValue));
        continue;
      }
      if (n.nodeType !== 1) continue;
      var tag = n.tagName.toUpperCase();
      if (tag.indexOf(':') !== -1) { // znaczniki Office (o:p, v:shape…)
        if (tag === 'O:P') continue;
        cleanNode(n, doc, parent, depth + 1);
        continue;
      }
      if (DROP[tag]) continue;
      var styleAttr = n.getAttribute('style') || '';
      if (/mso-list:\s*ignore/i.test(styleAttr) || /display:\s*none/i.test(styleAttr)) continue;
      if (!ALLOWED[tag]) {
        if (tag === 'FONT') {
          var span = doc.createElement('span');
          var c = n.getAttribute('color');
          var st = [];
          if (c && COLOR_RE.test(c) && !isNeutralColor(c, 'fg')) st.push('color:' + c);
          if (MONO_RE.test(n.getAttribute('face') || '')) st.push('font-family:var(--mono)');
          if (st.length) span.setAttribute('style', st.join(';'));
          parent.appendChild(span);
          cleanNode(n, doc, span, depth + 1);
        } else {
          if (BLOCK[tag] === undefined && /^(SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|NAV|FIGURE|FIGCAPTION|CENTER|ADDRESS|DETAILS|SUMMARY)$/.test(tag)) {
            var d = doc.createElement('div');
            parent.appendChild(d);
            cleanNode(n, doc, d, depth + 1);
          } else {
            cleanNode(n, doc, parent, depth + 1);
          }
        }
        continue;
      }
      var el = doc.createElement(tag.toLowerCase());
      var style = cleanStyle(styleAttr, tag);
      if (style) el.setAttribute('style', style);
      if (tag === 'A') {
        var href = (n.getAttribute('href') || '').trim();
        if (/^(https?:|mailto:)/i.test(href)) {
          el.setAttribute('href', href);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }
      if ((tag === 'TD' || tag === 'TH')) {
        ['colspan', 'rowspan'].forEach(function (a) { var v = n.getAttribute(a); if (v && /^\d{1,2}$/.test(v)) el.setAttribute(a, v); });
      }
      if (tag === 'OL') {
        var s = n.getAttribute('start');
        if (s && /^\d{1,5}$/.test(s)) el.setAttribute('start', s);
        var ty = n.getAttribute('type');
        if (ty && /^[1aAiI]$/.test(ty)) el.setAttribute('type', ty);
      }
      parent.appendChild(el);
      if (tag !== 'BR' && tag !== 'HR') cleanNode(n, doc, el, depth + 1);
    }
  }

  /** Zwraca bezpieczny HTML z zachowanym formatowaniem (pogrubienia, listy, kolory, wcięcia, tabele…). */
  function sanitizeHtml(html) {
    if (!html) return '';
    html = String(html).replace(/<!--[\s\S]*?-->/g, '');
    var src = new DOMParser().parseFromString(html, 'text/html');
    var doc = document.implementation.createHTMLDocument('');
    var root = doc.createElement('div');
    cleanNode(src.body, doc, root, 0);
    // usuń puste elementy inline i skrajne puste akapity
    root.querySelectorAll('span:not([style]), b:empty, i:empty, strong:empty, em:empty, u:empty, span:empty').forEach(function (e) {
      if (e.tagName === 'SPAN' && !e.hasAttribute('style')) { while (e.firstChild) e.parentNode.insertBefore(e.firstChild, e); e.remove(); }
      else if (!e.textContent) e.remove();
    });
    var out = root.innerHTML.replace(/^(\s|<br>|&nbsp;)+|(\s|<br>|&nbsp;)+$/g, '');
    return out.length > 400000 ? out.slice(0, 400000) : out;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  /** Zamienia tabulatory na spacje z zachowaniem kolumn (tab stop co n znaków). */
  function expandTabs(text, n) {
    n = n || 4;
    return String(text).replace(/\r\n?/g, '\n').split('\n').map(function (line) {
      if (line.indexOf('\t') === -1) return line;
      var out = '';
      for (var i = 0; i < line.length; i++) {
        var ch = line.charAt(i);
        if (ch === '\t') { var sp = n - (out.length % n); out += new Array(sp + 1).join(' '); } else out += ch;
      }
      return out;
    }).join('\n');
  }

  /** Tekst -> HTML z zachowaniem spacji i nowych linii (pole tekstowe ma white-space: pre-wrap). */
  function textToHtml(text) {
    return escapeHtml(expandTabs(text)).replace(/\n/g, '<br>');
  }

  /** Czy schowek HTML pochodzi z edytora kodu (VS Code, IDE, GitHub, <pre>…). */
  function isCodeHtml(html) {
    if (!html) return false;
    if (/<pre[\s>]/i.test(html) && !/<(p|li|h[1-6]|table)[\s>]/i.test(html.replace(/<pre[\s\S]*?<\/pre>/gi, ''))) return true;
    var head = html.slice(0, 3000);
    return /white-space:\s*pre/i.test(head) && MONO_RE.test(head);
  }

  /** Heurystyka: czy zwykły tekst wygląda na listing kodu. */
  function looksLikeCode(text) {
    var lines = String(text).replace(/\r/g, '').split('\n').filter(function (l) { return l.trim() !== ''; });
    if (lines.length < 2) return /^\s*(<\?php|#include|import |from \S+ import|def |function |class |SELECT |public |const |let |var )/.test(text) && /[;{}()=]/.test(text);
    var indented = 0, codey = 0;
    lines.forEach(function (l) {
      if (/^(\t| {2,})\S/.test(l)) indented++;
      if (/[;{}]\s*$|^\s*[{}()\[\]]|=>|->|::|==|!=|\+\+|&&|\|\||^\s*(#|\/\/|\/\*|\*|--|<\/?[a-z]+[\s>])|^\s*(def|class|function|if|for|while|return|import|from|public|private|static|const|let|var|SELECT|INSERT|UPDATE|CREATE|echo|print)\b/i.test(l)) codey++;
    });
    return codey / lines.length >= 0.35 || (indented >= 1 && codey >= 1);
  }

  /* ---------- Kolorowanie składni (lekki, wbudowany) ---------- */
  var KW = {
    js: 'break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield async await of static get set null undefined true false',
    ts: 'interface type enum implements namespace declare readonly private public protected abstract as any number string boolean never unknown',
    php: 'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield null true false self parent',
    py: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield None True False self print',
    java: 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while var null true false string using namespace var async await override virtual readonly struct',
    c: 'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while bool true false nullptr class public private protected template typename namespace using new delete virtual override std include define ifdef ifndef endif',
    sql: 'select from where and or not insert into values update set delete create table alter drop index primary key foreign references join left right inner outer full on group by order having limit offset as distinct union all null is like in between exists case when then else end default auto_increment varchar int integer text datetime timestamp begin commit rollback view trigger procedure function returns declare',
    bash: 'if then else elif fi for while do done case esac function in return export local echo exit source alias cd sudo',
    go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false',
    rust: 'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while'
  };
  var LANG_MAP = { javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', php: 'php', python: 'py', py: 'py', java: 'java', csharp: 'java', cs: 'java', kotlin: 'java', c: 'c', cpp: 'c', sql: 'sql', bash: 'bash', shell: 'bash', go: 'go', rust: 'rust', html: 'html', xml: 'html', css: 'css', json: 'json' };
  var kwCache = {};
  function kwSet(lang) {
    if (kwCache[lang]) return kwCache[lang];
    var words = (KW[lang] || '') + (lang === 'ts' ? ' ' + KW.js : '');
    var set = {};
    words.split(/\s+/).forEach(function (w) { if (w) set[lang === 'sql' ? w.toLowerCase() : w] = 1; });
    return (kwCache[lang] = set);
  }

  function detectLang(code) {
    if (/<\?php|\$[a-z_]\w*\s*=|->\w+\(|echo\s/i.test(code)) return 'php';
    if (/^\s*(def |class \w+(\(.*\))?:|import \w+$|from \S+ import|print\()/m.test(code) && !/[;{]\s*$/m.test(code)) return 'python';
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/im.test(code)) return 'sql';
    if (/^\s*<(!doctype|html|div|span|body|head|\w+[\s>])/im.test(code) && /<\/\w+>/.test(code)) return 'html';
    if (/^\s*#include|std::|printf\(|int main\(/m.test(code)) return 'cpp';
    if (/\b(public|private)\s+(static\s+)?(class|void|int|String)\b|System\.out/.test(code)) return 'java';
    if (/^\s*(package main|func \w+\()/m.test(code)) return 'go';
    if (/\bfn \w+\(|let mut |println!/.test(code)) return 'rust';
    if (/^\s*[.#]?[\w-]+\s*\{[\s\S]*:\s*[^;]+;/m.test(code) && !/function|=>|const /.test(code)) return 'css';
    if (/^\s*[{\[][\s\S]*[}\]]\s*$/.test(code) && /"\w+"\s*:/.test(code)) return 'json';
    if (/^\s*(#!\/bin\/(ba)?sh|echo |sudo |apt |cd \S)/m.test(code)) return 'bash';
    if (/\b(function|const|let|var|=>|console\.)\b|=>/.test(code)) return 'javascript';
    return 'plain';
  }

  function span(cls, s) { return '<span class="tk-' + cls + '">' + escapeHtml(s) + '</span>'; }

  function highlight(code, lang) {
    if (!lang || lang === 'auto') lang = detectLang(code);
    var L = LANG_MAP[lang];
    if (!L || lang === 'plain') return escapeHtml(code);
    if (L === 'html') {
      return escapeHtml(code)
        .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tk-c">$1</span>')
        .replace(/(&lt;\/?)([\w:-]+)([^&]*?)(\/?&gt;)/g, function (m, a, tag, attrs, b) {
          attrs = attrs.replace(/([\w:-]+)(=)(&quot;.*?&quot;|'.*?')/g, '<span class="tk-a">$1</span>$2<span class="tk-s">$3</span>');
          return '<span class="tk-p">' + a + '</span><span class="tk-k">' + tag + '</span>' + attrs + '<span class="tk-p">' + b + '</span>';
        });
    }
    var hashComment = L === 'py' || L === 'bash' || L === 'php';
    var dashComment = L === 'sql';
    var kws = kwSet(L === 'css' || L === 'json' ? '' : L);
    var out = '', i = 0, n = code.length;
    while (i < n) {
      var ch = code.charAt(i), rest;
      // komentarze
      if ((ch === '/' && code.charAt(i + 1) === '/' && L !== 'css' && L !== 'json' && L !== 'py' && L !== 'sql') || (hashComment && ch === '#') || (dashComment && ch === '-' && code.charAt(i + 1) === '-')) {
        var e1 = code.indexOf('\n', i); if (e1 === -1) e1 = n;
        out += span('c', code.slice(i, e1)); i = e1; continue;
      }
      if (ch === '/' && code.charAt(i + 1) === '*' && L !== 'py') {
        var e2 = code.indexOf('*/', i + 2); e2 = e2 === -1 ? n : e2 + 2;
        out += span('c', code.slice(i, e2)); i = e2; continue;
      }
      if (L === 'py' && (code.substr(i, 3) === '"""' || code.substr(i, 3) === "'''")) {
        var q3 = code.substr(i, 3), e3 = code.indexOf(q3, i + 3); e3 = e3 === -1 ? n : e3 + 3;
        out += span('s', code.slice(i, e3)); i = e3; continue;
      }
      // napisy
      if (ch === '"' || ch === "'" || (ch === '`' && (L === 'js' || L === 'ts' || L === 'go' || L === 'sql'))) {
        var j = i + 1;
        while (j < n && code.charAt(j) !== ch && !(code.charAt(j) === '\n' && ch !== '`')) { if (code.charAt(j) === '\\') j++; j++; }
        j = Math.min(n, j + 1);
        out += span(L === 'json' && /^\s*:/.test(code.slice(j, j + 3)) ? 'a' : 's', code.slice(i, j)); i = j; continue;
      }
      // liczby
      rest = code.slice(i, i + 40);
      var m = /^(0x[\da-f]+|\d[\d_]*(\.\d+)?(e[+-]?\d+)?)/i.exec(rest);
      if (m && !/[\w$]/.test(code.charAt(i - 1) || '')) { out += span('n', m[0]); i += m[0].length; continue; }
      // zmienne PHP / bash
      if ((ch === '$' && (L === 'php' || L === 'bash'))) {
        var mv = /^\$[\w]+/.exec(code.slice(i, i + 80));
        if (mv) { out += span('v', mv[0]); i += mv[0].length; continue; }
      }
      // słowa
      var mw = /^[A-Za-z_][\w]*/.exec(code.slice(i, i + 80));
      if (mw) {
        var w = mw[0], key = L === 'sql' ? w.toLowerCase() : w;
        if (L === 'css') {
          out += /^\s*:/.test(code.slice(i + w.length, i + w.length + 3)) ? span('a', w) : escapeHtml(w);
        } else if (kws[key]) out += span('k', w);
        else if (code.charAt(i + w.length) === '(') out += span('f', w);
        else if (/^[A-Z][a-z]/.test(w) && L !== 'sql') out += span('t', w);
        else out += escapeHtml(w);
        i += w.length; continue;
      }
      if (ch === '@' && (L === 'py' || L === 'java' || L === 'ts' || L === 'php')) {
        var md = /^@[\w.]+/.exec(code.slice(i, i + 60));
        if (md) { out += span('f', md[0]); i += md[0].length; continue; }
      }
      out += escapeHtml(ch); i++;
    }
    return out;
  }

  window.Sanitize = {
    html: sanitizeHtml, escape: escapeHtml, expandTabs: expandTabs, textToHtml: textToHtml,
    isCodeHtml: isCodeHtml, looksLikeCode: looksLikeCode, detectLang: detectLang, highlight: highlight
  };
})();
