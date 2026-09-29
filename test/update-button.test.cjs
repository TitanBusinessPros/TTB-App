const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)][0][1];

async function checkUpdateButton(hasWaitingWorker) {
  const listeners = {};
  const messages = [];
  const visits = [];
  const button = {
    disabled: false,
    textContent: 'Get latest version',
    addEventListener(type, listener) { listeners[`button:${type}`] = listener; }
  };
  const registration = {
    waiting: hasWaitingWorker ? { postMessage(message) { messages.push(message); } } : null,
    installing: null,
    updateCalls: 0,
    update() { this.updateCalls++; return Promise.resolve(); },
    addEventListener() {}
  };
  const window = {
    matchMedia: () => ({ matches: false }),
    addEventListener(type, listener) { listeners[`window:${type}`] = listener; }
  };
  const document = {
    visibilityState: 'visible',
    querySelectorAll: () => [],
    getElementById(id) { return id === 'update-app-btn' ? button : { hidden: true }; },
    addEventListener() {}
  };
  const navigator = {
    standalone: false,
    serviceWorker: {
      controller: {},
      addEventListener(type, listener) { listeners[`worker:${type}`] = listener; },
      async register(url) {
        assert.equal(url, './sw.js?version=22');
        return registration;
      }
    }
  };
  const location = {
    href: 'https://titanbusinesspros.github.io/TTB-App/?view=board',
    protocol: 'https:',
    hostname: 'titanbusinesspros.github.io',
    replace(url) { visits.push(url); }
  };
  vm.runInNewContext(script, {
    window, document, navigator, location, URL,
    setTimeout() {}, setInterval() {}, console, alert() {}
  });
  await listeners['window:load']();
  const priorChecks = registration.updateCalls;
  listeners['button:click']();
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(button.disabled, true);
  assert.equal(registration.updateCalls, priorChecks + 1);
  assert.equal(visits.length, 1);
  const nextUrl = new URL(visits[0]);
  assert.equal(nextUrl.searchParams.get('view'), 'board');
  assert.match(nextUrl.searchParams.get('ttb-update'), /^\d+$/);
  assert.equal(messages.length, hasWaitingWorker ? 1 : 0);
  if (hasWaitingWorker) assert.equal(messages[0].type, 'SKIP_WAITING');
}

(async () => {
  await checkUpdateButton(false);
  await checkUpdateButton(true);
  console.log('Update button refreshes a fresh URL with and without a waiting worker.');
})().catch(error => { console.error(error); process.exitCode = 1; });
