const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwwM1AFbWZPBUT2OJhF6pS0VRyWRpQvEaZVDOw74SUQJ1OsCIBCBtllO1rpP_FJ_T6t/exec",

  ANTHROPIC_API_KEY: "", // optional: paste your Anthropic key here to enable AI calorie estimation

  DAILY_GOALS: {
    water_oz: 100,
    calories: 2500,
    sleep_hrs: 7.5,
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
};
