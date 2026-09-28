// BK/B/N — ሥራ ክትትል (Work tracking) — Google Apps Script
// ለብቻው አዲስ project ይፍጠሩ። ከታች ያለውን ሚስጥር ይቀይሩ። ማንም ሰው የማያየው የራስዎ ቃል ይሁን።
var ADMIN_KEY = 'ይህን-በራስዎ-ሚስጥር-ይቀይሩ';
var FILE_NAME = 'bkbn-work-data.json';

function load_() {
  var it = DriveApp.getFilesByName(FILE_NAME);
  if (it.hasNext()) return JSON.parse(it.next().getBlob().getDataAsString() || '{}');
  return { roster: [], tasks: [] };
}
function save_(db) {
  var s = JSON.stringify(db), it = DriveApp.getFilesByName(FILE_NAME);
  if (it.hasNext()) it.next().setContent(s); else DriveApp.createFile(FILE_NAME, s, 'application/json');
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function find_(db, code) {
  code = String(code || '').toUpperCase();
  for (var i = 0; i < db.roster.length; i++) if (String(db.roster[i].code).toUpperCase() === code) return db.roster[i];
  return null;
}
// ማን ምን ያያል — ደንቡ እዚህ በሰርቨር ላይ ነው የሚተገበረው
function canSee_(p, t) {
  if (p.role === 'office') return true;
  return t.by === p.code || (t.assignees || []).indexOf(p.code) !== -1;
}
function scopePeople_(db, p) {
  return db.roster.filter(function (x) {
    return p.role === 'office' || x.code === p.code || (p.role === 'head' && x.boss === p.code);
  }).map(function (x) { return { code: x.code, name: x.name, role: x.role, dept: x.dept }; });
}
function auth_(db, code, pin) {
  var p = find_(db, code);
  if (!p) return { err: 'ኮዱ አልተገኘም' };
  if (!p.pin) return { err: 'nopin', p: p };
  if (p.pin !== pin) return { err: 'PIN ትክክል አይደለም' };
  return { p: p };
}

function doGet(e) {
  var q = e.parameter || {};
  if (q.type !== 'wlist') return out_({ ok: true, hello: 'work-script' });
  var db = load_(), a = auth_(db, q.code, q.pin);
  if (a.err) return out_({ ok: false, error: a.err, name: a.p && a.p.name });
  var p = a.p;
  return out_({
    ok: true,
    me: { code: p.code, name: p.name, role: p.role, dept: p.dept },
    people: scopePeople_(db, p),
    tasks: db.tasks.filter(function (t) { return canSee_(p, t); })
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var b = JSON.parse(e.postData.contents), db = load_(), now = new Date().toISOString();
    if (b.type === 'a_roster' || b.type === 'a_resetpin') {
      if (b.admin !== ADMIN_KEY) return out_({ ok: false, error: 'ያልተፈቀደ' });
      if (b.type === 'a_resetpin') { var r = find_(db, b.code); if (r) delete r.pin; }
      else b.roster.forEach(function (n) {
        var old = find_(db, n.code);
        if (old) { old.name = n.name; old.role = n.role; old.dept = n.dept; old.boss = n.boss; }
        else db.roster.push({ code: String(n.code).toUpperCase(), name: n.name, role: n.role, dept: n.dept, boss: n.boss });
      });
      save_(db); return out_({ ok: true });
    }
    if (b.type === 'w_setpin') {
      var s = find_(db, b.code);
      if (!s) return out_({ ok: false, error: 'ኮዱ አልተገኘም' });
      if (s.pin) return out_({ ok: false, error: 'PIN አስቀድሞ ተፈጥሯል — ጽሕፈት ቤቱን ያናግሩ' });
      s.pin = b.pin; save_(db); return out_({ ok: true });
    }
    var a = auth_(db, b.code, b.pin);
    if (a.err) return out_({ ok: false, error: a.err });
    var p = a.p;
    if (b.type === 'w_task') {
      if (p.role === 'sub') return out_({ ok: false, error: 'አይፈቀድም' });
      var allowed = scopePeople_(db, p).map(function (x) { return x.code; });
      var as = (b.assignees || []).filter(function (c) { return allowed.indexOf(c) !== -1; });
      db.tasks.push({ id: 'T' + Date.now(), by: p.code, byName: p.name, dept: p.dept, title: String(b.title || '').slice(0, 200),
        note: String(b.note || '').slice(0, 2000), due: b.due || '', assignees: as, status: 'open', ts: now, comments: [] });
    } else {
      var t = db.tasks.filter(function (x) { return x.id === b.id; })[0];
      if (!t || !canSee_(p, t)) return out_({ ok: false, error: 'አልተገኘም' });
      if (b.type === 'w_status') {
        if (['open', 'doing', 'done'].indexOf(b.status) === -1) return out_({ ok: false, error: 'የተሳሳተ ሁኔታ' });
        t.status = b.status;
      } else if (b.type === 'w_comment') {
        t.comments.push({ by: p.name, text: String(b.text || '').slice(0, 1000), ts: now });
      } else return out_({ ok: false, error: 'unknown' });
    }
    save_(db); return out_({ ok: true });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
  finally { lock.releaseLock(); }
}
