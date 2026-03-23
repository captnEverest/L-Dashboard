/* ============================================================
   L-Dashboard — app.js
   All application logic: API calls, charts, form handling
   ============================================================ */

"use strict";

// ── Utilities ───────────────────────────────────────────────

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day   = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(isoString) {
  const [year, month, day] = isoString.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// ── API layer ────────────────────────────────────────────────

async function apiFetch(params) {
  if (CONFIG.APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
    console.warn("L-Dashboard: APPS_SCRIPT_URL not configured in config.js");
    return null;
  }
  const url = new URL(CONFIG.APPS_SCRIPT_URL);
  Object.entries(params).forEach(([key, val]) => url.searchParams.set(key, val));
  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("apiFetch error:", err);
    return null;
  }
}

async function apiPost(body) {
  if (CONFIG.APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
    console.warn("L-Dashboard: APPS_SCRIPT_URL not configured in config.js");
    return null;
  }
  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" }, // Apps Script requires text/plain for CORS-safe POST
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("apiPost error:", err);
    return null;
  }
}

async function apiPut(body) {
  if (CONFIG.APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
    return null;
  }
  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST", // Apps Script only exposes doPost; we encode method in body
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ ...body, _method: "PUT" }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("apiPut error:", err);
    return null;
  }
}

// fetch today's check-in row
async function fetchTodayCheckin() {
  return apiFetch({ sheet: "daily_checkin", date: todayISO() });
}

// fetch last N days of check-ins
async function fetchRecentCheckins(days) {
  return apiFetch({ sheet: "daily_checkin", limit: days });
}

// fetch supplement records for today
async function fetchTodaySupplements() {
  return apiFetch({ sheet: "supplements", date: todayISO() });
}

// fetch habit records for today
async function fetchTodayHabits() {
  return apiFetch({ sheet: "habits", date: todayISO() });
}

// fetch habit records for past N days (for streak chart)
async function fetchRecentHabits(days) {
  return apiFetch({ sheet: "habits", limit: days });
}

// post a new daily check-in
async function postCheckin(data) {
  return apiPost({ sheet: "daily_checkin", data });
}

// update an existing check-in by date
async function putCheckin(data) {
  return apiPut({ sheet: "daily_checkin", data });
}

// post supplement records for today
async function postSupplements(supplementArray) {
  return apiPost({ sheet: "supplements", data: supplementArray });
}

// post habit records for today
async function postHabits(habitArray) {
  return apiPost({ sheet: "habits", data: habitArray });
}

// toggle a single supplement taken status
async function toggleSupplement(supplement_name, taken, date) {
  return apiPost({
    sheet: "supplements",
    _method: "TOGGLE",
    data: { date: date || todayISO(), supplement_name, taken },
  });
}

// ── Chart helpers ────────────────────────────────────────────

function chartDefaults() {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    textColor:   dark ? "#9A9890" : "#6B6B6B",
    gridColor:   dark ? "#2A2D38" : "#E8E7E2",
    accentColor: "#2D9E6B",
    amberColor:  "#E8A838",
  };
}

function buildWeightChart(canvas, labels, values) {
  const { textColor, gridColor, accentColor } = chartDefaults();
  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Weight (lbs)",
        data: values,
        borderColor: accentColor,
        backgroundColor: "transparent",
        pointBackgroundColor: accentColor,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
        tension: 0.35,
      }],
    },
    options: {
      animation: { duration: 700, easing: "easeOutQuart" },
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} lbs`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: "'DM Mono'", size: 10 }, maxTicksLimit: 7 },
          grid: { color: gridColor },
        },
        y: {
          ticks: { color: textColor, font: { family: "'DM Mono'", size: 10 } },
          grid: { color: gridColor },
        },
      },
    },
  });
}

function buildSleepChart(canvas, labels, values) {
  const { textColor, gridColor, accentColor } = chartDefaults();
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Sleep (hrs)",
        data: values,
        backgroundColor: accentColor + "99",
        borderColor: accentColor,
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      animation: { duration: 700, easing: "easeOutQuart" },
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} hrs`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: "'DM Mono'", size: 10 } },
          grid: { display: false },
        },
        y: {
          ticks: { color: textColor, font: { family: "'DM Mono'", size: 10 } },
          grid: { color: gridColor },
          suggestedMin: 0,
          suggestedMax: 10,
        },
      },
    },
  });
}

