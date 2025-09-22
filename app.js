"use strict";

// ===== Utility =====
// 最終ポインタ座標（クリックや移動で更新）
let __lastPointer = { x: null, y: null };
function __updatePointer(ev){
  if (!ev) return;
  if (typeof ev.clientX === 'number' && typeof ev.clientY === 'number'){
    __lastPointer = { x: ev.clientX, y: ev.clientY };
  }
}
// ポインタイベントで座標を記憶（外側どこでも）
document.addEventListener('pointerdown', __updatePointer, { passive: true, capture: true });
document.addEventListener('pointermove', __updatePointer, { passive: true });
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function showToast(msg) {
  // 直近のポインタ座標があればカーソル横、なければ従来の中央下
  if (Number.isFinite(__lastPointer.x) && Number.isFinite(__lastPointer.y)){
    showToastAt(msg, __lastPointer.x, __lastPointer.y);
    return;
  }
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove('at-pointer');
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1400);
}

// クリック位置など任意座標の近くにトーストを表示
function showToastAt(msg, x, y, opts = {}){
  const { offsetX = 12, offsetY = 12, duration = 1400 } = opts;
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  // カーソル表示モードへ
  el.classList.add('at-pointer');
  // いったん表示してサイズを測る
  el.style.opacity = '0';
  el.style.left = '0px';
  el.style.top = '0px';
  el.style.bottom = 'auto';
  el.style.transform = 'none';
  el.classList.add('show');
  requestAnimationFrame(()=>{
    const vw = window.innerWidth, vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let tx = x + offsetX;
    let ty = y + offsetY;
    if (tx + rect.width + pad > vw) tx = Math.max(pad, vw - rect.width - pad);
    if (ty + rect.height + pad > vh) ty = Math.max(pad, vh - rect.height - pad);
    el.style.left = `${tx}px`;
    el.style.top = `${ty}px`;
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(()=>{
      el.classList.remove('show');
      // 後始末：中央表示に戻せるように初期化
      el.classList.remove('at-pointer');
      el.style.left = '';
      el.style.top = '';
      el.style.bottom = '';
      el.style.transform = '';
      el.style.opacity = '';
    }, duration);
  });
}
function showToastNearCursor(msg, ev, opts = {}){
  if (!ev) { showToast(msg); return; }
  const x = (ev.clientX != null) ? ev.clientX : 0;
  const y = (ev.clientY != null) ? ev.clientY : 0;
  showToastAt(msg, x, y, opts);
}

// 折り畳み見出し用：▼/◀ の付与・更新
function updateArrowLabel(el){
  // 矢印はCSSの擬似要素(::after)で表示するため、JSでは何もしない
}

// Half-width helpers for scoreboard/labels
function abbr4(s) {
  const t = (s || "").slice(0, 4);
  return t.padEnd(4, ' ');
}
function formatInningCell(v){
  if (v === undefined || v === null) return 'X';
  const n = Number(v);
  if (Number.isFinite(n)) return String(n);
  return 'X';
}
function makeScoreboardMarkdown(cols, linesA, linesB, nameA, nameB, totalA, totalB){
  const header = ['    '];
  for (let i=1;i<=cols;i++) header.push(String(i));
  header.push('計');
  const sep = ['----'];
  for (let i=1;i<=cols;i++) sep.push('---');
  sep.push('---');
  function row(name, lines, total){
    const r = [`${abbr4(name)}`];
    for (let i=0;i<cols;i++) r.push(formatInningCell(lines[i]));
    r.push(String(total));
    return `| ${r.join(' | ')} |`;
  }
  const headLine = `| ${header.join(' | ')} |`;
  const sepLine = `| ${sep.join(' | ')} |`;
  const aLine = row(nameA, linesA, totalA);
  const bLine = row(nameB, linesB, totalB);
  return [headLine, sepLine, aLine, bLine].join('\n');
}

// New: Scoreboard as grid cells (fixed width)
function makeScoreboardGridHtml(cols, linesA, linesB, nameA, nameB, totalA, totalB, hitsA, hitsB){
  const cells = [];
  function cell(txt, cls){ cells.push(`<div class="cell ${cls||''}">${escapeHtml(String(txt))}</div>`); }
  // Header
  cell('', 'th team');
  for (let i=1;i<=cols;i++) cell(i, 'th num');
  cell('計', 'th num');
  cell('H', 'th num');
  // Row A
  cell(nameA, 'team');
  for (let i=0;i<cols;i++) cell(formatInningCell(linesA[i]), 'num');
  cell(totalA, 'num');
  cell(hitsA ?? 0, 'num');
  // Row B
  cell(nameB, 'team');
  for (let i=0;i<cols;i++) cell(formatInningCell(linesB[i]), 'num');
  cell(totalB, 'num');
  cell(hitsB ?? 0, 'num');
  const style = `grid-template-columns: max-content repeat(${cols}, 2ch) 2ch 2ch;`;
  return `<div class="scoreboard-grid" style="${style}">${cells.join('')}</div>`;
}

// Table version (no grid-template-columns)
function makeScoreboardTable(cols, linesA, linesB, nameA, nameB, totalA, totalB, hitsA, hitsB){
  const headCells = [''].concat(Array.from({length:cols}, (_,i)=>String(i+1))).concat(['計','H']);
  const aCells = [nameA].concat(Array.from({length:cols}, (_,i)=>formatInningCell(linesA[i]))).concat([String(totalA), String(hitsA ?? 0)]);
  const bCells = [nameB].concat(Array.from({length:cols}, (_,i)=>formatInningCell(linesB[i]))).concat([String(totalB), String(hitsB ?? 0)]);
  const ths = headCells.map((t,idx)=>`<th class=\"${idx===0?'team':'col-inning'}\">${escapeHtml(t)}</th>`).join('');
  const aRow = aCells.map((t,idx)=> idx===0? `<td class=\"team\">${escapeHtml(t)}</td>` : `<td class=\"col-inning\">${escapeHtml(t)}</td>`).join('');
  const bRow = bCells.map((t,idx)=> idx===0? `<td class=\"team\">${escapeHtml(t)}</td>` : `<td class=\"col-inning\">${escapeHtml(t)}</td>`).join('');
  return `<table class="scoreboard-table"><thead><tr>${ths}</tr></thead><tbody><tr>${aRow}</tr><tr>${bRow}</tr></tbody></table>`;
}

// Seeded RNG
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a) { return function() { let t = (a += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function seededRng(seedStr) { const seed = xmur3(seedStr || (Math.random()+"") )(); return mulberry32(seed); }

// ===== Domain data =====
const TEAM_PRESETS = [
  { full: "HJ&チュパカブラーズ", abbr: "チュパ" },
  { full: "アフィブログいすゞ", abbr: "アフィ" },
  { full: "黒部ダム森永製菓", abbr: "森永" },
  { full: "ぐう畜テレビジョンズ", abbr: "ぐう畜" },
  { full: "避難J鉄道スパロウズ", abbr: "鉄スパ" },
  { full: "避難J篭球部モミーズ", abbr: "モミーズ" },
  { full: "新なんJフェニックス", abbr: "新J" },
  { full: "うんちブリックス", abbr: "うんちブリ" },
  { full: "大正義避難軍", abbr: "大正" },
  { full: "避難J村内会ゴリラズ", abbr: "ゴリラズ" },
  { full: "はませんベイスターズ", abbr: "はません" },
  { full: "避難J懺悔録ヒナリーズ", abbr: "懺悔" },
  { full: "避難所ジュピターズ", abbr: "ジュピ" },
  { full: "避難J村ダムズ", abbr: "ダムズ" },
  { full: "肥満Jレッドソックス", abbr: "肥満J" },
  { full: "ゴールデンボールツインズ", abbr: "金玉" },
  { full: "避難ジェイズ", abbr: "ジェイズ" },
  { full: "八木遊ファンタジーズ", abbr: "ファンタジーズ" },
  { full: "チームふじのみや", abbr: "ふじのみや" },
  { full: "原住民ピクルス", abbr: "ピクルス" },
];

const RANDOM_NAMES = [
"黄昏",
"網戸",
"津田沼",
"西船",
"東船",
"船橋",
"中山",
"本八幡",
"市川",
"小岩",
"平井",
"亀戸",
"錦糸",
"両国",
"浅草",
"秋葉",
"御茶ノ水",
"水道橋",
"飯田橋",
"市ヶ谷",
"四ツ谷",
"信濃",
"千駄ヶ谷",
"代々木",
"新宿",
"大久保",
"東野",
"本郷",
"幕張",
"検見川",
"稲毛",
"西葉",
"千葉",
"東葉",
"都賀",
"四街道",
"物井",
"佐倉",
"酒井",
"榎戸",
"八街",
"日向",
"成東",
"松尾",
"横芝",
"飯倉",
"八日市場",
"干潟",
"旭",
"飯岡",
"倉橋",
"猿田"
];

const HOPES_BASE = ["【希望なし】","【投手】","【野手】","【内野】","【外野】","先発","中継ぎ","抑え","捕","一","二","三","遊","左","中","右"];
function getHopeList(currentHope){
  const list = HOPES_BASE.slice();
  if (state.dh || currentHope === '指') list.push('指');
  return list;
}
const POS_KANJI = { P:"投", C:"捕", "1B":"一", "2B":"二", "3B":"三", SS:"遊", LF:"左", CF:"中", RF:"右", DH:"指" };
function posMark(r){ const key = (r && r.pos) || ""; const p = POS_KANJI[key] || ""; return p ? '('+p+')' : ""; }

// ===== State =====
const MAX_PLAYERS = 20;
let visibleCount = 9;
let state = {
  dh: false,
  slugfest: -10,
  seed: "",
  logView: 'cells', // セル表記を既定
  teams: {
    A: { full:"", abbr:"", preset:"", rows: Array.from({length:MAX_PLAYERS}, (_,i)=>emptyRow(i+1)) },
    B: { full:"", abbr:"", preset:"", rows: Array.from({length:MAX_PLAYERS}, (_,i)=>emptyRow(i+1)) },
  },
  currentGame: null,
};

function emptyRow(no){ return { no, name:"", id:"", hope:"【希望なし】", bats:"右", throws:"右", bat: null, pit: null, errs: [] }; }

// ===== Initialization =====
// DOMが既に準備済みでも確実に初期化する
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
function init(){
  // チームはデフォルト未選択（-）
  populatePresetDropdowns();

  // Build roster rows
  renderRoster('A');
  renderRoster('B');

  // Wire settings
  function enforcePlayerCountConstraints(){
    const min = state.dh ? 10 : 9;
    const pc = $("#player-count");
    if (pc) {
      // DHありのとき、9人オプションを選択不可にする
      Array.from(pc.options || []).forEach(opt => {
        if (String(opt.value) === '9') opt.disabled = !!state.dh;
      });
      if (visibleCount < min) {
        visibleCount = min;
        pc.value = String(visibleCount);
      }
    }
  }
  $("#player-count").addEventListener('change', e => {
    const min = state.dh ? 10 : 9;
    const v = clamp(parseInt(e.target.value||"9",10), min, 20);
    e.target.value = String(v);
    visibleCount = v;
    renderRoster('A');
    renderRoster('B');
    saveState();
  });
  const dhSel = $("#dh-select");
  if (dhSel) dhSel.addEventListener('change', e => {
    state.dh = (e.target.value === 'on');
    enforcePlayerCountConstraints(); // 9→10への自動補正とUI反映
    renderRoster('A');
    renderRoster('B');
    saveState();
  });
  $("#slugfest-level").addEventListener('change', e => { state.slugfest = parseInt(e.target.value,10) || 0; saveState(); });
  $("#seed-input").addEventListener('input', e => { state.seed = e.target.value; saveState(); });

  // Fold toggle by title (roster)
  const rosterTitle = $("#rosters .panel-header .panel-toggle");
  const rosterPanel = $("#rosters");
  function toggleRoster(){
    const exp = rosterTitle.getAttribute('aria-expanded') === 'true';
    rosterPanel.classList.toggle('collapsed', exp);
    rosterTitle.setAttribute('aria-expanded', String(!exp));
    updateArrowLabel(rosterTitle);
  }
  rosterTitle.addEventListener('click', toggleRoster);
  rosterTitle.addEventListener('keydown', (e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); toggleRoster(); } });
  updateArrowLabel(rosterTitle);

  // Section toggles (summary log, highlights)
  $$(".section-toggle").forEach(el=>{
    const targetSel = el.getAttribute('data-target');
    const target = $(targetSel);
    function toggle(){ const exp = el.getAttribute('aria-expanded')==='true'; target.classList.toggle('collapsed', exp); el.setAttribute('aria-expanded', String(!exp)); updateArrowLabel(el); }
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); toggle(); } });
    updateArrowLabel(el);
  });

  // 試合開始までは「試合ログ」「ハイライト」を完全非表示
  hideLogsUntilStart();

  // Toolbar buttons
  $("#btn-auto-lineup").addEventListener('click', () => {
    autoLineups();
    renderLineupsPreview();
    // 自動編成時にロスターを折り畳む
    const rosterTitle2 = $("#rosters .panel-header .panel-toggle");
    const rosterPanel2 = $("#rosters");
    rosterPanel2.classList.add('collapsed');
    if (rosterTitle2) rosterTitle2.setAttribute('aria-expanded', 'false');
    updateArrowLabel(rosterTitle2);
    showToast('スタメンを自動編成しました');
  });
  $("#btn-start").addEventListener('click', () => { startGame(); });
  $("#btn-reset-game").addEventListener('click', resetGame);
  $("#btn-reset-all").addEventListener('click', resetAll);

  $("#btn-copy-article").addEventListener('click', (e)=> copyArticleText(e));
  // 編成テキストコピー（ロスター見出し横）
  const btnCopyRoster = document.querySelector('#btn-copy-roster');
  if (btnCopyRoster) btnCopyRoster.addEventListener('click', (e)=> copyRosterText(e));
  const btnCsvDl = $("#btn-download-csv");
  if (btnCsvDl) btnCsvDl.addEventListener('click', downloadDebugCsv);
  const btnViewCsvDl = $("#btn-download-view-csv");
  if (btnViewCsvDl) btnViewCsvDl.addEventListener('click', downloadReadableLogCsv);
  const btnMulti = $("#btn-download-multi");
  if (btnMulti) btnMulti.addEventListener('click', downloadMultipleCsv);

  // 保存データの復元
  loadState();
  // 既定/復元直後の制約をUIに反映
  enforcePlayerCountConstraints();
  // enforceにより人数が繰り上がった場合に備えて再描画
  renderRoster('A');
  renderRoster('B');

  // （削除）ログ表示モード切替ボタンは未実装のため処理を撤去

  // Highlight view toggle
  // ハイライトはテキスト固定（セル表示は廃止）

  // ===== キーボードショートカット（Alt+Shift+Key） =====
  function isTypingTarget(el){
    if (!el) return false;
    const t = el.closest('input, textarea, select, [contenteditable="true"]');
    return !!t;
  }
  function clickIf(sel){ const el = document.querySelector(sel); if (el) el.click(); }
  function onShortcut(e){
    // Alt+Shift もしくは（配慮）Meta+Shift をサポート
    const hasMod = (e.altKey && e.shiftKey) || (e.metaKey && e.shiftKey);
    if (!hasMod) return;
    if (isTypingTarget(e.target)) return;
    const k = (e.key || '').toLowerCase();
    switch (k) {
      case 'q': // 試合開始
        clickIf('#btn-start');
        break;
      case 'r': // 試合リセット（Reset）
        clickIf('#btn-reset-game');
        break;
      case 'l': // 全リセット
        clickIf('#btn-reset-all');
        break;
      case 'e': // メンバー自動編成
        clickIf('#btn-auto-lineup');
        break;
      case 'a': // チームA 空欄ランダム埋め
        clickIf('.team-actions .btn-fill-blanks[data-side="A"]');
        break;
      case 'd': // チームA 名前・IDをクリア
        clickIf('.team-actions .btn-clear-names[data-side="A"]');
        break;
      case 'z': // チームB 空欄ランダム埋め
        clickIf('.team-actions .btn-fill-blanks[data-side="B"]');
        break;
      case 'c': // チームB 名前・IDをクリア
        clickIf('.team-actions .btn-clear-names[data-side="B"]');
        break;
      case 'p': // 印刷（結果+成績）
        clickIf('#scoreboard .sbh-print');
        break;
      default:
        return;
    }
    e.preventDefault();
    // showToast('ショートカット実行');
  }
  document.addEventListener('keydown', onShortcut, { capture: true });
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function populatePresetDropdowns(){
  for (const side of ['A','B']){
    const sel = $(`.team-preset[data-side="${side}"]`);
    const opts = [`<option value="-1" selected>-</option>`]
      .concat(TEAM_PRESETS.map((t,i)=>`<option value="${i}">${escapeHtml(t.full)}</option>`));
    sel.innerHTML = opts.join('');
    sel.value = '-1';
    sel.addEventListener('change', e => {
      const v = String(e.target.value);
      if (v === '-1') {
        state.teams[side].full = '';
        state.teams[side].abbr = '';
        $(`.team-name[data-side="${side}"]`).value = '';
        $(`.team-abbr[data-side="${side}"]`).value = '';
      } else {
        const t = TEAM_PRESETS[parseInt(v,10)];
        applyTeamPreset(side, t);
      }
    });
  }
}
function applyTeamPreset(side, t){
  state.teams[side].full = t.full;
  state.teams[side].abbr = t.abbr;
  $(`.team-name[data-side="${side}"]`).value = t.full;
  $(`.team-abbr[data-side="${side}"]`).value = t.abbr;
  saveState();
}

