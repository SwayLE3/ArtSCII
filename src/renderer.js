import { EditorState, Prec, RangeSetBuilder } from '@codemirror/state';
import {
  EditorView,
  ViewPlugin,
  Decoration,
  keymap,
  drawSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, insertTab, indentLess } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';

const theme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      fontSize: 'var(--editor-font-size, 14px)',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      fontFamily: 'var(--editor-font-family, monospace)',
      lineHeight: '1.5',
    },
    '.cm-content': {
      padding: '16px',
      caretColor: '#fff',
    },
    '.cm-cursor': {
      borderLeftColor: '#fff',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: '#264f78',
    },
    '.cm-indentGuides': {
      backgroundImage: 'repeating-linear-gradient(to right, #555 0 1px, transparent 1px var(--tab-width, 4ch))',
      backgroundSize: 'calc(var(--indent) * var(--tab-width, 4ch)) 100%',
      backgroundRepeat: 'no-repeat',
      backgroundOrigin: 'content-box',
    },
  },
  { dark: true }
);

function leadingTabs(text) {
  return /^\t*/.exec(text)[0].length;
}

// lignes vides : on reprend l'indentation des voisines
function neighbourIndent(doc, lineNo, dir) {
  for (let n = lineNo + dir, i = 0; n >= 1 && n <= doc.lines && i < 200; n += dir, i++) {
    const text = doc.line(n).text;
    if (text.trim() !== '') return leadingTabs(text);
  }
  return 0;
}

