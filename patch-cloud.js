// patch-cloud.js
// Runtime patch to normalize EntityAreaEffectCloud radius and prevent ClassCastException
(function () {
  "use strict";

  // Normalize various boxed/typed values into a finite number
  function toNumber(x) {
    if (typeof x === "number") return isFinite(x) ? x : 0;
    if (typeof x === "string") {
      var p = parseFloat(x);
      return isFinite(p) ? p : 0;
    }
    if (x && typeof x.floatValue === "function") {
      try {
        var v = x.floatValue();
        return typeof v === "number" && isFinite(v) ? v : 0;
      } catch (e) {
        return 0;
      }
    }
    if (x && typeof x.value === "number") return isFinite(x.value) ? x.value : 0;
    var n = Number(x);
    return typeof n === "number" && isFinite(n) ? n : 0;
  }

  // Try to locate the AreaEffectCloud class across common exposures
  function findCloudClass() {
    try {
      if (window.net && net.minecraft && net.minecraft.entity && net.minecraft.entity.EntityAreaEffectCloud) {
        return net.minecraft.entity.EntityAreaEffectCloud;
      }
    } catch (e) {}

    try {
      if (window.EntityAreaEffectCloud) return window.EntityAreaEffectCloud;
    } catch (e) {}

    // Heuristic: scan global objects for a module that exposes the class
    try {
      var keys = Object.keys(window);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = window[k];
        if (!v || typeof v !== "object") continue;
        try {
          if (v.EntityAreaEffectCloud) return v.EntityAreaEffectCloud;
          if (v.net && v.net.minecraft && v.net.minecraft.entity && v.net.minecraft.entity.EntityAreaEffectCloud) {
            return v.net.minecraft.entity.EntityAreaEffectCloud;
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {}

    return null;
  }

  // Poll until the class is available, then patch
  var attempts = 0;
  var maxAttempts = 600; // ~60s at 100ms
  var interval = 100;
  var timer = setInterval(function () {
    attempts++;
    var Cloud = findCloudClass();

    if (!Cloud || !Cloud.prototype) {
      if (attempts >= maxAttempts) {
        clearInterval(timer);
        console.warn("[patch-cloud] EntityAreaEffectCloud not found after", attempts, "attempts");
      }
      return;
    }

    clearInterval(timer);

    if (Cloud.__patchedCloudRadius) {
      console.log("[patch-cloud] Already patched");
      return;
    }

    // Patch shouldIgnoreRadius safely
    try {
      var origShould = Cloud.prototype.shouldIgnoreRadius;
      Cloud.prototype.shouldIgnoreRadius = function (r) {
        try {
          var n = toNumber(r);
          return n <= 0.0;
        } catch (e) {
          return true;
        }
      };
    } catch (e) {
      // ignore
    }

    // Patch onUpdate to sanitize this.radius and avoid crashing
    try {
      var origOnUpdate = Cloud.prototype.onUpdate;
      Cloud.prototype.onUpdate = function () {
        try {
          this.radius = toNumber(this.radius);
          return origOnUpdate ? origOnUpdate.apply(this, arguments) : undefined;
        } catch (e) {
          return;
        }
      };
    } catch (e) {
      // ignore
    }

    Cloud.__patchedCloudRadius = true;
    console.log("[patch-cloud] EntityAreaEffectCloud radius normalization active");
  }, interval);
})();