// ===== Roster rendering =====
function renderRoster(side){
  const root = $(`#rows-${side}`);
  root.innerHTML = '';
  const team = state.teams[side];
  // Name inputs
  $(`.team-name[data-side="${side}"]`).addEventListener('input', e => { team.full = e.target.value; saveState(); });
  $(`.team-abbr[data-side="${side}"]`).addEventListener('input', e => { team.abbr = e.target.value; saveState(); });

  const frag = document.createDocumentFragment();
  for (let i=0;i<MAX_PLAYERS;i++){
    const row = team.rows[i];
    const visible = i < visibleCount;
    const div = document.createElement('div');
    div.className = 'roster-row';
    if (!visible) { div.style.display = 'none'; }
    div.dataset.index = String(i);
    div.innerHTML = `
      <div>${row.no}</div>
      <div><input type="text" class="name" value="${escapeHtml(row.name)}" placeholder="名前"></div>
      <div>
        <input type="text" class="id" value="${escapeHtml(row.id)}" placeholder="8桁英大小数字" maxlength="8">
        <div class="error-msg" role="alert" aria-live="polite"></div>
      </div>
      <div>
        <select class="hope">${getHopeList(row.hope).map(h=>`<option value="${h}" ${row.hope===h?'selected':''}>${h}</option>`).join('')}</select>
      </div>
      <div><span class="dli-copy copy" role="button" title="能力値をクリップボードにコピー"><span></span></span></div>
      <div><button type="button" class="clear">クリア</button></div>
    `;
    const nameI = $('.name', div);
    const idI = $('.id', div);
    const hopeS = $('.hope', div);
    const err = $('.error-msg', div);
    nameI.addEventListener('input', e => { row.name = e.target.value; saveState(); });
    idI.addEventListener('input', e => { row.id = e.target.value; validateIdAll(); saveState(); });
    hopeS.addEventListener('change', e => { row.hope = e.target.value; ensureTraits(row); saveState(); });
    $('.copy', div).addEventListener('click', ()=> copyRowAbility(side, i));
    $('.clear', div).addEventListener('click', ()=> { row.name=''; row.id=''; row.hope='【希望なし】'; ensureTraits(row); renderRoster(side); saveState(); });
    frag.appendChild(div);
  }
  root.appendChild(frag);

  // Team-level buttons
  $(`.team-actions .btn-fill-blanks[data-side="${side}"]`).onclick = ()=> fillBlanks(side);
  $(`.team-actions .btn-clear-names[data-side="${side}"]`).onclick = ()=> clearNamesIds(side);
  // $(`.team-actions .btn-recalc[data-side="${side}"]`).onclick = ()=> recalcTeam(side);

  validateIdAll();
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

// ===== Validation =====
function validateIdAll(){
  const ids = new Map();
  for (const side of ['A','B']){
    for (let i=0;i<visibleCount;i++){
      const row = state.teams[side].rows[i];
      const key = row.id;
      if (/^[A-Za-z0-9]{8}$/.test(key)) ids.set(key, (ids.get(key)||0)+1);
    }
  }
  for (const side of ['A','B']){
    const root = $(`#rows-${side}`);
    for (let i=0;i<visibleCount;i++){
      const div = root.children[i];
      const idI = $('.id', div);
      const err = $('.error-msg', div);
      const val = idI.value;
      let msg = '';
      if (!val) msg = '';
      else if (!/^[A-Za-z0-9]{8}$/.test(val)) msg = '8桁の英大小数字';
      else if ((ids.get(val)||0) > 1) msg = 'ID重複';
      idI.classList.toggle('invalid', !!msg);
      err.textContent = msg;
      // Update traits when valid
      const row = state.teams[side].rows[i];
      if (/^[A-Za-z0-9]{8}$/.test(val)) { row.id = val; ensureTraits(row); }
    }
  }
}

// ===== Traits generation (deterministic by ID) =====
function ensureTraits(row){
  if (!/^[A-Za-z0-9]{8}$/.test(row.id)) { row.bat=null; row.pit=null; return; }
  const prng = seededRng(row.id);
  // Bats/Throws bias: bats Right 70%/Left 30%; throws Right 85%/Left 15%
  row.bats = prng() < 0.30 ? '左' : '右';
  row.throws = prng() < 0.15 ? '左' : '右';

  // Hitter abilities 0–100 then grade
  const base = () => Math.floor(prng()*101);
  let power = Math.floor(40 + prng()*61); // 40–100
  const contact = Math.floor(35 + prng()*66); // 35–100
  const run = Math.floor(30 + prng()*71);
  const arm = Math.floor(30 + prng()*71);
  const field = Math.floor(30 + prng()*71);
  const catchF = Math.floor(30 + prng()*71);
  // Trajectory 1–4 linked weakly with power
  const trajectory = 1 + Math.min(3, Math.floor((power-40)/20) + (prng()<0.3?1:0));
  row.bat = {
    trajectory,
    contact: grade(contact),
    power: grade(power),
    run: grade(run),
    arm: grade(arm),
    field: grade(field),
    catch: grade(catchF)
  };
  // Pitcher: velo 80–185km/h; control/stamina grades
  const velo = Math.floor(80 + prng()*106); // 80–185
  const control = grade(Math.floor(30 + prng()*71));
  const stamina = grade(Math.floor(30 + prng()*71));
  const PITCH_TYPES = ['スライダー','カーブ','フォーク','チェンジアップ','シンカー','ツーシーム','カットボール','スプリット'];
  const fav = PITCH_TYPES[Math.floor(prng()*PITCH_TYPES.length)];
  row.pit = { velo, control, stamina, fav };
}
function grade(n){ if(n>=90) return 'A'; if(n>=80) return 'B'; if(n>=70) return 'C'; if(n>=60) return 'D'; if(n>=50) return 'E'; if(n>=40) return 'F'; return 'G'; }

// ===== Team-level ops =====
function fillBlanks(side){
  const team = state.teams[side];
  const rng = seededRng(`${Date.now()}-${side}`);
  const usedIds = new Set([...collectIds('A'), ...collectIds('B')]);
  const usedNames = collectAllNames();
  for (let i=0;i<visibleCount;i++){
    const row = team.rows[i];
    if (!row.name) { const nm = pickUnique(RANDOM_NAMES, rng, usedNames); row.name = nm; usedNames.add(nm); }
    if (!/^[A-Za-z0-9]{8}$/.test(row.id)) {
      let id;
      do { id = randId(rng); } while (usedIds.has(id));
      row.id = id; ensureTraits(row); usedIds.add(id);
    }
  }
  renderRoster(side);
  saveState();
}
function clearNamesIds(side){
  const team = state.teams[side];
  for (let i=0;i<visibleCount;i++){
    const r = team.rows[i]; r.name=''; r.id=''; r.hope='【希望なし】'; r.bat=null; r.pit=null;
  }
  renderRoster(side);
  saveState();
}
function recalcTeam(side){
  const team = state.teams[side];
  for (let i=0;i<visibleCount;i++) ensureTraits(team.rows[i]);
  renderRoster(side);
  saveState();
}
function collectIds(side){
  const set = new Set();
  for (let i=0;i<visibleCount;i++){ const id = state.teams[side].rows[i].id; if (/^[A-Za-z0-9]{8}$/.test(id)) set.add(id); }
  return set;
}
function collectNames(side){
  const set = new Set();
  for (let i=0;i<MAX_PLAYERS;i++){ const n = state.teams[side].rows[i].name.trim(); if (n) set.add(n); }
  return set;
}
function collectAllNames(){
  const s = new Set();
  for (const side of ['A','B']){
    for (let i=0;i<MAX_PLAYERS;i++){
      const n = state.teams[side].rows[i].name.trim();
      if (n) s.add(n);
    }
  }
  return s;
}
function pickUnique(pool, rng, used){
  const avail = pool.filter(n => !used.has(n));
  if (avail.length === 0) return pool[0];
  return avail[Math.floor(rng()*avail.length)];
}
function randId(rng){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s=''; for(let i=0;i<8;i++) s += chars[Math.floor(rng()*chars.length)];
  return s;
}

// ===== Copy ability text =====
function copyRowAbility(side, idx){
  const team = state.teams[side]; const row = team.rows[idx]; ensureTraits(row);
  const name = row.name || `選手${row.no}`;
  const lines = [];
  const dh = state.dh;
  const isPitchKind = ["【投手】","先発","中継ぎ","抑え"].some(k=> row.hope.startsWith(k));
  const b = row.bat || {};
  const p = row.pit || {};
  const hitterLine = `${name} ID:${row.id}\n${row.bats}打ち｜弾道${(b.trajectory!=null?b.trajectory:1)} ミート${(b.contact!=null?b.contact:'G')} パワー${(b.power!=null?b.power:'G')} 走力${(b.run!=null?b.run:'G')} 肩力${(b.arm!=null?b.arm:'G')} 守備${(b.field!=null?b.field:'G')} 捕球${(b.catch!=null?b.catch:'G')}`;
  const pitcherLine = `${name} ID:${row.id}\n${row.throws}投げ｜球速${(p.velo!=null?p.velo:120)}km/h コントロール${(p.control!=null?p.control:'G')} スタミナ${(p.stamina!=null?p.stamina:'G')}`;
  if (isPitchKind && dh) {
    lines.push(pitcherLine);
  } else if (isPitchKind && !dh) {
    lines.push(hitterLine, row.throws+"投げ｜球速"+((p.velo!=null?p.velo:120))+"km/h コントロール"+((p.control!=null?p.control:'G'))+" スタミナ"+((p.stamina!=null?p.stamina:'G')));
  } else {
    lines.push(hitterLine);
  }
  const text = lines.join("\n");
  const preview = text.replace(/[\r\n]+/g,' ').trim().slice(0, 120);
  copyText(text)
    .then(()=>showToast(`${preview} をクリップボードにコピーしました`))
    .catch(()=>{});
}
async function copyText(t){
  try { await navigator.clipboard.writeText(t); }
  catch(e){
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); } finally { document.body.removeChild(ta); }
  }
}

