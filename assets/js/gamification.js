/**
 * Basic gamification functionality for news.aiworld.com.br
 */

// Mock user data - in a real app, this would come from a database
const userData = {
  points: 125,
  level: 7,
  streak: 3,
  badges: [
    { id: "tech-expert", name: "Tech Expert", icon: "💻", unlocked: true },
    { id: "news-scout", name: "News Scout", icon: "🔍", unlocked: true },
    {
      id: "global-explorer",
      name: "Global Explorer",
      icon: "🌍",
      unlocked: false,
    },
    { id: "fact-checker", name: "Fact Checker", icon: "✓", unlocked: false },
  ],
  challenges: {
    continentsExplored: 1,
    continentsGoal: 3,
  },
};

// Initialize the gamification elements
function initGamification() {
  // Update user stats
  document.querySelector(".stat-value:nth-child(1)").textContent =
    userData.points;
  document.querySelector(".stat-value:nth-child(2)").textContent =
    userData.level;
  document.querySelector(".stat-value:nth-child(3)").textContent =
    userData.streak;

  // Update challenge progress
  const progressBar = document.querySelector(".progress-bar");
  const progressPercent =
    (userData.challenges.continentsExplored /
      userData.challenges.continentsGoal) *
    100;
  progressBar.style.width = `${progressPercent}%`;

  // Add click events to buttons
  document.querySelectorAll(".btn").forEach((button) => {
    button.addEventListener("click", handleButtonClick);
  });
}

// Handle button clicks
function handleButtonClick(event) {
  const button = event.currentTarget;

  // Simulate different actions based on button text
  if (button.textContent.includes("Start Reading")) {
    simulateReadArticle();
  } else if (button.textContent.includes("Learn More")) {
    alert(
      "This is a demo of a gamified news experience. In the full version, you would learn about how to earn points and badges!"
    );
  } else if (button.textContent.includes("Subscribe")) {
    alert(
      "Thanks for your interest! In the full version, you would be subscribed to updates."
    );
  }
}

// Simulate reading an article and earning points
function simulateReadArticle() {
  // Add points
  userData.points += 10;
  document.querySelector(".stat-value:nth-child(1)").textContent =
    userData.points;

  // Show notification
  showNotification("🎉 You earned 10 points for reading an article!");

  // Simulate exploring a new continent
  if (
    userData.challenges.continentsExplored < userData.challenges.continentsGoal
  ) {
    userData.challenges.continentsExplored++;
    const progressBar = document.querySelector(".progress-bar");
    const progressPercent =
      (userData.challenges.continentsExplored /
        userData.challenges.continentsGoal) *
      100;
    progressBar.style.width = `${progressPercent}%`;

    // Update progress text
    document.querySelector(
      ".progress-container + p small"
    ).textContent = `${userData.challenges.continentsExplored}/${userData.challenges.continentsGoal} continents explored today`;

    showNotification("🌍 You explored a new continent!");

    // Check if challenge is completed
    if (
      userData.challenges.continentsExplored >=
      userData.challenges.continentsGoal
    ) {
      completeChallenge();
    }
  }
}

// Complete a challenge
function completeChallenge() {
  // Add bonus points
  userData.points += 50;
  document.querySelector(".stat-value:nth-child(1)").textContent =
    userData.points;

  // Unlock the Global Explorer badge
  const globalExplorerBadge = userData.badges.find(
    (badge) => badge.id === "global-explorer"
  );
  if (globalExplorerBadge && !globalExplorerBadge.unlocked) {
    globalExplorerBadge.unlocked = true;

    // Update badge in UI
    const badgeElement = document.querySelector(
      '.badge[data-tooltip="Global Explorer"]'
    );
    badgeElement.classList.remove("locked");
    badgeElement.style.backgroundColor = "#a0e7e5";

    showNotification(
      "🏆 Challenge completed! You unlocked the Global Explorer badge!"
    );
  }
}

// Show a notification
function showNotification(message) {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = "notification";
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.bottom = "20px";
  notification.style.right = "20px";
  notification.style.backgroundColor = "var(--primary)";
  notification.style.color = "white";
  notification.style.padding = "10px 20px";
  notification.style.borderRadius = "4px";
  notification.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
  notification.style.zIndex = "1000";
  notification.style.opacity = "0";
  notification.style.transform = "translateY(20px)";
  notification.style.transition = "opacity 0.3s, transform 0.3s";

  // Add to document
  document.body.appendChild(notification);

  // Trigger animation
  setTimeout(() => {
    notification.style.opacity = "1";
    notification.style.transform = "translateY(0)";
  }, 10);

  // Remove after delay
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateY(20px)";

    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initGamification);
