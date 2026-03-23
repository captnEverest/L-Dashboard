// ============================================================
//  L-Dashboard — Code.gs
//  Google Apps Script backend
//  Deploy as: Web app → Execute as "Me" → Access "Anyone"
// ============================================================

// sheet tab names
var SHEET_DAILY_CHECKIN = "daily_checkin";
var SHEET_HABITS        = "habits";
var SHEET_SUPPLEMENTS   = "supplements";

// column order for each sheet
var COLUMNS = {
  daily_checkin: ["date", "weight", "water_oz", "sleep_hrs", "sleep_quality", "calories", "notes"],
  habits:        ["date", "habit_name", "completed"],
  supplements:   ["date", "supplement_name", "taken"],
};

// ── CORS headers ─────────────────────────────────────────────

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, statusCode) {
  var output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── Helpers ───────────────────────────────────────────────────

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(sheet_name) {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(sheet_name);
  if (!sheet) {
    sheet = ss.insertSheet(sheet_name);
    // write header row
    var headers = COLUMNS[sheet_name];
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

// read all rows from a sheet and return as array of objects
function sheetToObjects(sheet_name) {
  var sheet = getSheet(sheet_name);
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return [];
  }

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

// convert a date cell value to ISO string YYYY-MM-DD
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

// normalize all row dates to ISO strings
function normalizeRows(rows) {
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].date) {
      rows[i].date = toISODate(rows[i].date);
    }
  }
  return rows;
}

// append a single data object as a new row
function appendRow(sheet_name, data_obj) {
  var sheet   = getSheet(sheet_name);
  var headers = COLUMNS[sheet_name];
  var row_values = headers.map(function(col) {
    var val = data_obj[col];
    return val !== undefined && val !== null ? val : "";
  });
  sheet.appendRow(row_values);
}

// find the 1-based row index (including header) where column "date" matches target_date
function findRowIndexByDate(sheet, target_date) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var row_date = toISODate(data[i][0]); // date is always column 0
    if (row_date === target_date) {
      return i + 1; // 1-based
    }
  }
  return -1;
}

// update a row matched by date
function updateRowByDate(sheet_name, data_obj) {
  var sheet      = getSheet(sheet_name);
  var headers    = COLUMNS[sheet_name];
  var target_date = toISODate(data_obj["date"] || "");
  var row_index  = findRowIndexByDate(sheet, target_date);

  if (row_index === -1) {
    // no existing row — append instead
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

// upsert a supplement or habit row (match by date + name)
function upsertNamedRow(sheet_name, data_obj, name_col) {
  var sheet       = getSheet(sheet_name);
  var headers     = COLUMNS[sheet_name];
  var data        = sheet.getDataRange().getValues();
  var target_date  = toISODate(data_obj["date"] || "");
  var target_name  = data_obj[name_col] || "";

  for (var i = 1; i < data.length; i++) {
    var row_date = toISODate(data[i][0]);
    var row_name = data[i][1]; // name is always column 1 in habits/supplements
    if (row_date === target_date && String(row_name) === String(target_name)) {
      var row_values = headers.map(function(col) {
        var val = data_obj[col];
        return val !== undefined && val !== null ? val : "";
      });
      sheet.getRange(i + 1, 1, 1, row_values.length).setValues([row_values]);
      return { status: "ok", action: "updated" };
    }
  }

  // not found — insert
  appendRow(sheet_name, data_obj);
  return { status: "ok", action: "inserted" };
}

// ── doGet ─────────────────────────────────────────────────────

function doGet(e) {
  try {
    var params     = e.parameter;
    var sheet_name = params.sheet || "";
    var date_filter = params.date || null;
    var limit      = params.limit ? Number(params.limit) : null;

    if (!COLUMNS[sheet_name]) {
      return jsonResponse({ error: "Unknown sheet: " + sheet_name });
    }

    var rows = sheetToObjects(sheet_name);
    rows     = normalizeRows(rows);

    // filter by exact date if requested
    if (date_filter) {
      rows = rows.filter(function(row) {
        return row.date === date_filter;
      });
      // for daily_checkin, return the single object (or null)
      if (sheet_name === SHEET_DAILY_CHECKIN) {
        return jsonResponse(rows.length > 0 ? rows[0] : null);
      }
      return jsonResponse(rows);
    }

    // apply limit (most recent N rows)
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
    var method     = body._method || "POST"; // supports PUT tunneled through POST

    if (!COLUMNS[sheet_name]) {
      return jsonResponse({ error: "Unknown sheet: " + sheet_name });
    }

    // ── handle TOGGLE (supplement click from dashboard)
    if (method === "TOGGLE") {
      var result = upsertNamedRow(sheet_name, data, "supplement_name");
      return jsonResponse(result);
    }

    // ── handle PUT (edit existing check-in)
    if (method === "PUT") {
      if (sheet_name === SHEET_DAILY_CHECKIN) {
        var result = updateRowByDate(sheet_name, data);
        return jsonResponse(result);
      }
    }

    // ── handle POST (new data)
    if (sheet_name === SHEET_DAILY_CHECKIN) {
      // single object
      appendRow(sheet_name, data);
      return jsonResponse({ status: "ok", action: "inserted" });
    }

    if (sheet_name === SHEET_SUPPLEMENTS) {
      // array of supplement objects
      if (Array.isArray(data)) {
        data.forEach(function(item) {
          upsertNamedRow(SHEET_SUPPLEMENTS, item, "supplement_name");
        });
      } else {
        upsertNamedRow(SHEET_SUPPLEMENTS, data, "supplement_name");
      }
      return jsonResponse({ status: "ok" });
    }

    if (sheet_name === SHEET_HABITS) {
      // array of habit objects
      if (Array.isArray(data)) {
        data.forEach(function(item) {
          upsertNamedRow(SHEET_HABITS, item, "habit_name");
        });
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
