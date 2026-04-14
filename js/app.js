import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { 
  collection, addDoc, getDocs, deleteDoc, doc, getDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; 

const STORAGE_KEYS = {
  user: "fitcoach_user",
  profile: "fitcoach_profile",
  workouts: "fitcoach_workouts",
  plan: "fitcoach_plan",
  meal: "fitcoach_meal",
  mealLogs: "fitcoach_meal_logs",
  goals: "fitcoach_goals",
  coachMessages: "fitcoach_coach_messages",
  schedule: "fitcoach_schedule"
};

const protectedPages = ["home.html", "dashboard.html", "workout.html", "plan.html", "meal.html", "help.html"];

function go(page) {
  window.location.href = page;
}

function getCurrentPage() {
  return window.location.pathname.split("/").pop() || "dashboard.html";
}

function getStoredValue(key, fallback) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

function setStoredValue(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUser() {
  return getStoredValue(STORAGE_KEYS.user, null);
}

function setUser(user) {
  setStoredValue(STORAGE_KEYS.user, user);
}

function getProfile() {
  return getStoredValue(STORAGE_KEYS.profile, {});
}

function isFirebaseUser() {
  const user = getUser();
  return Boolean(user?.uid);
}

async function syncFirestoreField(field, value) {
  const user = getUser();
  if (!user?.uid) {
    return;
  }

  try {
    await setDoc(doc(db, "users", user.uid), { [field]: value }, { merge: true });
  } catch (error) {
    console.warn(`Failed to sync ${field} to Firestore:`, error.message);
  }
}

async function loadFirestoreData(uid) {
  try {
    const snapshot = await getDoc(doc(db, "users", uid));
    if (!snapshot.exists()) {
      return;
    }

    const data = snapshot.data();
    if (data.profile) {
      setStoredValue(STORAGE_KEYS.profile, data.profile);
    }
    if (Array.isArray(data.workouts)) {
      setStoredValue(STORAGE_KEYS.workouts, data.workouts);
    }
    if (Array.isArray(data.goals)) {
      setStoredValue(STORAGE_KEYS.goals, data.goals);
    }
    if (Array.isArray(data.mealLogs)) {
      setStoredValue(STORAGE_KEYS.mealLogs, data.mealLogs);
    }
    if (Array.isArray(data.schedule)) {
      setStoredValue(STORAGE_KEYS.schedule, data.schedule);
    }
    if (data.plan) {
      setStoredValue(STORAGE_KEYS.plan, data.plan);
    }
    if (Array.isArray(data.coachMessages)) {
      setStoredValue(STORAGE_KEYS.coachMessages, data.coachMessages);
    }
  } catch (error) {
    console.warn("Failed to load Firestore user data:", error.message);
  }
}

function saveProfile(profile) {
  setStoredValue(STORAGE_KEYS.profile, profile);
  syncFirestoreField("profile", profile);
}

async function logout() {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn("Firebase logout failed", err.message);
  }
  localStorage.removeItem(STORAGE_KEYS.user);
  go("login.html");
}

function getWorkouts() {
  return getStoredValue(STORAGE_KEYS.workouts, []);
}

function saveWorkouts(workouts) {
  setStoredValue(STORAGE_KEYS.workouts, workouts);
  syncFirestoreField("workouts", workouts);
}

function getGoals() {
  return getStoredValue(STORAGE_KEYS.goals, []);
}

function saveGoals(goals) {
  setStoredValue(STORAGE_KEYS.goals, goals);
  syncFirestoreField("goals", goals);
}

function getMealLogs() {
  return getStoredValue(STORAGE_KEYS.mealLogs, []);
}

function saveMealLogs(mealLogs) {
  setStoredValue(STORAGE_KEYS.mealLogs, mealLogs);
  syncFirestoreField("mealLogs", mealLogs);
}

function getCoachMessages() {
  return getStoredValue(STORAGE_KEYS.coachMessages, []);
}

function saveCoachMessages(messages) {
  setStoredValue(STORAGE_KEYS.coachMessages, messages);
  syncFirestoreField("coachMessages", messages);
}

function getSchedule() {
  return getStoredValue(STORAGE_KEYS.schedule, []);
}

function saveSchedule(schedule) {
  setStoredValue(STORAGE_KEYS.schedule, schedule);
  syncFirestoreField("schedule", schedule);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function showMessage(id, message, isError) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle("error", Boolean(isError));
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatShortDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short"
  });
}

function getStartOfWeek(baseDate) {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekDates(baseDate) {
  const start = getStartOfWeek(baseDate || new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-IN", { weekday: "short" }),
      day: date.getDate()
    };
  });
}

function estimateCalories(workout) {
  const duration = Number(workout.duration) || 0;
  const reps = Number(workout.reps) || 0;
  const sets = Number(workout.sets) || 0;
  const intensity = workout.intensity || "Moderate";
  const multipliers = { Low: 5, Moderate: 7, High: 9 };

  if (workout.category === "Cardio") {
    return Math.round(duration * multipliers[intensity]);
  }

  const strengthBase = Math.max(sets * reps * 0.45, duration * 4.2);
  return Math.round(strengthBase * (multipliers[intensity] / 7));
}

