(() => {
  window.__errs = window.__errs || [];
  if (!window.__errHook) {
    window.__errHook = 1;
    const oe = console.error;
    console.error = function (...a) {
      window.__errs.push(
        a
          .map(x => String(x?.stack || x))
          .join(" ")
          .slice(0, 400),
      );
      return oe.apply(this, a);
    };
    window.addEventListener("error", e => window.__errs.push("ERR " + e.message));
    window.addEventListener("unhandledrejection", e => window.__errs.push("REJ " + (e.reason?.stack || e.reason)));
  }
  return 1;
})();