function buildWaterChart(canvas, labels, values) {
  const { textColor, gridColor, amberColor } = chartDefaults();
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Water (oz)",
        data: values,
        backgroundColor: amberColor + "99",
        borderColor: amberColor,
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      animation: { duration: 700, easing: "easeOutQuart" },
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} oz`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: "'DM Mono'", size: 10 } },
          grid: { display: false },
        },
        y: {
          ticks: { color: textColor, font: { family: "'DM Mono'", size: 10 } },
          grid: { color: gridColor },
          suggestedMin: 0,
        },
      },
    },
  });
}

// ── Dashboard page ───────────────────────────────────────────

async function initDashboard() {
  if (!document.getElementById("dashboard-root")) { return; }

  renderSummarySkeletons();
  renderChartSkeletons();
  renderSupplementSkeletons();

  const [todayData, recentData, todaySupps, todayHabitsData, recentHabitsData] = await Promise.all([
    fetchTodayCheckin(),
    fetchRecentCheckins(14),
    fetchTodaySupplements(),
    fetchTodayHabits(),
    fetchRecentHabits(30),
  ]);

  renderSummaryCards(todayData, recentData);
  renderCharts(recentData);
  renderSupplementBadges(todaySupps);
  renderHabitSummary(todayHabitsData);
  renderHabitTrendBars(recentHabitsData);
}

function renderSummarySkeletons() {
  const cards = document.querySelectorAll(".summary-card");
  cards.forEach((card) => {
    card.innerHTML = `
      <div class="card-label skeleton skeleton-text"></div>
      <div class="card-value skeleton skeleton-value"></div>
    `;
  });
}

function renderChartSkeletons() {
  // charts will populate when data arrives; canvases already exist
}

function renderSupplementSkeletons() {
  const grid = document.getElementById("supplements-grid");
  if (!grid) { return; }
  grid.innerHTML = CONFIG.SUPPLEMENTS.map((s) => {
    return `<span class="supp-badge" data-name="${s}">${s}</span>`;
  }).join("");
}

function renderSummaryCards(todayRow, recentRows) {
  // weight
  const weightCard = document.getElementById("card-weight");
  if (weightCard) {
    let weightValue = "—";
    let deltaHtml = "";

    if (todayRow && todayRow.weight) {
      const weight_today = Number(todayRow.weight);
      weightValue = weight_today.toFixed(1);

      if (recentRows && recentRows.length >= 2) {
        const yesterday = recentRows.find((r) => r.date !== todayISO() && r.weight);
        if (yesterday) {
          const delta = weight_today - Number(yesterday.weight);
          if (Math.abs(delta) > 0.05) {
            const sign = delta > 0 ? "▲" : "▼";
            const cls  = delta > 0 ? "delta--up" : "delta--down";
            deltaHtml = `<span class="delta ${cls}">${sign}${Math.abs(delta).toFixed(1)}</span>`;
          } else {
            deltaHtml = `<span class="delta delta--flat">→</span>`;
          }
        }
      }
    }
    weightCard.innerHTML = `
      <div class="card-label">Weight</div>
      <div class="card-value">${weightValue}<span style="font-size:0.9rem"> lbs</span>${deltaHtml}</div>
    `;
  }

  // water
  const waterCard = document.getElementById("card-water");
  if (waterCard) {
    const water_oz = todayRow ? Number(todayRow.water_oz) || 0 : 0;
    const water_goal = CONFIG.DAILY_GOALS.water_oz;
    const water_pct = clamp(Math.round((water_oz / water_goal) * 100), 0, 100);
    waterCard.innerHTML = `
      <div class="card-label">Water</div>
      <div class="card-value card-value--sm">${water_oz > 0 ? water_oz : "—"}<span style="font-size:0.9rem"> oz</span></div>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-bar__fill" style="width:${water_pct}%"></div></div>
        <div class="card-meta">${water_pct}% of ${water_goal} oz goal</div>
      </div>
    `;
  }

  // sleep
  const sleepCard = document.getElementById("card-sleep");
  if (sleepCard) {
    const sleep_hrs     = todayRow ? Number(todayRow.sleep_hrs) || 0 : 0;
    const sleep_quality = todayRow ? Number(todayRow.sleep_quality) || 0 : 0;
    const stars         = sleep_quality > 0 ? "★".repeat(sleep_quality) + "☆".repeat(5 - sleep_quality) : "—";
    sleepCard.innerHTML = `
      <div class="card-label">Sleep</div>
      <div class="card-value card-value--sm">${sleep_hrs > 0 ? sleep_hrs : "—"}<span style="font-size:0.9rem"> hrs</span></div>
      <div class="card-meta">${stars}</div>
    `;
  }

  // calories
  const calCard = document.getElementById("card-calories");
  if (calCard) {
    const calories   = todayRow ? Number(todayRow.calories) || 0 : 0;
    const cal_goal   = CONFIG.DAILY_GOALS.calories;
    const cal_pct    = clamp(Math.round((calories / cal_goal) * 100), 0, 100);
    calCard.innerHTML = `
      <div class="card-label">Calories</div>
      <div class="card-value card-value--sm">${calories > 0 ? calories.toLocaleString() : "—"}</div>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-bar__fill progress-bar__fill--amber" style="width:${cal_pct}%"></div></div>
        <div class="card-meta">${cal_pct}% of ${cal_goal.toLocaleString()} kcal</div>
      </div>
    `;
  }

  // habits placeholder — updated separately
  const habitCard = document.getElementById("card-habits");
  if (habitCard && !todayRow) {
    habitCard.innerHTML = `
      <div class="card-label">Habits</div>
      <div class="card-value card-value--sm">—</div>
    `;
  }

  // workout (parsed from notes or a future field; show placeholder for now)
  const workoutCard = document.getElementById("card-workout");
  if (workoutCard) {
    workoutCard.innerHTML = `
      <div class="card-label">Workout</div>
      <div class="card-value card-value--sm" style="font-size:1rem">
        ${todayRow && todayRow.notes && todayRow.notes.toLowerCase().includes("workout")
          ? `<span class="pill pill--green">✓ logged</span>`
          : `<span class="pill pill--grey">not logged</span>`}
      </div>
    `;
  }
}

function renderCharts(recentRows) {
  const weightCanvas = document.getElementById("chart-weight");
  const sleepCanvas  = document.getElementById("chart-sleep");
  const waterCanvas  = document.getElementById("chart-water");

  if (!recentRows || recentRows.length === 0) {
    [weightCanvas, sleepCanvas, waterCanvas].forEach((c) => {
      if (c) {
        c.style.display = "none";
        c.insertAdjacentHTML("afterend", '<p class="state-error">No data yet. Submit your first check-in!</p>');
      }
    });
    return;
  }

  // sort ascending by date, take last 14
  const sorted = [...recentRows]
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const labels       = sorted.map((r) => formatDate(r.date));
  const weightValues = sorted.map((r) => Number(r.weight) || null);
  const sleepValues  = sorted.map((r) => Number(r.sleep_hrs) || null);
  const waterValues  = sorted.map((r) => Number(r.water_oz) || null);

  if (weightCanvas) { buildWeightChart(weightCanvas, labels, weightValues); }
  if (sleepCanvas)  { buildSleepChart(sleepCanvas, labels.slice(-7), sleepValues.slice(-7)); }
  if (waterCanvas)  { buildWaterChart(waterCanvas, labels.slice(-7), waterValues.slice(-7)); }
}

async function renderSupplementBadges(todaySuppRows) {
  const grid = document.getElementById("supplements-grid");
  if (!grid) { return; }

  // build taken set from API data
  const takenSet = new Set();
  if (todaySuppRows && Array.isArray(todaySuppRows)) {
    todaySuppRows.forEach((row) => {
      if (String(row.taken).toLowerCase() === "true" || row.taken === true) {
        takenSet.add(row.supplement_name);
      }
    });
  }

  grid.innerHTML = CONFIG.SUPPLEMENTS.map((name) => {
    const taken_class = takenSet.has(name) ? " taken" : "";
    return `<span class="supp-badge${taken_class}" data-name="${name}">${name}</span>`;
  }).join("");

  // wire up click to toggle
  grid.querySelectorAll(".supp-badge").forEach((badge) => {
    badge.addEventListener("click", async () => {
      const name        = badge.dataset.name;
      const is_now_taken = !badge.classList.contains("taken");
      badge.classList.toggle("taken", is_now_taken);
      await toggleSupplement(name, is_now_taken, todayISO());
    });
  });
}

function renderHabitSummary(todayHabitRows) {
  const habitCard = document.getElementById("card-habits");
  if (!habitCard) { return; }

  let done_count  = 0;
  const total_count = CONFIG.HABITS.length;

  if (todayHabitRows && Array.isArray(todayHabitRows)) {
    todayHabitRows.forEach((row) => {
      if (String(row.completed).toLowerCase() === "true" || row.completed === true) {
        done_count++;
      }
    });
  }

  habitCard.innerHTML = `
    <div class="card-label">Habits</div>
    <div class="card-value card-value--sm">${done_count}<span style="font-size:1rem"> / ${total_count}</span></div>
    <div class="card-meta">completed today</div>
  `;
}

function renderHabitTrendBars(recentHabitRows) {
  const container = document.getElementById("habit-trend-bars");
  if (!container) { return; }

  if (!recentHabitRows || recentHabitRows.length === 0) {
    container.innerHTML = '<p class="state-loading">No habit data yet.</p>';
    return;
  }

  // count completions per habit over 30 days
  const completion_map = {};
  CONFIG.HABITS.forEach((habit) => {
    completion_map[habit] = { done: 0, total: 0 };
  });

  // count distinct dates we have data for
  const date_set = new Set();
  recentHabitRows.forEach((row) => {
    if (row.date) { date_set.add(row.date); }
  });
  const days_with_data = date_set.size;

  recentHabitRows.forEach((row) => {
    const habit_name = row.habit_name;
    if (completion_map[habit_name] === undefined) { return; }
    completion_map[habit_name].total++;
    if (String(row.completed).toLowerCase() === "true" || row.completed === true) {
      completion_map[habit_name].done++;
    }
  });

  const rows_html = CONFIG.HABITS.map((habit) => {
    const stats     = completion_map[habit];
    const days_seen = stats.total || days_with_data || 1;
    const pct       = Math.round((stats.done / days_seen) * 100);
    return `
      <div class="habit-bar-row">
        <span class="habit-bar-label">${habit}</span>
        <div class="habit-bar-track">
          <div class="habit-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="habit-bar-pct">${pct}%</span>
      </div>
    `;
  }).join("");

  container.innerHTML = rows_html;
}

// ── Check-in page ────────────────────────────────────────────

async function initCheckin() {
  if (!document.getElementById("checkin-root")) { return; }

  buildSupplementCheckboxes();
  buildHabitCheckboxes();
  wireStarRating();

  const banner     = document.getElementById("already-submitted-bar");
  const submitBtn  = document.getElementById("submit-btn");
  const editBtn    = document.getElementById("edit-mode-btn");
  const form       = document.getElementById("checkin-form");

  let is_edit_mode   = false;
  let existing_entry = null;

  // check if already submitted today
  const today_data = await fetchTodayCheckin();
  if (today_data && today_data.date === todayISO()) {
    existing_entry = today_data;
    if (banner) { banner.classList.add("visible"); }
    setFormDisabled(true);
    prefillForm(today_data);

    // also fill supplements and habits from today's data
    const [supp_rows, habit_rows] = await Promise.all([
      fetchTodaySupplements(),
      fetchTodayHabits(),
    ]);
    prefillSupplements(supp_rows);
    prefillHabits(habit_rows);
  }

  // edit mode button
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      is_edit_mode = true;
      setFormDisabled(false);
      if (banner) { banner.classList.remove("visible"); }
      if (submitBtn) { submitBtn.textContent = "Update Entry"; }
    });
  }

  // form submit
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleCheckinSubmit(is_edit_mode);
    });
  }
}

function buildSupplementCheckboxes() {
  const container = document.getElementById("supplement-checks");
  if (!container) { return; }

  container.innerHTML = CONFIG.SUPPLEMENTS.map((name) => {
    const id = `supp-${name.replace(/\s+/g, "-").toLowerCase()}`;
    return `
      <label class="check-item">
        <input type="checkbox" id="${id}" name="supplement" value="${name}">
        <span>${name}</span>
      </label>
    `;
  }).join("");
}

function buildHabitCheckboxes() {
  const container = document.getElementById("habit-checks");
  if (!container) { return; }

  container.innerHTML = CONFIG.HABITS.map((name) => {
    const id = `habit-${name.replace(/[\s/]+/g, "-").toLowerCase()}`;
    return `
      <label class="check-item">
        <input type="checkbox" id="${id}" name="habit" value="${name}">
        <span>${name}</span>
      </label>
    `;
  }).join("");
}

function wireStarRating() {
  const stars = document.querySelectorAll(".star-rating input");
  stars.forEach((input) => {
    input.addEventListener("change", () => {
      // visual handled by CSS :checked ~ label selectors
    });
  });
}

function setFormDisabled(disabled) {
  const form = document.getElementById("checkin-form");
  if (!form) { return; }
  const inputs = form.querySelectorAll("input, textarea, button[type='submit']");
  inputs.forEach((el) => {
    el.disabled = disabled;
  });
}

function prefillForm(data) {
  const set_val = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) { el.value = val; }
  };

  set_val("field-weight",  data.weight);
  set_val("field-water",   data.water_oz);
  set_val("field-sleep",   data.sleep_hrs);
  set_val("field-calories", data.calories);
  set_val("field-notes",   data.notes);

  // sleep quality stars
  const quality = Number(data.sleep_quality);
  if (quality >= 1 && quality <= 5) {
    const star_input = document.getElementById(`star-${quality}`);
    if (star_input) { star_input.checked = true; }
  }
}

function prefillSupplements(supp_rows) {
  if (!supp_rows || !Array.isArray(supp_rows)) { return; }
  supp_rows.forEach((row) => {
    if (String(row.taken).toLowerCase() === "true" || row.taken === true) {
      const id = `supp-${row.supplement_name.replace(/\s+/g, "-").toLowerCase()}`;
      const el = document.getElementById(id);
      if (el) { el.checked = true; }
    }
  });
}

function prefillHabits(habit_rows) {
  if (!habit_rows || !Array.isArray(habit_rows)) { return; }
  habit_rows.forEach((row) => {
    if (String(row.completed).toLowerCase() === "true" || row.completed === true) {
      const id = `habit-${row.habit_name.replace(/[\s/]+/g, "-").toLowerCase()}`;
      const el = document.getElementById(id);
      if (el) { el.checked = true; }
    }
  });
}

function collectFormData() {
  const get_num = (id) => {
    const el = document.getElementById(id);
    return el && el.value !== "" ? Number(el.value) : null;
  };
  const get_str = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  };

  // sleep quality from star rating
  let sleep_quality_rating = null;
  const checked_star = document.querySelector(".star-rating input:checked");
  if (checked_star) { sleep_quality_rating = Number(checked_star.value); }

  const checkin_data = {
    date:          todayISO(),
    weight:        get_num("field-weight"),
    water_oz:      get_num("field-water"),
    sleep_hrs:     get_num("field-sleep"),
    sleep_quality: sleep_quality_rating,
    calories:      get_num("field-calories"),
    notes:         get_str("field-notes"),
  };

  const supplement_data = CONFIG.SUPPLEMENTS.map((name) => {
    const id      = `supp-${name.replace(/\s+/g, "-").toLowerCase()}`;
    const el      = document.getElementById(id);
    const is_taken = el ? el.checked : false;
    return { date: todayISO(), supplement_name: name, taken: is_taken };
  });

  const habit_data = CONFIG.HABITS.map((name) => {
    const id          = `habit-${name.replace(/[\s/]+/g, "-").toLowerCase()}`;
    const el          = document.getElementById(id);
    const is_completed = el ? el.checked : false;
    return { date: todayISO(), habit_name: name, completed: is_completed };
  });

  return { checkin_data, supplement_data, habit_data };
}

async function handleCheckinSubmit(is_edit_mode) {
  const submit_btn   = document.getElementById("submit-btn");
  const result_banner = document.getElementById("result-banner");

  if (submit_btn) {
    submit_btn.disabled = true;
    submit_btn.textContent = "Saving…";
  }

  const { checkin_data, supplement_data, habit_data } = collectFormData();

  try {
    const checkin_fn = is_edit_mode ? putCheckin : postCheckin;
    const [checkin_result, supp_result, habit_result] = await Promise.all([
      checkin_fn(checkin_data),
      postSupplements(supplement_data),
      postHabits(habit_data),
    ]);

    const success = checkin_result && checkin_result.status === "ok";

    if (result_banner) {
      result_banner.className = `submit-banner visible ${success ? "submit-banner--success" : "submit-banner--error"}`;
      result_banner.textContent = success
        ? (is_edit_mode ? "✓ Entry updated successfully." : "✓ Check-in saved. Great work today!")
        : "Something went wrong — check the console and your Apps Script URL.";
    }

    if (success && submit_btn) {
      submit_btn.textContent = "Saved";
      setFormDisabled(true);
    } else if (submit_btn) {
      submit_btn.disabled  = false;
      submit_btn.textContent = is_edit_mode ? "Update Entry" : "Submit Check-in";
    }
  } catch (err) {
    console.error("Submit error:", err);
    if (result_banner) {
      result_banner.className = "submit-banner visible submit-banner--error";
      result_banner.textContent = "Unexpected error — see console for details.";
    }
    if (submit_btn) {
      submit_btn.disabled  = false;
      submit_btn.textContent = is_edit_mode ? "Update Entry" : "Submit Check-in";
    }
  }
}

// ── Boot ─────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
  initCheckin();
});