function buildWorkoutSummary(workout) {
  if (workout.category === "Cardio") {
    return `${workout.duration} min ${workout.exercise.toLowerCase()} session`;
  }

  return `${workout.sets} sets x ${workout.reps} reps`;
}

function getDailyBuckets(workouts, daysToShow) {
  const today = new Date();
  const buckets = [];

  for (let index = daysToShow - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: date.toLocaleDateString("en-IN", { weekday: "short" }),
      workouts: 0,
      cardioMinutes: 0,
      strengthVolume: 0
    });
  }

  workouts.forEach((workout) => {
    const bucket = buckets.find((item) => item.key === workout.date);
    if (!bucket) {
      return;
    }

    bucket.workouts += 1;
    bucket.cardioMinutes += workout.category === "Cardio" ? Number(workout.duration) || 0 : 0;
    bucket.strengthVolume += workout.category === "Strength"
      ? (Number(workout.sets) || 0) * (Number(workout.reps) || 0)
      : 0;
  });

  return buckets;
}

function calculateStreak(workouts) {
  const uniqueDays = [...new Set(workouts.map((workout) => workout.date))].sort().reverse();
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  uniqueDays.forEach((day, index) => {
    const compare = new Date(cursor);
    compare.setDate(cursor.getDate() - index);
    if (compare.toISOString().slice(0, 10) === day) {
      streak += 1;
    }
  });

  return streak;
}

function getMetrics(workouts) {
  const totalCalories = workouts.reduce((sum, workout) => sum + estimateCalories(workout), 0);
  const totalCardioMinutes = workouts.reduce((sum, workout) => {
    return sum + (workout.category === "Cardio" ? Number(workout.duration) || 0 : 0);
  }, 0);
  const strengthVolume = workouts.reduce((sum, workout) => {
    return sum + (workout.category === "Strength" ? (Number(workout.sets) || 0) * (Number(workout.reps) || 0) : 0);
  }, 0);
  const activeDays = new Set(workouts.map((workout) => workout.date)).size;

  return {
    totalWorkouts: workouts.length,
    totalCalories,
    totalCardioMinutes,
    strengthVolume,
    activeDays,
    streak: calculateStreak(workouts)
  };
}

function getGoalProgress(goal) {
  const current = Number(goal.current) || 0;
  const target = Number(goal.target) || 0;
  if (!target) {
    return 0;
  }

  return Math.min(100, Math.round((current / target) * 100));
}

