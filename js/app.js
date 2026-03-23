/* ============================================================
   L-Dashboard — app.js
   ============================================================ */

"use strict";

// ── Utilities ───────────────────────────────────────────────

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
  return [
    ...CONFIG.SUPPLEMENTS.morning,
    ...CONFIG.SUPPLEMENTS.evening,
  ];
}

// read ?date= from URL or fall back to today
function getTargetDate() {
  const params = new URLSearchParams(window.location.search);
  const raw    = params.get("date");
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) { return raw; }
  return todayISO();
}

// ── API layer ────────────────────────────────────────────────

async function apiFetch(params) {
  if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
    console.warn("L-Dashboard: APPS_SCRIPT_URL not configured");
    return null;
  }
  const url = new URL(CONFIG.APPS_SCRIPT_URL);
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
  if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
    return null;
  }
  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
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

async function fetchCheckinByDate(date) {
  return apiFetch({ sheet: "daily_checkin", date });
}

async function fetchRecentCheckins(days) {
  return apiFetch({ sheet: "daily_checkin", limit: days });
}

async function fetchSupplementsByDate(date) {
  return apiFetch({ sheet: "supplements", date });
}

async function fetchHabitsByDate(date) {
  return apiFetch({ sheet: "habits", date });
}

async function fetchRecentHabits(days) {
  return apiFetch({ sheet: "habits", limit: days });
}

async function fetchCheckinDates() {
  return apiFetch({ sheet: "daily_checkin", limit: 120 });
}

async function upsertCheckin(data, exists) {
  return apiPost({ sheet: "daily_checkin", data, _method: exists ? "PUT" : "POST" });
}

async function upsertSupplements(supplement_array) {
  return apiPost({ sheet: "supplements", data: supplement_array });
}

async function upsertHabits(habit_array) {
  return apiPost({ sheet: "habits", data: habit_array });
}

async function toggleSupplement(supplement_name, taken, date) {
  return apiPost({
    sheet:   "supplements",
    _method: "TOGGLE",
    data:    { date, supplement_name, taken },
  });
}

// ── AI calorie estimation ─────────────────────────────────────