// ===== 編成テキストコピー =====
function copyRosterText(ev){
  try{
    const text = buildRosterText();
    copyText(text).then(()=>{
      showToastNearCursor('編成テキストをコピーしました', ev);
    });
  } catch(_){ showToastNearCursor('編成テキストの生成に失敗しました', ev); }
}
function buildRosterText(){
  // 現在の入力内容から編成を構築（未編成でも自動で整形）
  const A = buildTeam('A');
  const B = buildTeam('B');
  return [formatTeamBlock(A), '', formatTeamBlock(B)].join('\n');
}
function idOrPlaceholder(id){ return (id && String(id).trim()) ? String(id).trim() : '--------'; }
function fmtBatterLine(i, r){
  const pos = posKanji(r) || (r.pos || '');
  const name = r.name || `選手${i}`;
  const id = idOrPlaceholder(r.id||'');
  const b = r.bat || {};
  const traj = (b.trajectory!=null? b.trajectory : 1);
  const con = b.contact!=null? b.contact : 'G';
  const pow = b.power!=null? b.power : 'G';
  const run = b.run!=null? b.run : 'G';
  const arm = b.arm!=null? b.arm : 'G';
  const fld = b.field!=null? b.field : 'G';
  const cat = b.catch!=null? b.catch : 'G';
  return `${i} ${pos||'—'} ${name}(ID:${id}) 弾${traj} ミ${con} パ${pow} 走${run} 肩${arm} 守${fld} 捕${cat}`;
}
function fmtPitcherLine(role, p){
  if (!p) return `${role}: -`;
  const name = p.name || '投手';
  const id = idOrPlaceholder(p.id||'');
  const velo = (p.pit && p.pit.velo!=null) ? `${p.pit.velo}km/h` : '';
  const ctrl = (p.pit && p.pit.control!=null) ? `コン${p.pit.control}` : '';
  const sta  = (p.pit && p.pit.stamina!=null) ? `スタ${p.pit.stamina}` : '';
  const sp = [velo, ctrl, sta].filter(Boolean).join(' ');
  return `${role}: ${name}(ID:${id})  ${sp}`.trim();
}
function formatTeamBlock(T){
  const title = (T.full && T.full.trim()) || (T.side==='A'? 'チームA':'チームB');
  const lines = [];
  lines.push(`${title}`);
  // 打順（DHのときはlineupが10人になる可能性に注意→buildTeamは常に9枠だが、DHは投手を外してDHを含む）
  const batters = (T.lineup||[]);
  for (let i=0;i<batters.length; i++){
    const order = i+1;
    const r = batters[i] || {};
    lines.push(fmtBatterLine(order, r));
  }
  lines.push('');
  lines.push('投手');
  lines.push(fmtPitcherLine('先発', T.pitcher));
  const pen = (T.bullpen||[]);
  if (pen.length>0){
    const first = pen[0];
    lines.push(fmtPitcherLine('控え', first));
    for (let i=1;i<pen.length;i++){
      const p = pen[i];
      lines.push(`　　　${fmtPitcherLine('', p).replace(/^\s*:?\s*/, '')}`);
    }
  }
  return lines.join('\n');
}

// ===== Lineup auto assignment (simplified) =====
function autoLineups(){
  const need = state.dh ? 10 : 9;
  const cntA = eligibleCount('A');
  const cntB = eligibleCount('B');
  if (cntA < need || cntB < need){ showToast('人数が足りません'); }
  for (const side of ['A','B']){
    const team = state.teams[side];
    const rows = team.rows.slice(0, Math.max(9, visibleCount)).filter(r=> r.name || r.id);
    rows.forEach(r=> ensureTraits(r));
    const { lineup, pitcher, pitchers } = assignPositions(rows, state.dh);
    team.lineup = lineup; // includes positions
    team.pitcher = pitcher;
    team.pitchers = pitchers;
  }
}
function scorePitch(r){
  const g = {A:6,B:5,C:4,D:3,E:2,F:1,G:0};
  const pit = r.pit || {};
  const velo = (pit.velo!=null ? pit.velo : 120);
  return velo/10 + g[pit.control||'G'] + g[pit.stamina||'G'];
}
function assignPositions(players, dh){
  // Clone shallow to avoid mutating original rows
  const pool = players.map(p=>({...p}));
  const unassigned = new Set(pool);
  const infield = ['1B','2B','3B','SS'];
  const outfield = ['LF','CF','RF'];

  // Choose starting pitcher with hope preference
  const pitchKinds = (h)=> /【投手】|先発|中継ぎ|抑え/.test(h);
  function pitchPref(h){
    if (h==='先発') return 0; if (h==='【投手】') return 1; if (h==='中継ぎ') return 2; if (h==='抑え') return 3; if (h==='【希望なし】') return 4; return 5;
  }
  const pitchCands = pool.filter(p=> pitchKinds(p.hope) || p.hope==='【希望なし】');
  pitchCands.sort((a,b)=> pitchPref(a.hope) - pitchPref(b.hope) || scorePitch(b) - scorePitch(a));
  const pitcher = pitchCands[0] || pool[0];
  if (pitcher) unassigned.delete(unassignedHas(unassigned, pitcher));

  // Assign field positions (excluding P)
  const positions = ['C','1B','2B','3B','SS','LF','CF','RF'];
  const assigned = [];
  for (const pos of positions){
    const candArr = Array.from(unassigned);
    candArr.sort((a,b)=> posCmp(a,b,pos));
    const pick = candArr[0];
    if (pick){
      unassigned.delete(pick);
      assigned.push({...pick, pos});
    }
  }

  // DH slot if enabled
  if (dh){
    const candArr = Array.from(unassigned).filter(p=> !/【投手】|先発|中継ぎ|抑え/.test(p.hope));
    const dhPref = (h)=> h==='指' ? 0 : (h==='【野手】' ? 1 : (h==='【希望なし】' ? 2 : ((h==='【内野】' || h==='【外野】') ? 3 : 4)));
    candArr.sort((a,b)=> dhPref(a.hope) - dhPref(b.hope) || scoreHit(b) - scoreHit(a));
    const dhPick = candArr[0] || Array.from(unassigned)[0];
    if (dhPick){ unassigned.delete(dhPick); assigned.push({...dhPick, pos:'DH'}); }
  }

  // Build batting order
  let lineup;
  if (dh){
    lineup = assigned.sort((a,b)=> scoreHit(b)-scoreHit(a)).slice(0,9);
  } else {
    // add pitcher batting 9th
    const fielders = assigned.slice(0,8).sort((a,b)=> scoreHit(b)-scoreHit(a));
    const pBat = {...pitcher, pos:'P'};
    lineup = [...fielders.slice(0,8), pBat];
  }
  // Pitcher list for bullpen display: exclude anyone who was assigned a field/DH position
  const remainingPitch = Array.from(unassigned).filter(p=> pitchKinds(p.hope) || p.hope==='【希望なし】');
  remainingPitch.sort((a,b)=> pitchPref(a.hope) - pitchPref(b.hope) || scorePitch(b) - scorePitch(a));
  const pitchers = [pitcher, ...remainingPitch];
  return { lineup, pitcher, pitchers };
}
function unassignedHas(set, ref){
  for (const x of set){ if (x===ref || (x.id && ref.id && x.id===ref.id && x.name===ref.name)) return x; }
  return ref;
}
function posCmp(a,b,pos){
  const pa = posPref(a.hope, pos), pb = posPref(b.hope, pos);
  if (pa !== pb) return pa - pb;
  return scoreHit(b) - scoreHit(a);
}
function posPref(hope, pos){
  // 0: exact, 1: in/out category match, 2: 野手, 3: 希望なし, 4: others, 5: pitcher-kind on fielder
  if (hope === mapPosToHope(pos)) return 0;
  if ((hope==='【内野】' && ['1B','2B','3B','SS'].includes(pos)) || (hope==='【外野】' && ['LF','CF','RF'].includes(pos))) return 1;
  if (hope==='【野手】') return 2;
  if (hope==='【希望なし】') return 3;
  if (/【投手】|先発|中継ぎ|抑え/.test(hope)) return 5;
  return 4;
}
function mapPosToHope(pos){
  return ({C:'捕','1B':'一','2B':'二','3B':'三',SS:'遊',LF:'左',CF:'中',RF:'右',P:'【投手】',DH:'指'})[pos] || '';
}
function scoreHit(r){
  // Simple score by grades
  const g = {A:6,B:5,C:4,D:3,E:2,F:1,G:0};
  const b = r.bat || {trajectory:1, contact:'G', power:'G', run:'G', arm:'G', field:'G'};
  return b.trajectory + g[b.contact] + 1.2*g[b.power] + 0.4*g[b.run];
}

// ===== Game engine (simplified but deterministic) =====
function startGame(){
  // Ensure engine loaded; fallbackで動的ロード
  if (!(window.Engine && window.Engine.simulateGame)){
    const tried = document.body.getAttribute('data-engine-tried');
    function loadScriptOnce(src){
      return new Promise((resolve,reject)=>{
        const s = document.createElement('script');
        s.src = src; s.onload = ()=>resolve(true); s.onerror = ()=>reject(new Error('load failed'));
        document.head.appendChild(s);
      });
    }
    // 一度だけリトライ
    if (!tried){
      document.body.setAttribute('data-engine-tried','1');
      loadScriptOnce('js/engine.js').then(()=>{
        // 再実行
        startGame();
      }).catch(()=>{
        showToast('エンジン読み込みに失敗しました');
      });
      return;
    }
    showToast('エンジン読み込みに失敗しました');
    return;
  }
  // Fold roster
  const rosterTitle = $("#rosters .panel-header .panel-toggle");
  const panel = $("#rosters");
  panel.classList.add('collapsed'); if (rosterTitle) { rosterTitle.setAttribute('aria-expanded', 'false'); updateArrowLabel(rosterTitle); }

  // 人数チェックと自動編成
  const need = state.dh ? 10 : 9;
  const cntA = eligibleCount('A');
  const cntB = eligibleCount('B');
  if (cntA < need || cntB < need){ showToast('人数が足りません'); return; }
  if (!state.teams.A.lineup || !state.teams.B.lineup){ autoLineups(); }

  // Build teams and validate names
  const A = buildTeam('A');
  const B = buildTeam('B');
  if (!A || !B) { showToast('必要な情報が不足しています'); return; }

  // Seed（空なら自動生成）
  const usedSeed = (state.seed && state.seed.trim()) ? state.seed.trim() : `${Date.now()}-${Math.random()}`;
  const rng = seededRng(usedSeed);

  // If no lineup yet, auto
  if (!state.teams.A.lineup) autoLineups();

  // 分割後エンジン（グローバル公開）で試合をシミュレート
  const game = window.Engine.simulateGame(A, B, rng, { slugfest: state.slugfest, dh: state.dh });
  game.seed = usedSeed;
  state.currentGame = game;
  // 試合ログ・ハイライトの見出しだけ表示（展開/折り畳み状態は維持）
  showLogHeadersVisibleKeepState();
  renderGame(game);

  // 試合終了トースト（最終スコアを表示）
  try {
    const na = (game.A && (game.A.abbr || game.A.full)) || 'チームA';
    const nb = (game.B && (game.B.abbr || game.B.full)) || 'チームB';
    showToast(`試合終了！ ${na} ${game.scoreA}-${game.scoreB} ${nb}`);
  } catch (_) { /* noop */ }
}

