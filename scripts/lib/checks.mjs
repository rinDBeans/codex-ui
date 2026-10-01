/**
 * checks.mjs — 所有验收脚本共用的断言记录与输出格式：
 *
 *   PASS <断言名>   [实测]
 *   FAIL <断言名>   [实测]
 *   …
 *   ALL PASS (n/n) | FAILED (p/n)        退出码 0 / 1
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
    /** 函数式断言：fn 抛错即失败（错误信息作为实测），返回值作为实测。 */
    attempt(name, fn) {
      try { return record(name, true, fn()); } catch (e) { return record(name, false, e.message); }
    },
  };
}

/** 打印总计并设退出码。 */
export function summarize(results) {
  const pass = results.filter((r) => r.ok).length;
  console.log('\n' + (pass === results.length ? 'ALL PASS' : 'FAILED') + ' (' + pass + '/' + results.length + ')');
  process.exitCode = pass === results.length ? 0 : 1;
  return pass === results.length;
}