async function estimateCaloriesWithAI(food_log_text) {
  if (!CONFIG.ANTHROPIC_API_KEY) { return null; }

  const prompt = `Estimate the total calories in this meal log. Return ONLY a JSON object like: {"calories": 1850, "note": "rough estimate"}. No other text.\n\nMeal log:\n${food_log_text}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         CONFIG.ANTHROPIC_API_KEY,
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
    const text   = data.content[0].text.trim();
    const parsed = JSON.parse(text);
    return parsed;
  } catch (err) {
    console.error("AI estimate error:", err);
    return null;
  }
}

// ── Chart helpers ────────────────────────────────────────────

function chartColors() {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    text:  dark ? "#9A9890" : "#6B6B6B",
    grid:  dark ? "#2A2D38" : "#E8E7E2",
    green: "#2D9E6B",
    amber: "#E8A838",
  };
}

function makeLineChart(canvas, labels, values, unit) {
  const c = chartColors();
  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data:                 values,
        borderColor:          c.green,
        backgroundColor:      "transparent",
        pointBackgroundColor: c.green,
        pointRadius:          3,
        pointHoverRadius:     5,
        borderWidth:          2,
        tension:              0.35,
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

// ── Calendar widget ──────────────────────────────────────────

function buildCalendar(container, checkin_rows) {
  const has_checkin = new Set();
  if (checkin_rows && Array.isArray(checkin_rows)) {
    checkin_rows.forEach((row) => {
      if (row.date) { has_checkin.add(String(row.date).slice(0, 10)); }
    });
  }

  const today     = new Date();
  const today_iso = todayISO();

  // last 4 months including current
  const months = [];
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
    ["S","M","T","W","T","F","S"].forEach((day_letter) => {
      html += `<span class="cal-dow">${day_letter}</span>`;
    });
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

// ── Dashboard page ───────────────────────────────────────────

async function initDashboard() {
  if (!document.getElementById("dashboard-root")) { return; }

  const date_el = document.getElementById("dashboard-date");
  if (date_el) { date_el.textContent = isoToDisplay(todayISO()); }

  const [today_data, recent_data, today_supps, today_habits_data, recent_habits_data, all_checkins] = await Promise.all([
    fetchCheckinByDate(todayISO()),
    fetchRecentCheckins(14),
    fetchSupplementsByDate(todayISO()),
    fetchHabitsByDate(todayISO()),
    fetchRecentHabits(30),
    fetchCheckinDates(),
  ]);

  renderSummaryCards(today_data, recent_data);
  renderCharts(recent_data);
  renderSupplementBadges(today_supps);
  renderHabitSummary(today_habits_data);
  renderHabitTrendBars(recent_habits_data);

  const cal_container = document.getElementById("calendar-container");
  if (cal_container) { buildCalendar(cal_container, all_checkins); }
}

function renderSummaryCards(today_row, recent_rows) {
  const weight_card = document.getElementById("card-weight");
  if (weight_card) {
    let weight_value = "—";
    let delta_html   = "";

    if (today_row && today_row.weight) {
      const weight_today = Number(today_row.weight);
      weight_value = weight_today.toFixed(1);

      if (recent_rows && recent_rows.length >= 2) {
        const yesterday = recent_rows
          .filter((r) => r.date !== todayISO() && r.weight)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
        if (yesterday) {
          const delta = weight_today - Number(yesterday.weight);
          if (Math.abs(delta) > 0.05) {
            const sign = delta > 0 ? "▲" : "▼";
            const cls  = delta > 0 ? "delta--up" : "delta--down";
            delta_html = `<span class="delta ${cls}">${sign}${Math.abs(delta).toFixed(1)}</span>`;
          } else {
            delta_html = `<span class="delta delta--flat">→</span>`;
          }
        }
      }
    }
    weight_card.innerHTML = `
      <div class="card-label">Weight</div>
      <div class="card-value">${weight_value}<span style="font-size:.85rem"> lbs</span>${delta_html}</div>
    `;
  }

  const water_card = document.getElementById("card-water");
  if (water_card) {
    const water_oz   = today_row ? Number(today_row.water_oz) || 0 : 0;
    const water_goal = CONFIG.DAILY_GOALS.water_oz;
    const water_pct  = clamp(Math.round((water_oz / water_goal) * 100), 0, 100);
    water_card.innerHTML = `
      <div class="card-label">Water</div>
      <div class="card-value card-value--sm">${water_oz > 0 ? water_oz : "—"}<span style="font-size:.85rem"> oz</span></div>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-bar__fill" style="width:${water_pct}%"></div></div>
        <div class="card-meta">${water_pct}% of ${water_goal} oz</div>
      </div>
    `;
  }

  const sleep_card = document.getElementById("card-sleep");
  if (sleep_card) {
    const sleep_hrs     = today_row ? Number(today_row.sleep_hrs) || 0 : 0;
    const sleep_quality = today_row ? Number(today_row.sleep_quality) || 0 : 0;
    const stars         = sleep_quality > 0 ? "★".repeat(sleep_quality) + "☆".repeat(5 - sleep_quality) : "—";
    sleep_card.innerHTML = `
      <div class="card-label">Sleep</div>
      <div class="card-value card-value--sm">${sleep_hrs > 0 ? sleep_hrs : "—"}<span style="font-size:.85rem"> hrs</span></div>
      <div class="card-meta">${stars}</div>
    `;
  }

  const cal_card = document.getElementById("card-calories");
  if (cal_card) {
    const calories  = today_row ? Number(today_row.calories) || 0 : 0;
    const cal_goal  = CONFIG.DAILY_GOALS.calories;
    const cal_pct   = clamp(Math.round((calories / cal_goal) * 100), 0, 100);
    cal_card.innerHTML = `
      <div class="card-label">Calories</div>
      <div class="card-value card-value--sm">${calories > 0 ? calories.toLocaleString() : "—"}</div>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-bar__fill progress-bar__fill--amber" style="width:${cal_pct}%"></div></div>
        <div class="card-meta">${cal_pct}% of ${cal_goal.toLocaleString()}</div>
      </div>
    `;
  }

  const workout_card = document.getElementById("card-workout");
  if (workout_card) {
    const notes_lower = (today_row && today_row.notes) ? today_row.notes.toLowerCase() : "";
    const logged      = notes_lower.includes("workout") || notes_lower.includes("gym") || notes_lower.includes("run");
    workout_card.innerHTML = `
      <div class="card-label">Workout</div>
      <div class="card-value card-value--sm" style="font-size:1rem; padding-top:4px;">
        ${logged ? '<span class="pill pill--green">✓ logged</span>' : '<span class="pill pill--grey">not logged</span>'}
      </div>
    `;
  }
}

function renderCharts(recent_rows) {
  const weight_canvas = document.getElementById("chart-weight");
  const sleep_canvas  = document.getElementById("chart-sleep");
  const water_canvas  = document.getElementById("chart-water");

  if (!recent_rows || recent_rows.length === 0) {
    const no_data = '<p class="state-error" style="margin-top:8px;">No data yet.</p>';
    if (weight_canvas) { weight_canvas.insertAdjacentHTML("afterend", no_data); weight_canvas.remove(); }
    if (sleep_canvas)  { sleep_canvas.insertAdjacentHTML("afterend", no_data);  sleep_canvas.remove(); }
    if (water_canvas)  { water_canvas.insertAdjacentHTML("afterend", no_data);  water_canvas.remove(); }
    return;
  }

  const sorted = [...recent_rows]
    .filter((r) => r.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-14);

  const labels        = sorted.map((r) => isoToShort(String(r.date).slice(0, 10)));
  const weight_values = sorted.map((r) => Number(r.weight)    || null);
  const sleep_values  = sorted.map((r) => Number(r.sleep_hrs) || null);
  const water_values  = sorted.map((r) => Number(r.water_oz)  || null);

  if (weight_canvas) { makeLineChart(weight_canvas, labels, weight_values, "lbs"); }
  if (sleep_canvas)  { makeBarChart(sleep_canvas, labels.slice(-7), sleep_values.slice(-7), "hrs", "green"); }
  if (water_canvas)  { makeBarChart(water_canvas, labels.slice(-7), water_values.slice(-7), "oz", "amber"); }
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
    const taken_class = taken_set.has(name) ? " taken" : "";
    return `<span class="supp-badge${taken_class}" data-name="${name}">${name}</span>`;
  }).join("");

  grid.querySelectorAll(".supp-badge").forEach((badge) => {
    badge.addEventListener("click", async () => {
      const name         = badge.dataset.name;
      const is_now_taken = !badge.classList.contains("taken");
      badge.classList.toggle("taken", is_now_taken);
      await toggleSupplement(name, is_now_taken, todayISO());
    });
  });
}

function renderHabitSummary(today_habit_rows) {
  const habit_card  = document.getElementById("card-habits");
  if (!habit_card) { return; }

  let done_count    = 0;
  const total_count = CONFIG.HABITS.length;

  if (today_habit_rows && Array.isArray(today_habit_rows)) {
    today_habit_rows.forEach((row) => {
      if (String(row.completed).toLowerCase() === "true" || row.completed === true) {
        done_count++;
      }
    });
  }

  habit_card.innerHTML = `
    <div class="card-label">Habits</div>
    <div class="card-value card-value--sm">${done_count}<span style="font-size:1rem"> / ${total_count}</span></div>
    <div class="card-meta">completed today</div>
  `;
}

function renderHabitTrendBars(recent_habit_rows) {
  const container = document.getElementById("habit-trend-bars");
  if (!container) { return; }

  if (!recent_habit_rows || recent_habit_rows.length === 0) {
    container.innerHTML = '<p class="state-loading">No habit data yet.</p>';
    return;
  }

  const completion_map = {};
  CONFIG.HABITS.forEach((habit) => { completion_map[habit] = { done: 0, total: 0 }; });

  const date_set = new Set();
  recent_habit_rows.forEach((row) => { if (row.date) { date_set.add(row.date); } });

  recent_habit_rows.forEach((row) => {
    if (completion_map[row.habit_name] === undefined) { return; }
    completion_map[row.habit_name].total++;
    if (String(row.completed).toLowerCase() === "true" || row.completed === true) {
      completion_map[row.habit_name].done++;
    }
  });

  const rows_html = CONFIG.HABITS.map((habit) => {
    const stats = completion_map[habit];
    const days  = stats.total || date_set.size || 1;
    const pct   = Math.round((stats.done / days) * 100);
    return `
      <div class="habit-bar-row">
        <span class="habit-bar-label">${habit}</span>
        <div class="habit-bar-track"><div class="habit-bar-fill" style="width:${pct}%"></div></div>
        <span class="habit-bar-pct">${pct}%</span>
      </div>
    `;
  }).join("");

  container.innerHTML = rows_html;
}

// ── Check-in page ────────────────────────────────────────────

async function initCheckin() {
  if (!document.getElementById("checkin-root")) { return; }

  const target_date = getTargetDate();
  const is_today    = target_date === todayISO();

  const date_el = document.getElementById("checkin-date");
  if (date_el) {
    date_el.textContent = isoToDisplay(target_date) + (is_today ? " · Today" : "");
  }

  buildSupplementCheckboxes();
  buildHabitCheckboxes();

  const [existing_checkin, existing_supps, existing_habits] = await Promise.all([
    fetchCheckinByDate(target_date),
    fetchSupplementsByDate(target_date),
    fetchHabitsByDate(target_date),
  ]);

  const entry_exists = !!(existing_checkin && existing_checkin.date);

  if (entry_exists) {
    prefillForm(existing_checkin);
    prefillSupplements(existing_supps);
    prefillHabits(existing_habits);
  }

  const submit_btn = document.getElementById("submit-btn");
  if (submit_btn) {
    submit_btn.textContent = entry_exists ? "Update Entry" : "Submit Check-in";
  }

  // AI estimate button
  const ai_btn = document.getElementById("ai-estimate-btn");
  if (ai_btn) {
    if (CONFIG.ANTHROPIC_API_KEY) {
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
      await handleCheckinSubmit(target_date, entry_exists);
    });
  }
}

function buildSupplementCheckboxes() {
  const container = document.getElementById("supplement-checks");
  if (!container) { return; }

  const groups = [
    { label: "Morning", items: CONFIG.SUPPLEMENTS.morning },
    { label: "Evening", items: CONFIG.SUPPLEMENTS.evening },
  ];

  container.innerHTML = groups.map(({ label, items }) => {
    const checkboxes = items.map((name) => {
      const id = suppId(name);
      return `
        <label class="check-item">
          <input type="checkbox" id="${id}" name="supplement" value="${name}">
          <span>${name}</span>
        </label>
      `;
    }).join("");
    return `
      <div class="check-group">
        <div class="check-group-label">${label}</div>
        ${checkboxes}
      </div>
    `;
  }).join("");
}

function buildHabitCheckboxes() {
  const container = document.getElementById("habit-checks");
  if (!container) { return; }

  container.innerHTML = CONFIG.HABITS.map((name) => {
    const id = habitId(name);
    return `
      <label class="check-item">
        <input type="checkbox" id="${id}" name="habit" value="${name}">
        <span>${name}</span>
      </label>
    `;
  }).join("");
}

function suppId(name) {
  return `supp-${name.replace(/[\s()\/,.]/g, "-").replace(/-+/g, "-").toLowerCase()}`;
}

function habitId(name) {
  return `habit-${name.replace(/[\s()\/,.]/g, "-").replace(/-+/g, "-").toLowerCase()}`;
}

function prefillForm(data) {
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

  const quality = Number(data.sleep_quality);
  if (quality >= 1 && quality <= 5) {
    const star = document.getElementById(`star-${quality}`);
    if (star) { star.checked = true; }
  }
}

function prefillSupplements(supp_rows) {
  if (!supp_rows || !Array.isArray(supp_rows)) { return; }
  supp_rows.forEach((row) => {
    if (String(row.taken).toLowerCase() === "true" || row.taken === true) {
      const el = document.getElementById(suppId(row.supplement_name));
      if (el) { el.checked = true; }
    }
  });
}

function prefillHabits(habit_rows) {
  if (!habit_rows || !Array.isArray(habit_rows)) { return; }
  habit_rows.forEach((row) => {
    if (String(row.completed).toLowerCase() === "true" || row.completed === true) {
      const el = document.getElementById(habitId(row.habit_name));
      if (el) { el.checked = true; }
    }
  });
}

function collectFormData(target_date) {
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
    date:          target_date,
    weight:        get_num("field-weight"),
    water_oz:      get_num("field-water"),
    sleep_hrs:     get_num("field-sleep"),
    sleep_quality: sleep_quality,
    calories:      get_num("field-calories"),
    food_log:      get_str("field-food-log"),
    notes:         get_str("field-notes"),
  };

  const supplement_data = allSupplements().map((name) => {
    const el = document.getElementById(suppId(name));
    return { date: target_date, supplement_name: name, taken: el ? el.checked : false };
  });

  const habit_data = CONFIG.HABITS.map((name) => {
    const el = document.getElementById(habitId(name));
    return { date: target_date, habit_name: name, completed: el ? el.checked : false };
  });

  return { checkin_data, supplement_data, habit_data };
}

async function handleCheckinSubmit(target_date, entry_exists) {
  const submit_btn    = document.getElementById("submit-btn");
  const result_banner = document.getElementById("result-banner");

  if (submit_btn) {
    submit_btn.disabled    = true;
    submit_btn.textContent = "Saving…";
  }

  const { checkin_data, supplement_data, habit_data } = collectFormData(target_date);

  try {
    const [checkin_result] = await Promise.all([
      upsertCheckin(checkin_data, entry_exists),
      upsertSupplements(supplement_data),
      upsertHabits(habit_data),
    ]);

    const success = checkin_result && checkin_result.status === "ok";

    if (result_banner) {
      result_banner.className   = `submit-banner visible ${success ? "submit-banner--success" : "submit-banner--error"}`;
      result_banner.textContent = success
        ? (entry_exists ? "✓ Entry updated." : "✓ Check-in saved.")
        : "Something went wrong — check the console and your Apps Script URL.";
    }

    if (submit_btn) {
      submit_btn.textContent = success ? "Saved ✓" : (entry_exists ? "Update Entry" : "Submit Check-in");
      submit_btn.disabled    = !success;
    }

    if (success) {
      // re-enable as "Update" so user can keep editing throughout the day
      setTimeout(() => {
        if (submit_btn) {
          submit_btn.disabled    = false;
          submit_btn.textContent = "Update Entry";
        }
      }, 1800);
    }
  } catch (err) {
    console.error("Submit error:", err);
    if (result_banner) {
      result_banner.className   = "submit-banner visible submit-banner--error";
      result_banner.textContent = "Unexpected error — see console.";
    }
    if (submit_btn) {
      submit_btn.disabled    = false;
      submit_btn.textContent = entry_exists ? "Update Entry" : "Submit Check-in";
    }
  }
}

// ── Boot ─────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
  initCheckin();
});
