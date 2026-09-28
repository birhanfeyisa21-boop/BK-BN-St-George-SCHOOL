// SCRIPT 1 — Backup + "reader device" full mirror
// (extends the backup script from before: adds "pull" so a second phone
//  can fetch the latest shared backup using the same transfer code)
var SECRET_KEY = "ይህንን_ይቀይሩት_ወደ_የራስዎ_ሚስጥር_ቃል";
var FOLDER_NAME = "BKBN ምትኬዎች";
var SHARED_FILE = "bkbn-shared-latest.json"; // the one file "reader" devices pull

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.key !== SECRET_KEY) return out({ ok: false, err: "bad key" });
    var folder = getFolder();

    if (body.action === "pull") {
      var files = folder.getFilesByName(SHARED_FILE);
      if (!files.hasNext()) return out({ ok: false, err: "no shared data yet" });
      return out({ ok: true, content: files.next().getBlob().getDataAsString() });
    }

    // default: "push" — save a dated backup AND overwrite the one "latest" file readers pull
    var name = "bkbn-backup-" + Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd_HH-mm") + ".json";
    folder.createFile(name, body.content, MimeType.PLAIN_TEXT);
    var existing = folder.getFilesByName(SHARED_FILE);
    while (existing.hasNext()) existing.next().setTrashed(true);
    folder.createFile(SHARED_FILE, body.content, MimeType.PLAIN_TEXT);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, err: String(err) });
  }
}
function getFolder() {
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
}
function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