function getProfileCompletion(profile) {
  const fields = [
    profile.age,
    profile.height,
    profile.weight,
    profile.level,
    profile.trainingDays,
    profile.equipment
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function getNextScheduledSession() {
  const today = new Date().toISOString().slice(0, 10);
  return getSchedule()
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .find((session) => session.date >= today);
}

function generateCoachReply(prompt) {
  const profile = getProfile();
  const workouts = getWorkouts();
  const goals = getGoals();
  const schedule = getSchedule();
  const metrics = getMetrics(workouts);
  const latestWorkout = workouts[workouts.length - 1];
  const nextSession = getNextScheduledSession();
  const normalizedPrompt = prompt.toLowerCase();

  if (normalizedPrompt.includes("today") || normalizedPrompt.includes("train")) {
    if (nextSession) {
      return `Your next planned session is ${nextSession.title} on ${formatShortDate(nextSession.date)}. Based on your profile, keep the effort around ${profile.level || "intermediate"} quality and focus on clean execution.`;
    }
    return "You do not have a scheduled session yet. Add one in the weekly planner, then I can guide the day more specifically.";
  }

  if (normalizedPrompt.includes("goal") || normalizedPrompt.includes("progress")) {
    const activeGoal = goals[goals.length - 1];
    if (activeGoal) {
      return `Your latest goal is ${activeGoal.title}. You're currently at ${getGoalProgress(activeGoal)}% completion, with ${metrics.activeDays} active days logged so far.`;
    }
    return "You have not added a milestone yet. Add a goal in the dashboard and I will use it for more focused coaching.";
  }

  if (normalizedPrompt.includes("recovery") || normalizedPrompt.includes("rest")) {
    return `Recovery check: you've logged ${metrics.totalWorkouts} workouts and have a ${metrics.streak}-day streak. Prioritize sleep, hydration, and one easier session if fatigue has been building for more than a few days.`;
  }

  if (normalizedPrompt.includes("meal") || normalizedPrompt.includes("nutrition")) {
    return `Nutrition direction: your saved goal is ${profile.goal || getUser()?.goal || "performance"}. Keep protein high, match carbs to harder training days, and use the meal page to log at least one quality check-in daily.`;
  }

  if (latestWorkout) {
    return `Your latest logged session was ${latestWorkout.exercise} on ${formatShortDate(latestWorkout.date)}. Based on your current data, keep building consistency and make one measurable improvement this week.`;
  }

  return "I can help with training, recovery, nutrition, and scheduling. Ask me what to train today, how your progress looks, or how to balance recovery with your current workload.";
}

function renderUser() {
  const user = getUser();
  const profile = getProfile();
  if (!user) {
    return;
  }

  const userName = profile.fullName || user.name || "Athlete";
  setText("userName", userName);
  setText("welcomeName", userName);
  setText("homeUserName", userName);
  setText("profileName", userName);
}

function renderHomeSummary() {
  if (!document.getElementById("homeTotalWorkouts")) {
    return;
  }

  const workouts = getWorkouts();
  const goals = getGoals();
  const mealLogs = getMealLogs();
  const profile = getProfile();
  const metrics = getMetrics(workouts);
  const completedGoals = goals.filter((goal) => getGoalProgress(goal) >= 100).length;
  const nextSession = getNextScheduledSession();

  setText("homeTotalWorkouts", metrics.totalWorkouts);
  setText("homeCalories", `${metrics.totalCalories} kcal`);
  setText("homeStreak", `${metrics.streak} day streak`);
  setText("homeMeals", mealLogs.length);
  setText("homeGoalCount", `${completedGoals}/${goals.length || 0}`);
  setText("homeProfileCompletion", `${getProfileCompletion(profile)}%`);
  setText("homeNextSession", nextSession ? `${nextSession.title} on ${formatShortDate(nextSession.date)}` : "No session planned");
}

function renderDashboard() {
  if (!document.getElementById("totalWorkouts")) {
    return;
  }

  const workouts = getWorkouts();
  const goals = getGoals();
  const schedule = getSchedule();
  const profile = getProfile();
  const metrics = getMetrics(workouts);
  const weekly = getDailyBuckets(workouts, 7);
  const completedGoals = goals.filter((goal) => getGoalProgress(goal) >= 100).length;
  const nextSession = getNextScheduledSession();

  setText("totalWorkouts", metrics.totalWorkouts);
  setText("cardioMinutes", `${metrics.totalCardioMinutes} min`);
  setText("strengthVolume", metrics.strengthVolume);
  setText("streak", `${metrics.streak} days`);
  setText("calorieBurn", `${metrics.totalCalories} kcal`);
  setText("activeDays", metrics.activeDays);
  setText("weeklySessions", weekly.reduce((sum, day) => sum + day.workouts, 0));
  setText("consistencyScore", `${Math.min(100, weekly.reduce((sum, day) => sum + day.workouts, 0) * 14)}%`);
  setText("goalsAchieved", `${completedGoals}/${goals.length || 0}`);
  setText("profileCompletion", `${getProfileCompletion(profile)}%`);
  setText("scheduledCount", schedule.length);
  setText("nextSession", nextSession ? `${nextSession.title} on ${formatShortDate(nextSession.date)}` : "No session planned");

  renderChart(weekly);
  renderInsights(workouts, metrics);
  renderRecentWorkoutTable();
  renderRecentMealTable();
  renderGoalCards();
  renderProfilePanel();
  renderCoachChat();
  renderSchedule();
}

function renderChart(weekly) {
  const canvas = document.getElementById("chart");
  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  if (window.fitCoachChart) {
    window.fitCoachChart.destroy();
  }

  window.fitCoachChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: weekly.map((day) => day.label),
      datasets: [
        {
          label: "Cardio Minutes",
          data: weekly.map((day) => day.cardioMinutes),
          borderColor: "#19b47a",
          backgroundColor: "rgba(25, 180, 122, 0.14)",
          tension: 0.35,
          fill: true
        },
        {
          label: "Strength Volume",
          data: weekly.map((day) => day.strengthVolume),
          borderColor: "#3498ff",
          backgroundColor: "rgba(52, 152, 255, 0.12)",
          tension: 0.35,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#536780"
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#6a7d97"
          },
          grid: {
            color: "rgba(120, 145, 180, 0.12)"
          }
        },
        y: {
          ticks: {
            color: "#6a7d97"
          },
          grid: {
            color: "rgba(120, 145, 180, 0.12)"
          }
        }
      }
    }
  });
}

function renderInsights(workouts, metrics) {
  const container = document.getElementById("insights");
  if (!container) {
    return;
  }

  if (!workouts.length) {
    container.innerHTML = '<div class="empty-state">Start by logging your first workout. Your weekly trends and AI coach insights will show up here.</div>';
    return;
  }

  const latest = workouts[workouts.length - 1];
  const balance = metrics.totalCardioMinutes > 90 ? "Cardio base is strong" : "Add 2 cardio sessions this week";
  const coaching = latest.category === "Strength"
    ? "Progressive overload is your next lever. Increase reps, sets, or load slightly in the next strength block."
    : "Your cardio consistency is building. Add one interval day and one recovery day for better adaptation.";

  container.innerHTML = `
    <div class="insight-card">
      <h3>Latest session</h3>
      <p class="section-copy">${latest.exercise} on ${formatDate(latest.date)}.</p>
      <span class="pill">${buildWorkoutSummary(latest)}</span>
    </div>
    <div class="insight-card">
      <h3>Coach note</h3>
      <p class="section-copy">${coaching}</p>
      <span class="pill">${metrics.totalCalories} kcal estimated burn</span>
    </div>
    <div class="insight-card">
      <h3>Balance check</h3>
      <p class="section-copy">${balance} to support your goal and improve recovery quality.</p>
      <span class="pill">${metrics.activeDays} active days logged</span>
    </div>
  `;
}