function resetGame(){
  state.currentGame = null;
  $("#lineups").innerHTML = '';
  $("#scoreboard").innerHTML = '';
  $("#summary-log").innerHTML = '';
  $("#stats").innerHTML = '';
  $("#highlights").innerHTML = '';
  $("#result").innerHTML = '';
  hideLogsUntilStart();
  // Re-open rosters
  const rosterTitle = $("#rosters .panel-header .panel-toggle");
  const panel = $("#rosters");
  panel.classList.remove('collapsed'); if (rosterTitle) { rosterTitle.setAttribute('aria-expanded', 'true'); updateArrowLabel(rosterTitle); }
}
function resetAll(){
  const view = state.logView || 'cells';
  // 乱打補正の既定はUIの既定（-10=表示上の0）に合わせる
  state = { dh:false, slugfest:-10, seed:"", logView:view, teams: {A:{full:"",abbr:"",preset:"",rows:Array.from({length:MAX_PLAYERS},(_,i)=>emptyRow(i+1))}, B:{full:"",abbr:"",preset:"",rows:Array.from({length:MAX_PLAYERS},(_,i)=>emptyRow(i+1))} }, currentGame:null };
  visibleCount = 9;
  $("#player-count").value = '9'; $("#dh-select").value = 'off'; $("#slugfest-level").value = '-10'; $("#seed-input").value = '';
  populatePresetDropdowns();
  renderRoster('A'); renderRoster('B');
  resetGame();
}

// 人数カウント（名前またはIDが入力済の人数）
function eligibleCount(side){
  const team = state.teams[side];
  let c = 0;
  for (let i=0;i<visibleCount;i++){
    const r = team.rows[i];
    if ((r.name && r.name.trim()) || (/^[A-Za-z0-9]{8}$/.test(r.id||''))) c++;
  }
  return c;
}

// ===== UI helpers for log visibility =====
function hideLogsUntilStart(){
  const hdrLog = document.querySelector('h3.section-toggle[data-target="#summary-log"]');
  const hdrHi = document.querySelector('h3.section-toggle[data-target="#highlights"]');
  const sum = document.querySelector('#summary-log');
  const hi = document.querySelector('#highlights');
  if (hdrLog) { hdrLog.classList.add('hidden'); hdrLog.setAttribute('aria-expanded','false'); }
  if (hdrHi) { hdrHi.classList.add('hidden'); hdrHi.setAttribute('aria-expanded','false'); }
  if (sum) { sum.classList.add('hidden'); sum.classList.add('collapsed'); }
  if (hi) { hi.classList.add('hidden'); hi.classList.add('collapsed'); }
}
function showLogHeadersCollapsed(){
  const hdrLog = document.querySelector('h3.section-toggle[data-target="#summary-log"]');
  const hdrHi = document.querySelector('h3.section-toggle[data-target="#highlights"]');
  const sum = document.querySelector('#summary-log');
  const hi = document.querySelector('#highlights');
  if (hdrLog) { hdrLog.classList.remove('hidden'); hdrLog.setAttribute('aria-expanded','false'); }
  if (hdrHi) { hdrHi.classList.remove('hidden'); hdrHi.setAttribute('aria-expanded','false'); }
  if (sum) { sum.classList.remove('hidden'); sum.classList.add('collapsed'); }
  if (hi) { hi.classList.remove('hidden'); hi.classList.add('collapsed'); }
}

function showLogHeadersExpanded(){
  const hdrLog = document.querySelector('h3.section-toggle[data-target="#summary-log"]');
  const hdrHi = document.querySelector('h3.section-toggle[data-target="#highlights"]');
  const sum = document.querySelector('#summary-log');
  const hi = document.querySelector('#highlights');
  if (hdrLog) { hdrLog.classList.remove('hidden'); hdrLog.setAttribute('aria-expanded','true'); }
  if (hdrHi) { hdrHi.classList.remove('hidden'); hdrHi.setAttribute('aria-expanded','true'); }
  if (sum) { sum.classList.remove('hidden'); sum.classList.remove('collapsed'); }
  if (hi) { hi.classList.remove('hidden'); hi.classList.remove('collapsed'); }
}

// 見出しのみ表示し、展開/折り畳み状態は変更しない
function showLogHeadersVisibleKeepState(){
  const hdrLog = document.querySelector('h3.section-toggle[data-target="#summary-log"]');
  const hdrHi = document.querySelector('h3.section-toggle[data-target="#highlights"]');
  const sum = document.querySelector('#summary-log');
  const hi = document.querySelector('#highlights');
  if (hdrLog) hdrLog.classList.remove('hidden');
  if (hdrHi) hdrHi.classList.remove('hidden');
  if (sum) sum.classList.remove('hidden');
  if (hi) hi.classList.remove('hidden');
}

function buildTeam(side){
  const team = state.teams[side];
  const full = team.full || $(`.team-name[data-side="${side}"]`).value.trim() || (side==='A'?'チームA':'チームB');
  const abbr = team.abbr || $(`.team-abbr[data-side="${side}"]`).value.trim() || (side==='A'?'A':'B');
  const rows = team.rows.slice(0, Math.max(9, visibleCount)).map(r=> ({...r}));
  rows.forEach(r=> ensureTraits(r));
  // Build batting order (always 9枠: 非DHは投手を含む)
  let lineup = (team.lineup && team.lineup.length) ? team.lineup.slice(0, 9) : rows.filter(r=> r.name||r.id).slice(0, 9);
  while (lineup.length < 9) lineup.push(emptyRow(lineup.length+1));
  const pitcher = team.pitcher || rows[0];
  const pitchers = (team.pitchers && team.pitchers.length) ? team.pitchers.slice() : assignPositions(rows, state.dh).pitchers;
  const bullpen = pitchers.filter(p=> !(p.id===pitcher.id && p.name===pitcher.name));
  const data = { side, full, abbr, lineup, pitcher, bullpen };
  return data;
}

