/* ============================================================
   L-Dashboard — app.js  (Phase 1 + 2)
   ============================================================ */

"use strict";

// ── Config & localStorage ────────────────────────────────────

const CONFIG_KEY = "l_dashboard_config";

function getConfig() {
  try {
    const overrides = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    const merged    = { ...CONFIG };
    if (overrides.APPS_SCRIPT_URL)   { merged.APPS_SCRIPT_URL   = overrides.APPS_SCRIPT_URL; }
    if (overrides.ANTHROPIC_API_KEY) { merged.ANTHROPIC_API_KEY = overrides.ANTHROPIC_API_KEY; }
    if (overrides.DAILY_GOALS)       { merged.DAILY_GOALS       = { ...CONFIG.DAILY_GOALS, ...overrides.DAILY_GOALS }; }
    if (overrides.SUPPLEMENTS)       { merged.SUPPLEMENTS       = overrides.SUPPLEMENTS; }
    if (overrides.HABITS)            { merged.HABITS            = overrides.HABITS; }
    if (overrides.WORKOUT)           { merged.WORKOUT           = { ...CONFIG.WORKOUT, ...overrides.WORKOUT }; }
    return merged;
  } catch (e) {
    return CONFIG;
  }
}

function saveOverride(key, value) {
  const overrides = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
  overrides[key]  = value;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(overrides));
}

// ── Utilities ────────────────────────────────────────────────

