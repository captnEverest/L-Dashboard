// ============================================================
//  L-Dashboard — Code.gs
//  Google Apps Script backend
//  Deploy as: Web app → Execute as "Me" → Access "Anyone"
// ============================================================

var SHEET_DAILY_CHECKIN  = "daily_checkin";
var SHEET_HABITS         = "habits";
var SHEET_SUPPLEMENTS    = "supplements";
var SHEET_WORKOUTS       = "workouts";
var SHEET_BODY_COMP      = "body_composition";

var COLUMNS = {
  daily_checkin:    ["date", "weight", "water_oz", "sleep_hrs", "sleep_quality", "calories", "food_log", "notes"],
  habits:           ["date", "habit_name", "completed"],
  supplements:      ["date", "supplement_name", "taken"],
  workouts:         ["date", "type", "duration_min", "intensity", "muscle_groups", "exercises_json", "notes"],
  body_composition: ["date", "weight_lbs", "body_fat_pct", "chest_in", "waist_in", "hips_in", "arm_left_in", "arm_right_in", "thigh_left_in", "thigh_right_in", "notes"],
};

// ── Helpers ───────────────────────────────────────────────────

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(sheet_name) {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(sheet_name);
  if (!sheet) {
    sheet = ss.insertSheet(sheet_name);
    var headers = COLUMNS[sheet_name];
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

function sheetToObjects(sheet_name) {
  var sheet = getSheet(sheet_name);
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) { return []; }

  var headers = data[0];
  var rows    = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    rows.push(obj);
  }
  return rows;
}

function toISODate(val) {
  if (!val) { return ""; }
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = String(val.getMonth() + 1).padStart(2, "0");
    var d = String(val.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  return String(val);
}

function normalizeRows(rows) {
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].date) { rows[i].date = toISODate(rows[i].date); }
  }
  return rows;
}

function appendRow(sheet_name, data_obj) {
  var sheet      = getSheet(sheet_name);
  var headers    = COLUMNS[sheet_name];
  var row_values = headers.map(function(col) {
    var val = data_obj[col];
    return val !== undefined && val !== null ? val : "";
  });
  sheet.appendRow(row_values);
}

function findRowIndexByDate(sheet, target_date) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (toISODate(data[i][0]) === target_date) { return i + 1; }
  }
  return -1;
}

function updateRowByDate(sheet_name, data_obj) {
  var sheet       = getSheet(sheet_name);
  var headers     = COLUMNS[sheet_name];
  var target_date = toISODate(data_obj["date"] || "");
  var row_index   = findRowIndexByDate(sheet, target_date);

  if (row_index === -1) {
    appendRow(sheet_name, data_obj);
    return { status: "ok", action: "inserted" };
  }

  var row_values = headers.map(function(col) {
    var val = data_obj[col];
    return val !== undefined && val !== null ? val : "";
  });
  sheet.getRange(row_index, 1, 1, row_values.length).setValues([row_values]);
  return { status: "ok", action: "updated" };
}

function upsertNamedRow(sheet_name, data_obj, name_col) {
  var sheet       = getSheet(sheet_name);
  var headers     = COLUMNS[sheet_name];
  var data        = sheet.getDataRange().getValues();
  var target_date = toISODate(data_obj["date"] || "");
  var target_name = data_obj[name_col] || "";

  for (var i = 1; i < data.length; i++) {
    var row_date = toISODate(data[i][0]);
    var row_name = data[i][1];
    if (row_date === target_date && String(row_name) === String(target_name)) {
      var row_values = headers.map(function(col) {
        var val = data_obj[col];
        return val !== undefined && val !== null ? val : "";
      });
      sheet.getRange(i + 1, 1, 1, row_values.length).setValues([row_values]);
      return { status: "ok", action: "updated" };
    }
  }

  appendRow(sheet_name, data_obj);
  return { status: "ok", action: "inserted" };
}

// ── doGet ─────────────────────────────────────────────────────

function doGet(e) {
  try {
    var params      = e.parameter;
    var sheet_name  = params.sheet || "";
    var date_filter = params.date || null;
    var limit       = params.limit ? Number(params.limit) : null;

    if (!COLUMNS[sheet_name]) {
      return jsonResponse({ error: "Unknown sheet: " + sheet_name });
    }

    var rows = sheetToObjects(sheet_name);
    rows     = normalizeRows(rows);

    if (date_filter) {
      rows = rows.filter(function(row) { return row.date === date_filter; });
      if (sheet_name === SHEET_DAILY_CHECKIN) {
        return jsonResponse(rows.length > 0 ? rows[0] : null);
      }
      return jsonResponse(rows);
    }

    if (limit && limit > 0 && rows.length > limit) {
      rows = rows.slice(rows.length - limit);
    }

    return jsonResponse(rows);
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

// ── doPost ────────────────────────────────────────────────────

function doPost(e) {
  try {
    var body       = JSON.parse(e.postData.contents);
    var sheet_name = body.sheet || "";
    var data       = body.data;
    var method     = body._method || "POST";

    if (!COLUMNS[sheet_name]) {
      return jsonResponse({ error: "Unknown sheet: " + sheet_name });
    }

    // toggle (supplement badge click from dashboard)
    if (method === "TOGGLE") {
      return jsonResponse(upsertNamedRow(sheet_name, data, "supplement_name"));
    }

    // PUT — update row by date (works for daily_checkin, workouts, body_composition)
    if (method === "PUT") {
      return jsonResponse(updateRowByDate(sheet_name, data));
    }

    // POST — new entry
    if (sheet_name === SHEET_DAILY_CHECKIN || sheet_name === SHEET_WORKOUTS || sheet_name === SHEET_BODY_COMP) {
      appendRow(sheet_name, data);
      return jsonResponse({ status: "ok", action: "inserted" });
    }

    if (sheet_name === SHEET_SUPPLEMENTS) {
      if (Array.isArray(data)) {
        data.forEach(function(item) { upsertNamedRow(SHEET_SUPPLEMENTS, item, "supplement_name"); });
      } else {
        upsertNamedRow(SHEET_SUPPLEMENTS, data, "supplement_name");
      }
      return jsonResponse({ status: "ok" });
    }

    if (sheet_name === SHEET_HABITS) {
      if (Array.isArray(data)) {
        data.forEach(function(item) { upsertNamedRow(SHEET_HABITS, item, "habit_name"); });
      } else {
        upsertNamedRow(SHEET_HABITS, data, "habit_name");
      }
      return jsonResponse({ status: "ok" });
    }

    return jsonResponse({ error: "Unhandled sheet/method combination" });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}
