import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const installerSource = fs.readFileSync(new URL("callback/personal-install.js", root), "utf8");

function runInstaller({ search = "", cookie = "", initialStorage = {} } = {}) {
  const storage = new Map(Object.entries(initialStorage));
  const cookies = new Map();
  cookie.split(";").map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const at = part.indexOf("=");
    if (at > 0) cookies.set(part.slice(0, at), part.slice(at + 1));
  });
  const replacements = [];
  const location = new URL("https://hub.presence.co.kr/callback/index.html" + search);
  const document = {
    readyState: "loading",
    head: { appendChild() {} },
    addEventListener() {},
    querySelector() { return null; },
    createElement() { return { style: {}, appendChild() {}, remove() {} }; },
    get cookie() { return [...cookies].map(([key, value]) => key + "=" + value).join("; "); },
    set cookie(value) {
      const parts = value.split(";").map((part) => part.trim());
      const at = parts[0].indexOf("=");
      const key = parts[0].slice(0, at);
      const val = parts[0].slice(at + 1);
      if (parts.some((part) => /^Max-Age=0$/i.test(part))) cookies.delete(key);
      else cookies.set(key, val);
    },
  };
  const window = { addEventListener() {} };
  const context = {
    URL,
    URLSearchParams,
    Date,
    JSON,
    Object,
    Promise,
    encodeURIComponent,
    decodeURIComponent,
    location,
    document,
    window,
    navigator: {},
    history: { replaceState(_state, _title, url) { replacements.push(url); } },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    matchMedia() { return { matches: false }; },
    setTimeout() { return 0; },
  };
  vm.createContext(context);
  vm.runInContext(installerSource, context, { filename: "personal-install.js" });
  return { context, storage, cookies, replacements };
}

const query = "?u=admin&n=" + encodeURIComponent("임재영") + "&k=qa-only-key";
const safari = runInstaller({ search: query });
assert.equal(safari.context.window.__fcosLaunchRecovered, "query");
assert.ok(safari.cookies.has("fcos_personal_launch_v1"), "Safari visit must create the iOS-transfer cookie");
assert.ok(safari.storage.has("fcos_personal_launch_v2"), "Safari visit must retain the local fallback");

const copiedCookie = [...safari.cookies].map(([key, value]) => key + "=" + value).join("; ");
const standalone = runInstaller({ cookie: copiedCookie });
assert.equal(standalone.context.window.__fcosLaunchRecovered, "cookie");
assert.equal(standalone.replacements.length, 1, "queryless Home Screen launch must restore the personal URL");
assert.match(standalone.replacements[0], /u=admin/);
assert.match(standalone.replacements[0], /n=%EC%9E%84%EC%9E%AC%EC%98%81/);
assert.ok(standalone.storage.has("fcos_personal_launch_v2"), "copied cookie must repopulate standalone storage");

standalone.context.window.FcosPersonalInstall.clear();
assert.equal(standalone.cookies.has("fcos_personal_launch_v1"), false, "revocation must clear the iOS-transfer cookie");
assert.equal(standalone.storage.has("fcos_personal_launch_v2"), false, "revocation must clear the local personal link");

const manifest = JSON.parse(fs.readFileSync(new URL("callback/manifest.json", root), "utf8"));
assert.equal("start_url" in manifest, false, "install must inherit the personalized document URL");
assert.equal("id" in manifest, false, "app id must not force a generic URL");

const sw = fs.readFileSync(new URL("callback/sw.js", root), "utf8");
assert.match(sw, /fcos-v20/);
assert.match(sw, /e\.request\.mode === "navigate"/);
assert.match(sw, /caches\.match\("\.\/index\.html"\)/);

const app = fs.readFileSync(new URL("callback/script.js", root), "utf8");
assert.match(app, /if \(this\.isAdmin\(\)\) return orig\(\)/, "verified admin badge must open the picker without another password prompt");
assert.match(app, /다른 사람 콜백싯 보기/);
assert.match(app, /if \(alive === false\).*revokeIdentity/, "only a confirmed inactive profile may revoke identity");
assert.match(app, /if \(alive !== true\).*개인 연결 유지/, "temporary network failures must retain identity");

console.log("Callback PWA QA passed: personalized install, iOS recovery, admin picker, revocation, offline shell");
