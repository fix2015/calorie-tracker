const REMINDER_MESSAGES = [
  // Morning (breakfast)
  [
    "Rise and fuel! A good breakfast sets the tone for the whole day.",
    "Good morning! Don't skip breakfast — your body needs energy to start strong.",
    "Morning check-in! Log your breakfast and stay on track today.",
    "Fuel your morning! A balanced breakfast boosts focus and energy.",
    "Time to break the fast! What's fueling your body this morning?",
  ],
  // Midday (lunch)
  [
    "Lunchtime check! Are you hitting your protein target today?",
    "Midday fuel stop! Log your lunch and keep the momentum going.",
    "Halfway through the day! How are your macros looking?",
    "Lunch reminder! A balanced meal now prevents evening cravings.",
    "Quick check-in: have you logged your meals today? Stay consistent!",
  ],
  // Evening (dinner)
  [
    "Evening wrap-up! Log your dinner and review today's nutrition.",
    "Almost done for the day! How close are you to your calorie target?",
    "Dinner time! Make this meal count toward your goals.",
    "End-of-day check: log your final meals and see your progress!",
    "Last call! Round out your nutrition tracking for today.",
  ],
];

function getRandomMessage(timeSlot) {
  const messages = REMINDER_MESSAGES[timeSlot] || REMINDER_MESSAGES[0];
  return messages[Math.floor(Math.random() * messages.length)];
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function scheduleNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // Schedule checks every minute, trigger at target times
  const REMINDER_HOURS = [8, 13, 19]; // 8am, 1pm, 7pm
  const shownToday = new Set(JSON.parse(localStorage.getItem('notif_shown') || '[]'));
  const todayKey = new Date().toISOString().split('T')[0];

  // Reset if it's a new day
  const storedDay = localStorage.getItem('notif_day');
  if (storedDay !== todayKey) {
    localStorage.setItem('notif_day', todayKey);
    localStorage.setItem('notif_shown', '[]');
    shownToday.clear();
  }

  const now = new Date();
  const currentHour = now.getHours();

  REMINDER_HOURS.forEach((hour, index) => {
    if (currentHour >= hour && !shownToday.has(String(hour))) {
      shownToday.add(String(hour));
      localStorage.setItem('notif_shown', JSON.stringify([...shownToday]));

      const message = getRandomMessage(index);
      new Notification('Calorie Tracker', {
        body: message,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `reminder-${hour}`,
      });
    }
  });
}

export function startNotificationScheduler() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // Check immediately
  scheduleNotifications();

  // Then check every 15 minutes
  setInterval(scheduleNotifications, 15 * 60 * 1000);
}
