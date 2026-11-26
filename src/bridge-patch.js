/* RLC Hub+ (c) 2026 Milan. All rights reserved. See LICENSE.txt. */
;/* ===== RLC HUB+ : read or replace a top-level function/value of this game file (addons: hub.get / hub.replace) ===== */
module.exports.__hubBridge = function (name, value) {
  if (!/^[A-Za-z_$][\w$]*$/.test(String(name))) throw new Error("RLC Hub+: bad name " + name);
  if (arguments.length > 1) eval(name + " = arguments[1]");
  return eval("typeof " + name + " === 'undefined' ? undefined : " + name);
};