function renderWorkoutList() {
  const list = document.getElementById("list");
  if (!list) {
    return;
  }

  const workouts = getWorkouts().slice().reverse();

  if (!workouts.length) {
    list.innerHTML = '<div class="empty-state">No sessions logged yet. Add a gym workout or cardio session to build your fitness timeline.</div>';
    return;
  }

  list.innerHTML = workouts.map((workout) => `
    <article class="workout-card">
      <div class="workout-head">
        <div>
          <h3>${workout.exercise}</h3>
          <p class="muted">${formatDate(workout.date)} - ${workout.goal}</p>
        </div>
        <span class="pill">${workout.category}</span>
      </div>
      <div class="workout-meta">
        <span class="pill">${buildWorkoutSummary(workout)}</span>
        <span class="pill">${estimateCalories(workout)} kcal</span>
        <span class="pill">${workout.intensity} intensity</span>
      </div>
      ${workout.notes ? `<p class="section-copy">${workout.notes}</p>` : ""}
    </article>
  `).join("");
}

function renderRecentWorkoutTable() {
  const target = document.getElementById("recentWorkouts");
  if (!target) {
    return;
  }

  const workouts = getWorkouts().slice().reverse().slice(0, 5);
  if (!workouts.length) {
    target.innerHTML = '<div class="empty-state">Workout history will appear here after your first log.</div>';
    return;
  }

  target.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Exercise</th>
            <th>Type</th>
            <th>Volume</th>
          </tr>
        </thead>
        <tbody>
          ${workouts.map((workout) => `
            <tr>
              <td>${formatDate(workout.date)}</td>
              <td>${workout.exercise}</td>
              <td>${workout.category}</td>
              <td>${buildWorkoutSummary(workout)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRecentMealTable() {
  const target = document.getElementById("recentMeals");
  if (!target) {
    return;
  }

  const meals = getMealLogs().slice().reverse().slice(0, 5);
  if (!meals.length) {
    target.innerHTML = '<div class="empty-state">Meal check-ins will appear here once you log food entries.</div>';
    return;
  }

  target.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Meal</th>
            <th>Calories</th>
            <th>Protein</th>
          </tr>
        </thead>
        <tbody>
          ${meals.map((meal) => `
            <tr>
              <td>${formatDate(meal.date)}</td>
              <td>${meal.food}</td>
              <td>${meal.calories}</td>
              <td>${meal.protein} g</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderGoalCards() {
  const target = document.getElementById("goalList");
  if (!target) {
    return;
  }

  const goals = getGoals().slice().reverse();
  if (!goals.length) {
    target.innerHTML = '<div class="empty-state">Add your first goal to track milestones like weight loss, cardio minutes, or mobility streaks.</div>';
    return;
  }

  target.innerHTML = goals.map((goal) => {
    const progress = getGoalProgress(goal);
    const statusClass = progress >= 100 ? "success" : "blue";
    const statusLabel = progress >= 100 ? "Completed" : `${progress}% complete`;

    return `
      <article class="goal-card">
        <div class="workout-head">
          <div>
            <h3>${goal.title}</h3>
            <p class="muted">Target ${goal.target} - Current ${goal.current}${goal.dueDate ? ` - ${formatDate(goal.dueDate)}` : ""}</p>
          </div>
          <span class="chip ${statusClass}">${statusLabel}</span>
        </div>
        <div class="card-meta">
          <span class="pill">${goal.category}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${progress}%;"></div>
        </div>
      </article>
    `;
  }).join("");
}

function renderMealLogList() {
  const target = document.getElementById("mealLogList");
  if (!target) {
    return;
  }

  const mealLogs = getMealLogs().slice().reverse();
  if (!mealLogs.length) {
    target.innerHTML = '<div class="empty-state">Log meals to see your nutrition history and bring the dashboard to life.</div>';
    return;
  }

  target.innerHTML = mealLogs.map((meal) => `
    <article class="workout-card">
      <div class="workout-head">
        <div>
          <h3>${meal.food}</h3>
          <p class="muted">${formatDate(meal.date)} - ${meal.type}</p>
        </div>
        <span class="pill">${meal.calories} kcal</span>
      </div>
      <div class="workout-meta">
        <span class="pill">${meal.protein} g protein</span>
        <span class="pill">${meal.note || "Meal logged"}</span>
      </div>
    </article>
  `).join("");
}

function renderProfilePanel() {
  const profile = getProfile();
  const panel = document.getElementById("profileSummary");
  if (panel) {
    const goal = profile.goal || getUser()?.goal || "Not set";
    const level = profile.level || "Not set";
    const days = profile.trainingDays || "-";
    panel.innerHTML = `
      <div class="goal-list">
        <article class="resource-card">
          <h3>${profile.fullName || getUser()?.name || "Athlete"}</h3>
          <p>Goal: ${goal}</p>
          <div class="card-meta">
            <span class="pill">${level}</span>
            <span class="pill">${days} days/week</span>
          </div>
        </article>
        <article class="resource-card">
          <h3>Body stats</h3>
          <p>Age ${profile.age || "-"} - Height ${profile.height || "-"} cm - Weight ${profile.weight || "-"} kg</p>
        </article>
        <article class="resource-card">
          <h3>Equipment</h3>
          <p>${profile.equipment || "Not set yet"}</p>
        </article>
      </div>
    `;
  }

  const fields = {
    profileFullName: profile.fullName || getUser()?.name || "",
    profileAge: profile.age || "",
    profileHeight: profile.height || "",
    profileWeight: profile.weight || "",
    profileLevel: profile.level || "Intermediate",
    profileTrainingDays: profile.trainingDays || "",
    profileEquipment: profile.equipment || "Gym",
    profileGoal: profile.goal || getUser()?.goal || "Fat Loss"
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element && !element.dataset.locked) {
      element.value = value;
      element.dataset.locked = "true";
    }
  });
}

function renderCoachChat() {
  const target = document.getElementById("coachMessages");
  if (!target) {
    return;
  }

  const messages = getCoachMessages();
  if (!messages.length) {
    target.innerHTML = `
      <article class="chat-message coach">
        <div class="chat-bubble">
          Ask me things like "what should I train today?", "how is my progress?", or "how should I recover?"
        </div>
      </article>
    `;
    return;
  }

  target.innerHTML = messages.map((message) => `
    <article class="chat-message ${message.role}">
      <div class="chat-bubble">
        <strong>${message.role === "user" ? "You" : "Coach"}</strong>
        <p>${message.content}</p>
      </div>
    </article>
  `).join("");

  target.scrollTop = target.scrollHeight;
}

function sendCoachMessage() {
  const input = document.getElementById("coachInput");
  const prompt = input?.value.trim();

  if (!prompt) {
    showMessage("coachMessageStatus", "Type a question for your coach first.", true);
    return;
  }

  const messages = getCoachMessages();
  messages.push({
    role: "user",
    content: prompt,
    createdAt: new Date().toISOString()
  });

  messages.push({
    role: "coach",
    content: generateCoachReply(prompt),
    createdAt: new Date().toISOString()
  });

  saveCoachMessages(messages);
  input.value = "";
  showMessage("coachMessageStatus", "Coach response updated.");
  renderCoachChat();
}

function renderSchedule() {
  const calendar = document.getElementById("scheduleCalendar");
  const list = document.getElementById("scheduleList");
  if (!calendar && !list) {
    return;
  }

  const week = getWeekDates(new Date());
  const schedule = getSchedule();

  if (calendar) {
    calendar.innerHTML = week.map((day) => {
      const daySessions = schedule.filter((session) => session.date === day.key);
      return `
        <article class="calendar-day">
          <div class="split">
            <strong>${day.label}</strong>
            <span>${day.day}</span>
          </div>
          <div class="calendar-stack">
            ${daySessions.length ? daySessions.map((session) => `<span class="chip blue">${session.title}</span>`).join("") : '<span class="muted">No session</span>'}
          </div>
        </article>
      `;
    }).join("");
  }

  if (list) {
    if (!schedule.length) {
      list.innerHTML = '<div class="empty-state">Add your first scheduled session to build your weekly training calendar.</div>';
      return;
    }

    list.innerHTML = schedule
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((session) => `
        <article class="workout-card">
          <div class="workout-head">
            <div>
              <h3>${session.title}</h3>
              <p class="muted">${formatDate(session.date)} - ${session.time || "Any time"}</p>
            </div>
            <span class="pill">${session.type}</span>
          </div>
          <div class="workout-meta">
            <span class="pill">${session.focus}</span>
            <span class="pill">${session.duration} min</span>
          </div>
        </article>
      `).join("");
  }
}

function saveProfileSetup() {
  const fullName = document.getElementById("profileFullName")?.value.trim();
  const age = document.getElementById("profileAge")?.value.trim();
  const height = document.getElementById("profileHeight")?.value.trim();
  const weight = document.getElementById("profileWeight")?.value.trim();
  const level = document.getElementById("profileLevel")?.value || "Intermediate";
  const trainingDays = document.getElementById("profileTrainingDays")?.value.trim();
  const equipment = document.getElementById("profileEquipment")?.value || "Gym";
  const goal = document.getElementById("profileGoal")?.value || "Fat Loss";

  if (!fullName) {
    showMessage("profileMessage", "Add your name before saving the profile.", true);
    return;
  }

  const profile = {
    fullName,
    age,
    height,
    weight,
    level,
    trainingDays,
    equipment,
    goal,
    updatedAt: new Date().toISOString()
  };

  saveProfile(profile);
  const user = getUser();
  if (user) {
    setUser({ ...user, name: fullName, goal });
  }

  showMessage("profileMessage", "Profile saved. The coach and scheduler can now personalize better.");
  renderUser();
  renderProfilePanel();
  renderHomeSummary();
  renderDashboard();
}

function saveScheduleEntry() {
  const title = document.getElementById("scheduleTitle")?.value.trim();
  const type = document.getElementById("scheduleType")?.value || "Strength";
  const focus = document.getElementById("scheduleFocus")?.value || "Full Body";
  const duration = Number(document.getElementById("scheduleDuration")?.value || 0);
  const date = document.getElementById("scheduleDate")?.value || "";
  const time = document.getElementById("scheduleTime")?.value || "";

  if (!title || !date || !duration) {
    showMessage("scheduleMessage", "Add a session title, date, and duration.", true);
    return;
  }

  const schedule = getSchedule();
  schedule.push({
    id: `session-${Date.now()}`,
    title,
    type,
    focus,
    duration,
    date,
    time,
    createdAt: new Date().toISOString()
  });

  saveSchedule(schedule);
  document.getElementById("scheduleForm")?.reset();
  seedDefaults();
  showMessage("scheduleMessage", "Session added to your weekly calendar.");
  renderSchedule();
  renderHomeSummary();
  renderDashboard();
}

function saveWorkout() {
  const exercise = document.getElementById("exercise")?.value.trim();
  const category = document.getElementById("category")?.value || "Strength";
  const goal = document.getElementById("workoutGoal")?.value || "Performance";
  const date = document.getElementById("date")?.value || new Date().toISOString().slice(0, 10);
  const sets = Number(document.getElementById("sets")?.value || 0);
  const reps = Number(document.getElementById("reps")?.value || 0);
  const duration = Number(document.getElementById("duration")?.value || 0);
  const intensity = document.getElementById("intensity")?.value || "Moderate";
  const notes = document.getElementById("notes")?.value.trim() || "";

  if (!exercise) {
    showMessage("workoutMessage", "Add an exercise or cardio activity name first.", true);
    return;
  }

  if (category === "Strength" && (!sets || !reps)) {
    showMessage("workoutMessage", "Strength sessions need both sets and reps.", true);
    return;
  }

  if (category === "Cardio" && !duration) {
    showMessage("workoutMessage", "Cardio sessions need a duration in minutes.", true);
    return;
  }

  const workouts = getWorkouts();
  workouts.push({
    id: `workout-${Date.now()}`,
    exercise,
    category,
    goal,
    date,
    sets,
    reps,
    duration,
    intensity,
    notes,
    createdAt: new Date().toISOString()
  });

  saveWorkouts(workouts);
  document.getElementById("workoutForm")?.reset();
  seedDefaults();
  showMessage("workoutMessage", "Workout saved. Your dashboard and coaching insights are now updated.");
  renderWorkoutList();
  renderDashboard();
  renderHomeSummary();
}

function saveGoal() {
  const title = document.getElementById("goalTitle")?.value.trim();
  const target = Number(document.getElementById("goalTarget")?.value || 0);
  const current = Number(document.getElementById("goalCurrent")?.value || 0);
  const category = document.getElementById("goalCategory")?.value || "Performance";
  const dueDate = document.getElementById("goalDate")?.value || "";

  if (!title || !target) {
    showMessage("goalMessage", "Add a goal title and target value.", true);
    return;
  }

  const goals = getGoals();
  goals.push({
    id: `goal-${Date.now()}`,
    title,
    target,
    current,
    category,
    dueDate,
    createdAt: new Date().toISOString()
  });

  saveGoals(goals);
  document.getElementById("goalForm")?.reset();
  seedDefaults();
  showMessage("goalMessage", "Goal added. Your milestone tracker has been updated.");
  renderGoalCards();
  renderDashboard();
  renderHomeSummary();
}

function generatePlan() {
  const goal = document.getElementById("goal")?.value || "Fat Loss";
  const level = document.getElementById("level")?.value || "Beginner";
  const days = Number(document.getElementById("daysPerWeek")?.value || 4);
  const focus = document.getElementById("focus")?.value || "Balanced";
  const equipment = document.getElementById("equipment")?.value || "Gym";

  const splitByGoal = {
    "Fat Loss": ["2 full-body strength sessions", "2 interval cardio sessions", "1 long low-intensity cardio session"],
    "Muscle Gain": ["2 upper body hypertrophy days", "2 lower body hypertrophy days", "1 optional conditioning day"],
    Performance: ["2 strength days", "2 speed or conditioning days", "1 mobility and recovery day"]
  };

  const habitsByLevel = {
    Beginner: "Keep 1-2 reps in reserve and focus on movement quality before loading more weight.",
    Intermediate: "Track progression weekly and aim for one measurable improvement in volume, speed, or density.",
    Advanced: "Periodize intensity across the week and keep one lower-stress recovery session to protect performance."
  };

  const nutritionByGoal = {
    "Fat Loss": "Prioritize protein at each meal, build a light calorie deficit, and keep fiber high for recovery and satiety.",
    "Muscle Gain": "Use a small calorie surplus, hit your protein target daily, and place carbs around training windows.",
    Performance: "Fuel around training, stay hydrated, and match carbs to higher output days."
  };

  const weeklySplit = (splitByGoal[goal] || splitByGoal.Performance).slice(0, Math.min(days, 5));
  const plan = {
    headline: `${goal} plan for a ${level.toLowerCase()} athlete training ${days} days/week`,
    coaching: `${habitsByLevel[level]} Main emphasis: ${focus.toLowerCase()} work with ${equipment.toLowerCase()} access.`,
    split: weeklySplit,
    recovery: [
      "Sleep 7-9 hours and keep one easier day after your hardest training block.",
      "Use a 5-8 minute mobility reset after workouts, especially on lower body and cardio-heavy days.",
      "Review the dashboard weekly and adjust volume if fatigue rises for more than 3 days."
    ],
    nutrition: nutritionByGoal[goal] || nutritionByGoal.Performance
  };

  setStoredValue(STORAGE_KEYS.plan, plan);
  syncFirestoreField("plan", plan);
  renderPlan(plan);
}

function renderPlan(savedPlan) {
  const target = document.getElementById("result");
  if (!target) {
    return;
  }

  const plan = savedPlan || getStoredValue(STORAGE_KEYS.plan, null);
  if (!plan) {
    target.innerHTML = '<div class="empty-state">Choose your goal, training level, and weekly availability to generate your coaching plan.</div>';
    return;
  }

  target.innerHTML = `
    <div class="coach-plan">
      <div class="plan-block">
        <h3>${plan.headline}</h3>
        <p class="section-copy">${plan.coaching}</p>
      </div>
      <div class="plan-block">
        <h3>Weekly split</h3>
        <ul>${plan.split.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
      <div class="plan-block">
        <h3>Recovery rules</h3>
        <ul>${plan.recovery.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
      <div class="plan-block">
        <h3>Nutrition direction</h3>
        <p class="section-copy">${plan.nutrition}</p>
      </div>
    </div>
  `;
}

function mealPlan() {
  const goal = document.getElementById("mealGoal")?.value || "Fat Loss";
  const preference = document.getElementById("preference")?.value || "High Protein";
  const meals = {
    "Fat Loss": {
      breakfast: "Greek yogurt bowl with berries, chia seeds, and oats",
      lunch: "Grilled chicken, rice, mixed greens, and cucumber mint yogurt",
      dinner: "Salmon or tofu, roasted vegetables, and quinoa",
      snack: "Protein shake or cottage cheese with fruit"
    },
    "Muscle Gain": {
      breakfast: "Egg scramble, toast, fruit, and peanut butter oats",
      lunch: "Chicken burrito bowl with rice, beans, avocado, and salsa",
      dinner: "Lean beef or paneer, potatoes, vegetables, and olive oil",
      snack: "Smoothie with milk, banana, oats, and protein"
    },
    Performance: {
      breakfast: "Overnight oats, banana, whey, and almonds",
      lunch: "Turkey or chickpea wrap, fruit, and yogurt",
      dinner: "Rice, fish or tofu, stir-fry vegetables, and broth soup",
      snack: "Rice cakes with nut butter and a protein yogurt"
    }
  };

  const selected = meals[goal] || meals.Performance;
  const mealOutput = {
    title: `${goal} meal strategy`,
    note: `${preference} preference selected. Keep hydration and recovery meals consistent around training.`,
    items: selected
  };

  setStoredValue(STORAGE_KEYS.meal, mealOutput);
  renderMealPlan(mealOutput);
}

function renderMealPlan(savedMeal) {
  const target = document.getElementById("meal");
  if (!target) {
    return;
  }

  const meal = savedMeal || getStoredValue(STORAGE_KEYS.meal, null);
  if (!meal) {
    target.innerHTML = '<div class="empty-state">Generate a meal strategy that fits your goal and nutrition style.</div>';
    return;
  }

  target.innerHTML = `
    <div class="meal-plan">
      <div class="plan-block">
        <h3>${meal.title}</h3>
        <p class="section-copy">${meal.note}</p>
      </div>
      <div class="plan-block">
        <h3>Breakfast</h3>
        <p class="section-copy">${meal.items.breakfast}</p>
      </div>
      <div class="plan-block">
        <h3>Lunch</h3>
        <p class="section-copy">${meal.items.lunch}</p>
      </div>
      <div class="plan-block">
        <h3>Dinner</h3>
        <p class="section-copy">${meal.items.dinner}</p>
      </div>
      <div class="plan-block">
        <h3>Snack</h3>
        <p class="section-copy">${meal.items.snack}</p>
      </div>
    </div>
  `;
}

function saveMealLog() {
  const food = document.getElementById("foodName")?.value.trim();
  const calories = Number(document.getElementById("mealCalories")?.value || 0);
  const protein = Number(document.getElementById("mealProtein")?.value || 0);
  const type = document.getElementById("mealType")?.value || "Lunch";
  const date = document.getElementById("mealDate")?.value || new Date().toISOString().slice(0, 10);
  const note = document.getElementById("mealNote")?.value.trim() || "";

  if (!food || !calories) {
    showMessage("mealMessage", "Add a food name and calorie value.", true);
    return;
  }

  const mealLogs = getMealLogs();
  mealLogs.push({
    id: `meal-log-${Date.now()}`,
    food,
    calories,
    protein,
    type,
    date,
    note,
    createdAt: new Date().toISOString()
  });

  saveMealLogs(mealLogs);
  document.getElementById("mealLogForm")?.reset();
  seedDefaults();
  showMessage("mealMessage", "Meal logged. Your nutrition history and dashboard are updated.");
  renderMealLogList();
  renderRecentMealTable();
  renderHomeSummary();
}

async function login() {
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value.trim();

  if (!email || !password) {
    showMessage("loginMessage", "Enter both email and password.", true);
    return;
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    setUser({
      email: user.email,
      uid: user.uid,
      loggedInAt: new Date().toISOString()
    });

    await loadFirestoreData(user.uid);

    const existingProfile = getProfile();
    saveProfile({
      ...existingProfile,
      fullName: existingProfile.fullName || user.email,
      goal: existingProfile.goal || "Performance"
    });

    go("dashboard.html");
  } catch (error) {
    showMessage("loginMessage", error.message || "Login failed.", true);
  }
}

window.go = go;
window.logout = logout;
window.signup = signup;
window.login = login;
window.saveProfileSetup = saveProfileSetup;
window.saveScheduleEntry = saveScheduleEntry;
window.saveWorkout = saveWorkout;
window.saveGoal = saveGoal;
window.generatePlan = generatePlan;
window.mealPlan = mealPlan;
window.saveMealLog = saveMealLog;
window.sendCoachMessage = sendCoachMessage;

function protectRoute() {
  const currentPage = getCurrentPage();
  const user = getUser();

  if (currentPage === "login.html" && user) {
    go("dashboard.html");
    return;
  }

  if (protectedPages.includes(currentPage) && !user) {
    go("login.html");
  }
}

function setNavState() {
  const page = getCurrentPage();
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });
}

