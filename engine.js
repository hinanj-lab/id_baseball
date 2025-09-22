// 試合エンジン（結果多様性＋投手交代）
// 外部からは simulateGame(A,B,rng) を呼び出す

// ユーティリティ（Utils優先、なければフォールバック）
const __U = (typeof window!=='undefined' && window.Utils) ? window.Utils : {};
const toFwDigit = __U.toFwDigit || (x=> String(x));
const resultText = __U.resultText || (t => ({ BB:'四球', HBP:'死球', K:'三振', OUT:'凡退', GOUT:'ゴロ', FO:'フライ', SF:'犠飛', GDP:'併殺', ADV:'進塁打', E:'失策', SB:'盗塁', CS:'盗塁死', '1B':'単打', '2B':'二塁打', '3B':'三塁打', HR:'本塁打' }[t] || t));
const outsText = __U.outsText || (o => (o===0? '無死' : (o===1? '1死' : '2死')));
const basesText = __U.basesText || (bs => { const b=[]; if (bs.b1) b.push('一'); if (bs.b2) b.push('二'); if (bs.b3) b.push('三'); if (!b.length) return '走者なし'; if (b.length===3) return '満塁'; return b.join('')+'塁'; });

// 盤外: ログ用のB/Sカウントを擬似生成（試合結果には影響しない）
function countForResult(t, rng){
  const rInt = (n)=> Math.floor(rng()*n);
  if (t==='BB' || t==='HBP'){
    return { b:4, s:rInt(3) };
  } else if (t==='K'){
    return { b:rInt(4), s:3 };
  } else {
    let b = rInt(4);
    let s = rInt(3);
    if (s>2) s = 2;
    return { b, s };
  }
}

// 打席結果（簡易確率＋状況依存イベント）
function plateAppearanceEx(batter, pitcher, rng, ctx){
  const g = v=> ({A:6,B:5,C:4,D:3,E:2,F:1,G:0}[v]||0);
  const bat = batter?.bat || {trajectory:1, contact:'G', power:'G'};
  const pow = g(bat.power), con = g(bat.contact);
  const ctrl = g(pitcher?.pit?.control || 'G');
  const slug = (ctx.slugfest||0);

  // 事前イベント: 盗塁（1塁走者, 2死でないとき中心）
  if (ctx.stealAllowed && ctx.b1 && !ctx.b2 && rng()<0.12){
    const safe = rng()<0.62; // 簡易成功率
    return safe ? { type:'SB', base:2 } : { type:'CS', base:2 };
  }

  // 基本確率
  let pBB = 0.07 + Math.max(0, 0.02*(3-ctrl));
  let pK = 0.18 - 0.02*con; if (pK<0.06) pK=0.06;
  let pHR = 0.03 + 0.01*pow + 0.01*slug;
  let pH1 = 0.17 + 0.02*con;
  let pH2 = 0.06 + 0.01*pow;
  let pH3 = 0.01 + 0.005*con;
  // 死球（コントロール悪いと増える）
  let pHBP = 0.004 + 0.002*Math.max(0,(3-ctrl));
  // ゴロ/フライ比（大まか）
  let pG = 0.22; // インプレーのゴロ
  let pF = 0.12; // インプレーのフライ

  // === 乱打補正の実効化（HRだけでなく分布全体に反映） ===
  const s = Math.max(-10, Math.min(10, slug));   // 安全にクリップ
  const nz = v => Math.max(0, v);                 // 下限0で安全
  // 打高でヒット↑（HR>3塁>2塁>単打の順に感度）、投高でK↑/四球↓、打高でエラー↑
  pHR = nz(pHR * (1 + 0.08*s));
  pH3 = nz(pH3 * (1 + 0.06*s));
  pH2 = nz(pH2 * (1 + 0.05*s));
  pH1 = nz(pH1 * (1 + 0.03*s));
  pK  = nz(pK  * (1 - 0.03*s));
  pBB = nz(pBB * (1 - 0.01*s));
  // インプレーアウトと失策も微調整（打高でゴロ/フライやや減、失策やや増）
  pG  = nz(pG  * (1 - 0.02*s));
  pF  = nz(pF  * (1 - 0.01*s));
  // 失策（インプレー時ごくわずか）
  let pE = 0.015;

  // let pE = typeof pE==='number' ? nz(pE * (1 + 0.02*s)) : undefined; // pEを使っている場合のみ
  // ※この後にある“sumで割る正規化”が全体を整えてくれる


  // 状況依存: 1塁・無/1死での併殺出現率
  const dpChance = (ctx.b1 && !ctx.b2 && ctx.outs<=1) ? 0.12 : 0.0;
  const sfChance = (ctx.b3 && ctx.outs<=1) ? 0.20 : 0.0; // 犠飛チャンス
  // 進塁打（走者がいる時のみ発生。2アウトでは基本発生させない）
  const advChance = (((ctx.b1||ctx.b2||ctx.b3) && ctx.outs<=1) ? 0.10 : 0.0);

  let sum = pBB+pK+pHR+pH1+pH2+pH3+pHBP+pG+pF+pE+dpChance+sfChance+advChance;
  // 正規化
  pBB/=sum; pK/=sum; pHR/=sum; pH1/=sum; pH2/=sum; pH3/=sum; pHBP/=sum; pG/=sum; pF/=sum; pE/=sum; let pDP=dpChance/sum; let pSF=sfChance/sum; let pADV=advChance/sum;

  const r = rng();
  let acc=0;
  function pick(p){ acc+=p; return r<acc; }
  if (pick(pBB)) return {type:'BB'};
  if (pick(pK)) return {type:'K'};
  if (pick(pHR)) return {type:'HR'};
  if (pick(pH3)) return {type:'3B'};
  if (pick(pH2)) return {type:'2B'};
  if (pick(pH1)) return {type:'1B'};
  if (pick(pHBP)) return {type:'HBP'};
  if (pick(pE)) return {type:'E'};
  if (pick(pDP)) return {type:'GDP'};
  if (pick(pSF)) return {type:'SF'};
  if (pick(pADV)) return {type:'ADV'};
  if (pick(pF)) return {type:'FO'}; // 通常フライアウト
  return {type:'GOUT'}; // 通常ゴロアウト
}