function todayISO() {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const d   = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoToDisplay(iso) {
  if (!iso) { return ""; }
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function isoToShort(iso) {
  if (!iso) { return ""; }
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function allSupplements() {
  const cfg = getConfig();
  return [...cfg.SUPPLEMENTS.morning, ...cfg.SUPPLEMENTS.evening];
}

function getTargetDate() {
  const params = new URLSearchParams(window.location.search);
  const raw    = params.get("date");
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) { return raw; }
  return todayISO();
}

function thisWeekStart() {
  const today = new Date();
  const dow   = today.getDay();
  const diff  = dow === 0 ? 6 : dow - 1; // days since Monday
  const mon   = new Date(today);
  mon.setDate(today.getDate() - diff);
  const y = mon.getFullYear();
  const m = String(mon.getMonth() + 1).padStart(2, "0");
  const d = String(mon.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateMinusDays(iso, days) {
  const [y, m, d] = iso.split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  dt.setDate(dt.getDate() - days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function daysBetween(iso_a, iso_b) {
  const [ay, am, ad] = iso_a.split("-").map(Number);
  const [by, bm, bd] = iso_b.split("-").map(Number);
  const a = new Date(ay, am - 1, ad);
  const b = new Date(by, bm - 1, bd);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function calcWorkoutStreak(workout_rows) {
  const date_set = new Set();
  workout_rows.forEach((r) => {
    if (r.date) { date_set.add(String(r.date).slice(0, 10)); }
  });

  let streak       = 0;
  const cursor     = new Date();
  if (!date_set.has(todayISO())) { cursor.setDate(cursor.getDate() - 1); }

  while (true) {
    const y   = cursor.getFullYear();
    const m   = String(cursor.getMonth() + 1).padStart(2, "0");
    const d   = String(cursor.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    if (!date_set.has(iso)) { break; }
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ── API layer ────────────────────────────────────────────────

async function apiFetch(params) {
  const cfg = getConfig();
  if (!cfg.APPS_SCRIPT_URL || cfg.APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
    console.warn("L-Dashboard: APPS_SCRIPT_URL not configured");
    return null;
  }
  const url = new URL(cfg.APPS_SCRIPT_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const res = await fetch(url.toString());
    if (!res.ok) { throw new Error(`HTTP ${res.status}`); }
    return await res.json();
  } catch (err) {
    console.error("apiFetch:", err);
    return null;
  }
}

async function apiPost(body) {
  const cfg = getConfig();
  if (!cfg.APPS_SCRIPT_URL || cfg.APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
    return null;
  }
  try {
    const res = await fetch(cfg.APPS_SCRIPT_URL, {
      method:  "POST",
      headers: { "Content-Type": "text/plain" },
      body:    JSON.stringify(body),
    });
    if (!res.ok) { throw new Error(`HTTP ${res.status}`); }
    return await res.json();
  } catch (err) {
    console.error("apiPost:", err);
    return null;
  }
}

// check-in
async function fetchCheckinByDate(date)    { return apiFetch({ sheet: "daily_checkin", date }); }
async function fetchRecentCheckins(days)   { return apiFetch({ sheet: "daily_checkin", limit: days }); }
async function fetchCheckinDates()         { return apiFetch({ sheet: "daily_checkin", limit: 120 }); }
async function fetchSupplementsByDate(date){ return apiFetch({ sheet: "supplements", date }); }
async function fetchHabitsByDate(date)     { return apiFetch({ sheet: "habits", date }); }
async function fetchRecentHabits(days)     { return apiFetch({ sheet: "habits", limit: days }); }
async function upsertCheckin(data, exists) { return apiPost({ sheet: "daily_checkin", data, _method: exists ? "PUT" : "POST" }); }
async function upsertSupplements(arr)      { return apiPost({ sheet: "supplements", data: arr }); }
async function upsertHabits(arr)           { return apiPost({ sheet: "habits", data: arr }); }
async function toggleSupplement(name, taken, date) {
  return apiPost({ sheet: "supplements", _method: "TOGGLE", data: { date, supplement_name: name, taken } });
}

// workouts
async function fetchWorkoutHistory(days)         { return apiFetch({ sheet: "workouts", limit: days }); }
async function fetchWorkoutByDate(date)          { return apiFetch({ sheet: "workouts", date }); }
async function postWorkoutEntry(data)            { return apiPost({ sheet: "workouts", data, _method: "POST" }); }
async function putWorkoutEntry(data)             { return apiPost({ sheet: "workouts", data, _method: "PUT" }); }

// body composition
async function fetchBodyComposition()            { return apiFetch({ sheet: "body_composition", limit: 200 }); }
async function fetchBodyCompByDate(date)         { return apiFetch({ sheet: "body_composition", date }); }
async function postBodyCompEntry(data)           { return apiPost({ sheet: "body_composition", data, _method: "POST" }); }
async function putBodyCompEntry(data)            { return apiPost({ sheet: "body_composition", data, _method: "PUT" }); }

// ── AI calorie estimation ─────────────────────────────────────

async function estimateCaloriesWithAI(food_log_text) {
  const api_key = getConfig().ANTHROPIC_API_KEY;
  if (!api_key) { return null; }

  const prompt = `Estimate the total calories in this meal log. Return ONLY a JSON object like: {"calories": 1850, "note": "rough estimate"}. No other text.\n\nMeal log:\n${food_log_text}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         api_key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages:   [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) { throw new Error(`Anthropic ${res.status}`); }
    const data   = await res.json();
    const parsed = JSON.parse(data.content[0].text.trim());
    return parsed;
  } catch (err) {
    console.error("AI estimate error:", err);
    return null;
  }
}

// ── Chart helpers ─────────────────────────────────────────────

function chartColors() {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    text:  dark ? "#9A9890" : "#6B6B6B",
    grid:  dark ? "#2A2D38" : "#E8E7E2",
    green: "#2D9E6B",
    amber: "#E8A838",
  };
}

const CHART_PALETTE = ["#2D9E6B", "#E8A838", "#5B9BD5", "#C94F4F", "#E8784A", "#5BAA8C", "#CF7A40"];

const MEASUREMENT_COLORS = {
  "Chest":       "#2D9E6B",
  "Waist":       "#E8A838",
  "Hips":        "#5B9BD5",
  "Left Arm":    "#C94F4F",
  "Right Arm":   "#E8784A",
  "Left Thigh":  "#5BAA8C",
  "Right Thigh": "#CF7A40",
};

const MUSCLE_COLORS = {
  "Chest":     "#2D9E6B",
  "Back":      "#E8A838",
  "Shoulders": "#5B9BD5",
  "Arms":      "#C94F4F",
  "Core":      "#E8784A",
  "Legs":      "#5BAA8C",
  "Full Body": "#CF7A40",
};

function makeLineChart(canvas, labels, values, unit, color) {
  const c     = chartColors();
  const col   = color || c.green;
  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data:                 values,
        borderColor:          col,
        backgroundColor:      "transparent",
        pointBackgroundColor: col,
        pointRadius:          3,
        pointHoverRadius:     5,
        borderWidth:          2,
        tension:              0.35,
        spanGaps:             true,
      }],
    },
    options: {
      animation:           { duration: 600, easing: "easeOutQuart" },
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend:  { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} ${unit}` } },
      },
      scales: {
        x: { ticks: { color: c.text, font: { family: "'DM Mono'", size: 10 }, maxTicksLimit: 7 }, grid: { color: c.grid } },
        y: { ticks: { color: c.text, font: { family: "'DM Mono'", size: 10 } }, grid: { color: c.grid } },
      },
    },
  });
}

function makeBarChart(canvas, labels, values, unit, color_key) {
  const c     = chartColors();
  const color = color_key === "amber" ? c.amber : c.green;
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data:            values,
        backgroundColor: color + "99",
        borderColor:     color,
        borderWidth:     1,
        borderRadius:    4,
      }],
    },
    options: {
      animation:           { duration: 600, easing: "easeOutQuart" },
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend:  { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} ${unit}` } },
      },
      scales: {
        x: { ticks: { color: c.text, font: { family: "'DM Mono'", size: 10 } }, grid: { display: false } },
        y: { ticks: { color: c.text, font: { family: "'DM Mono'", size: 10 } }, grid: { color: c.grid }, suggestedMin: 0 },
      },
    },
  });
}

// ── Calendar widget ───────────────────────────────────────────

function buildCalendar(container, checkin_rows) {
  const has_checkin = new Set();
  if (checkin_rows && Array.isArray(checkin_rows)) {
    checkin_rows.forEach((row) => {
      if (row.date) { has_checkin.add(String(row.date).slice(0, 10)); }
    });
  }

  const today     = new Date();
  const today_iso = todayISO();
  const months    = [];

  for (let offset = 3; offset >= 0; offset--) {
    const d = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  let html = '<div class="cal-grid">';

  months.forEach(({ year, month }) => {
    const month_name = new Date(year, month, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const first_dow  = new Date(year, month, 1).getDay();
    const days_in    = new Date(year, month + 1, 0).getDate();

    html += `<div class="cal-month">`;
    html += `<div class="cal-month-label">${month_name}</div>`;
    html += `<div class="cal-week-row">`;
    ["S","M","T","W","T","F","S"].forEach((dl) => { html += `<span class="cal-dow">${dl}</span>`; });
    html += `</div><div class="cal-days">`;

    for (let i = 0; i < first_dow; i++) {
      html += `<span class="cal-cell cal-cell--empty"></span>`;
    }
    for (let day = 1; day <= days_in; day++) {
      const iso      = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const filled   = has_checkin.has(iso);
      const is_today = iso === today_iso;
      const future   = iso > today_iso;

      let cls = "cal-cell";
      if (filled)   { cls += " cal-cell--filled"; }
      if (is_today) { cls += " cal-cell--today"; }
      if (future)   { cls += " cal-cell--future"; }

      html += `<a class="${cls}" href="checkin.html?date=${iso}" title="${iso}">${day}</a>`;
    }
    html += `</div></div>`;
  });

  html += "</div>";
  container.innerHTML = html;
}

// ── Dashboard page ────────────────────────────────────────────

async function initDashboard() {
  if (!document.getElementById("dashboard-root")) { return; }

  const cfg     = getConfig();
  const date_el = document.getElementById("dashboard-date");
  if (date_el) { date_el.textContent = isoToDisplay(todayISO()); }

  const [today_data, recent_data, today_supps, today_habits, recent_habits, all_checkins] = await Promise.all([
    fetchCheckinByDate(todayISO()),
    fetchRecentCheckins(14),
    fetchSupplementsByDate(todayISO()),
    fetchHabitsByDate(todayISO()),
    fetchRecentHabits(30),
    fetchCheckinDates(),
  ]);

  renderSummaryCards(today_data, recent_data, cfg);
  renderCharts(recent_data);
  renderSupplementBadges(today_supps);
  renderHabitSummary(today_habits, cfg);
  renderHabitTrendBars(recent_habits, cfg);

  const cal_el = document.getElementById("calendar-container");
  if (cal_el) { buildCalendar(cal_el, all_checkins); }
}

function renderSummaryCards(today_row, recent_rows, cfg) {
  const weight_card = document.getElementById("card-weight");
  if (weight_card) {
    let weight_value = "—";
    let delta_html   = "";
    if (today_row && today_row.weight) {
      const wt = Number(today_row.weight);
      weight_value = wt.toFixed(1);
      const yesterday = (recent_rows || [])
        .filter((r) => r.date !== todayISO() && r.weight)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      if (yesterday) {
        const delta = wt - Number(yesterday.weight);
        if (Math.abs(delta) > 0.05) {
          const sign = delta > 0 ? "▲" : "▼";
          const cls  = delta > 0 ? "delta--up" : "delta--down";
          delta_html = `<span class="delta ${cls}">${sign}${Math.abs(delta).toFixed(1)}</span>`;
        } else {
          delta_html = `<span class="delta delta--flat">→</span>`;
        }
      }
    }
    weight_card.innerHTML = `<div class="card-label">Weight</div><div class="card-value">${weight_value}<span style="font-size:.85rem"> lbs</span>${delta_html}</div>`;
  }

  const water_card = document.getElementById("card-water");
  if (water_card) {
    const oz   = today_row ? Number(today_row.water_oz) || 0 : 0;
    const goal = cfg.DAILY_GOALS.water_oz;
    const pct  = clamp(Math.round((oz / goal) * 100), 0, 100);
    water_card.innerHTML = `<div class="card-label">Water</div><div class="card-value card-value--sm">${oz > 0 ? oz : "—"}<span style="font-size:.85rem"> oz</span></div><div class="progress-wrap"><div class="progress-bar"><div class="progress-bar__fill" style="width:${pct}%"></div></div><div class="card-meta">${pct}% of ${goal} oz</div></div>`;
  }

  const sleep_card = document.getElementById("card-sleep");
  if (sleep_card) {
    const hrs     = today_row ? Number(today_row.sleep_hrs) || 0 : 0;
    const quality = today_row ? Number(today_row.sleep_quality) || 0 : 0;
    const stars   = quality > 0 ? "★".repeat(quality) + "☆".repeat(5 - quality) : "—";
    sleep_card.innerHTML = `<div class="card-label">Sleep</div><div class="card-value card-value--sm">${hrs > 0 ? hrs : "—"}<span style="font-size:.85rem"> hrs</span></div><div class="card-meta">${stars}</div>`;
  }

  const cal_card = document.getElementById("card-calories");
  if (cal_card) {
    const cals    = today_row ? Number(today_row.calories) || 0 : 0;
    const goal    = cfg.DAILY_GOALS.calories;
    const pct     = clamp(Math.round((cals / goal) * 100), 0, 100);
    cal_card.innerHTML = `<div class="card-label">Calories</div><div class="card-value card-value--sm">${cals > 0 ? cals.toLocaleString() : "—"}</div><div class="progress-wrap"><div class="progress-bar"><div class="progress-bar__fill progress-bar__fill--amber" style="width:${pct}%"></div></div><div class="card-meta">${pct}% of ${goal.toLocaleString()}</div></div>`;
  }

  const workout_card = document.getElementById("card-workout");
  if (workout_card) {
    const notes  = today_row && today_row.notes ? today_row.notes.toLowerCase() : "";
    const logged = notes.includes("workout") || notes.includes("gym") || notes.includes("run");
    workout_card.innerHTML = `<div class="card-label">Workout</div><div class="card-value card-value--sm" style="font-size:1rem;padding-top:4px;">${logged ? '<span class="pill pill--green">✓ logged</span>' : '<span class="pill pill--grey">not logged</span>'}</div>`;
  }
}

function renderCharts(recent_rows) {
  const weight_canvas = document.getElementById("chart-weight");
  const sleep_canvas  = document.getElementById("chart-sleep");
  const water_canvas  = document.getElementById("chart-water");

  if (!recent_rows || recent_rows.length === 0) {
    const msg = '<p class="state-error" style="margin-top:8px;">No data yet.</p>';
    if (weight_canvas) { weight_canvas.insertAdjacentHTML("afterend", msg); weight_canvas.remove(); }
    if (sleep_canvas)  { sleep_canvas.insertAdjacentHTML("afterend", msg);  sleep_canvas.remove(); }
    if (water_canvas)  { water_canvas.insertAdjacentHTML("afterend", msg);  water_canvas.remove(); }
    return;
  }

  const sorted = [...recent_rows]
    .filter((r) => r.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-14);

  const labels = sorted.map((r) => isoToShort(String(r.date).slice(0, 10)));
  const w_vals = sorted.map((r) => Number(r.weight)    || null);
  const s_vals = sorted.map((r) => Number(r.sleep_hrs) || null);
  const a_vals = sorted.map((r) => Number(r.water_oz)  || null);

  if (weight_canvas) { makeLineChart(weight_canvas, labels, w_vals, "lbs"); }
  if (sleep_canvas)  { makeBarChart(sleep_canvas, labels.slice(-7), s_vals.slice(-7), "hrs", "green"); }
  if (water_canvas)  { makeBarChart(water_canvas, labels.slice(-7), a_vals.slice(-7), "oz", "amber"); }
}

function renderSupplementBadges(today_supp_rows) {
  const grid = document.getElementById("supplements-grid");
  if (!grid) { return; }

  const taken_set = new Set();
  if (today_supp_rows && Array.isArray(today_supp_rows)) {
    today_supp_rows.forEach((row) => {
      if (String(row.taken).toLowerCase() === "true" || row.taken === true) {
        taken_set.add(row.supplement_name);
      }
    });
  }

  grid.innerHTML = allSupplements().map((name) => {
    const cls = taken_set.has(name) ? " taken" : "";
    return `<span class="supp-badge${cls}" data-name="${name}">${name}</span>`;
  }).join("");

  grid.querySelectorAll(".supp-badge").forEach((badge) => {
    badge.addEventListener("click", async () => {
      const name     = badge.dataset.name;
      const is_taken = !badge.classList.contains("taken");
      badge.classList.toggle("taken", is_taken);
      await toggleSupplement(name, is_taken, todayISO());
    });
  });
}

function renderHabitSummary(today_habit_rows, cfg) {
  const card = document.getElementById("card-habits");
  if (!card) { return; }
  let done  = 0;
  const total = cfg.HABITS.length;
  if (today_habit_rows && Array.isArray(today_habit_rows)) {
    today_habit_rows.forEach((row) => {
      if (String(row.completed).toLowerCase() === "true" || row.completed === true) { done++; }
    });
  }
  card.innerHTML = `<div class="card-label">Habits</div><div class="card-value card-value--sm">${done}<span style="font-size:1rem"> / ${total}</span></div><div class="card-meta">completed today</div>`;
}

function renderHabitTrendBars(recent_habit_rows, cfg) {
  const container = document.getElementById("habit-trend-bars");
  if (!container) { return; }
  if (!recent_habit_rows || recent_habit_rows.length === 0) {
    container.innerHTML = '<p class="state-loading">No habit data yet.</p>';
    return;
  }

  const map      = {};
  const date_set = new Set();
  cfg.HABITS.forEach((h) => { map[h] = { done: 0, total: 0 }; });
  recent_habit_rows.forEach((row) => { if (row.date) { date_set.add(row.date); } });
  recent_habit_rows.forEach((row) => {
    if (map[row.habit_name] === undefined) { return; }
    map[row.habit_name].total++;
    if (String(row.completed).toLowerCase() === "true" || row.completed === true) { map[row.habit_name].done++; }
  });

  container.innerHTML = cfg.HABITS.map((habit) => {
    const days = map[habit].total || date_set.size || 1;
    const pct  = Math.round((map[habit].done / days) * 100);
    return `<div class="habit-bar-row"><span class="habit-bar-label">${habit}</span><div class="habit-bar-track"><div class="habit-bar-fill" style="width:${pct}%"></div></div><span class="habit-bar-pct">${pct}%</span></div>`;
  }).join("");
}

// ── Check-in page ─────────────────────────────────────────────

async function initCheckin() {
  if (!document.getElementById("checkin-root")) { return; }

  const cfg         = getConfig();
  const target_date = getTargetDate();
  const is_today    = target_date === todayISO();
  const date_el     = document.getElementById("checkin-date");
  if (date_el) { date_el.textContent = isoToDisplay(target_date) + (is_today ? " · Today" : ""); }

  buildSupplementCheckboxes(cfg);
  buildHabitCheckboxes(cfg);

  const [existing_checkin, existing_supps, existing_habits] = await Promise.all([
    fetchCheckinByDate(target_date),
    fetchSupplementsByDate(target_date),
    fetchHabitsByDate(target_date),
  ]);

  const entry_exists = !!(existing_checkin && existing_checkin.date);
  if (entry_exists) {
    prefillCheckinForm(existing_checkin);
    prefillSupplements(existing_supps, cfg);
    prefillHabits(existing_habits, cfg);
  }

  const submit_btn = document.getElementById("submit-btn");
  if (submit_btn) { submit_btn.textContent = entry_exists ? "Update Entry" : "Submit Check-in"; }

  const ai_btn = document.getElementById("ai-estimate-btn");
  if (ai_btn) {
    if (cfg.ANTHROPIC_API_KEY) {
      ai_btn.style.display = "inline-flex";
      ai_btn.addEventListener("click", async () => {
        const food_log  = document.getElementById("field-food-log");
        const cal_input = document.getElementById("field-calories");
        if (!food_log || !food_log.value.trim()) { return; }
        ai_btn.textContent = "Estimating…";
        ai_btn.disabled    = true;
        const result       = await estimateCaloriesWithAI(food_log.value.trim());
        ai_btn.textContent = "Estimate with AI";
        ai_btn.disabled    = false;
        if (result && result.calories && cal_input) {
          cal_input.value = result.calories;
          const note_el   = document.getElementById("ai-estimate-note");
          if (note_el) { note_el.textContent = result.note || ""; }
        }
      });
    } else {
      ai_btn.style.display = "none";
    }
  }

  const form = document.getElementById("checkin-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleCheckinSubmit(target_date, entry_exists, cfg);
    });
  }
}

function buildSupplementCheckboxes(cfg) {
  const container = document.getElementById("supplement-checks");
  if (!container) { return; }
  const groups = [
    { label: "Morning", items: cfg.SUPPLEMENTS.morning },
    { label: "Evening", items: cfg.SUPPLEMENTS.evening },
  ];
  container.innerHTML = groups.map(({ label, items }) => {
    const boxes = items.map((name) => {
      const id = suppId(name);
      return `<label class="check-item"><input type="checkbox" id="${id}" name="supplement" value="${name}"><span>${name}</span></label>`;
    }).join("");
    return `<div class="check-group"><div class="check-group-label">${label}</div>${boxes}</div>`;
  }).join("");
}

function buildHabitCheckboxes(cfg) {
  const container = document.getElementById("habit-checks");
  if (!container) { return; }
  container.innerHTML = cfg.HABITS.map((name) => {
    const id = habitId(name);
    return `<label class="check-item"><input type="checkbox" id="${id}" name="habit" value="${name}"><span>${name}</span></label>`;
  }).join("");
}

function suppId(name) {
  return `supp-${name.replace(/[\s()\/,.]/g, "-").replace(/-+/g, "-").toLowerCase()}`;
}

function habitId(name) {
  return `habit-${name.replace(/[\s()\/,.]/g, "-").replace(/-+/g, "-").toLowerCase()}`;
}

function prefillCheckinForm(data) {
  const set_val = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null && val !== "") { el.value = val; }
  };
  set_val("field-weight",   data.weight);
  set_val("field-water",    data.water_oz);
  set_val("field-sleep",    data.sleep_hrs);
  set_val("field-calories", data.calories);
  set_val("field-food-log", data.food_log);
  set_val("field-notes",    data.notes);
  const q = Number(data.sleep_quality);
  if (q >= 1 && q <= 5) {
    const star = document.getElementById(`star-${q}`);
    if (star) { star.checked = true; }
  }
}

function prefillSupplements(supp_rows, cfg) {
  if (!supp_rows || !Array.isArray(supp_rows)) { return; }
  supp_rows.forEach((row) => {
    if (String(row.taken).toLowerCase() === "true" || row.taken === true) {
      const el = document.getElementById(suppId(row.supplement_name));
      if (el) { el.checked = true; }
    }
  });
}

function prefillHabits(habit_rows, cfg) {
  if (!habit_rows || !Array.isArray(habit_rows)) { return; }
  habit_rows.forEach((row) => {
    if (String(row.completed).toLowerCase() === "true" || row.completed === true) {
      const el = document.getElementById(habitId(row.habit_name));
      if (el) { el.checked = true; }
    }
  });
}

function collectCheckinData(target_date, cfg) {
  const get_num = (id) => {
    const el = document.getElementById(id);
    return (el && el.value !== "") ? Number(el.value) : null;
  };
  const get_str = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  };
  let sleep_quality  = null;
  const checked_star = document.querySelector(".star-rating input:checked");
  if (checked_star) { sleep_quality = Number(checked_star.value); }

  const checkin_data = {
    date: target_date, weight: get_num("field-weight"), water_oz: get_num("field-water"),
    sleep_hrs: get_num("field-sleep"), sleep_quality, calories: get_num("field-calories"),
    food_log: get_str("field-food-log"), notes: get_str("field-notes"),
  };
  const supplement_data = allSupplements().map((name) => {
    const el = document.getElementById(suppId(name));
    return { date: target_date, supplement_name: name, taken: el ? el.checked : false };
  });
  const habit_data = cfg.HABITS.map((name) => {
    const el = document.getElementById(habitId(name));
    return { date: target_date, habit_name: name, completed: el ? el.checked : false };
  });
  return { checkin_data, supplement_data, habit_data };
}

async function handleCheckinSubmit(target_date, entry_exists, cfg) {
  const submit_btn    = document.getElementById("submit-btn");
  const result_banner = document.getElementById("result-banner");
  if (submit_btn) { submit_btn.disabled = true; submit_btn.textContent = "Saving…"; }

  const { checkin_data, supplement_data, habit_data } = collectCheckinData(target_date, cfg);
  try {
    const [checkin_result] = await Promise.all([
      upsertCheckin(checkin_data, entry_exists),
      upsertSupplements(supplement_data),
      upsertHabits(habit_data),
    ]);
    const success = checkin_result && checkin_result.status === "ok";
    if (result_banner) {
      result_banner.className   = `submit-banner visible ${success ? "submit-banner--success" : "submit-banner--error"}`;
      result_banner.textContent = success ? (entry_exists ? "✓ Entry updated." : "✓ Check-in saved.") : "Something went wrong — check console.";
    }
    if (submit_btn) { submit_btn.textContent = success ? "Saved ✓" : (entry_exists ? "Update Entry" : "Submit Check-in"); submit_btn.disabled = !success; }
    if (success) {
      setTimeout(() => {
        if (submit_btn) { submit_btn.disabled = false; submit_btn.textContent = "Update Entry"; }
      }, 1800);
    }
  } catch (err) {
    console.error("Submit error:", err);
    if (result_banner) { result_banner.className = "submit-banner visible submit-banner--error"; result_banner.textContent = "Unexpected error — see console."; }
    if (submit_btn) { submit_btn.disabled = false; submit_btn.textContent = entry_exists ? "Update Entry" : "Submit Check-in"; }
  }
}

// ── Workout page ──────────────────────────────────────────────

async function initWorkout() {
  if (!document.getElementById("workout-root")) { return; }

  const cfg         = getConfig();
  const target_date = todayISO();
  const date_el     = document.getElementById("workout-date");
  if (date_el) { date_el.textContent = isoToDisplay(target_date) + " · Today"; }

  // set date input default
  const date_input = document.getElementById("field-workout-date");
  if (date_input) { date_input.value = target_date; }

  const history = await fetchWorkoutHistory(60);
  const sorted  = history
    ? [...history].filter((r) => r.date).sort((a, b) => String(b.date).localeCompare(String(a.date)))
    : [];

  renderWorkoutStats(sorted, cfg);
  renderWorkoutCharts(sorted);
  renderWorkoutHistory(sorted.slice(0, 14));

  // check if today already has an entry
  const today_entry = sorted.find((r) => String(r.date).slice(0, 10) === target_date);
  if (today_entry) { prefillWorkoutForm(today_entry); }

  // wire "add exercise" button
  const add_btn = document.getElementById("add-exercise-btn");
  if (add_btn) {
    add_btn.addEventListener("click", () => {
      const container = document.getElementById("exercises-container");
      if (container) { container.appendChild(buildExerciseRow()); }
    });
    // start with one empty row
    const container = document.getElementById("exercises-container");
    if (container && !today_entry) { container.appendChild(buildExerciseRow()); }
  }

  const form = document.getElementById("workout-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleWorkoutSubmit(today_entry);
    });
  }

  const date_hint = document.getElementById("workout-form-date-hint");
  if (date_hint) { date_hint.textContent = ""; }
}

function buildExerciseRow(name = "", sets = "", reps = "") {
  const div       = document.createElement("div");
  div.className   = "exercise-row";
  div.innerHTML   = `
    <input type="text"   class="ex-name" placeholder="Exercise name"     value="${name}" />
    <input type="number" class="ex-sets" placeholder="Sets" min="1" max="99" value="${sets}" />
    <input type="text"   class="ex-reps" placeholder="Reps / duration"   value="${reps}" />
    <button type="button" class="btn--icon btn--icon--remove ex-remove" title="Remove">×</button>
  `;
  div.querySelector(".ex-remove").addEventListener("click", () => div.remove());
  return div;
}

function collectExercises() {
  const rows = document.querySelectorAll(".exercise-row");
  const exercises = [];
  rows.forEach((row) => {
    const name = row.querySelector(".ex-name").value.trim();
    const sets = row.querySelector(".ex-sets").value;
    const reps = row.querySelector(".ex-reps").value.trim();
    if (name) { exercises.push({ name, sets: sets || "", reps_duration: reps }); }
  });
  return exercises;
}

function prefillWorkoutForm(entry) {
  const set_val = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null && val !== "") { el.value = val; }
  };
  set_val("field-workout-date",     String(entry.date).slice(0, 10));
  set_val("field-workout-type",     entry.type);
  set_val("field-workout-duration", entry.duration_min);
  set_val("field-workout-notes",    entry.notes);

  const intensity = Number(entry.intensity);
  if (intensity >= 1 && intensity <= 5) {
    const star = document.getElementById(`wstar-${intensity}`);
    if (star) { star.checked = true; }
  }

  const muscles = entry.muscle_groups ? String(entry.muscle_groups).split(",").map((s) => s.trim()) : [];
  muscles.forEach((muscle) => {
    const cb = document.querySelector(`input[name="muscle_group"][value="${muscle}"]`);
    if (cb) { cb.checked = true; }
  });

  const container = document.getElementById("exercises-container");
  if (container && entry.exercises_json) {
    try {
      const exercises = JSON.parse(entry.exercises_json);
      container.innerHTML = "";
      exercises.forEach((ex) => { container.appendChild(buildExerciseRow(ex.name, ex.sets, ex.reps_duration)); });
    } catch (e) { /* skip */ }
  }

  const submit_btn = document.getElementById("workout-submit-btn");
  if (submit_btn) { submit_btn.textContent = "Update Workout"; }
}

function renderWorkoutStats(sorted_rows, cfg) {
  const week_start   = thisWeekStart();
  const week_entries = sorted_rows.filter((r) => String(r.date).slice(0, 10) >= week_start);
  const week_count   = week_entries.length;
  const week_goal    = cfg.WORKOUT.weekly_goal_days;
  const week_volume  = week_entries.reduce((sum, r) => sum + (Number(r.duration_min) || 0), 0);
  const streak       = calcWorkoutStreak(sorted_rows);

  // most trained muscle group (last 30 days)
  const muscle_counts = {};
  sorted_rows.slice(0, 30).forEach((r) => {
    if (!r.muscle_groups) { return; }
    String(r.muscle_groups).split(",").forEach((m) => {
      const clean = m.trim();
      if (clean) { muscle_counts[clean] = (muscle_counts[clean] || 0) + 1; }
    });
  });
  const top_muscle = Object.keys(muscle_counts).sort((a, b) => muscle_counts[b] - muscle_counts[a])[0] || "—";

  const val_week   = document.getElementById("val-workouts-week");
  const meta_week  = document.getElementById("meta-workouts-week");
  const val_volume = document.getElementById("val-volume-week");
  const val_muscle = document.getElementById("val-top-muscle");
  const val_streak = document.getElementById("val-streak");

  if (val_week)   { val_week.innerHTML   = `${week_count}<span style="font-size:1rem"> / ${week_goal}</span>`; }
  if (meta_week)  { meta_week.textContent = `${Math.round((week_count / week_goal) * 100)}% of goal`; }
  if (val_volume) { val_volume.innerHTML  = `${week_volume}<span style="font-size:.85rem"> min</span>`; }
  if (val_muscle) { val_muscle.textContent = top_muscle; }
  if (val_streak) { val_streak.innerHTML  = `${streak}<span style="font-size:.85rem"> days</span>`; }
}

function renderWorkoutCharts(sorted_rows) {
  const freq_canvas     = document.getElementById("chart-workout-freq");
  const duration_canvas = document.getElementById("chart-workout-duration");
  const muscle_canvas   = document.getElementById("chart-muscle-dist");
  const c               = chartColors();

  // frequency: workouts per week for last 4 weeks
  const week_labels = [];
  const week_counts = [];
  for (let w = 3; w >= 0; w--) {
    const week_iso   = dateMinusDays(todayISO(), w * 7);
    const week_end   = dateMinusDays(todayISO(), w * 7 - 6);
    const [wy, wm, wd] = week_iso.split("-");
    const label        = new Date(Number(wy), Number(wm) - 1, Number(wd)).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const week_start_iso = dateMinusDays(todayISO(), w * 7 + 6);
    const count          = sorted_rows.filter((r) => {
      const d = String(r.date).slice(0, 10);
      return d >= week_start_iso && d <= week_iso;
    }).length;
    week_labels.push(label);
    week_counts.push(count);
  }
  if (freq_canvas) { makeBarChart(freq_canvas, week_labels, week_counts, "workouts", "green"); }

  // duration trend: last 14 sessions
  const recent_14   = sorted_rows.slice(0, 14).reverse();
  const dur_labels  = recent_14.map((r) => isoToShort(String(r.date).slice(0, 10)));
  const dur_values  = recent_14.map((r) => Number(r.duration_min) || null);
  if (duration_canvas) { makeLineChart(duration_canvas, dur_labels, dur_values, "min"); }

  // muscle group doughnut: last 30 days
  if (muscle_canvas) {
    const muscle_counts = {};
    sorted_rows.slice(0, 30).forEach((r) => {
      if (!r.muscle_groups) { return; }
      String(r.muscle_groups).split(",").forEach((m) => {
        const clean = m.trim();
        if (clean) { muscle_counts[clean] = (muscle_counts[clean] || 0) + 1; }
      });
    });
    const muscle_labels = Object.keys(muscle_counts);
    const muscle_values = muscle_labels.map((k) => muscle_counts[k]);
    const muscle_colors = muscle_labels.map((k) => MUSCLE_COLORS[k] || "#AEAEAD");

    if (muscle_labels.length > 0) {
      new Chart(muscle_canvas, {
        type: "doughnut",
        data: {
          labels:   muscle_labels,
          datasets: [{ data: muscle_values, backgroundColor: muscle_colors, borderWidth: 0 }],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "right", labels: { color: c.text, font: { family: "'DM Mono'", size: 10 }, boxWidth: 10, padding: 8 } },
          },
        },
      });
    }
  }
}

function renderWorkoutHistory(rows) {
  const container = document.getElementById("workout-history-container");
  if (!container) { return; }
  if (!rows || rows.length === 0) {
    container.innerHTML = '<p class="state-loading" style="padding:12px 0;">No workouts logged yet.</p>';
    return;
  }

  const type_cls = {
    "Strength": "strength", "Cardio": "cardio", "HIIT": "hiit",
    "Mobility/Stretch": "mobility", "Sport": "sport", "Other": "other",
  };

  const rows_html = rows.map((r) => {
    const date_str     = isoToShort(String(r.date).slice(0, 10));
    const intensity    = Number(r.intensity);
    const stars        = intensity > 0 ? "★".repeat(intensity) + "☆".repeat(5 - intensity) : "—";
    const muscles      = r.muscle_groups ? String(r.muscle_groups).replace(/,/g, ", ") : "—";
    const notes_short  = r.notes ? String(r.notes).slice(0, 60) + (r.notes.length > 60 ? "…" : "") : "";
    const row_cls      = type_cls[r.type] || "other";
    return `
      <tr class="workout-row workout-row--${row_cls}">
        <td>${date_str}</td>
        <td>${r.type || "—"}</td>
        <td>${r.duration_min ? `${r.duration_min} min` : "—"}</td>
        <td style="letter-spacing:0;">${stars}</td>
        <td>${muscles}</td>
        <td class="notes-cell">${notes_short}</td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <table class="workout-table">
      <thead>
        <tr>
          <th>Date</th><th>Type</th><th>Duration</th><th>Intensity</th><th>Muscles</th><th>Notes</th>
        </tr>
      </thead>
      <tbody>${rows_html}</tbody>
    </table>
  `;
}

async function handleWorkoutSubmit(today_entry) {
  const submit_btn    = document.getElementById("workout-submit-btn");
  const result_banner = document.getElementById("workout-result-banner");
  if (submit_btn) { submit_btn.disabled = true; submit_btn.textContent = "Saving…"; }

  const date_input     = document.getElementById("field-workout-date");
  const type_input     = document.getElementById("field-workout-type");
  const duration_input = document.getElementById("field-workout-duration");
  const notes_input    = document.getElementById("field-workout-notes");
  const checked_star   = document.querySelector('input[name="intensity"]:checked');
  const muscles        = Array.from(document.querySelectorAll('input[name="muscle_group"]:checked')).map((cb) => cb.value);
  const exercises      = collectExercises();

  const data = {
    date:           date_input ? date_input.value : todayISO(),
    type:           type_input ? type_input.value : "",
    duration_min:   duration_input && duration_input.value ? Number(duration_input.value) : null,
    intensity:      checked_star ? Number(checked_star.value) : null,
    muscle_groups:  muscles.join(","),
    exercises_json: JSON.stringify(exercises),
    notes:          notes_input ? notes_input.value.trim() : "",
  };

  const entry_date  = data.date;
  const exists      = today_entry && String(today_entry.date).slice(0, 10) === entry_date;
  const result      = exists ? await putWorkoutEntry(data) : await postWorkoutEntry(data);
  const success     = result && result.status === "ok";

  if (result_banner) {
    result_banner.className   = `submit-banner visible ${success ? "submit-banner--success" : "submit-banner--error"}`;
    result_banner.textContent = success ? (exists ? "✓ Workout updated." : "✓ Workout logged.") : "Something went wrong — check console.";
  }
  if (submit_btn) {
    submit_btn.textContent = success ? "Saved ✓" : (exists ? "Update Workout" : "Log Workout");
    submit_btn.disabled    = !success;
    if (success) { setTimeout(() => { submit_btn.disabled = false; submit_btn.textContent = "Update Workout"; }, 1800); }
  }
}

// ── Body comp page ────────────────────────────────────────────

async function initBodyComp() {
  if (!document.getElementById("body-root")) { return; }

  const cfg      = getConfig();
  const bc_input = document.getElementById("field-bc-date");
  if (bc_input) { bc_input.value = todayISO(); }

  const all_entries = await fetchBodyComposition();
  const sorted      = all_entries
    ? [...all_entries].filter((r) => r.date).sort((a, b) => String(a.date).localeCompare(String(b.date)))
    : [];

  renderBodyCompSummary(sorted, cfg);
  const meas_chart = renderBodyCompCharts(sorted, cfg);

  // check if today already has an entry
  const today_entry = sorted.find((r) => String(r.date).slice(0, 10) === todayISO());
  if (today_entry) { prefillBodyCompForm(today_entry); }

  const form = document.getElementById("body-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleBodyCompSubmit(today_entry);
    });
  }
}

function renderBodyCompSummary(sorted, cfg) {
  if (!sorted || sorted.length === 0) { return; }

  const latest      = sorted[sorted.length - 1];
  const start_cfg   = cfg.BODY_COMP;
  const start       = sorted[0];

  // weight card
  const weight_el   = document.getElementById("bc-val-weight");
  const weight_meta = document.getElementById("bc-meta-weight");
  if (weight_el && latest.weight_lbs) {
    weight_el.innerHTML = `${Number(latest.weight_lbs).toFixed(1)}<span style="font-size:.85rem"> lbs</span>`;
    const start_w = start_cfg.start_weight_lbs || Number(start.weight_lbs);
    if (start_w) {
      const delta = Number(latest.weight_lbs) - start_w;
      const sign  = delta > 0 ? "▲" : "▼";
      const cls   = delta > 0 ? "delta--up" : "delta--down";
      if (weight_meta) { weight_meta.innerHTML = `<span class="delta ${cls}">${sign}${Math.abs(delta).toFixed(1)} lbs from start</span>`; }
    }
  }

  // body fat card
  const bf_el   = document.getElementById("bc-val-bf");
  const bf_meta = document.getElementById("bc-meta-bf");
  if (bf_el && latest.body_fat_pct) {
    bf_el.innerHTML = `${Number(latest.body_fat_pct).toFixed(1)}<span style="font-size:.85rem">%</span>`;
    const start_bf = start_cfg.start_body_fat_pct || Number(start.body_fat_pct);
    if (start_bf && bf_meta) {
      const delta = Number(latest.body_fat_pct) - start_bf;
      const sign  = delta > 0 ? "▲" : "▼";
      const cls   = delta > 0 ? "delta--up" : "delta--down";
      bf_meta.innerHTML = `<span class="delta ${cls}">${sign}${Math.abs(delta).toFixed(1)}% from start</span>`;
    }
  }

  // lean mass
  const lean_el = document.getElementById("bc-val-lean");
  if (lean_el && latest.weight_lbs && latest.body_fat_pct) {
    const lean = Number(latest.weight_lbs) * (1 - Number(latest.body_fat_pct) / 100);
    lean_el.innerHTML = `${lean.toFixed(1)}<span style="font-size:.85rem"> lbs</span>`;
  }

  // days since last log
  const days_el = document.getElementById("bc-val-days");
  if (days_el && latest.date) {
    const days = daysBetween(String(latest.date).slice(0, 10), todayISO());
    days_el.textContent = days === 0 ? "Today" : days;
  }
}

function renderBodyCompCharts(sorted, cfg) {
  const labels     = sorted.map((r) => isoToShort(String(r.date).slice(0, 10)));
  const weight_v   = sorted.map((r) => Number(r.weight_lbs)    || null);
  const bf_v       = sorted.map((r) => Number(r.body_fat_pct)  || null);
  const c          = chartColors();

  const weight_canvas = document.getElementById("chart-bc-weight");
  const bf_canvas     = document.getElementById("chart-bc-bf");
  const comp_canvas   = document.getElementById("chart-bc-composition");
  const meas_canvas   = document.getElementById("chart-bc-measurements");

  if (weight_canvas) { makeLineChart(weight_canvas, labels, weight_v, "lbs", c.green); }
  if (bf_canvas)     { makeLineChart(bf_canvas, labels, bf_v, "%", c.amber); }

  // stacked area: lean mass vs fat mass
  if (comp_canvas) {
    const lean_v = sorted.map((r) => {
      const w = Number(r.weight_lbs);
      const b = Number(r.body_fat_pct);
      return (w && b) ? Number((w * (1 - b / 100)).toFixed(1)) : null;
    });
    const fat_v = sorted.map((r) => {
      const w = Number(r.weight_lbs);
      const b = Number(r.body_fat_pct);
      return (w && b) ? Number((w * (b / 100)).toFixed(1)) : null;
    });

    new Chart(comp_canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label:           "Lean Mass",
            data:            lean_v,
            fill:            "origin",
            backgroundColor: c.green + "66",
            borderColor:     c.green,
            borderWidth:     1.5,
            tension:         0.3,
            spanGaps:        true,
          },
          {
            label:           "Fat Mass",
            data:            fat_v,
            fill:            "-1",
            backgroundColor: c.amber + "66",
            borderColor:     c.amber,
            borderWidth:     1.5,
            tension:         0.3,
            spanGaps:        true,
          },
        ],
      },
      options: {
        animation:           { duration: 600 },
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: c.text, font: { family: "'DM Mono'", size: 10 }, boxWidth: 10 } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} lbs` } },
        },
        scales: {
          x: { stacked: true, ticks: { color: c.text, font: { family: "'DM Mono'", size: 10 }, maxTicksLimit: 7 }, grid: { color: c.grid } },
          y: { stacked: true, ticks: { color: c.text, font: { family: "'DM Mono'", size: 10 } }, grid: { color: c.grid } },
        },
      },
    });
  }

  // measurement multi-line with toggles
  let meas_chart = null;
  if (meas_canvas) {
    const measurement_keys = [
      { col: "chest_in",       label: "Chest" },
      { col: "waist_in",       label: "Waist" },
      { col: "hips_in",        label: "Hips" },
      { col: "arm_left_in",    label: "Left Arm" },
      { col: "arm_right_in",   label: "Right Arm" },
      { col: "thigh_left_in",  label: "Left Thigh" },
      { col: "thigh_right_in", label: "Right Thigh" },
    ];

    const datasets = measurement_keys.map(({ col, label }) => ({
      label,
      data:        sorted.map((r) => Number(r[col]) || null),
      borderColor: MEASUREMENT_COLORS[label] || "#AEAEAD",
      backgroundColor: "transparent",
      pointRadius:     3,
      borderWidth:     2,
      tension:         0.3,
      spanGaps:        true,
      hidden:          false,
    }));

    meas_chart = new Chart(meas_canvas, {
      type: "line",
      data: { labels, datasets },
      options: {
        animation:           { duration: 600 },
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}"` } },
        },
        scales: {
          x: { ticks: { color: c.text, font: { family: "'DM Mono'", size: 10 }, maxTicksLimit: 7 }, grid: { color: c.grid } },
          y: { ticks: { color: c.text, font: { family: "'DM Mono'", size: 10 } }, grid: { color: c.grid } },
        },
      },
    });

    // render toggle buttons
    const toggles_el = document.getElementById("measurement-toggles");
    if (toggles_el) {
      toggles_el.innerHTML = measurement_keys.map(({ label }, idx) => {
        const color = MEASUREMENT_COLORS[label] || "#AEAEAD";
        return `<button type="button" class="measure-toggle active" data-idx="${idx}" style="border-color:${color};color:${color};background:${color}22;">${label}</button>`;
      }).join("");

      toggles_el.querySelectorAll(".measure-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx     = Number(btn.dataset.idx);
          const ds      = meas_chart.data.datasets[idx];
          ds.hidden     = !ds.hidden;
          btn.classList.toggle("active", !ds.hidden);
          if (ds.hidden) {
            btn.style.background = "var(--bg-input)";
            btn.style.color      = "var(--text-faint)";
            btn.style.borderColor= "var(--border)";
          } else {
            const color = MEASUREMENT_COLORS[ds.label] || "#AEAEAD";
            btn.style.background  = color + "22";
            btn.style.color       = color;
            btn.style.borderColor = color;
          }
          meas_chart.update();
        });
      });
    }
  }

  return meas_chart;
}