function seedDefaults() {
  const today = new Date().toISOString().slice(0, 10);
  const workoutDate = document.getElementById("date");
  const mealDate = document.getElementById("mealDate");
  const goalDate = document.getElementById("goalDate");
  const scheduleDate = document.getElementById("scheduleDate");
  const workoutGoalField = document.getElementById("workoutGoal");

  if (workoutDate && !workoutDate.value) {
    workoutDate.value = today;
  }

  if (mealDate && !mealDate.value) {
    mealDate.value = today;
  }

  if (goalDate && !goalDate.value) {
    goalDate.value = today;
  }

  if (scheduleDate && !scheduleDate.value) {
    scheduleDate.value = today;
  }

  if (workoutGoalField) {
    const user = getUser();
    workoutGoalField.value = user?.goal || "Performance";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      setUser({
        email: firebaseUser.email,
        uid: firebaseUser.uid,
        loggedInAt: new Date().toISOString()
      });

      await loadFirestoreData(firebaseUser.uid);

      if (getCurrentPage() === "login.html") {
        go("dashboard.html");
        return;
      }
    }

    protectRoute();
    renderUser();
    setNavState();
    seedDefaults();
    renderHomeSummary();
    renderWorkoutList();
    renderDashboard();
    renderGoalCards();
    renderRecentWorkoutTable();
    renderRecentMealTable();
    renderMealLogList();
    renderPlan();
    renderMealPlan();
  });
});

async function signup() {
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value.trim();

  if (!email || !password) {
    showMessage("loginMessage", "Enter both email and password.", true);
    return;
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    setUser({
      email: user.email,
      uid: user.uid,
      joinedAt: new Date().toISOString()
    });

    saveProfile({
      fullName: user.email,
      goal: "Performance"
    });

    await syncFirestoreField("profile", getProfile());
    await syncFirestoreField("plan", getStoredValue(STORAGE_KEYS.plan, {}));
    await syncFirestoreField("workouts", getWorkouts());
    await syncFirestoreField("goals", getGoals());
    await syncFirestoreField("mealLogs", getMealLogs());
    await syncFirestoreField("schedule", getSchedule());
    await syncFirestoreField("coachMessages", getCoachMessages());

    go("dashboard.html");
  } catch (error) {
    showMessage("loginMessage", error.message || "Sign up failed.", true);
  }
}