function buildIndentGuides(view) {
  const builder = new RangeSetBuilder();
  const doc = view.state.doc;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = doc.lineAt(pos);
      let indent = leadingTabs(line.text);
      if (line.text.trim() === '') {
        indent = Math.max(
          indent,
          Math.min(neighbourIndent(doc, line.number, -1), neighbourIndent(doc, line.number, 1))
        );
      }
      if (indent > 0) {
        builder.add(
          line.from,
          line.from,
          Decoration.line({
            class: 'cm-indentGuides',
            attributes: { style: `--indent: ${indent}` },
          })
        );
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const indentGuides = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildIndentGuides(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildIndentGuides(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

const state = EditorState.create({
  doc: '',
  extensions: [
    history(),
    drawSelection(),
    indentGuides,
    indentUnit.of('\t'),
    EditorState.tabSize.of(4),
    Prec.highest(
      keymap.of([
        { key: 'Tab', run: insertTab, shift: indentLess, preventDefault: true },
      ])
    ),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    theme,
  ],
});

const view = new EditorView({
  state,
  parent: document.getElementById('editor'),
});

// focus
const toolbar = document.getElementById('toolbar');
view.focus();
view.contentDOM.addEventListener('blur', (e) => {
  if (e.relatedTarget && toolbar.contains(e.relatedTarget)) return;
  setTimeout(() => {
    if (!toolbar.contains(document.activeElement)) view.focus();
  }, 0);
});
document.addEventListener('mousedown', (e) => {
  if (!view.dom.contains(e.target) && !toolbar.contains(e.target)) {
    e.preventDefault();
    view.focus();
  }
});

// polices
const FONTS = [
  'Menlo',
  'Monaco',
  'SF Mono',
  'Consolas',
  'Cascadia Code',
  'Courier New',
  'Fira Code',
  'JetBrains Mono',
  'Source Code Pro',
  'Arial',
  'Helvetica',
  'Verdana',
  'Georgia',
  'Times New Roman',
];

function isFontAvailable(font) {
  const ctx = document.createElement('canvas').getContext('2d');
  const sample = 'mmmmmmmmmmlli10OO';
  return ['monospace', 'serif'].some((fallback) => {
    ctx.font = `72px ${fallback}`;
    const base = ctx.measureText(sample).width;
    ctx.font = `72px "${font}", ${fallback}`;
    return ctx.measureText(sample).width !== base;
  });
}

const fontSelect = document.getElementById('font-family');
const sizeInput = document.getElementById('font-size');
const root = document.documentElement;

for (const font of FONTS.filter(isFontAvailable)) {
  const option = document.createElement('option');
  option.value = font;
  option.textContent = font;
  option.style.fontFamily = `"${font}"`;
  fontSelect.append(option);
}

function readSetting(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

// largeur réelle d'un \t (≠ 4ch pour les polices proportionnelles)
const tabMeasurer = document.createElement('span');
tabMeasurer.textContent = '\t';
Object.assign(tabMeasurer.style, {
  position: 'absolute',
  visibility: 'hidden',
  whiteSpace: 'pre',
  tabSize: String(view.state.tabSize),
});
view.scrollDOM.append(tabMeasurer);

function updateTabWidth() {
  const width = tabMeasurer.getBoundingClientRect().width;
  if (width > 0) view.dom.style.setProperty('--tab-width', `${width}px`);
}

document.fonts.addEventListener('loadingdone', updateTabWidth);

function applyFont(font) {
  root.style.setProperty('--editor-font-family', `"${font}", monospace`);
  writeSetting('fontFamily', font);
  updateTabWidth();
}

function applySize(size) {
  size = Math.min(48, Math.max(8, Number(size) || 14));
  sizeInput.value = size;
  root.style.setProperty('--editor-font-size', `${size}px`);
  writeSetting('fontSize', size);
  updateTabWidth();
  view.requestMeasure();
}

const savedFont = readSetting('fontFamily', null);
fontSelect.value = [...fontSelect.options].some((o) => o.value === savedFont)
  ? savedFont
  : fontSelect.options[0]?.value ?? '';
if (fontSelect.value) applyFont(fontSelect.value);
applySize(readSetting('fontSize', 14));

fontSelect.addEventListener('change', () => {
  applyFont(fontSelect.value);
  view.focus();
});
sizeInput.addEventListener('change', () => {
  applySize(sizeInput.value);
  view.focus();
});
document.getElementById('font-smaller').addEventListener('click', () => {
  applySize(Number(sizeInput.value) - 1);
  view.focus();
});
document.getElementById('font-bigger').addEventListener('click', () => {
  applySize(Number(sizeInput.value) + 1);
  view.focus();
});

// image guide
const guide = document.createElement('div');
guide.id = 'guide';
guide.hidden = true;
const guideImage = document.createElement('img');
guideImage.alt = '';
guide.append(guideImage);
for (const kind of ['corner', 'right', 'bottom']) {
  const handle = document.createElement('div');
  handle.className = `guide-handle ${kind}`;
  handle.dataset.kind = kind;
  guide.append(handle);
}
view.scrollDOM.append(guide);

const guideFile = document.getElementById('guide-file');
const guideOpacity = document.getElementById('guide-opacity');
const guideOpacityValue = document.getElementById('guide-opacity-value');
const guideScale = document.getElementById('guide-scale');
const guideScaleValue = document.getElementById('guide-scale-value');
const guideToggle = document.getElementById('guide-toggle');
const guideRemove = document.getElementById('guide-remove');
const guideControls = [guideOpacity, guideScale, guideToggle, guideRemove];
let guideUrl = null;

const MIN_GUIDE_SIZE = 10;
let guideWidth = 0;
let guideHeight = 0;

function positionGuide() {
  const scrollerBox = view.scrollDOM.getBoundingClientRect();
  const contentBox = view.contentDOM.getBoundingClientRect();
  const style = getComputedStyle(view.contentDOM);
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  guide.style.left = `${contentBox.left - scrollerBox.left + view.scrollDOM.scrollLeft + paddingLeft}px`;
  guide.style.top = `${contentBox.top - scrollerBox.top + view.scrollDOM.scrollTop + paddingTop}px`;
}

function setGuideSize(width, height) {
  guideWidth = Math.max(MIN_GUIDE_SIZE, width);
  guideHeight = Math.max(MIN_GUIDE_SIZE, height);
  guide.style.width = `${guideWidth}px`;
  guide.style.height = `${guideHeight}px`;
  const percent = Math.round((guideWidth / guideImage.naturalWidth) * 100);
  guideScale.value = percent;
  guideScaleValue.textContent = `${percent} %`;
}

function applyGuideOpacity() {
  guideImage.style.opacity = guideOpacity.value / 100;
  guideOpacityValue.textContent = `${guideOpacity.value} %`;
}

function applyGuideScale() {
  const factor = guideScale.value / 100;
  setGuideSize(guideImage.naturalWidth * factor, guideImage.naturalHeight * factor);
}

function setGuideVisible(visible) {
  guide.hidden = !visible;
  guideToggle.textContent = visible ? 'Masquer' : 'Afficher';
}

guide.addEventListener('pointerdown', (e) => {
  const kind = e.target.dataset?.kind;
  if (!kind) return;
  e.preventDefault();
  e.stopPropagation();

  const handle = e.target;
  handle.setPointerCapture(e.pointerId);
  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = guideWidth;
  const startHeight = guideHeight;
  const ratio = startWidth / startHeight;

  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (kind === 'right') {
      setGuideSize(startWidth + dx, startHeight);
    } else if (kind === 'bottom') {
      setGuideSize(startWidth, startHeight + dy);
    } else if (ev.shiftKey) {
      setGuideSize(startWidth + dx, startHeight + dy);
    } else {
      const width = Math.abs(dx) > Math.abs(dy * ratio) ? startWidth + dx : (startHeight + dy) * ratio;
      setGuideSize(width, width / ratio);
    }
  };
  const onUp = () => {
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onUp);
    view.focus();
  };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onUp);
});
guide.addEventListener('mousedown', (e) => {
  if (e.target.dataset?.kind) {
    e.preventDefault();
    e.stopPropagation();
  }
});

document.getElementById('guide-import').addEventListener('click', () => guideFile.click());

guideFile.addEventListener('change', () => {
  const file = guideFile.files[0];
  guideFile.value = '';
  if (!file) return;
  if (guideUrl) URL.revokeObjectURL(guideUrl);
  guideUrl = URL.createObjectURL(file);
  guideImage.onload = () => {
    guideScale.value = 100;
    applyGuideScale();
    applyGuideOpacity();
    positionGuide();
    setGuideVisible(true);
    guideControls.forEach((el) => (el.disabled = false));
  };
  guideImage.src = guideUrl;
  view.focus();
});

guideOpacity.addEventListener('input', applyGuideOpacity);
guideScale.addEventListener('input', applyGuideScale);
guideToggle.addEventListener('click', () => {
  setGuideVisible(guide.hidden);
  view.focus();
});
guideRemove.addEventListener('click', () => {
  guideImage.removeAttribute('src');
  setGuideVisible(false);
  if (guideUrl) URL.revokeObjectURL(guideUrl);
  guideUrl = null;
  guideControls.forEach((el) => (el.disabled = true));
  view.focus();
});

window.addEventListener('resize', positionGuide);

// menu Fichier
function setContent(text) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor: 0 },
  });
  view.focus();
}

window.fileApi.onNew(() => setContent(''));
window.fileApi.onOpened((content) => setContent(content));
window.fileApi.onRequestSave((saveAs) => {
  window.fileApi.save(view.state.doc.toString(), saveAs);
});