function prefillBodyCompForm(entry) {
  const set_val = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null && val !== "") { el.value = val; }
  };
  set_val("field-bc-date",        String(entry.date).slice(0, 10));
  set_val("field-bc-weight",      entry.weight_lbs);
  set_val("field-bc-bf",          entry.body_fat_pct);
  set_val("field-bc-chest",       entry.chest_in);
  set_val("field-bc-waist",       entry.waist_in);
  set_val("field-bc-hips",        entry.hips_in);
  set_val("field-bc-arm-left",    entry.arm_left_in);
  set_val("field-bc-arm-right",   entry.arm_right_in);
  set_val("field-bc-thigh-left",  entry.thigh_left_in);
  set_val("field-bc-thigh-right", entry.thigh_right_in);
  set_val("field-bc-notes",       entry.notes);

  const submit_btn = document.getElementById("body-submit-btn");
  if (submit_btn) { submit_btn.textContent = "Update Entry"; }
}

async function handleBodyCompSubmit(today_entry) {
  const submit_btn    = document.getElementById("body-submit-btn");
  const result_banner = document.getElementById("body-result-banner");
  if (submit_btn) { submit_btn.disabled = true; submit_btn.textContent = "Saving…"; }

  const get_num = (id) => {
    const el = document.getElementById(id);
    return (el && el.value !== "") ? Number(el.value) : null;
  };
  const get_str = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  };
  const date_val = get_str("field-bc-date") || todayISO();

  const data = {
    date:           date_val,
    weight_lbs:     get_num("field-bc-weight"),
    body_fat_pct:   get_num("field-bc-bf"),
    chest_in:       get_num("field-bc-chest"),
    waist_in:       get_num("field-bc-waist"),
    hips_in:        get_num("field-bc-hips"),
    arm_left_in:    get_num("field-bc-arm-left"),
    arm_right_in:   get_num("field-bc-arm-right"),
    thigh_left_in:  get_num("field-bc-thigh-left"),
    thigh_right_in: get_num("field-bc-thigh-right"),
    notes:          get_str("field-bc-notes"),
  };

  const exists = today_entry && String(today_entry.date).slice(0, 10) === date_val;
  const result = exists ? await putBodyCompEntry(data) : await postBodyCompEntry(data);
  const success = result && result.status === "ok";

  if (result_banner) {
    result_banner.className   = `submit-banner visible ${success ? "submit-banner--success" : "submit-banner--error"}`;
    result_banner.textContent = success ? (exists ? "✓ Entry updated." : "✓ Entry saved.") : "Something went wrong — check console.";
  }
  if (submit_btn) {
    submit_btn.textContent = success ? "Saved ✓" : (exists ? "Update Entry" : "Save Entry");
    submit_btn.disabled    = !success;
    if (success) { setTimeout(() => { submit_btn.disabled = false; submit_btn.textContent = "Update Entry"; }, 1800); }
  }
}

