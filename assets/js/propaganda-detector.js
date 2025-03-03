/**
 * Propaganda detector functionality for news.aiworld.com.br
 */

// Initialize the propaganda detector
document.addEventListener("DOMContentLoaded", () => {
  // Add event listeners to all rating buttons
  document.querySelectorAll(".rating-btn").forEach((button) => {
    button.addEventListener("click", handleRating);
  });

  // Add event listeners to action buttons
  document.querySelectorAll(".btn").forEach((button) => {
    button.addEventListener("click", handleButtonClick);
  });

  // Initialize news sources with their current propaganda levels
  initializeNewsSources();
});

// Initialize news sources
function initializeNewsSources() {
  // Get all news source elements
  const newsSources = document.querySelectorAll(".news-source");

  // For each news source, set the appropriate class based on its propaganda level
  newsSources.forEach((source) => {
    const propagandaLevel = source.querySelector(".propaganda-level");
    const width = parseFloat(propagandaLevel.style.width);

    if (width >= 70) {
      source.classList.add("propaganda-high");
    } else if (width >= 30) {
      source.classList.add("propaganda-medium");
    } else {
      source.classList.add("propaganda-low");
    }
  });
}

// Handle rating button clicks
function handleRating(event) {
  const button = event.currentTarget;
  const sourceId = button.getAttribute("data-source");
  const rating = button.getAttribute("data-rating");

  // Remove selected class from all buttons in this source
  const sourceElement = document.getElementById(sourceId);
  sourceElement.querySelectorAll(".rating-btn").forEach((btn) => {
    btn.classList.remove("selected");
  });

  // Add selected class to clicked button
  button.classList.add("selected");

  // Update propaganda meter
  updatePropagandaMeter(sourceId, rating);

  // Show notification
  showNotification(`You rated this source as ${rating} propaganda level`);

  // Update user stats
  updateUserStats();
}

// Update propaganda meter based on rating
function updatePropagandaMeter(sourceId, rating) {
  const sourceElement = document.getElementById(sourceId);
  const propagandaLevel = sourceElement.querySelector(".propaganda-level");

  // Remove existing propaganda classes
  sourceElement.classList.remove(
    "propaganda-high",
    "propaganda-medium",
    "propaganda-low"
  );

  // Set width and color based on rating
  let width, color;

  switch (rating) {
    case "high":
      width = "75%";
      color = "var(--danger)";
      sourceElement.classList.add("propaganda-high");
      break;
    case "medium":
      width = "45%";
      color = "var(--warning)";
      sourceElement.classList.add("propaganda-medium");
      break;
    case "low":
      width = "15%";
      color = "var(--success)";
      sourceElement.classList.add("propaganda-low");
      break;
  }

  // Animate the change
  propagandaLevel.style.width = "0%";
  setTimeout(() => {
    propagandaLevel.style.backgroundColor = color;
    propagandaLevel.style.width = width;
  }, 50);
}

// Update user stats
function updateUserStats() {
  // Get current sources rated count
  const sourcesRatedElement = document.querySelector(
    ".user-stats .stat-value:first-child"
  );
  let sourcesRated = parseInt(sourcesRatedElement.textContent);

  // Increment sources rated
  sourcesRated++;
  sourcesRatedElement.textContent = sourcesRated;

  // Simulate accuracy change
  const accuracyElement = document.querySelector(
    ".user-stats .stat-value:nth-child(2)"
  );
  const currentAccuracy = parseInt(accuracyElement.textContent);

  // Random small change in accuracy
  const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
  const newAccuracy = Math.min(100, Math.max(0, currentAccuracy + change));

  accuracyElement.textContent = `${newAccuracy}%`;
}

// Handle button clicks
function handleButtonClick(event) {
  const button = event.currentTarget;

  if (button.textContent.includes("Load More")) {
    showNotification(
      "Loading more sources... This feature will be available in the full version."
    );
  } else if (button.textContent.includes("View My Ratings")) {
    showNotification(
      "Your ratings history will be available in the full version."
    );
  }
}

// Show notification
function showNotification(message) {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = "notification";
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.bottom = "20px";
  notification.style.right = "20px";
  notification.style.backgroundColor = "var(--primary)";
  notification.style.color = "var(--background)";
  notification.style.padding = "10px 20px";
  notification.style.borderRadius = "4px";
  notification.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.3)";
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