// ===== Rendering =====
function posKanji(r){ const key = (r && r.pos) || ""; const p = POS_KANJI[key]; return p || ''; }
function lineupCardHtml(T){
  // 打者テーブル
  const batHeads = ['打順','守備','選手名','弾道','ミート','パワー','走力','肩力','守備力','捕球'];
  const batColClasses = ['lineup-col-order','lineup-col-pos','lineup-col-name','lineup-col-attr','lineup-col-attr','lineup-col-attr','lineup-col-attr','lineup-col-attr','lineup-col-attr','lineup-col-attr'];
  const batRows = [];
  for (let i=0;i<9;i++){
    const r = T.lineup[i] || {};
    const order = String(i+1);
    let pos = posKanji(r) || (r.pos||'');
    if (!pos) pos = '—';
    const name = r.name || `選手${i+1}`;
    const b = r.bat || {};
    const cells = [order,pos,name,b.trajectory??'',b.contact??'',b.power??'',b.run??'',b.arm??'',b.field??'',b.catch??''];
    batRows.push(`<tr>${cells.map((v,idx)=>`<td class=\"${batColClasses[idx]}${idx===2?' name':''}\">${escapeHtml(String(v))}</td>`).join('')}</tr>`);
  }
  const batThead = `<thead><tr>${batHeads.map((h,idx)=>`<th class=\"${batColClasses[idx]}${idx===2?' name':''}\">${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
  const batHtml = `<table class=\"lineup-table\">${batThead}<tbody>${batRows.join('')}</tbody></table>`;

  // 投手テーブル
  const pitHeads = ['役割','選手名','球速','コントロール','スタミナ','得意球'];
  const pitRows = [];
  function pitRow(role, p){
    const name = (p && p.name) || '投手';
    const velo = (p && p.pit && p.pit.velo!=null) ? `${p.pit.velo}km/h` : '';
    const ctrl = (p && p.pit && p.pit.control!=null) ? p.pit.control : '';
    const sta = (p && p.pit && p.pit.stamina!=null) ? p.pit.stamina : '';
    const fav = (p && p.pit && p.pit.fav!=null) ? p.pit.fav : '-';
    const cells = [role, name, velo, ctrl, sta, fav];
    pitRows.push(`<tr>${cells.map((v,idx)=>`<td${idx===1?' class=\"name\"':''}>${escapeHtml(String(v))}</td>`).join('')}</tr>`);
  }
  pitRow('先発', T.pitcher);
  for (const x of (T.bullpen||[])) pitRow('控え', x);
  const pitThead = `<thead><tr>${pitHeads.map((h,idx)=>`<th${idx===1?' class=\"name\"':''}>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
  const pitHtml = `<table class=\"lineup-table\">${pitThead}<tbody>${pitRows.join('')}</tbody></table>`;

  const avg = teamAverages(T);
  const avgHtml = `
    <div class=\"lineup-avg\"> 
      <div>平均野手：ミ${avg.hit.contact} パ${avg.hit.power} 走${avg.hit.run} 肩${avg.hit.arm} 守${avg.hit.field} 捕${avg.hit.catch}</div>
      <div>平均投手：球速${avg.pit.velo}km/h コントロール${avg.pit.control} スタミナ${avg.pit.stamina}</div>
    </div>`;

  return `<div class=\"lineup-card\"><h4>【${escapeHtml(T.full)}】</h4>${batHtml}<hr class=\"lineup-sep\">${pitHtml}${avgHtml}</div>`;
}
function renderGame(G){
  // Lineups
  const lu = [];
  const dispA = Object.assign({}, G.A, { pitcher: (G.startPitcherA || G.A.pitcher) });
  const dispB = Object.assign({}, G.B, { pitcher: (G.startPitcherB || G.B.pitcher) });
  lu.push(lineupCardHtml(dispA));
  lu.push(lineupCardHtml(dispB));
  $("#lineups").innerHTML = lu.join('');

  // Scoreboard (Markdown, half-width)
  const cols = Math.max(9, G.expandInnings||9);
  const sbHtml = makeScoreboardTable(cols, G.linesA, G.linesB, G.A.abbr||'', G.B.abbr||'', G.scoreA, G.scoreB, G.hitsA, G.hitsB);
  const headHtml = buildScoreboardHeader(G);
  const resHtml = buildResultSummary(G);
  $("#scoreboard").innerHTML = headHtml + sbHtml + resHtml;
  // ヘッダー右のコピー（below-scoreの内容をコピー）
  const hdrCopy = $("#scoreboard .sbh-copy");
  if (hdrCopy){
    hdrCopy.addEventListener('click', (e)=>{
      const bs = $("#scoreboard .below-score");
      const t = bs ? bs.textContent : '';
      copyText(t).then(()=> showToast('コピーしました'));
    });
  }
  // ヘッダー右の印刷（C1: 新規タブ、L2: 横向き、狭余白）
  const hdrPrint = $("#scoreboard .sbh-print");
  if (hdrPrint){ hdrPrint.addEventListener('click', (e)=> printGameViewC1L2(e)); }
  const recC = $("#records");
  if (recC) recC.innerHTML = recordsBlock(G);

  // Summary log（セル表記）
  renderSummaryLog(G);

  // Stats (simple)
  renderStats(G);

  // Highlights（得点が動いた打席のみ）
  renderHighlightsCells(G);

  // Debug preview（廃止）

  // Result summary (new format)
  const res = [];
  const line = `${G.A.abbr}  ${G.scoreA}-${G.scoreB}  ${G.B.abbr}`;
  res.push(line);
  const W = (G.decisions && G.decisions.W && G.decisions.W.name) || '-';
  const L = (G.decisions && G.decisions.L && G.decisions.L.name) || '-';
  const S = (G.decisions && G.decisions.S && G.decisions.S.name) || '-';
  res.push(`【勝】${W}`);
  res.push(`【敗】${L}`);
  res.push(`【Ｓ】${S || '-'}`);
  const hrs = ((G.records && G.records.HR) || []);
  if (hrs.length){
    const m = new Map();
    for (const h of hrs){
      const t = (h.team || '').slice(0,4);
      const name = h.name || '選手';
      const key = `${name}|${t}`;
      if (!m.has(key)) m.set(key, { name, t, count: 0 });
      m.get(key).count++;
    }
    const entries = [];
    for (const v of m.values()){
      entries.push(v.count > 1 ? `${v.name}(${v.t})${v.count}本` : `${v.name}(${v.t})`);
    }
    res.push(`【本塁打】 ${entries.join('・')}`);
  } else {
    res.push(`【本塁打】`);
  }
  // 結果まとめはスコアボード直下へ移設済み
  $("#result").innerHTML = '';
}

// ===== 印刷（C1: 新規タブ｜L2: 横向き｜狭余白） =====
function printGameViewC1L2(ev){
  const root = document.querySelector('#game');
  if (!root) { showToastNearCursor('印刷対象が見つかりません', ev); return; }
  // 対象をクローン、ログ/ハイライトを除外、折り畳み解除
  const clone = root.cloneNode(true);
  clone.querySelector('#col-logs')?.remove();
  clone.querySelector('#summary-log')?.remove();
  clone.querySelector('#highlights')?.remove();
  clone.querySelectorAll('.collapsible').forEach(n=> n.classList.remove('collapsed'));
  // 新規タブを開くだけ（印刷ダイアログは起動しない）
  const w = window.open('', '_blank');
  if (!w) { showToastNearCursor('ポップアップがブロックされました', ev); return; }
  const title = document.title || '試合結果';
  const html = `<!DOCTYPE html>
  <html lang="ja"><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}（ビュー）</title>
    <link rel="stylesheet" href="styles.css">
    <style>
      /* ビュー用上書き: 白背景・黒文字、横向き想定の狭余白（印刷時に適用） */
      :root{ --bg:#ffffff; --text:#000000; --panel:#ffffff; --surface:#ffffff; --surface-2:#ffffff; --surface-hover:#eee; --border-color:#c9c9c9; }
      body{ background:#fff; color:#000; }
      .toolbar, #rosters, .article-copy { display: none !important; }
      /* 新規タブでは各種アイコンを非表示 */
      .dli-copy, .dli-external-link { display: none !important; }
      @page { size: A4 landscape; margin: 8mm; }
      .container { padding: 0; }
      /* パネルの枠線を非表示 */
      .panel { border: none !important; }
      table { page-break-inside: avoid; break-inside: avoid; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; break-inside: avoid; }
      /* 新規タブでは「成績」見出しを非表示 */
      #col-stats > h3.section-toggle { display: none !important; }
    </style>
  </head>
  <body>
    <div class="container">
      ${clone.outerHTML}
    </div>
  </body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// （印刷機能は撤去）

function renderStats(G){
  // 左: 打撃成績、右: 投手成績 + 記録（記録自体は別処理で描画）
  const bat = [];
  bat.push(`<h3>打撃成績</h3>`);
  bat.push(teamBatTable('A', G));
  bat.push(teamBatTable('B', G));
  const pit = [];
  pit.push(`<h3>投手成績</h3>`);
  pit.push(teamPitTable('A', G));
  pit.push(teamPitTable('B', G));
  const batC = document.querySelector('#stats-bat');
  const pitC = document.querySelector('#stats-pit');
  if (batC) batC.innerHTML = bat.join('');
  if (pitC) pitC.innerHTML = pit.join('');
}

function teamBatTable(teamKey, G){
  const T = (teamKey==='A') ? G.A : G.B;
  const stats = (G.stats && G.stats[teamKey] && G.stats[teamKey].bat) || new Map();
  // 9回を基本に、延長があれば拡張
  const cols = Math.max(9, G.expandInnings || 9);
  const head = ['守','選手','打','安','点','打率'];
  for (let i=1; i<=cols; i++) head.push(`${i}回`);
  const colClasses = ['col-pos','name','col-num','col-num','col-num','col-avg'].concat(Array.from({length:cols}, ()=> 'col-in'));
  const rows = Array.from(stats.values()).map(s=>{
    let pos = posKanji(s.ref) || ((s.ref && s.ref.pos) || '');
    if (!pos) pos = '—';
    const name = (s.ref && s.ref.name) || '選手';
    const ab = s.AB||0; const h = s.H||0; const rbi = s.RBI||0;
    let avg = '-';
    if (ab>0){
      const v = (h/ab);
      let ss = v.toFixed(3);
      if (ss !== '1.000' && ss.startsWith('0')) ss = ss.slice(1);
      avg = ss;
    }
    const marks = [];
    for (let inn=1; inn<=cols; inn++){
      const arr = (s.byInn && s.byInn[inn]) || [];
      marks.push(arr.join('・'));
    }
    const cells = [pos, name, ab, h, rbi, avg, ...marks];
    return `<tr>${cells.map((v,i)=>`<td class="${colClasses[i]||''}">${escapeHtml(String(v))}</td>`).join('')}</tr>`;
  }).join('');
  const thead = `<thead><tr>${head.map((h,i)=>`<th class="${colClasses[i]||''}">${h}</th>`).join('')}</tr></thead>`;
  const teamNameBat = (T.full && T.full.trim()) || (T.abbr && T.abbr.trim()) || (teamKey==='A'?'チームA':'チームB');
  return `<div><strong>${escapeHtml(teamNameBat)}</strong></div><table class="stats-table">${thead}<tbody>${rows}</tbody></table>`;
}

function teamPitTable(teamKey, G){
  const T = (teamKey==='A') ? G.A : G.B;
  const stats = (G.stats && G.stats[teamKey] && G.stats[teamKey].pit) || new Map();
  const head = ['選手','回数','失点','防御率','被安打','与四球','与死球','被本塁','奪三振'];
  const rows = Array.from(stats.values()).map(p=>{
    const name = (p.ref && p.ref.name) || '投手';
    const outs = p.outs||0; const inn = (outs/3);
    const innTxt = (Math.floor(inn)) + '.' + (outs%3);
    const R = p.R||0; const HA=p.HA||0; const BB=p.BB||0; const HBP=p.HBP||0; const HR=p.HR||0; const K=p.K||0;
    const era = outs>0 ? ((R*9)/(outs/3)).toFixed(2) : '-';
    const cells = [name, innTxt, R, era, HA, BB, HBP, HR, K];
    return `<tr>${cells.map((v,i)=>`<td class=\"${i===0? 'name':'col-pitch'}\">${escapeHtml(String(v))}</td>`).join('')}</tr>`;
  }).join('');
  const thead = `<thead><tr>${head.map((h,i)=>`<th class=\"${i===0? 'name':'col-pitch'}\">${h}</th>`).join('')}</tr></thead>`;
  const teamNamePit = (T.full && T.full.trim()) || (T.abbr && T.abbr.trim()) || (teamKey==='A'?'チームA':'チームB');
  return `<div><strong>${escapeHtml(teamNamePit)}</strong></div><table class="stats-table">${thead}<tbody>${rows}</tbody></table>`;
}

function recordsBlock(G){
  const W = (G.decisions && G.decisions.W && G.decisions.W.name) || '';
  const L = (G.decisions && G.decisions.L && G.decisions.L.name) || '';
  // まとめ対象は要望に合わせて6項目（セーブは除外）
  const hrs = ((G.records && G.records.HR)||[]);
  const hrList = hrs.map(h=>{
    const teamAbbr = h.team || '';
    const name = h.name || '選手';
    const half = h.half || '';
    return `${escapeHtml(name)}［${escapeHtml(teamAbbr)}］（${h.inning}回${half}）`;
  }).join('・');
  const sbList = (((G.records && G.records.SB)||[])).map(x=> `${escapeHtml(x.name||'選手')}［${escapeHtml(x.team)}］（${x.inning}回${x.half}）`).join('・');
  const csList = (((G.records && G.records.CS)||[])).map(x=> `${escapeHtml(x.name||'選手')}［${escapeHtml(x.team)}］（${x.inning}回${x.half}）`).join('・');
  const eList = (((G.records && G.records.E)||[])).map(x=> `${escapeHtml(x.name||'不明')}［${escapeHtml(x.team)}］（${x.inning}回${x.half}）`).join('・');

  // 2列テーブルで見やすく
  const rows = [
    ['勝利投手', W],
    ['敗戦投手', L],
    ['本塁打', hrList],
    ['盗塁', sbList],
    ['盗塁死', csList],
    ['失策', eList],
  ];
  const tr = rows.map(([k,v])=>`<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v||'')}</td></tr>`).join('');
  // 見出し「記録」を先頭に追加
  return `<h3>記録</h3><table class="stats-table records-table"><tbody>${tr}</tbody></table>`;
}

function buildScoreboardHeader(G){
  const d = new Date();
  const w = ['日','月','火','水','木','金','土'][d.getDay()];
  const mm = d.getMonth()+1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  const dateLine = `${mm}/${dd}(${w}) ${hh}:${mi}`;
  const nameA = (G.A && (G.A.full || G.A.abbr)) || 'チームA';
  const nameB = (G.B && (G.B.full || G.B.abbr)) || 'チームB';
  const scoreLine = `${nameA}  ${G.scoreA}-${G.scoreB}  ${nameB}`;
  const status = '試合終了';
  return `<div class=\"scoreboard-header\"><div class=\"sbh-date\">${escapeHtml(dateLine)}</div><div class=\"sbh-teams\">${escapeHtml(scoreLine)}</div><div class=\"sbh-status\">${escapeHtml(status)} <span class=\"dli-copy sbh-copy\" title=\"コピー\"><span></span></span> <span class=\"dli-external-link sbh-print\" title=\"印刷\"><span></span></span></div></div>`;
}

function buildResultSummary(G){
  // Result summary
  const W = (G.decisions && G.decisions.W && G.decisions.W.name) || '-';
  const L = (G.decisions && G.decisions.L && G.decisions.L.name) || '-';
  const S = (G.decisions && G.decisions.S && G.decisions.S.name) || '-';
  const res = [];
  const line = `${G.A.abbr}  ${G.scoreA}-${G.scoreB}  ${G.B.abbr}`;
  res.push(line);
  res.push(`【勝】${W}`);
  res.push(`【敗】${L}`);
  res.push(`【Ｓ】${S || '-'}`);
  const hrs = ((G.records && G.records.HR) || []);
  if (hrs.length){
    const m = new Map();
    for (const h of hrs){
      const t = (h.team || '').slice(0,4);
      const name = h.name || '選手';
      const key = `${name}|${t}`;
      if (!m.has(key)) m.set(key, { name, t, count: 0 });
      m.get(key).count++;
    }
    const entries = [];
    for (const v of m.values()){
      entries.push(v.count > 1 ? `${v.name}(${v.t})${v.count}本` : `${v.name}(${v.t})`);
    }
    res.push(`【本塁打】 ${entries.join('・')}`);
  } else {
    res.push(`【本塁打】`);
  }
  return `<div class="below-score"><pre>${escapeHtml(res.join('\n'))}</pre></div>`;
}

function teamAverages(T){
  const gVal = ch => ({A:6,B:5,C:4,D:3,E:2,F:1,G:0}[ch] ?? 0);
  const gChar = v => v>=5.5?'A':v>=4.5?'B':v>=3.5?'C':v>=2.5?'D':v>=1.5?'E':v>=0.5?'F':'G';
  // Hitters: lineup 9人
  const hs = T.lineup || [];
  const nH = Math.max(1, hs.length);
  const sum = { contact:0,power:0,run:0,arm:0,field:0,catch:0 };
  for (const r of hs){ const b=r.bat||{}; sum.contact+=gVal(b.contact||'G'); sum.power+=gVal(b.power||'G'); sum.run+=gVal(b.run||'G'); sum.arm+=gVal(b.arm||'G'); sum.field+=gVal(b.field||'G'); sum.catch+=gVal(b.catch||'G'); }
  const hit = { contact:gChar(sum.contact/nH), power:gChar(sum.power/nH), run:gChar(sum.run/nH), arm:gChar(sum.arm/nH), field:gChar(sum.field/nH), catch:gChar(sum.catch/nH) };
  // Pitchers: starter + bullpen
  const ps = [T.pitcher, ...(T.bullpen||[])].filter(Boolean);
  const nP = Math.max(1, ps.length);
  let velo=0, control=0, stamina=0;
  for (const p of ps){ const pit=(p&&p.pit)||{}; velo += (pit.velo||0); control += gVal(pit.control||'G'); stamina += gVal(pit.stamina||'G'); }
  const pit = { velo: Math.round(velo/nP), control: gChar(control/nP), stamina: gChar(stamina/nP) };
  return { hit, pit };
}

