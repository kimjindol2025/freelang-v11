/* dclub-analytics-client.js — Phase Y1
 *
 * 사용법 (사이트 <head> 에 삽입):
 *   <script src="https://analytics.dclub.kr/sdk.js"></script>
 *   <script>
 *     var t = DclubAnalytics.createTracker("s_yoursite", "https://analytics.dclub.kr");
 *     t.pageview();          // 자동 — DOMContentLoaded 시 호출
 *     t.event("click_buy", { plan: "pro" });
 *   </script>
 *
 * 외부 의존: 0. 모든 코드 vanilla. ~150줄.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "dclub_an_queue";
  var SESSION_KEY = "dclub_an_se";

  function newSessionId() {
    return (
      "se_" +
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36).slice(-4)
    );
  }

  function getSessionId() {
    try {
      var s = global.sessionStorage.getItem(SESSION_KEY);
      if (!s) {
        s = newSessionId();
        global.sessionStorage.setItem(SESSION_KEY, s);
      }
      return s;
    } catch (e) {
      return newSessionId();
    }
  }

  function readQueue() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writeQueue(q) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
    } catch (e) {
      /* quota exceeded — drop */
    }
  }

  function sendOne(endpoint, payload) {
    var url = endpoint + "/track";
    var body = JSON.stringify(payload);
    if (
      navigator &&
      typeof navigator.sendBeacon === "function" &&
      payload._beacon
    ) {
      try {
        var blob = new Blob([body], { type: "application/json" });
        return navigator.sendBeacon(url, blob);
      } catch (e) {
        /* fall through */
      }
    }
    if (typeof fetch === "function") {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
        mode: "cors",
        credentials: "omit",
      })
        .then(function (r) {
          return r.ok;
        })
        .catch(function () {
          return false;
        });
    }
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(body);
    return true;
  }

  function flushQueue(endpoint) {
    var q = readQueue();
    if (q.length === 0) return;
    var remaining = [];
    for (var i = 0; i < q.length; i++) {
      var ok = sendOne(endpoint, q[i]);
      if (!ok && ok !== undefined) remaining.push(q[i]);
    }
    writeQueue(remaining);
  }

  function send(endpoint, payload) {
    try {
      var ok = sendOne(endpoint, payload);
      if (ok === false) {
        var q = readQueue();
        q.push(payload);
        if (q.length > 50) q = q.slice(-50);
        writeQueue(q);
      }
    } catch (e) {
      var q2 = readQueue();
      q2.push(payload);
      writeQueue(q2);
    }
  }

  function createTracker(siteId, endpoint) {
    if (!endpoint) endpoint = "";
    if (endpoint.charAt(endpoint.length - 1) === "/")
      endpoint = endpoint.slice(0, -1);
    var sessionId = getSessionId();
    var loc = global.location || {};
    var doc = global.document || {};

    var api = {
      siteId: siteId,
      endpoint: endpoint,
      pageview: function (path) {
        send(endpoint, {
          site_id: siteId,
          type: "pageview",
          page: path || (loc.pathname || "/") + (loc.search || ""),
          referrer: doc.referrer || "",
          session_id: sessionId,
        });
      },
      event: function (name, props) {
        send(endpoint, {
          site_id: siteId,
          type: "event",
          page: (loc.pathname || "/") + (loc.search || ""),
          name: name,
          props: props || {},
          session_id: sessionId,
        });
      },
      flush: function () {
        flushQueue(endpoint);
      },
    };

    if (
      doc &&
      typeof doc.addEventListener === "function" &&
      doc.readyState !== "complete"
    ) {
      doc.addEventListener("DOMContentLoaded", function () {
        api.pageview();
        flushQueue(endpoint);
      });
    } else {
      try {
        api.pageview();
        flushQueue(endpoint);
      } catch (e) {}
    }

    if (global && typeof global.addEventListener === "function") {
      global.addEventListener("pagehide", function () {
        send(endpoint, {
          site_id: siteId,
          type: "session_end",
          page: loc.pathname || "/",
          session_id: sessionId,
          _beacon: true,
        });
      });
    }

    return api;
  }

  global.DclubAnalytics = {
    version: "0.1.0",
    createTracker: createTracker,
  };
})(typeof window !== "undefined" ? window : this);