function simulateGame(A, B, rng, opts){
  const innings = 9;
  const maxInnings = 12;
  const dh = !!(opts?.dh ?? A?.dh) || false; // UI設定優先
  const slugfest = (opts?.slugfest ?? 0) | 0;
  const G = {
    A, B, dh, rng,
    scoreA: 0, scoreB: 0,
    linesA: [], linesB: [],
    log: [],
    logRows: [],
    highlights: [],
    decisions: { W:null, L:null, S:null },
    hitsA: 0, hitsB: 0,
    stats: { A:{ bat:new Map(), pit:new Map(), order:[] }, B:{ bat:new Map(), pit:new Map(), order:[] } },
    records: { HR:[], SB:[], CS:[], E:[] },
    startPitcherA: A && A.pitcher ? A.pitcher : null,
    startPitcherB: B && B.pitcher ? B.pitcher : null,
    slugfest,
  };

  // 投手リスト（先発＋控え）
  function bullpenOf(T){ return [T.pitcher, ...(T.bullpen||[])].filter(Boolean); }
  const penA = bullpenOf(B); // A攻撃時の相手投手群
  const penB = bullpenOf(A);
  const faced = new Map(); // pitcher.id -> 打者数
  function incFaced(p){ if(!p) return; const k=p.id||p.name||'P'; faced.set(k,(faced.get(k)||0)+1); }
  function nextPitcher(pen, current, retiredSet){
    const idx = pen.findIndex(x => (x.id===current.id && x.name===current.name));
    for (let i=(idx<0?0:idx+1); i<pen.length; i++){
      const cand = pen[i];
      if (!cand) continue;
      if (retiredSet && retiredSet.has((cand?.id||'')+'|'+(cand?.name||''))) continue;
      if (!(cand.id===current.id && cand.name===current.name)) return cand;
    }
    return current;
  }

  let orderA = 0, orderB = 0;
  let inning = 1;
  let top = true;
  const retiredA = new Set();
  const retiredB = new Set();
  let pendingChange = null; // 回頭の交代を次ヘッダ直後に表示するためのバッファ

  let paGlobal = 0; // 全体通番（play/runnerイベント含む）
  while (true){
    const atk = top ? A : B;
    const def = top ? B : A;
    const lines = top ? G.linesA : G.linesB;
    const halfHdr = top ? '表' : '裏';
    G.log.push(`[${toFwDigit(inning)}回${halfHdr}：${atk.abbr}の攻撃]`);
    G.logRows.push({ type:'header', inning, half: halfHdr, teamAbbr: atk.abbr });
    // 回頭の交代が保留されていれば、ヘッダ直後に表示
    if (pendingChange && pendingChange.inning === inning && pendingChange.half === halfHdr) {
      G.logRows.push(pendingChange);
      pendingChange = null;
    }
    let inningPaIndex = 0; // この半回内の通番

    let out = 0, R = 0;
    let b1=null,b2=null,b3=null;
    let idx = top? orderA : orderB;
    let paCount = 0;
    let inningHits = 0;
    let hitsInARow = 0;
    let changesThisInning = 0;
    let pitcher = def.pitcher;
    // 先発を使用順に記録
    function pushPitOrder(teamKey, p){
      const arr = G.stats[teamKey].order;
      const key = (p?.id||p?.name||'P') + '|' + (p?.name||'');
      if (!arr.find(k=>k===key)) arr.push(key);
    }
    pushPitOrder(top? 'B':'A', pitcher);
    let pens = top ? penA : penB;

    let endedWalkoff = false; // サヨナラ成立フラグ（この半回で即終了）
    while (out < 3){
      const order = idx % atk.lineup.length;
      const batter = atk.lineup[order];
      const beforeBases = { b1: !!b1, b2: !!b2, b3: !!b3 };
      const beforeOut = out;
      const beforeR = R;

      // 盗塁を含む状況付き打席
      const pre = plateAppearanceEx(batter, pitcher, rng, { b1:!!b1, b2:!!b2, b3:!!b3, outs:out, slugfest, stealAllowed:true });
      let res = pre;
      if (pre.type==='SB'){
        // 盗塁成功（主体=走者）
        const runner = b1; // 実際に走るのは一塁走者
        if (b1 && !b2){ b2=b1; b1=null; }
        const basesTxt = basesText(beforeBases);
        const curA = top ? (G.scoreA + R) : G.scoreA;
        const curB = top ? G.scoreB : (G.scoreB + R);
        const scoreTxt = `${G.A.abbr} ${curA}-${curB} ${G.B.abbr}`;
        const afterBases = { b1: !!b1, b2: !!b2, b3: !!b3 };
        G.logRows.push({
          type:'runner', inning, half:halfHdr, top:!!top, side: top?'A':'B',
          atkFull: atk.full||'', atkAbbr: atk.abbr, defFull: def.full||'', defAbbr: def.abbr,
          pitcherId: def.pitcher?.id||'', pitcherName: def.pitcher?.name||'投手',
          // 打者文脈（任意）
          order:(order+1), batterId: batter?.id||'', name: (batter?.name||''), pos: batter?.pos||'',
          // BSO/走者（打席外: B/Sは非表示扱い）
          b: null, s: null, o: beforeOut, outsBefore: beforeOut,
          b1: beforeBases.b1, b2: beforeBases.b2, b3: beforeBases.b3, basesTxtBefore: basesTxt, bsoSource:'runner',
          // 主体=走者
          runnerId: runner?.id||'', runnerName: runner?.name||'走者', runnerFromBase: 1, runnerToBase: (pre.base||2),
          // 結果
          resultType:'SB', resultTxt:'盗塁成功', runs:0, rbi:0,
          outsAfter: out, outsMade: 0,
          b1After: afterBases.b1, b2After: afterBases.b2, b3After: afterBases.b3, basesTxtAfter: basesText(afterBases),
          scoreA: curA, scoreB: curB, scored:false, scoreTxt,
          goAhead:false, tie:false, walkoff: false,
          errorFielderPos:'', errorFielderName:'',
          sbTargetBase: pre.base || 2,
          paId: ++paGlobal, inningPaIndex: inningPaIndex++
        });
        // 記録（盗塁）
        G.records.SB.push({ team: atk.abbr, name: (runner?.name||'走者'), inning, half: halfHdr });
        continue;
      } else if (pre.type==='CS'){
        // 盗塁死（主体=走者）
        const runner = b1;
        if (b1 && !b2){ b1=null; out++; }
        const basesTxt = basesText(beforeBases);
        const curA = top ? (G.scoreA + R) : G.scoreA;
        const curB = top ? G.scoreB : (G.scoreB + R);
        const scoreTxt = `${G.A.abbr} ${curA}-${curB} ${G.B.abbr}`;
        const afterBases = { b1: !!b1, b2: !!b2, b3: !!b3 };
        G.logRows.push({
          type:'runner', inning, half:halfHdr, top:!!top, side: top?'A':'B',
          atkFull: atk.full||'', atkAbbr: atk.abbr, defFull: def.full||'', defAbbr: def.abbr,
          pitcherId: def.pitcher?.id||'', pitcherName: def.pitcher?.name||'投手',
          order:(order+1), batterId: batter?.id||'', name: (batter?.name||''), pos: batter?.pos||'',
          b: null, s: null, o: beforeOut, outsBefore: beforeOut,
          b1: beforeBases.b1, b2: beforeBases.b2, b3: beforeBases.b3, basesTxtBefore: basesTxt, bsoSource:'runner',
          runnerId: runner?.id||'', runnerName: runner?.name||'走者', runnerFromBase: 1, runnerToBase: (pre.base||2),
          resultType:'CS', resultTxt:'盗塁死', runs:0, rbi:0,
          outsAfter: out, outsMade: (out - beforeOut),
          b1After: afterBases.b1, b2After: afterBases.b2, b3After: afterBases.b3, basesTxtAfter: basesText(afterBases),
          scoreA: curA, scoreB: curB, scored:false, scoreTxt,
          goAhead:false, tie:false, walkoff: false,
          errorFielderPos:'', errorFielderName:'',
          sbTargetBase: pre.base || 2,
          paId: ++paGlobal, inningPaIndex: inningPaIndex++
        });
        G.records.CS.push({ team: atk.abbr, name: (runner?.name||'走者'), inning, half: halfHdr });
        // 投球回の端数（走塁アウトも在場投手に加算）
        {
          const defKey = top ? 'B' : 'A';
          const pitKey = (pitcher?.id || `${pitcher?.name||'投手'}`);
          if (!G.stats[defKey].pit.has(pitKey)){
            G.stats[defKey].pit.set(pitKey, { ref:pitcher, outs:0, R:0, HA:0, BB:0, HBP:0, HR:0, K:0 });
          }
          const pit = G.stats[defKey].pit.get(pitKey);
          const outDelta = (out - beforeOut);
          if (outDelta > 0) pit.outs += outDelta;
        }
        if (out>=3){ break; }
        continue;
      }

      // 本結果の適用
      function addHit(){ if (top) G.hitsA++; else G.hitsB++; inningHits++; }
      if (res.type === 'K') { out++; hitsInARow = 0; }
      else if (res.type === 'BB' || res.type === 'HBP') { if (!b1) b1 = batter; else if (!b2) b2 = b1, b1 = batter; else if (!b3) b3 = b2, b2 = b1, b1 = batter; else { R++; } hitsInARow = 0; }
      else if (res.type === '1B') { // 単打
        if (b3){ R++; b3=null; }
        if (b2){ b3=b2; b2=null; }
        if (b1){ b2=b1; b1=null; }
        b1 = batter; addHit(); hitsInARow++;
      }
      else if (res.type === '2B') { if (b3){ R++; b3=null; } if (b2){ R++; b2=null; } if (b1){ b3=b1; b1=null; } b2=batter; addHit(); hitsInARow++; }
      else if (res.type === '3B') { if (b3){ R++; b3=null; } if (b2){ R++; b2=null; } if (b1){ R++; b1=null; } b3=batter; addHit(); hitsInARow++; }
      else if (res.type === 'HR') { const on=(b1?1:0)+(b2?1:0)+(b3?1:0); R += 1+on; b1=b2=b3=null; addHit(); hitsInARow++; G.highlights.push({ kind:'HR', inning, top, batter }); G.records.HR.push({ team: (top?G.A:G.B).abbr, name: batter?.name||'選手', inning, half: halfHdr }); }
      else if (res.type === 'E') { // 失策で出塁（全員一つずつ進む）
        if (b3){ R++; b3=null; }
        if (b2){ b3=b2; b2=null; }
        if (b1){ b2=b1; b1=null; }
        b1 = batter; hitsInARow = 0;
        // 記録（失策）: 打球種別に応じて守備者を推定
        const contact = (rng() < 0.7) ? 'ground' : 'fly';
        const fielder = pickErrorFielder(def, contact, rng);
        const fname = fielder?.name || '選手';
        G.records.E.push({ team: def.abbr, name: fname, inning, half: halfHdr });
      }
      else if (res.type === 'GDP') { // 併殺: 打者と一塁走者アウト、他は1つ進む（原則、得点は入らない）
        if (b1){
          b1 = null;
          const outBefore = beforeOut;
          out += 2;
          // 三塁走者の得点はGIDPでは原則無効。
          // 例外として、0アウト時のみ時間差で生還を許容（第3アウトではないため）。
          if (b3){
            if (outBefore === 0) { R++; }
            b3 = null;
          }
          if (b2){ b3 = b2; b2 = null; }
        } else {
          out++;
        } // 条件不成立時は通常アウト
        hitsInARow = 0;
      }
      else if (res.type === 'SF') { // 犠牲フライ: 三塁走者がいれば生還
        out++; hitsInARow = 0;
        if (b3){ R++; b3=null; }
      }
      else if (res.type === 'ADV') { // 進塁打: 打者アウト、走者が一つずつ進む
        out++; hitsInARow = 0;
        if (b3){ R++; b3=null; }
        if (b2){ b3=b2; b2=null; }
        if (b1){ b2=b1; b1=null; }
      }
      else { // GOUT/FO/OUT
        out++; hitsInARow = 0;
      }

      // ログ生成
      const runsOnPlay = R - beforeR;
      const name = batter?.name || `選手${(order+1)}`;
      const resultTxt = resultText(res.type);
      const outsTxt = `${outsText(beforeOut)}`;
      const basesTxt = basesText(beforeBases);
      const curA_before = top ? (G.scoreA + beforeR) : G.scoreA;
      const curB_before = top ? G.scoreB : (G.scoreB + beforeR);
      const curA = top ? (G.scoreA + R) : G.scoreA;
      const curB = top ? G.scoreB : (G.scoreB + R);
      const scoreTxt = `${G.A.abbr} ${curA}-${curB} ${G.B.abbr}`;
      // 疑似B/Sは廃止（表示は常にプレー前、B/Sは非表示扱い）
      const tail = runsOnPlay>=1 ? `（${runsOnPlay}点）` : '';
      G.log.push(`${outsTxt} ${basesTxt} ${order+1}番 ${name}：${resultTxt}${tail}｜${scoreTxt}`);
      // デバッグ強化用: 打席後の走者/アウトも保持
      const afterBases = { b1: !!b1, b2: !!b2, b3: !!b3 };
      const outsAfter = out;
      const pitcherName = pitcher?.name || '投手';
      const pitcherId = pitcher?.id || '';
      const batterId = batter?.id || '';
      const pos = batter?.pos || '';
      const atkFull = atk?.full || '';
      const defFull = def?.full || '';
      const isRbi = (runsOnPlay>0) && (res.type!=='E');
      // 勝ち越し/同点/サヨナラの判定
      const wasLead = (top ? (curA_before > curB_before) : (curB_before > curA_before));
      const becameLead = (top ? (curA > curB) : (curB > curA));
      const becameTie = (curA === curB) && !(curA_before === curB_before);
      const goAhead = (!wasLead) && becameLead && (runsOnPlay>0);
      const tie = becameTie;
      const walkoff = (!top && inning >= 9 && (curB > curA) && (runsOnPlay>0));
      // 失策責任者（簡易）
      let errorFielderPos = '', errorFielderName = '';
      if (res.type === 'E'){
        const contact = 'ground';
        const who = pickErrorFielder(def, contact, rng);
        if (who){ errorFielderPos = who.pos || ''; errorFielderName = who.name || ''; }
      }
      // 表示テキストの調整（曖昧語の排除）
      let displayTxt = `${resultTxt}${tail}`;
      // ADVで三走生還: 「内野ゴロの間に三塁走者生還」
      if (res.type === 'ADV' && beforeBases.b3 && runsOnPlay >= 1){
        displayTxt = '内野ゴロの間に三塁走者生還';
      }
      // ゴロ/フライで走者が動かず: 「進塁ならず」注記
      const noAdvance = (beforeBases.b2 || beforeBases.b3) && (afterBases.b2 === beforeBases.b2) && (afterBases.b3 === beforeBases.b3) && runsOnPlay===0;
      if ((res.type === 'GOUT' || res.type === 'FO') && noAdvance){
        displayTxt = `${resultTxt}（進塁ならず）`;
      }

      // 構造化ログ（B/Sはnull=非表示）
      G.logRows.push({
        // コンテキスト
        type: 'play',
        inning,
        half: halfHdr,
        top: !!top,
        side: top ? 'A' : 'B',
        // チーム情報
        atkFull, atkAbbr: atk.abbr,
        defFull, defAbbr: def.abbr,
        // 対戦当事者
        pitcherId, pitcherName,
        order: (order+1),
        batterId,
        name,
        pos,
        // 打席前状況（擬似BSO・走者）
        b: null,
        s: null,
        o: beforeOut,
        outsBefore: beforeOut,
        b1: beforeBases.b1,
        b2: beforeBases.b2,
        b3: beforeBases.b3,
        basesTxtBefore: basesTxt,
        bsoSource: 'pre',
        // 結果
        resultType: res.type,
        resultTxt: displayTxt,
        runs: runsOnPlay,
        rbi: isRbi ? runsOnPlay : 0,
        // 打席後状況
        outsAfter,
        outsMade: (outsAfter - beforeOut),
        b1After: afterBases.b1,
        b2After: afterBases.b2,
        b3After: afterBases.b3,
        basesTxtAfter: basesText(afterBases),
        // スコア
        scoreA: curA,
        scoreB: curB,
        scored: (runsOnPlay>=1),
        scoreTxt,
        // 付加情報
        goAhead, tie, walkoff,
        errorFielderPos, errorFielderName,
        sbTargetBase: '',
        paId: ++paGlobal, inningPaIndex: inningPaIndex++
      });

      // 後半状況ハイライト
      const isLate = inning >= 7;
      if (isLate && ['1B','2B','3B','HR'].includes(res.type)){
        const atkScore = top ? G.scoreA + R : G.scoreB + R;
        const defScore = top ? G.scoreB : G.scoreA;
        if (atkScore > defScore) G.highlights.push({kind:'GO_AHEAD', inning, top, batter});
        else if (atkScore === defScore) G.highlights.push({kind:'TIE', inning, top, batter});
      }

      // 成績集計（打者）
      const atkKey = top? 'A':'B';
      const batKey = batter?.id || `${batter?.name||'選手'}-${batter?.no||order+1}`;
      if (!G.stats[atkKey].bat.has(batKey)){
        G.stats[atkKey].bat.set(batKey, { ref:batter, pos:(batter?.pos||''), AB:0,H:0,RBI:0, byInn: {} });
      }
      const bat = G.stats[atkKey].bat.get(batKey);
      // 成績表記（パディングせず短縮なし）
      const markMap = {
        BB: '四球', HBP: '死球', K: '三振', OUT: '凡退',
        '1B': '単打', '2B': '二塁打', '3B': '三塁打', HR: '本塁打',
        SF: '犠飛', GDP: '併殺打', ADV: '進塁打', E: '失策', SB: '盗塁', CS: '盗塁死',
        GOUT: 'ゴロ', FO: 'フライ'
      };
      const isHit = ['1B','2B','3B','HR'].includes(res.type);
      const isAB = ['K','1B','2B','3B','HR','GOUT','FO','GDP','ADV','OUT','E'].includes(res.type);
      if (isAB) bat.AB++;
      if (isHit) bat.H++;
      if (isRbi) bat.RBI += runsOnPlay;
      const mark = markMap[res.type] || res.type;
      if (!bat.byInn[inning]) bat.byInn[inning] = [];
      bat.byInn[inning].push(mark);

      // 成績集計（投手）
      const defKey = top? 'B':'A';
      const pitKey = pitcher?.id || `${pitcher?.name||'投手'}`;
      if (!G.stats[defKey].pit.has(pitKey)){
        G.stats[defKey].pit.set(pitKey, { ref:pitcher, outs:0, R:0, HA:0, BB:0, HBP:0, HR:0, K:0 });
      }
      const pit = G.stats[defKey].pit.get(pitKey);
      const outDelta = (out - beforeOut);
      if (outDelta>0) pit.outs += outDelta;
      if (runsOnPlay>0) pit.R += runsOnPlay;
      if (isHit) pit.HA += 1;
      if (res.type==='BB') pit.BB += 1;
      if (res.type==='HBP') pit.HBP += 1;
      if (res.type==='HR') pit.HR += 1;
      if (res.type==='K') pit.K += 1;

      // codex:begin walkoff-fix
      // サヨナラ成立時は、個票（打者・投手・走者得点）まで反映してから終了
      if (walkoff) {
        endedWalkoff = true;
        // この半回の攻撃はここで打ち切る（早期returnは行わない）
        break;
      }
      // codex:end walkoff-fix

      // 交代判定: この回に4点以上/連続被安打3で交代（各回1回まで）
      if ((R - beforeR) >= 1 && ['1B','2B','3B','HR'].includes(res.type)){
        inningHits++;
      }
      const tooManyRuns = (R >= 4);
      const tooManyHits = (hitsInARow >= 3);
      if (changesThisInning < 1 && (tooManyRuns || tooManyHits) && pens.length>0){
        const retiredSet = top ? retiredB : retiredA;
        const prevKey = (pitcher?.id||'')+'|'+(pitcher?.name||'');
        const newP = nextPitcher(pens, pitcher, retiredSet);
        if (newP && (newP.id!==pitcher.id || newP.name!==pitcher.name)){
          retiredSet.add(prevKey);
          const from = pitcher?.name || '投手';
          const fromId = pitcher?.id || '';
          const to = newP?.name || '投手';
          const toId = newP?.id || '';
          // 交代理由とサマリ
          const reason = tooManyRuns ? 'runs_in_inning' : 'consecutive_hits';
          const notes = [];
          if (tooManyRuns) notes.push(`この回${R}失点`);
          if (tooManyHits) notes.push(`連続${hitsInARow}被安打`);
          const reasonNote = notes.join('・');
          // 降板投手の途中成績
          const defKey = top? 'B':'A';
          const fromKey = pitcher?.id || `${pitcher?.name||'投手'}`;
          const pst = G.stats[defKey].pit.get(fromKey) || { outs:0,R:0,HA:0,BB:0,HBP:0,HR:0,K:0 };
          pitcher = newP;
          def.pitcher = newP;
          pushPitOrder(top? 'B':'A', pitcher);
          const teamAbbr = def.abbr;
          const orderArr = G.stats[top? 'B':'A'].order;
          const toKey = (newP?.id||'')+'|'+(newP?.name||'');
          const pitOrder = Math.max(1, (orderArr.findIndex(k=>k===toKey) + 1));
          const changeTxt = `投手交代：${def.abbr} ${from} → ${to}`;
          G.log.push(changeTxt);
          G.logRows.push({ type:'change', inning, half:halfHdr, text: changeTxt, teamAbbr,
            fromName: from, fromId, toName: to, toId,
            pitOrder, reason, reasonNote, inningRuns: R, hitsInARow,
            fromStats: { outs:pst.outs, R:pst.R, HA:pst.HA, BB:pst.BB, HBP:pst.HBP, HR:pst.HR, K:pst.K },
            toProfile: { throws: newP?.throws || '', velo: (newP?.pit?.velo||0), control: (newP?.pit?.control||'G'), stamina: (newP?.pit?.stamina||'G') }
          });
          changesThisInning++;
        }
      }

      idx++;
      incFaced(pitcher);
      if (paCount++ > 120) break;
    }

    if (top){ G.scoreA += R; orderA = idx % A.lineup.length; } else { G.scoreB += R; orderB = idx % B.lineup.length; }
    lines.push(R);
    if (R >= 2) G.highlights.push({ kind:'BIG', inning, top, runs:R });
    const half = top ? '表' : '裏';
    // サヨナラ成立時は回終了行を出力せずにゲーム終了
    if (!endedWalkoff) {
      G.log.push(`[${toFwDigit(inning)}回${half}終了：${G.A.abbr} ${G.scoreA}-${G.scoreB} ${G.B.abbr}]`);
    }

    // サヨナラなら即終了
    if (endedWalkoff) {
      break;
    }

    if (!top) { inning++; }
    // 9回以降：表終了時に後攻がリードなら裏をスキップして終了
    if (top && inning >= 9 && G.scoreB > G.scoreA) {
      break;
    }
    if (inning > innings && G.scoreA !== G.scoreB) { break; }
    if (inning > maxInnings) break;
    top = !top;

    // イニング跨ぎ交代: 7回以降は先発から交代（再登板禁止を尊重）
    if (top){
      // 次の攻撃側に合わせて守備側の投手を決める
      const nextDef = top ? B : A; // ここではB
      const pen = top ? penA : penB;
      if (inning >= 7 && pen.length>0){
        const cur = nextDef.pitcher;
        const retiredSet = top ? retiredB : retiredA;
        const prevKey = (cur?.id||'')+'|'+(cur?.name||'');
        const newP = nextPitcher(pen, cur, retiredSet);
        if (newP && (newP.id!==cur.id || newP.name!==cur.name)){
          retiredSet.add(prevKey);
          if (top){ B.pitcher = newP; } else { A.pitcher = newP; }
          // 登板順の更新
          pushPitOrder('B', newP);
          // ヘッダ直後に出すため保留
          const teamAbbr = nextDef.abbr;
          const changeTxt = `投手交代：${teamAbbr} ${(cur?.name||'投手')} → ${(newP?.name||'投手')}`;
          const orderArr = G.stats['B'].order;
          const toKey = (newP?.id||'')+'|'+(newP?.name||'');
          const pitOrder = Math.max(1, (orderArr.findIndex(k=>k===toKey) + 1));
          const defKey2 = 'B';
          const fromKey = cur?.id || `${cur?.name||'投手'}`;
          const pst = G.stats[defKey2].pit.get(fromKey) || { outs:0,R:0,HA:0,BB:0,HBP:0,HR:0,K:0 };
          const halfNext = '表';
          pendingChange = { type:'change', inning, half: halfNext, text: changeTxt, teamAbbr,
            fromName: (cur?.name||'投手'), fromId: (cur?.id||''), toName: (newP?.name||'投手'), toId: (newP?.id||''),
            pitOrder, reason:'between_innings_auto', reasonNote:'回頭の継投', inningRuns: 0, hitsInARow: 0,
            fromStats: { outs:pst.outs, R:pst.R, HA:pst.HA, BB:pst.BB, HBP:pst.HBP, HR:pst.HR, K:pst.K },
            toProfile: { throws: newP?.throws || '', velo: (newP?.pit?.velo||0), control: (newP?.pit?.control||'G'), stamina: (newP?.pit?.stamina||'G') }
          };
        }
      }
    }
  }

  G.expandInnings = Math.max(9, G.linesA.length, G.linesB.length);
  // 勝敗（簡易）: 先発（使用順の先頭）を勝敗投手とする
  const winTeam = (G.scoreA===G.scoreB) ? null : (G.scoreA>G.scoreB ? 'A' : 'B');
  const loseTeam = (G.scoreA===G.scoreB) ? null : (G.scoreA>G.scoreB ? 'B' : 'A');
  function firstPitcherName(teamKey){
    const order = G.stats[teamKey].order;
    if (!order.length) return '-';
    const key = order[0];
    const [id,name] = key.split('|');
    return name || '投手';
  }
  G.decisions.W = winTeam ? { team: winTeam, name: firstPitcherName(winTeam) } : null;
  G.decisions.L = loseTeam ? { team: loseTeam, name: firstPitcherName(loseTeam) } : null;
  // セーブ（簡易）: 勝利側の最終登板者が先発と異なり、点差<=3で付与
  if (winTeam){
    const order = G.stats[winTeam].order;
    const last = order[order.length-1] || '';
    const first = order[0] || '';
    const margin = Math.abs(G.scoreA - G.scoreB);
    if (last && last !== first && margin <= 3){
      const [,name] = last.split('|');
      G.decisions.S = { team: winTeam, name: name || '投手' };
    } else {
      G.decisions.S = null;
    }
  } else {
    G.decisions.S = null;
  }
  return G;
}

// 守備側から失策の責任者を打球種別に応じて推定
function pickErrorFielder(def, contact, rng){
  const lineup = Array.isArray(def.lineup) ? def.lineup : [];
  const infieldPos = new Set(['P','C','1B','2B','3B','SS']);
  const outfieldPos = new Set(['LF','CF','RF']);
  const infielders = lineup.filter(p => infieldPos.has(p.pos));
  const outfielders = lineup.filter(p => outfieldPos.has(p.pos));
  // contact: 'ground' -> 内野優先, 'fly' -> 外野優先
  let pool = (contact === 'fly') ? outfielders : infielders;
  if (!pool.length) pool = infielders.length ? infielders : (outfielders.length ? outfielders : lineup);
  if (!pool || !pool.length) return def.pitcher || null;
  const idx = Math.floor(rng() * pool.length);
  return pool[idx] || null;
}

// グローバル公開（従来の<script>読込で動作させる）
window.Engine = Object.assign({}, window.Engine, { simulateGame });