// 試合ログ（テーブル表示）
function renderSummaryLog(G){
  const rows = G.logRows || [];
  let playId = 0;
  const thead = `<thead><tr><th>状況</th><th>順</th><th>打者</th><th>結果</th><th>スコア</th></tr></thead>`;
  const baseLabel = n => n===2? '二塁' : (n===3? '三塁' : (n===4? '本塁' : ''));
  function outsKanji(n){ return n===0? '無死' : (n===1? '一死' : '二死'); }
  function situText(o, bases){
    const outs = outsKanji(Number(o||0));
    const btxt = bases || '';
    return `${outs}${btxt}`;
  }
  const tr = [];
  for (const r of rows){
    if (r.type === 'header'){
      const txt = `${r.inning}回${r.half}：${r.teamAbbr}の攻撃`;
      tr.push(`<tr class="header"><td colspan="5">${escapeHtml(txt)}</td></tr>`);
    } else if (r.type === 'runner'){
      const id = String(++playId);
      // 打席外イベント：状況（プレー前のアウト＋走者）
      const O = (r.outsBefore!=null) ? r.outsBefore : (r.o!=null ? r.o : 0);
      const basesTxt = r.basesTxtBefore || r.basesTxt || '';
      const situ = situText(O, basesTxt);
      const badges = [ '<span class="badge ext">打席外</span>' ];
      let rt = r.resultTxt || '';
      if ((r.resultType==='SB' || r.resultType==='CS') && r.sbTargetBase){ rt += `（${baseLabel(Number(r.sbTargetBase))}）`; }
      const runnerName = r.runnerName || '走者';
      const resHtml = `<span class="result-chip rt-${escapeHtml(r.resultType||'')}">${escapeHtml(rt)}</span> ${badges.join(' ')}`;
      const scoreHtml = r.scored ? `<strong>${escapeHtml(r.scoreTxt)}</strong>` : escapeHtml(r.scoreTxt||'');
      // 順は空、打者列は走者主体で表示
      tr.push(`<tr class="play runner" data-id="${id}"><td>${escapeHtml(situ)}</td><td>—</td><td>${escapeHtml(runnerName)}（走者）</td><td>${resHtml}</td><td class="${r.scored?'scored':''}">${scoreHtml}</td></tr>`);
      const det = [];
      if (typeof r.outsMade === 'number') det.push(`outsMade: ${String(r.outsMade)}`);
      tr.push(`<tr class="details" data-id="${id}"><td colspan="5">${escapeHtml(det.join(' ｜ '))}</td></tr>`);
    } else if (r.type === 'play'){
      const id = String(++playId);
      // 状況は「プレー前のアウト＋走者」を表示に統一
      const O = (r.outsBefore!=null) ? r.outsBefore : (r.o!=null ? r.o : 0);
      const basesTxt = r.basesTxtBefore || r.basesTxt || '';
      const situ = situText(O, basesTxt);
      const badges = [];
      if (r.walkoff) badges.push('<span class="badge wk">サヨナラ</span>');
      if (r.goAhead) badges.push('<span class="badge ga">勝ち越し</span>');
      if (r.tie) badges.push('<span class="badge tie">同点</span>');
      let rt = r.resultTxt || '';
      if ((r.resultType==='SB' || r.resultType==='CS') && r.sbTargetBase){ rt += `（${baseLabel(Number(r.sbTargetBase))}）`; }
      if (r.resultType==='E'){
        const fname = (r.errorFielderName || '').trim();
        rt = fname ? `失策（${escapeHtml(fname)}）` : (r.resultTxt || '失策');
      }
      const resHtml = `<span class="result-chip rt-${escapeHtml(r.resultType||'')}">${escapeHtml(rt)}</span> ${badges.join(' ')}`;
      const scoreHtml = r.scored ? `<strong>${escapeHtml(r.scoreTxt)}</strong>` : escapeHtml(r.scoreTxt);
      tr.push(`<tr class="play" data-id="${id}"><td>${escapeHtml(situ)}</td><td>${escapeHtml(String(r.order)+'番')}</td><td>${escapeHtml(r.name||'選手')}</td><td>${resHtml}</td><td class="${r.scored?'scored':''}">${scoreHtml}</td></tr>`);
      const det = [];
      det.push(`outsMade: ${String(r.outsMade ?? (typeof r.outsAfter==='number'? (r.outsAfter - (r.o??0)) : 0))}`);
      if (r.goAhead || r.tie || r.walkoff){ det.push(`flags: ${r.goAhead?'GO_AHEAD ':''}${r.tie?'TIE ':''}${r.walkoff?'WALKOFF':''}`.trim()); }
      tr.push(`<tr class="details" data-id="${id}"><td colspan="5">${escapeHtml(det.join(' ｜ '))}</td></tr>`);
    } else if (r.type === 'change'){
      const team = r.teamAbbr ? `[${r.teamAbbr}] ` : '';
      const line = `${team}投手交代：${r.fromName||''} → ${r.toName||''}`.trim();
      const badges = [];
      if (r.reason === 'runs_in_inning') badges.push('<span class="badge chg ris">この回大量失点</span>');
      if (r.reason === 'consecutive_hits') badges.push('<span class="badge chg hits">連打で交代</span>');
      if (r.reason === 'between_innings_auto') badges.push('<span class="badge chg auto">回頭の継投</span>');
      const headerHtml = `${escapeHtml(line)} ${badges.join(' ')}`;
      tr.push(`<tr class="header change-row"><td colspan="5">${headerHtml}</td></tr>`);
      function fmtOuts(outs){ if (!Number.isFinite(outs)) return ''; const ip = Math.floor(outs/3); const rem = outs%3; return `${ip}.${rem}`; }
      const sub = [];
      if (r.reasonNote) sub.push(r.reasonNote);
      if (r.fromStats){
        const fs = r.fromStats;
        const ip = fmtOuts(Number(fs.outs||0));
        sub.push(`降板: ${ip}回 ${fs.HA||0}安打 ${fs.BB||0}四球 ${fs.K||0}三振 ${fs.R||0}失点`);
      }
      if (r.pitOrder) sub.push(`登板順: ${r.pitOrder}番手`);
      if (sub.length) tr.push(`<tr class="sub"><td colspan="5"><span class="sub">${escapeHtml(sub.join(' ｜ '))}</span></td></tr>`);
    } else if (r.type === 'end'){
      const txt = `${r.inning}回${r.half}終了：${r.Aabbr} ${r.scoreA}-${r.scoreB} ${r.Babbr}`;
      tr.push(`<tr class="end"><td colspan="5">${escapeHtml(txt)}</td></tr>`);
    }
  }
  const html = `<table class="summary-table">${thead}<tbody>${tr.join('')}</tbody></table>`;
  const wrap = $("#summary-log");
  wrap.innerHTML = html;
  wrap.querySelector('tbody')?.addEventListener('click', (e)=>{
    const row = e.target.closest('tr.play');
    if (!row) return;
    const id = row.getAttribute('data-id');
    const det = wrap.querySelector(`tr.details[data-id="${CSS.escape(id)}"]`);
    if (det) det.classList.toggle('open');
  }, false);
}

// ハイライト（セル表示：BSO/走者/順/打者/結果/スコア）
function renderHighlightsCells(G){
  const rows = (G.logRows || []);
  // 得点プレー + SB/CS + E を対象
  // const plays = rows.filter(r => r && r.type==='play' && (r.scored || r.resultType==='SB' || r.resultType==='CS' || r.resultType==='E'));
  const plays = rows.filter(r => r && r.type==='play' && r.scored);

  // 走者表記の短縮（状況列では最終的に「塁」を付与）
  const shortBases = (txt) => {
    if (!txt) return '';
    if (txt === '走者なし' || txt === '満塁') return txt;
    return txt.replace(/塁/g,'');
  };
  // アウト表記（無死/1死/2死）
  const outsShort = (o) => (o===0? '無死' : (o===1? '一死' : '二死'));
  // 走者文言（プレーテキスト用）
  const runnerPhrase = (txt) => {
    if (!txt || txt === '走者なし') return '走者なし';
    if (txt === '満塁') return '走者満塁';
    const s = shortBases(txt);
    return `走者${s}塁`;
  };
  // 盗塁種別
  const stealKind = (base) => (base===2? '二盗' : (base===3? '三盗' : '本盗'));
  // 結果→文言
  function playVerb(r){
    const t = r.resultType;
    const runs = r.runs || 0;
    if (t === 'SB') return `${stealKind(Number(r.sbTargetBase||2))}成功`;
    if (t === 'CS') return `${stealKind(Number(r.sbTargetBase||2))}失敗（盗塁死）`;
    if (t === 'HR'){
      if (runs === 1) return 'ソロ本塁打を放つ';
      if (runs === 4) return '満塁本塁打を放つ';
      return `${runs}ラン本塁打を放つ`;
    }
    if (t === '3B') return '三塁打を放つ';
    if (t === '2B') return '二塁打を放つ';
    if (t === '1B') return runs>0 ? 'タイムリーを放つ' : 'ヒットを放つ';
    if (t === 'SF') return '犠牲フライを放つ';
    if (t === 'GDP') return '併殺打';
    if (t === 'BB') return runs>0 ? '押し出し四球を選ぶ' : '四球を選ぶ';
    if (t === 'HBP') return runs>0 ? '押し出し死球を受ける' : '死球を受ける';
    if (t === 'E'){
      const fname = (r.errorFielderName || '').trim();
      const label = fname ? `失策（${fname}）` : '失策';
      return runs>0 ? label : `${label}で出塁`;
    }
    if (t === 'ADV') return '進塁打';
    // フォールバック
    return (window.Utils && window.Utils.resultText) ? (window.Utils.resultText(t) + '') : String(t);
  }

  // 半回ごとの合計点と最初の得点打（タグ用）
  const keyOf = (r)=> `${r.inning}-${r.half}`;
  const sumByHalf = new Map();
  const firstIndexByHalf = new Map();
  plays.forEach((r, idx)=>{
    const k = keyOf(r);
    sumByHalf.set(k, (sumByHalf.get(k)||0) + (r.runs||0));
    if (!firstIndexByHalf.has(k) && (r.runs||0)>0) firstIndexByHalf.set(k, idx);
  });

  // テーブル構築
  const head = `<thead><tr><th>回</th><th>状況</th><th>番</th><th>打者</th><th>プレー</th><th>スコア</th><th>タグ</th></tr></thead>`;
  const rowsHtml = [];

  plays.forEach((r, idx)=>{
    const innTxt = `${r.inning}回${r.half}`;
    const situBases = r.basesTxtBefore || r.basesTxt || '';
    const sb = shortBases(situBases);
    const sbWithSuffix = (!sb || sb==='走者なし' || sb==='満塁') ? sb : (sb + '塁');
    const situ = `${outsShort(Number(r.o||0))}${sbWithSuffix}`;
    const ordTxt = `${r.order}番`;
    const batterTxt = `${(r.name||'選手')}［${r.atkAbbr||''}］`;
    // const countTxt = `${Number(r.b||0)}-${Number(r.s||0)}`;
    const playTxt = `${runnerPhrase(situBases)}から${playVerb(r)}${(r.runs||0)>0? ` ${r.runs}点獲得` : ''}`;
    const scoreTxt = r.scoreTxt || '';

    // タグ
    const tags = [];
    if (r.walkoff) tags.push('サヨナラ');
    if (r.goAhead) tags.push('勝ち越し');
    if (r.tie) tags.push('同点');
    const hk = keyOf(r);
    const sumRuns = sumByHalf.get(hk) || 0;
    if (sumRuns >= 3){
      tags.push(`ビッグイニング${sumRuns}`);
      if (firstIndexByHalf.get(hk) === idx) tags.push('反撃開始');
    }
    const postA = (r.scoreA!=null) ? r.scoreA : 0;
    const postB = (r.scoreB!=null) ? r.scoreB : 0;
    const runs = r.runs||0;
    const top = !!r.top;
    const preA = top ? (postA - runs) : postA;
    const preB = top ? postB : (postB - runs);
    const beforeLead = (top ? (preA - preB) : (preB - preA));
    const afterLead  = (top ? (postA - postB) : (postB - postA));
    if ((r.inning>=8) && (afterLead >= 2) && ((afterLead - beforeLead) >= 2)){
      tags.push('ダメ押し');
    }
    const tagStr = tags.length ? `[${tags.join('] [')}]` : '';
    rowsHtml.push(`<tr><td>${escapeHtml(innTxt)}</td><td>${escapeHtml(situ)}</td><td>${escapeHtml(ordTxt)}</td><td>${escapeHtml(batterTxt)}</td><td>${escapeHtml(playTxt)}</td><td>${escapeHtml(scoreTxt)}</td><td>${escapeHtml(tagStr)}</td></tr>`);
  });
  const html = `<table class="highlights-table">${head}<tbody>${rowsHtml.join('')}</tbody></table>`;
  $("#highlights").innerHTML = html;
}

