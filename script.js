
const STORAGE_KEY = "fittrack_activities_v1";

const $ = (id) => document.getElementById(id);

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readActivities() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    if (!Array.isArray(data)) return [];

    return data.filter((a) =>
      a &&
      typeof a.id === "string" &&
      typeof a.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(a.date) &&
      typeof a.type === "string" &&
      ["Walking", "Running", "Cycling", "Gym", "Yoga",
       "Sports", "Other"].includes(a.type) &&
      [a.duration, a.calories, a.steps].every(
        n => Number.isSafeInteger(n) && n >= 0
      ) &&
      (a.notes === undefined ||
        (typeof a.notes === "string" && a.notes.length <= 250))
    );
  } catch {
    return [];
  }
}

let activities = readActivities();

function saveActivities() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    return true;
  } catch {
    $("message").textContent =
      "Could not save data. Check your browser storage settings.";
    return false;
  }
}

function totalForDay(date) {
  const records = activities.filter(a => a.date === date);

  return records.reduce((total, a) => ({
    steps: total.steps + a.steps,
    calories: total.calories + a.calories,
    duration: total.duration + a.duration,
    workouts: total.workouts + 1
  }), {
    steps: 0,
    calories: 0,
    duration: 0,
    workouts: 0
  });
}

function setProgress(id, value, goal) {
  $(id).style.width = `${Math.min(100, value / goal * 100)}%`;
}

function renderDashboard() {
  const date = $("selectedDate").value || localDate();
  const totals = totalForDay(date);

  $("steps").textContent = totals.steps.toLocaleString();
  $("calories").innerHTML =
    `${totals.calories.toLocaleString()} <small>kcal</small>`;
  $("minutes").innerHTML =
    `${totals.duration.toLocaleString()} <small>min</small>`;
  $("workouts").textContent = totals.workouts;

  setProgress("stepsBar", totals.steps, 10000);
  setProgress("caloriesBar", totals.calories, 500);
  setProgress("minutesBar", totals.duration, 60);

  renderWeeklyChart();
  renderHistory();
}

function renderWeeklyChart() {
  const selected = new Date($("selectedDate").value + "T12:00:00");
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(selected);
    date.setDate(date.getDate() - i);

    const key = localDate(date);
    days.push({
      date: key,
      label: date.toLocaleDateString("en-IN", {
        weekday: "short"
      }),
      steps: totalForDay(key).steps
    });
  }

  const max = Math.max(10000, ...days.map(d => d.steps));

  $("weeklyChart").innerHTML = days.map(day => {
    const height = Math.max(2, day.steps / max * 155);
    const isSelected = day.date === $("selectedDate").value;

    return `
      <div class="chart-day">
        <span class="bar-value">${day.steps >= 1000
          ? (day.steps / 1000).toFixed(1) + "k"
          : day.steps}</span>
        <div
          class="chart-bar ${isSelected ? "today" : ""}"
          style="height:${height}px"
          title="${day.date}: ${day.steps.toLocaleString()} steps">
        </div>
        <small>${day.label}</small>
      </div>
    `;
  }).join("");

  const total = days.reduce((sum, day) => sum + day.steps, 0);
  $("weeklyTotal").textContent = total.toLocaleString();
}

const icons = {
  Walking: "🚶",
  Running: "🏃",
  Cycling: "🚴",
  Gym: "🏋️",
  Yoga: "🧘",
  Sports: "⚽",
  Other: "💪"
};

function renderHistory() {
  const selected = $("selectedDate").value;

  const records = [...activities]
    .filter(a => a.date === selected)
    .sort((a, b) => b.id.localeCompare(a.id));

  if (!records.length) {
    $("activityList").innerHTML =
      '<div class="empty">No activities for this date yet. Add your first workout above! 💚</div>';
    return;
  }

  $("activityList").innerHTML = records.map(a => `
    <div class="activity">
      <div class="activity-icon">${icons[a.type] || "💪"}</div>
      <div class="activity-info">
        <strong>${escapeHTML(a.type)}</strong>
        <p>${a.duration} min · ${a.steps.toLocaleString()} steps</p>
        ${a.notes ? `<p>${escapeHTML(a.notes)}</p>` : ""}
      </div>
      <div class="activity-stats">
        <strong>${a.calories.toLocaleString()} kcal</strong>
      </div>
      <button
        class="delete-btn"
        data-delete="${escapeHTML(a.id)}"
        aria-label="Delete ${escapeHTML(a.type)} activity"
        title="Delete activity">✕</button>
    </div>
  `).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

$("activityForm").addEventListener("submit", event => {
  event.preventDefault();

  const activity = {
    id: crypto.randomUUID(),
    date: $("activityDate").value,
    type: $("type").value,
    duration: Number($("duration").value),
    calories: Number($("burned").value),
    steps: Number($("stepInput").value),
    notes: $("notes").value.trim()
  };

  if (
    !activity.date ||
    !Number.isSafeInteger(activity.duration) ||
    !Number.isSafeInteger(activity.calories) ||
    !Number.isSafeInteger(activity.steps) ||
    activity.duration < 0 || activity.duration > 1440 ||
    activity.calories < 0 || activity.calories > 100000 ||
    activity.steps < 0 || activity.steps > 1000000 ||
    activity.notes.length > 250
  ) {
    $("message").textContent = "Please enter valid activity details.";
    return;
  }

  activities.push(activity);

  if (!saveActivities()) {
    activities.pop();
    return;
  }

  $("selectedDate").value = activity.date;
  $("message").textContent = "Activity saved successfully! 🎉";

  $("duration").value = "";
  $("burned").value = "";
  $("stepInput").value = "";
  $("notes").value = "";

  renderDashboard();
});

$("selectedDate").addEventListener("change", () => {
  $("activityDate").value = $("selectedDate").value;
  $("message").textContent = "";
  renderDashboard();
});

$("activityList").addEventListener("click", event => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  const id = button.dataset.delete;
  const previous = activities;
  activities = activities.filter(a => a.id !== id);

  if (!saveActivities()) {
    activities = previous;
    return;
  }

  $("message").textContent = "Activity deleted.";
  renderDashboard();
});

$("clearBtn").addEventListener("click", () => {
  if (!activities.length) return;

  if (!confirm("Delete ALL saved fitness activities? This cannot be undone.")) {
    return;
  }

  const previous = activities;
  activities = [];

  if (!saveActivities()) {
    activities = previous;
    return;
  }

  $("message").textContent = "All activities cleared.";
  renderDashboard();
});

const today = localDate();
$("selectedDate").value = today;
$("activityDate").value = today;

renderDashboard();
