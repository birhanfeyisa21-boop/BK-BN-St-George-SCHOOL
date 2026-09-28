// SCRIPT 2 — Messaging + public content (a SEPARATE Apps Script/deployment
// from the backup one, on purpose — its key is not truly secret, since
// every phone needs it, so it must never be the same key that protects backups)
var MSG_KEY = "ይህንን_ይቀይሩት_የመልእክት_ሚስጥር_ቃል";
var FOLDER_NAME = "BKBN መልእክት";
var PUBLIC_FILE = "bkbn-public.json";     // {roster, lessons, documents} — owner publishes this
var MESSAGES_FILE = "bkbn-messages.json"; // growing array of messages
var MAX_MESSAGES = 500;

function doGet(e) {
  var type = e.parameter.type, key = e.parameter.key;
  if (key !== MSG_KEY) return out({ ok: false, err: "bad key" });
  if (type === "public") {
    var f = readFile(PUBLIC_FILE);
    return out({ ok: true, content: f || "{}" });
  }
  if (type === "messages") {
    return out({ ok: true, messages: readJson(MESSAGES_FILE, []) });
  }
  return out({ ok: false, err: "unknown type" });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.key !== MSG_KEY) return out({ ok: false, err: "bad key" });

    if (body.type === "publish") {
      writeFile(PUBLIC_FILE, body.content);
      return out({ ok: true });
    }

    if (body.type === "set_pin") {
      var lock = LockService.getScriptLock(); lock.waitLock(10000);
      try {
        var pub = readJson(PUBLIC_FILE, { roster: [], lessons: [], documents: [] });
        var found = false;
        (pub.roster || []).forEach(function (r) {
          if (r.code === body.code) { r.pinHash = body.pinHash; found = true; }
        });
        if (found) writeFile(PUBLIC_FILE, JSON.stringify(pub));
        return out({ ok: found });
      } finally { lock.releaseLock(); }
    }

    if (body.type === "message") {
      var lock2 = LockService.getScriptLock(); lock2.waitLock(10000);
      try {
        var msgs = readJson(MESSAGES_FILE, []);
        msgs.push({
          sender: body.sender, senderCode: body.senderCode, senderGroup: body.senderGroup,
          target: body.target, text: body.text, ts: Date.now()
        });
        if (msgs.length > MAX_MESSAGES) msgs = msgs.slice(msgs.length - MAX_MESSAGES);
        writeFile(MESSAGES_FILE, JSON.stringify(msgs));
        return out({ ok: true });
      } finally { lock2.releaseLock(); }
    }

    return out({ ok: false, err: "unknown type" });
  } catch (err) {
    return out({ ok: false, err: String(err) });
  }
}

function getFolder() {
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
}
function readFile(name) {
  var files = getFolder().getFilesByName(name);
  return files.hasNext() ? files.next().getBlob().getDataAsString() : null;
}
function readJson(name, fallback) {
  var s = readFile(name);
  try { return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; }
}
function writeFile(name, content) {
  var folder = getFolder();
  var existing = folder.getFilesByName(name);
  while (existing.hasNext()) existing.next().setTrashed(true);
  folder.createFile(name, content, MimeType.PLAIN_TEXT);
}
function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