// ── Settings page ─────────────────────────────────────────────

function initSettings() {
  if (!document.getElementById("settings-root")) { return; }

  const cfg = getConfig();

  // populate goals
  const set_input = (id, val) => {
    const el = document.getElementById(id);
    if (el) { el.value = val; }
  };
  set_input("set-water",        cfg.DAILY_GOALS.water_oz);
  set_input("set-calories",     cfg.DAILY_GOALS.calories);
  set_input("set-sleep",        cfg.DAILY_GOALS.sleep_hrs);
  set_input("set-workout-days", cfg.DAILY_GOALS.workout_days_week);
  set_input("set-script-url",   cfg.APPS_SCRIPT_URL);
  // never prefill the API key — password fields start blank for security

  // save goals
  const save_goals_btn = document.getElementById("save-goals-btn");
  if (save_goals_btn) {
    save_goals_btn.addEventListener("click", () => {
      const goals = {
        water_oz:          Number(document.getElementById("set-water").value)        || cfg.DAILY_GOALS.water_oz,
        calories:          Number(document.getElementById("set-calories").value)     || cfg.DAILY_GOALS.calories,
        sleep_hrs:         Number(document.getElementById("set-sleep").value)        || cfg.DAILY_GOALS.sleep_hrs,
        workout_days_week: Number(document.getElementById("set-workout-days").value) || cfg.DAILY_GOALS.workout_days_week,
      };
      saveOverride("DAILY_GOALS", goals);
      showConfirm("goals-confirm", "✓ Saved");
    });
  }

  // save URL
  const save_url_btn = document.getElementById("save-url-btn");
  if (save_url_btn) {
    save_url_btn.addEventListener("click", () => {
      const url = document.getElementById("set-script-url").value.trim();
      if (url) { saveOverride("APPS_SCRIPT_URL", url); showConfirm("url-confirm", "✓ Saved"); }
    });
  }

  // save API key
  const save_key_btn = document.getElementById("save-api-key-btn");
  if (save_key_btn) {
    save_key_btn.addEventListener("click", () => {
      const key = document.getElementById("set-api-key").value.trim();
      if (key) { saveOverride("ANTHROPIC_API_KEY", key); showConfirm("api-key-confirm", "✓ Saved — never committed to repo"); }
      else     { saveOverride("ANTHROPIC_API_KEY", "");  showConfirm("api-key-confirm", "✓ Key cleared"); }
    });
  }

  // supplement lists
  let morning_list = [...cfg.SUPPLEMENTS.morning];
  let evening_list = [...cfg.SUPPLEMENTS.evening];

  const save_supps = () => {
    saveOverride("SUPPLEMENTS", { morning: morning_list, evening: evening_list });
  };

  renderSettingsList("settings-supps-morning", morning_list, save_supps, () => renderSettingsList("settings-supps-morning", morning_list, save_supps, null));
  renderSettingsList("settings-supps-evening", evening_list, save_supps, () => renderSettingsList("settings-supps-evening", evening_list, save_supps, null));

  const btn_add_morning = document.getElementById("btn-add-supp-morning");
  if (btn_add_morning) {
    btn_add_morning.addEventListener("click", () => {
      const input = document.getElementById("add-supp-morning");
      const val   = input ? input.value.trim() : "";
      if (!val) { return; }
      morning_list.push(val);
      if (input) { input.value = ""; }
      save_supps();
      renderSettingsList("settings-supps-morning", morning_list, save_supps, () => renderSettingsList("settings-supps-morning", morning_list, save_supps, null));
    });
  }

  const btn_add_evening = document.getElementById("btn-add-supp-evening");
  if (btn_add_evening) {
    btn_add_evening.addEventListener("click", () => {
      const input = document.getElementById("add-supp-evening");
      const val   = input ? input.value.trim() : "";
      if (!val) { return; }
      evening_list.push(val);
      if (input) { input.value = ""; }
      save_supps();
      renderSettingsList("settings-supps-evening", evening_list, save_supps, () => renderSettingsList("settings-supps-evening", evening_list, save_supps, null));
    });
  }

  // habit list
  let habit_list = [...cfg.HABITS];
  const save_habits = () => { saveOverride("HABITS", habit_list); };

  renderSettingsList("settings-habits", habit_list, save_habits, () => renderSettingsList("settings-habits", habit_list, save_habits, null));

  const btn_add_habit = document.getElementById("btn-add-habit");
  if (btn_add_habit) {
    btn_add_habit.addEventListener("click", () => {
      const input = document.getElementById("add-habit");
      const val   = input ? input.value.trim() : "";
      if (!val) { return; }
      habit_list.push(val);
      if (input) { input.value = ""; }
      save_habits();
      renderSettingsList("settings-habits", habit_list, save_habits, () => renderSettingsList("settings-habits", habit_list, save_habits, null));
    });
  }

  // reset
  const reset_btn = document.getElementById("reset-btn");
  if (reset_btn) {
    reset_btn.addEventListener("click", () => {
      if (window.confirm("Reset all settings to config.js defaults? This cannot be undone.")) {
        localStorage.removeItem(CONFIG_KEY);
        window.location.reload();
      }
    });
  }
}

