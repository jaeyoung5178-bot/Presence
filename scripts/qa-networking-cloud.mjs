import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const runtime = process.env.CODEX_NODE_RUNTIME || '/Users/jaeyoung5178/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json';
const { chromium } = createRequire(runtime)('playwright');
const base = process.env.NETWORKING_QA_URL || 'http://127.0.0.1:8768';
const out = '/tmp/presence-networking-cloud-qa';
await mkdir(out, { recursive: true });
const checks = [], failures = [];
const check = (name, condition, detail = '') => (condition ? checks : failures).push({ name, detail });

// Evaluate the checked-in Firebase authorization expressions without contacting Firebase.
const rulesPath = process.env.NETWORKING_RULES_PATH || '/Users/jaeyoung5178/Documents/ChatGPT/리캡/.worktrees/ic-manager-20261024/scripts/ic-manager-security/database.rules.json';
const rules = JSON.parse(await readFile(rulesPath, 'utf8')).rules.userPreferences.$uid;
const tree = { authSessions: { sessionA: { userUid: 'alice' }, sessionB: { userUid: 'bob' }, inactiveSession: { userUid: 'inactive' } }, users: { alice: { status: 'active' }, bob: { status: 'active' }, inactive: { status: 'inactive' } } };
const snap = value => ({ child: key => snap(value?.[key]), val: () => value ?? null });
for (const action of ['.read','.write']) {
  const allowed = (auth, uid) => Function('auth','root','$uid',`return (${rules[action]});`)(auth, snap(tree), uid);
  check(`${action}: own active uid authorized`, allowed({ uid: 'sessionA' }, 'alice'));
  check(`${action}: other uid denied`, !allowed({ uid: 'sessionA' }, 'bob'));
  check(`${action}: inactive user denied`, !allowed({ uid: 'inactiveSession' }, 'inactive'));
  check(`${action}: unauthenticated denied`, !allowed(null, 'alice'));
  check(`${action}: no workbook session denied`, !allowed({ uid: 'unknown' }, 'alice'));
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto(`${base}/networking/cloud.js`);
  const unit = await page.evaluate(async () => {
    const { createNetworkingCloud } = await import('/networking/cloud.js');
    const checks = [];
    const check = (name, value) => { if (!value) throw Error(name); checks.push(name); };
    const wire = new Map(), listeners = new Map(), calls = [];
    let identity = 'alice', online = true, failPhoto = false, loseResponse = false, race = false, forceStatus = 0;
    const copy = value => JSON.parse(JSON.stringify(value));
    const snapshot = value => ({ val: () => copy(value) });
    const values = path => Object.fromEntries([...wire].filter(([key]) => key.startsWith(path + '/')).map(([key,v]) => [key.slice(path.length+1),v]));
    const emit = path => { for (const [root, callbacks] of listeners) if (path.startsWith(root + '/')) callbacks.forEach(cb => cb(snapshot(values(root)))); };
    const f = { db: {}, auth: { currentUser: { uid: 'synthetic-auth', getIdToken: async () => 'synthetic-token' } }, d: {
      ref: (_,path) => path,
      get: async path => snapshot(path.startsWith('authSessions/') ? { userUid: identity } : null),
      onValue: (path, callback) => { const set = listeners.get(path) || new Set(); set.add(callback); listeners.set(path,set); callback(snapshot(path === '.info/connected' ? online : path.startsWith('authSessions/') ? { userUid:identity } : values(path))); return () => set.delete(callback); },
    } };
    const fetchImpl = async (url, options = {}) => {
      const path = new URL(url).pathname.slice(1,-5), method = options.method || 'GET'; calls.push({path,method,size:options.body?.length || 0});
      if (forceStatus) return new Response('{}',{status:forceStatus});
      if (!path.startsWith(`userPreferences/${identity}/`)) return new Response('{}',{status:403});
      if (failPhoto && path.includes('/photos/')) return new Response('{}',{status:503});
      const previous = wire.get(path) || null;
      const etag = previous ? `"${previous.revision || previous.createdAt}"` : 'null_etag';
      if (method === 'PUT') {
        if (race && path.includes('/records/')) { race = false; wire.set(path,{...previous,revision:99}); }
        const latest = wire.get(path) || null, latestEtag = latest ? `"${latest.revision || latest.createdAt}"` : 'null_etag';
        if (options.headers?.['If-Match'] && options.headers['If-Match'] !== latestEtag) return new Response('{}',{status:412});
        const value = JSON.parse(options.body); wire.set(path,value); emit(path);
        if (loseResponse) { loseResponse = false; throw Error('synthetic response lost'); }
        return new Response(JSON.stringify(value),{status:200,headers:{ETag:latestEtag}});
      }
      return new Response(JSON.stringify(previous),{status:200,headers:{ETag:etag}});
    };
    const states = [], listsA = [], listsB = [], opts = { getFirebase: async () => f, fetchImpl, online: () => online, timeoutMs:30 };
    const a = await createNetworkingCloud({uid:'alice'},v=>listsA.push(v),(s,m)=>states.push([s,m]),opts);
    const b = await createNetworkingCloud({uid:'alice'},v=>listsB.push(v),()=>{},opts);
    const record = {id:'qa-one',title:'same date A',scope:'mine',owner:'QA',date:'2026-10-26',count:2,duration:90,photos:[],captures:[]};
    const first = await a.save(record,0);
    check('server ack increments revision',first.revision === 1);
    check('same uid second client receives saved record',listsB.at(-1)[0].title === record.title);
    const image = {id:'photo-one',name:'synthetic.png',src:'data:image/png;base64,AAAA'};
    const ref = await a.uploadPhoto(image);
    check('photo metadata excludes original bytes',!('src' in ref));
    check('second device downloads full original photo',await b.photo(ref.id) === image.src);
    const second = await a.save({...record,photos:[ref],title:'same date B'},1);
    check('metadata record does not embed original photo',!wire.get('userPreferences/alice/networkingArchive/records/qa-one').recordJson.includes('data:image'));
    let stale = false; try { await b.save({...record,title:'stale'},1); } catch (e) { stale = e.name === 'ConflictError'; }
    check('stale device cannot overwrite newest revision',stale && JSON.parse(wire.get('userPreferences/alice/networkingArchive/records/qa-one').recordJson).title === 'same date B');
    race = true; let raced = false; try { await a.save(record,2); } catch (e) { raced = e.name === 'ConflictError'; }
    check('If-Match race rejects concurrent server overwrite',raced);
    const tomb = {...record,id:'qa-delete',title:'delete me'}; await a.save(tomb,0); await a.remove(tomb.id,1);
    check('delete stores tombstone and hides record',wire.get('userPreferences/alice/networkingArchive/records/qa-delete').deleted && !listsB.at(-1).some(r=>r.id===tomb.id));
    let resurrection = false; try { await a.save(tomb,2); } catch (e) { resurrection = e.name === 'ConflictError'; }
    check('tombstone prevents stale import resurrection',resurrection && await a.exists(tomb.id));
    loseResponse = true; const recovered = await a.save({...record,id:'lost-response'},0);
    check('lost successful response recovers using operation id',recovered.revision === 1);
    online = false; let offline = false; try { await a.save({...record,id:'offline'},0); } catch(e) { offline = e.message.includes('아직 서버에 저장되지'); }
    check('offline never reports server save success',offline && !wire.has('userPreferences/alice/networkingArchive/records/offline')); online = true;
    failPhoto = true; let missing = false; try { await a.photo('not-loaded'); } catch { missing = true; } failPhoto = false;
    check('failed photo download rejects instead of empty data',missing);
    const beforeLarge = calls.length; let large = false; try { await a.uploadPhoto({...image,id:'oversize',src:'data:image/png;base64,'+'A'.repeat(4*1024*1024)}); } catch { large = true; }
    check('oversize photo rejected before network',large && calls.length === beforeLarge);
    identity = 'bob'; let switched = false; try { await a.save({...record,id:'wrong-account'},0); } catch(e) { switched = e.message.includes('계정이 바뀌'); }
    check('account switch rejects old editor save',switched && !wire.has('userPreferences/alice/networkingArchive/records/wrong-account'));
    let foreignRead = false; try { await a.photo('foreign'); } catch { foreignRead = true; }
    check('server denies foreign uid photo request',foreignRead);
    a.close(); b.close(); let closed = false; try { await a.photo('photo-one'); } catch { closed = true; }
    check('logout closes clients and clears photo cache',closed);
    check('only dedicated own archive paths used',calls.every(c=>c.path.startsWith('userPreferences/alice/networkingArchive/')));
    check('cloud never writes auth or old callback data',calls.filter(c=>c.method==='PUT').every(c=>c.path.includes('/networkingArchive/')));
    return checks;
  });
  unit.forEach(name => check(name,true));
  await context.close();
} finally {
  await browser.close();
  await writeFile(`${out}/report.json`, JSON.stringify({ checks, failures }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, failed: failures.length, failures }, null, 2));
}
assert.equal(failures.length, 0);