// 記事用プロンプト生成
function buildArticlePrompt(G, opts={}){
  const tone = opts.tone || '記者調・辛口・皮肉多め';
  const maxChars = opts.maxChars || 300; // 目安
  // HR要約（「選手名（略称）2本」形式）
  let hrSummary = '本塁打なし';
  try{
    const hrs = Array.isArray(G.records?.HR) ? G.records.HR : [];
    if (hrs.length){
      const m = new Map();
      for (const h of hrs){
        const t = (h.team || '').slice(0,4);
        const name = h.name || '選手';
        const key = `${name}|${t}`;
        if (!m.has(key)) m.set(key, { name, t, count: 0 });
        m.get(key).count++;
      }
      const entries = [];
      for (const v of m.values()){
        entries.push(v.count > 1 ? `${v.name}（${v.t}）${v.count}本` : `${v.name}（${v.t}）`);
      }
      hrSummary = entries.join('・') || '本塁打なし';
    }
  } catch(_){ /* noop */ }

  // 得点プレーのみの簡易ハイライト
  const plays = (G.logRows||[]).filter(r=> r && r.type==='play' && r.scored);
  const hl = plays.map(r=>({
    inning: r.inning,
    half: r.half,
    team: r.teamAbbr || r.atkAbbr || '',
    order: r.order,
    batter: r.name || '選手',
    result: r.resultType,
    runs: r.runs||0,
    score: r.scoreTxt||''
  }));

  const data = {
    teams: { A:{ full:G.A?.full||'', abbr:G.A?.abbr||'' }, B:{ full:G.B?.full||'', abbr:G.B?.abbr||'' } },
    score: { A:G.scoreA, B:G.scoreB },
    lines: { A:G.linesA, B:G.linesB },
    hits: { A:G.hitsA||0, B:G.hitsB||0 },
    decisions: {
      W: G.decisions?.W?.name || '-',
      L: G.decisions?.L?.name || '-',
      S: G.decisions?.S?.name || ''
    },
    hrSummary,
    highlights: hl,
    notes: { extraInnings: (Math.max(G.linesA.length, G.linesB.length) > 9) }
  };

  const prompt = [
    '【指示】あなたは全国紙スポーツ部の記者。以下のデータのみを根拠に記事を作成。',
    `【トーン】${tone}`,
    '【出力形式】プレーンテキストのみ。',
    '【構成】見出し（1行）／本文（1段落）。',
    '【表記】見出しはチーム略称、本文は正式名を用いる。数字は半角。',
    '【ハイライト】得点プレーのみを取り上げる。',
    '【本塁打表記】「選手名（略称）2本」形式。',
    `【データ】${JSON.stringify(data)}`
  ].join('\n');
  // 目安コメント（直接生成に影響はないが読み手に明示）
  return prompt + `\n【備考】目安:${maxChars}文字程度。余計な前置きは不要。`;
}

function copyArticleText(ev){
  const G = state.currentGame; if (!G) { showToast('試合データがありません'); return; }
  const prompt = buildArticlePrompt(G, { tone:'記者調・皮肉多め', maxChars:600 });
  copyText(prompt).then(()=>{ showToast('記事用プロンプトをコピーしました'); });
}

// ===== CSV（デバッグ完全版） =====
function buildDebugCsv(G){
  const plays = (G.logRows || []).filter(r => r && (r.type === 'play' || r.type === 'runner'));
  const header = [
    // コンテキスト
    'type','inning','half','top','side',
    // チーム情報
    'atkFull','atkAbbr','defFull','defAbbr',
    // 対戦当事者
    'pitcherId','pitcherName','order','batterId','name','pos',
    // 打席前状況
    'b','s','o','b1','b2','b3','basesTxtBefore','bsoSource',
    // 結果
    'resultType','resultTxt','runs','rbi',
    // 打席後状況
    'outsAfter','b1After','b2After','b3After','basesTxtAfter',
    // スコア
    'scoreA','scoreB','scored','scoreTxt',
    // 追加情報（末尾。後方互換のため）
    'outsBefore','outsMade','goAhead','tie','walkoff','errorFielderPos','errorFielderName','sbTargetBase','paId','inningPaIndex',
    // 走者イベント用（runner）
    'runnerName','runnerFromBase','runnerToBase'
  ];
  function q(v){
    if (v === null || v === undefined) v = '';
    if (typeof v === 'boolean') v = v ? '1' : '0';
    if (typeof v === 'number') v = String(v);
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }
  function b01(v){ return v ? 1 : 0; }
  const rows = plays.map(r => [
    r.type || 'play',
    (r.inning ?? ''),
    r.half || '',
    b01(!!r.top),
    r.side || '',
    r.atkFull || '', r.atkAbbr || '', r.defFull || '', r.defAbbr || '',
    r.pitcherId || '', r.pitcherName || '', r.order ?? '', r.batterId || '', r.name || '', r.pos || '',
    (r.b ?? ''), (r.s ?? ''), (r.o ?? ''), b01(!!r.b1), b01(!!r.b2), b01(!!r.b3), r.basesTxtBefore || '', r.bsoSource || 'pre',
    r.resultType || '', r.resultTxt || '', (r.runs ?? 0), (r.rbi ?? 0),
    (r.outsAfter ?? ''), b01(!!r.b1After), b01(!!r.b2After), b01(!!r.b3After), r.basesTxtAfter || '',
    (r.scoreA ?? ''), (r.scoreB ?? ''), b01(!!r.scored), r.scoreTxt || '',
    (r.outsBefore ?? ''), (r.outsMade ?? ''), b01(!!r.goAhead), b01(!!r.tie), b01(!!r.walkoff), r.errorFielderPos || '', r.errorFielderName || '', (r.sbTargetBase ?? ''), (r.paId ?? ''), (r.inningPaIndex ?? ''),
    (r.runnerName || ''), (r.runnerFromBase ?? ''), (r.runnerToBase ?? '')
  ].map(q).join(','));
  return [header.map(q).join(','), ...rows].join('\n');
}

function copyDebugCsv(){
  const G = state.currentGame; if (!G) { showToast('試合データがありません'); return; }
  const csv = buildDebugCsv(G);
  copyText(csv).then(()=> showToast('CSVをコピーしました'));
}

function downloadDebugCsv(){
  const G = state.currentGame; if (!G) { showToast('試合データがありません'); return; }
  const csv = buildDebugCsv(G);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fname = `game_log_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSVをダウンロードしました');
}

// ===== 視認用ログCSV（画面表示に準拠） =====
function buildReadableLogCsv(G){
  const rows = G.logRows || [];
  const header = ['種別','回','半','チーム','OUT','走者','順','打者','結果','スコア','タグ','補足'];
  function q(v){
    if (v === null || v === undefined) v = '';
    if (typeof v === 'boolean') v = v ? '1' : '0';
    if (typeof v === 'number') v = String(v);
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }
  const baseLabel = n => n===2? '二塁' : (n===3? '三塁' : (n===4? '本塁' : ''));
  const fmtOuts = (outs) => { if (!Number.isFinite(outs)) return ''; const ip = Math.floor(outs/3); const rem = outs%3; return `${ip}.${rem}`; };

  const csvRows = [];
  for (const r of rows){
    if (!r) continue;
    if (r.type === 'header'){
      const txt = `${r.inning}回${r.half}：${r.teamAbbr}の攻撃`;
      csvRows.push(['HEADER', r.inning, r.half, r.teamAbbr||'', '', '', '', '', txt, '', '', '']);
    } else if (r.type === 'play'){
      // BSOはプレー前で固定（outsBeforeを優先）
      const O = (r.outsBefore!=null) ? r.outsBefore : ((r.o!=null) ? r.o : 0);
      const OUT = `O${O}`;
      // 走者もプレー前に固定
      const basesTxt = r.basesTxtBefore || r.basesTxt || r.basesTxtAfter || '';
      const orderTxt = (r.order!=null) ? `${r.order}番` : '';
      let rt = r.resultTxt || '';
      if ((r.resultType==='SB' || r.resultType==='CS') && r.sbTargetBase){ rt += `（${baseLabel(Number(r.sbTargetBase))}）`; }
      if (r.resultType==='E'){
        const fname = (r.errorFielderName || '').trim();
        rt = fname ? `失策（${fname}）` : (r.resultTxt || '失策');
      }
      const tags = [];
      if (r.walkoff) tags.push('サヨナラ');
      if (r.goAhead) tags.push('勝ち越し');
      if (r.tie) tags.push('同点');
      const tagStr = tags.join(' ');
      const misc = [];
      if (typeof r.outsMade === 'number') misc.push(`アウト増加:${r.outsMade}`);
      csvRows.push(['PLAY', r.inning||'', r.half||'', r.teamAbbr||r.atkAbbr||'', OUT, basesTxt, orderTxt, (r.name||'選手'), rt, (r.scoreTxt||''), tagStr, misc.join(' ｜ ')]);
    } else if (r.type === 'runner'){
      // 走者イベント（打席外）
      const O = (r.outsBefore!=null) ? r.outsBefore : ((r.o!=null) ? r.o : 0);
      const OUT = `O${O}`;
      const basesTxt = r.basesTxtBefore || r.basesTxt || r.basesTxtAfter || '';
      const orderTxt = '';
      let rt = r.resultTxt || '';
      if ((r.resultType==='SB' || r.resultType==='CS') && r.sbTargetBase){ rt += `（${baseLabel(Number(r.sbTargetBase))}）`; }
      const tags = ['打席外'];
      const runnerName = r.runnerName || '走者';
      const misc = [];
      if (typeof r.outsMade === 'number') misc.push(`アウト増加:${r.outsMade}`);
      csvRows.push(['RUNNER', r.inning||'', r.half||'', r.teamAbbr||r.atkAbbr||'', OUT, basesTxt, orderTxt, `走者:${runnerName}`, rt, (r.scoreTxt||''), tags.join(' '), misc.join(' ｜ ')]);
    } else if (r.type === 'change'){
      const badges = [];
      if (r.reason === 'runs_in_inning') badges.push('この回大量失点');
      if (r.reason === 'consecutive_hits') badges.push('連打で交代');
      if (r.reason === 'between_innings_auto') badges.push('回頭の継投');
      const line = `${r.teamAbbr ? `[${r.teamAbbr}] ` : ''}投手交代：${r.fromName||''} → ${r.toName||''}`.trim();
      const sub = [];
      if (r.reasonNote) sub.push(r.reasonNote);
      if (r.fromStats){
        const fs = r.fromStats;
        const ip = fmtOuts(Number(fs.outs||0));
        sub.push(`降板:${ip}回 ${fs.HA||0}安打 ${fs.BB||0}四球 ${fs.K||0}三振 ${fs.R||0}失点`);
      }
      if (r.pitOrder) sub.push(`登板順:${r.pitOrder}番手`);
      csvRows.push(['CHANGE', r.inning||'', r.half||'', r.teamAbbr||'', '', '', '', '', `${line} ${badges.join(' ')}`.trim(), '', '', sub.join(' ｜ ')]);
    } else if (r.type === 'end'){
      const txt = `${r.inning}回${r.half}終了：${r.Aabbr} ${r.scoreA}-${r.scoreB} ${r.Babbr}`;
      csvRows.push(['END', r.inning||'', r.half||'', '', '', '', '', '', txt, '', '', '']);
    }
  }
  return [header.map(q).join(','), ...csvRows.map(row=> row.map(q).join(','))].join('\n');
}

function downloadReadableLogCsv(){
  const G = state.currentGame; if (!G) { showToast('試合データがありません'); return; }
  const csv = buildReadableLogCsv(G);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fname = `readable_log_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('試合ログCSVをダウンロードしました');
}