function renderSettingsList(container_id, items, on_change, on_render) {
  const container = document.getElementById(container_id);
  if (!container) { return; }

  container.innerHTML = items.map((item, idx) => `
    <div class="settings-list-item" data-index="${idx}">
      <span class="settings-list-item__name">${item}</span>
      <div class="settings-list-item__controls">
        <button class="btn--icon" data-action="up"     data-index="${idx}" ${idx === 0 ? "disabled" : ""}>↑</button>
        <button class="btn--icon" data-action="down"   data-index="${idx}" ${idx === items.length - 1 ? "disabled" : ""}>↓</button>
        <button class="btn--icon btn--icon--remove" data-action="remove" data-index="${idx}">×</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const idx    = Number(btn.dataset.index);

      if (action === "remove") {
        items.splice(idx, 1);
      } else if (action === "up" && idx > 0) {
        const temp       = items[idx - 1];
        items[idx - 1]   = items[idx];
        items[idx]       = temp;
      } else if (action === "down" && idx < items.length - 1) {
        const temp       = items[idx + 1];
        items[idx + 1]   = items[idx];
        items[idx]       = temp;
      }

      on_change();
      renderSettingsList(container_id, items, on_change, on_render);
    });
  });
}

function showConfirm(el_id, message) {
  const el = document.getElementById(el_id);
  if (!el) { return; }
  el.textContent = message;
  el.classList.add("visible");
  setTimeout(() => { el.classList.remove("visible"); }, 3000);
}

// ── Nav hamburger ─────────────────────────────────────────────

function initNav() {
  const hamburger = document.getElementById("nav-hamburger");
  const nav       = document.getElementById("site-nav");
  if (!hamburger || !nav) { return; }

  hamburger.addEventListener("click", () => {
    nav.classList.toggle("open");
  });

  // close when a link is tapped on mobile
  nav.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
    });
  });
}

// ── Boot ──────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initDashboard();
  initCheckin();
  initWorkout();
  initBodyComp();
  initSettings();
});
