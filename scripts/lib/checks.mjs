/**
 * checks.mjs — 所有验收脚本共用的断言记录与输出格式：
 *
 *   PASS  <断言名>   [实测]
 *   FAIL  <断言名>   [实测]
 *   XFAIL <断言名>   [实测]   ← 已知缺陷，不计入失败（见下方 xfail 说明）
 *   …
 *   ALL PASS (n/n, x 条 XFAIL) | FAILED (p/n)        退出码 0 / 1
 *
 * xfail 的用途：某条断言**确实还没通过**，但根因在宿主、不在本仓库能修的地方。
 * 与 check 的区别是它不拉红 CI，但**断言本身一条不删**——宿主修好后它会自动转 PASS 并从汇总里消失。
 * 纪律（与 T00 §4.3 同源）：xfail 只允许用于已查实根因、且已写明宿主提案的条目；
 * 不允许拿它盖住「皮肤没做到」——那种情况必须让 FAIL 报出来。
 */
export function checklist() {
  const results = [];
  const record = (name, ok, detail) => {
    results.push({ name, ok: Boolean(ok) });
    const extra = detail === undefined || detail === null || detail === '' ? '' : '   [' + String(detail).replace(/\s+/g, ' ').slice(0, 200) + ']';
    console.log((ok ? 'PASS ' : 'FAIL ') + name + extra);
    return Boolean(ok);
  };
  return {
    results,
    /** 布尔断言。 */
    check: record,
    /**
     * 已知缺陷断言：ok 为真时照常 PASS（宿主已修好），为假时记 XFAIL 而不记 FAIL。
     * why 必须写明根因与由谁修，便于日后回填。
     */
    xfail(name, ok, why, detail) {
      if (ok) {
        results.push({ name, ok: true, xfail: false });
        const extra = detail === undefined || detail === null || detail === '' ? '' : '   [' + String(detail).replace(/\s+/g, ' ').slice(0, 200) + ']';
        console.log('PASS ' + name + extra + '   ← 原 XFAIL，宿主已修复');
        return true;
      }
      results.push({ name, ok: true, xfail: true });
      console.log('XFAIL ' + name + '   [' + String(why).replace(/\s+/g, ' ').slice(0, 160) + ']');
      return false;
    },
    /** 函数式断言：fn 抛错即失败（错误信息作为实测），返回值作为实测。 */
    attempt(name, fn) {
      try { return record(name, true, fn()); } catch (e) { return record(name, false, e.message); }
    }
  };
}

/** 打印总计并设退出码。XFAIL 不计入分母：它们不是「这次没做好」，而是「已知且不由本仓库修」。 */
export function summarize(results) {
  const xfails = results.filter((r) => r.xfail).length;
  const scored = results.filter((r) => !r.xfail);
  const pass = scored.filter((r) => r.ok).length;
  const tail = xfails > 0 ? ', ' + xfails + ' 条 XFAIL' : '';
  console.log('\n' + (pass === scored.length ? 'ALL PASS' : 'FAILED') + ' (' + pass + '/' + scored.length + tail + ')');
  process.exitCode = pass === scored.length ? 0 : 1;
  return pass === scored.length;
}