// ===== 追加: ボードスコアCSV／成績表CSV分割（打撃/投手）／ZIP一括DL =====
function buildBoardScoreCsv(G){
  const cols = Math.max(9, (G.linesA||[]).length, (G.linesB||[]).length);
  const head = [''].concat(Array.from({length:cols}, (_,i)=>String(i+1))).concat(['計','H']);
  const aName = (G.A && (G.A.abbr||G.A.full)) || 'A';
  const bName = (G.B && (G.B.abbr||G.B.full)) || 'B';
  function row(name, lines, total, hits){
    const cells = [name];
    for (let i=0;i<cols;i++) cells.push((lines && lines[i] != null) ? String(lines[i]) : '');
    cells.push(String(total||0));
    cells.push(String(hits||0));
    return cells;
  }
  const rows = [head, row(aName, G.linesA, G.scoreA, G.hitsA), row(bName, G.linesB, G.scoreB, G.hitsB)];
  const q = s => {
    s = (s==null)? '' : String(s);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  };
  return rows.map(r=> r.map(q).join(',')).join('\n');
}

function buildStatsBatCsv(G){
  const rows = [];
  const q = s => { s = (s==null)? '' : String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const teamName = (key)=>{ const T = key==='A'? G.A : G.B; return (T && (T.full||T.abbr)) || (key==='A'?'チームA':'チームB'); };
  rows.push(['チーム','守','選手','打','安','点','打率','1回','2回','3回','4回','5回','6回','7回','8回','9回']);
  for (const key of ['A','B']){
    const stats = (G.stats && G.stats[key] && G.stats[key].bat) || new Map();
    for (const s of stats.values()){
      const pos = (function(){ const k = (s && s.ref && s.ref.pos) || ''; const m = {P:'投',C:'捕','1B':'一','2B':'二','3B':'三',SS:'遊',LF:'左',CF:'中',RF:'右',DH:'指'}; return m[k]||'—'; })();
      const name = (s.ref && s.ref.name) || '選手';
      const ab = s.AB||0; const h = s.H||0; const rbi = s.RBI||0;
      let avg = '-';
      if (ab>0){ let v=(h/ab); let ss=v.toFixed(3); if (ss!=='1.000' && ss.startsWith('0')) ss=ss.slice(1); avg=ss; }
      const marks = [];
      for (let inn=1; inn<=9; inn++){
        const arr = (s.byInn && s.byInn[inn]) || [];
        marks.push(arr.join('・'));
      }
      rows.push([teamName(key), pos, name, ab, h, rbi, avg, ...marks]);
    }
  }
  return rows.map(r=> r.map(q).join(',')).join('\n');
}

function buildStatsPitCsv(G){
  const rows = [];
  const q = s => { s = (s==null)? '' : String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const teamName = (key)=>{ const T = key==='A'? G.A : G.B; return (T && (T.full||T.abbr)) || (key==='A'?'チームA':'チームB'); };
  rows.push(['チーム','選手','回数','失点','防御率','被安打','与四球','与死球','被本塁','奪三振']);
  for (const key of ['A','B']){
    const stats = (G.stats && G.stats[key] && G.stats[key].pit) || new Map();
    for (const p of stats.values()){
      const name = (p.ref && p.ref.name) || '投手';
      const outs = p.outs||0; const inn = (outs/3);
      const innTxt = Number.isFinite(inn) ? (Math.floor(inn) + '.' + (outs%3)) : '';
      const R = p.R||0; const HA=p.HA||0; const BB=p.BB||0; const HBP=p.HBP||0; const HR=p.HR||0; const K=p.K||0;
      const era = (outs>0) ? ((R*9)/(outs/3)).toFixed(2) : '-';
      rows.push([teamName(key), name, innTxt, R, era, HA, BB, HBP, HR, K]);
    }
  }
  return rows.map(r=> r.map(q).join(',')).join('\n');
}

// 簡易ZIP（無圧縮）
function buildZipBlob(files){
  // files: [{name: string, data: string|Uint8Array}]
  const enc = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const cdEntries = [];

  // CRC32 テーブル
  const crcTable = (()=>{
    const table = new Uint32Array(256);
    for (let n=0; n<256; n++){
      let c = n;
      for (let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(arr){
    let c = 0xFFFFFFFF;
    for (let i=0;i<arr.length;i++) c = (c >>> 8) ^ crcTable[(c ^ arr[i]) & 0xFF];
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function dosTimeDate(d){
    const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds()/2)) & 0xFFFF;
    const date = (((d.getFullYear()-1980) << 9) | ((d.getMonth()+1) << 5) | d.getDate()) & 0xFFFF;
    return { time, date };
  }
  function writeUint16LE(v){ const b = new Uint8Array(2); const dv=new DataView(b.buffer); dv.setUint16(0, v & 0xFFFF, true); return b; }
  function writeUint32LE(v){ const b = new Uint8Array(4); const dv=new DataView(b.buffer); dv.setUint32(0, v >>> 0, true); return b; }
  function push(arr){ chunks.push(arr); offset += arr.length; }

  const now = new Date();
  const { time:dosTime, date:dosDate } = dosTimeDate(now);

  for (const f of files){
    const nameBytes = enc.encode(f.name);
    const data = (f.data instanceof Uint8Array) ? f.data : enc.encode(String(f.data));
    const crc = crc32(data);
    const compSize = data.length;
    const uncompSize = data.length;
    const localHeaderOffset = offset;
    // Local file header
    push(writeUint32LE(0x04034b50)); // signature
    push(writeUint16LE(20));         // version needed
    push(writeUint16LE(0x0800));     // general purpose (UTF-8)
    push(writeUint16LE(0));          // method: store
    push(writeUint16LE(dosTime));
    push(writeUint16LE(dosDate));
    push(writeUint32LE(crc));
    push(writeUint32LE(compSize));
    push(writeUint32LE(uncompSize));
    push(writeUint16LE(nameBytes.length));
    push(writeUint16LE(0));          // extra len
    push(nameBytes);
    push(data);
    // Central directory entry info to write later
    cdEntries.push({ nameBytes, crc, compSize, uncompSize, dosTime, dosDate, localHeaderOffset });
  }

  const cdStart = offset;
  // Central directory
  for (const e of cdEntries){
    push(writeUint32LE(0x02014b50)); // signature
    push(writeUint16LE(20));         // version made by
    push(writeUint16LE(20));         // version needed
    push(writeUint16LE(0x0800));     // general purpose (UTF-8)
    push(writeUint16LE(0));          // method
    push(writeUint16LE(e.dosTime));
    push(writeUint16LE(e.dosDate));
    push(writeUint32LE(e.crc));
    push(writeUint32LE(e.compSize));
    push(writeUint32LE(e.uncompSize));
    push(writeUint16LE(e.nameBytes.length));
    push(writeUint16LE(0));          // extra len
    push(writeUint16LE(0));          // comment len
    push(writeUint16LE(0));          // disk start
    push(writeUint16LE(0));          // int attr
    push(writeUint32LE(0));          // ext attr
    push(writeUint32LE(e.localHeaderOffset));
    push(e.nameBytes);
  }
  const cdEnd = offset;
  const cdSize = cdEnd - cdStart;
  // End of central directory
  push(writeUint32LE(0x06054b50));
  push(writeUint16LE(0)); // disk
  push(writeUint16LE(0)); // disk start
  push(writeUint16LE(cdEntries.length)); // entries on this disk
  push(writeUint16LE(cdEntries.length)); // total entries
  push(writeUint32LE(cdSize));
  push(writeUint32LE(cdStart));
  push(writeUint16LE(0)); // comment len

  // Concat chunks
  let total = 0; for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let p = 0; for (const c of chunks){ out.set(c, p); p += c.length; }
  return new Blob([out], { type: 'application/zip' });
}

function downloadMultipleCsv(){
  const G = state.currentGame; if (!G) { showToast('試合データがありません'); return; }
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const files = [
    { name: `board_score_${stamp}.csv`, data: buildBoardScoreCsv(G) },
    { name: `stats_bat_${stamp}.csv`, data: buildStatsBatCsv(G) },
    { name: `stats_pit_${stamp}.csv`, data: buildStatsPitCsv(G) },
    { name: `readable_log_${stamp}.csv`, data: buildReadableLogCsv(G) },
  ];
  const zip = buildZipBlob(files);
  const url = URL.createObjectURL(zip);
  const a = document.createElement('a');
  a.href = url; a.download = `logs_${stamp}.zip`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSVをZIPでダウンロードしました');
}

// ===== Debug preview (booleans as true/false) =====
function renderDebugPreview(G){
  const plays = (G.logRows || []).filter(r => r && (r.type === 'play' || r.type === 'runner'));
  const limit = 200; // 表示上限
  const rows = plays.slice(0, limit);
  const header = ['回','攻','守','投手','OUT','一','二','三','守位/主体','表示名','結果','スコア'];
  function tf(v){ return v ? 'true' : 'false'; }
  function rowToCells(r){
    const inningHalf = `${r.inning}${r.half}`;
    const subj = (r.type==='runner') ? '走者' : (r.pos || '');
    const dispName = (r.type==='runner') ? (r.runnerName || '走者') : (r.name || '');
    return [
      inningHalf,
      r.atkAbbr || '',
      r.defAbbr || '',
      r.pitcherName || '',
      `O${(r.outsBefore!=null) ? r.outsBefore : (r.o ?? '')}`,
      tf(!!r.b1),
      tf(!!r.b2),
      tf(!!r.b3),
      subj,
      dispName,
      r.resultTxt || '',
      r.scoreTxt || ''
    ];
  }
  const ths = header.map(h=>`<th>${escapeHtml(h)}</th>`).join('');
  const trs = rows.map(r => `<tr>${rowToCells(r).map(c=>`<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('');
  const note = plays.length>limit ? `<div class="muted">（先頭${limit}件のみ表示）</div>` : '';
  const html = `<div class="debug-table-wrap"><table class="debug-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>${note}</div>`;
  $("#debug-log").innerHTML = html;
}

// Preview-only lineup rendering (after auto lineup button)
function renderLineupsPreview(){
  const A = buildTeam('A');
  const B = buildTeam('B');
  $("#lineups").innerHTML = lineupCardHtml(A) + lineupCardHtml(B);
}

// ====== 永続化（localStorage） ======
const STORAGE_KEY = 'textbb-state-v1';
function saveState(){
  try{
    const data = {
      visibleCount,
      dh: state.dh,
      slugfest: state.slugfest,
      seed: state.seed,
      teams: ['A','B'].reduce((acc,side)=>{
        const t = state.teams[side];
        acc[side] = {
          full: t.full,
          abbr: t.abbr,
          rows: t.rows.map(r=>({ no:r.no, name:r.name, id:r.id, hope:r.hope }))
        };
        return acc;
      }, {})
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch(e){ /* ignore */ }
}
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.visibleCount === 'number') { visibleCount = Math.max(9, Math.min(20, data.visibleCount)); const pc = $("#player-count"); if (pc) pc.value = String(visibleCount); }
    if (typeof data.dh === 'boolean') { state.dh = data.dh; const dhSel = $("#dh-select"); if (dhSel) dhSel.value = state.dh ? 'on':'off'; }
    if (typeof data.slugfest === 'number') { state.slugfest = data.slugfest; const sl = $("#slugfest-level"); if (sl) sl.value = String(state.slugfest); }
    if (typeof data.seed === 'string') { state.seed = data.seed; const si = $("#seed-input"); if (si) si.value = state.seed; }
    for (const side of ['A','B']){
      const t = (data.teams && data.teams[side]);
      if (!t) continue;
      state.teams[side].full = t.full || '';
      state.teams[side].abbr = t.abbr || '';
      const rows = Array.isArray(t.rows) ? t.rows : [];
      for (let i=0;i<Math.min(rows.length, MAX_PLAYERS); i++){
        const src = rows[i];
        const dst = state.teams[side].rows[i];
        dst.name = src.name || '';
        dst.id = src.id || '';
        dst.hope = src.hope || '【希望なし】';
        ensureTraits(dst);
      }
    }
    // 反映
    const tnA = $(`.team-name[data-side="A"]`); if (tnA) tnA.value = state.teams.A.full || '';
    const taA = $(`.team-abbr[data-side="A"]`); if (taA) taA.value = state.teams.A.abbr || '';
    const tnB = $(`.team-name[data-side="B"]`); if (tnB) tnB.value = state.teams.B.full || '';
    const taB = $(`.team-abbr[data-side="B"]`); if (taB) taB.value = state.teams.B.abbr || '';
    renderRoster('A');
    renderRoster('B');
  } catch(e){ /* ignore */ }
}
