// 共有ユーティリティ（グローバル公開）
(function(){
  function toFwDigit(x){ return String(x); }
  function resultText(t){
    const map = { BB:'四球', HBP:'死球', K:'三振', OUT:'凡退', GOUT:'ゴロ', FO:'フライ', SF:'犠飛', GDP:'併殺', ADV:'進塁打', E:'失策', SB:'盗塁', CS:'盗塁死', '1B':'単打', '2B':'二塁打', '3B':'三塁打', HR:'本塁打' };
    return map[t] || t;
  }
  function outsText(o){ return o===0? '無死' : (o===1? '1死' : '2死'); }
  function basesText(bs){
    const b = [];
    if (bs.b1) b.push('一'); if (bs.b2) b.push('二'); if (bs.b3) b.push('三');
    if (b.length===0) return '走者なし';
    if (b.length===3) return '満塁';
    return b.join('') + '塁';
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
  window.Utils = Object.assign({}, window.Utils||{}, { toFwDigit, resultText, outsText, basesText, escapeHtml });
})();

