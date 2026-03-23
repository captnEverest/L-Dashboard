const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwwM1AFbWZPBUT2OJhF6pS0VRyWRpQvEaZVDOw74SUQJ1OsCIBCBtllO1rpP_FJ_T6t/exec",

  // leave blank — set your Anthropic API key in Settings (stored in localStorage, never in the repo)
  ANTHROPIC_API_KEY: "",

  DAILY_GOALS: {
    water_oz:          100,
    calories:          2500,
    sleep_hrs:         7.5,
    workout_days_week: 4,
  },

  SUPPLEMENTS: {
    morning: [
      "Creatine (5g)",
      "Alpha GPC (300-600mg)",
      "Omega-3 (1-2g EPA+DHA)",
      "Vitamin D3 (2000-4000 IU)",
      "Vitamin K2 (100mcg)",
      "L-Theanine (morning)",
    ],
    evening: [
      "Magnesium Glycinate (300-400mg)",
      "Ashwagandha KSM-66 (600mg)",
      "Zinc (10-15mg)",
      "L-Theanine (evening, optional)",
    ],
  },

  HABITS: [
    "Read 20 min",
    "Research / paper reading",
    "Deep work session",
    "Journaling",
    "Meditation",
  ],

  BODY_COMP: {
    start_date:         "",    // e.g. "2026-03-23" — fill in manually
    start_weight_lbs:   null,
    start_body_fat_pct: null,
  },

  WORKOUT: {
    weekly_goal_days:    4,
    default_duration_min: 60,
  },

  MEASUREMENTS: [
    "Chest",
    "Waist",
    "Hips",
    "Left Arm",
    "Right Arm",
    "Left Thigh",
    "Right Thigh",
  ],
};
