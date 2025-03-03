/**
 * News display functionality for news.aiworld.com.br
 * Handles fetching and displaying news from the gnews.io API
 */

// Initialize the news display
document.addEventListener("DOMContentLoaded", () => {
  // Add event listener to the load more button
  const loadMoreButton = document.querySelector(".btn:first-child");
  if (loadMoreButton) {
    loadMoreButton.addEventListener("click", loadMoreNews);
  }

  // Add event listener to search form if it exists
  const searchForm = document.getElementById("news-search-form");
  if (searchForm) {
    searchForm.addEventListener("submit", handleSearch);
  }

  // Load initial news
  loadInitialNews();
});

// Current page for pagination
let currentPage = 1;
// Current search query
let currentQuery = "";
// News container element
const newsContainer = document.querySelector(".news-container");

/**
 * Load initial news articles
 */
async function loadInitialNews() {
  try {
    // Show loading indicator
    showLoadingIndicator();

    // Fetch top headlines
    const articles = await window.NewsAPI.fetchTopHeadlines({
      max: 4, // Start with 4 articles
    });

    // Clear existing static news sources
    clearExistingNews();

    // Display the articles
    displayNewsArticles(articles);

    // Hide loading indicator
    hideLoadingIndicator();
  } catch (error) {
    console.error("Error loading initial news:", error);
    showNotification("Error loading news. Please try again later.");
    hideLoadingIndicator();
  }
}

/**
 * Load more news articles
 */
async function loadMoreNews() {
  try {
    // Show loading indicator
    showLoadingIndicator();

    // Increment page
    currentPage++;

    // Fetch more articles based on current state
    let articles;
    if (currentQuery) {
      // If there's a search query, fetch more search results
      articles = await window.NewsAPI.searchNews(currentQuery, {
        max: 4,
        page: currentPage,
      });
    } else {
      // Otherwise fetch more top headlines
      articles = await window.NewsAPI.fetchTopHeadlines({
        max: 4,
        page: currentPage,
      });
    }

    // Display the articles
    displayNewsArticles(articles);

    // Hide loading indicator
    hideLoadingIndicator();

    // If no more articles, disable load more button
    if (articles.length === 0) {
      const loadMoreButton = document.querySelector(".btn:first-child");
      if (loadMoreButton) {
        loadMoreButton.disabled = true;
        loadMoreButton.textContent = "No More Articles";
      }
    }
  } catch (error) {
    console.error("Error loading more news:", error);
    showNotification("Error loading more news. Please try again later.");
    hideLoadingIndicator();
  }
}

/**
 * Handle search form submission
 * @param {Event} event - Form submit event
 */
async function handleSearch(event) {
  event.preventDefault();

  const searchInput = document.getElementById("news-search-input");
  if (!searchInput || !searchInput.value.trim()) {
    return;
  }

  try {
    // Show loading indicator
    showLoadingIndicator();

    // Reset pagination
    currentPage = 1;
    // Set current query
    currentQuery = searchInput.value.trim();

    // Fetch search results
    const articles = await window.NewsAPI.searchNews(currentQuery, {
      max: 4,
    });

    // Clear existing news
    clearExistingNews();

    // Display the articles
    displayNewsArticles(articles);

    // Reset load more button
    const loadMoreButton = document.querySelector(".btn:first-child");
    if (loadMoreButton) {
      loadMoreButton.disabled = false;
      loadMoreButton.textContent = "Load More Sources";
    }

    // Hide loading indicator
    hideLoadingIndicator();

    // Show search results message
    showNotification(`Showing results for "${currentQuery}"`);
  } catch (error) {
    console.error("Error searching news:", error);
    showNotification("Error searching news. Please try again later.");
    hideLoadingIndicator();
  }
}

/**
 * Display news articles in the UI
 * @param {Array} articles - Array of news articles
 */
function displayNewsArticles(articles) {
  if (!articles || articles.length === 0) {
    showNotification("No articles found.");
    return;
  }

  // Create a document fragment to improve performance
  const fragment = document.createDocumentFragment();

  // Process each article
  articles.forEach((article, index) => {
    // Create a unique ID for the source
    const sourceId = `source-${Date.now()}-${index}`;

    // Create the news source element
    const newsSource = document.createElement("div");
    newsSource.className = "card news-source";
    newsSource.id = sourceId;

    // Determine source name from the article
    const sourceName = article.source?.name || "Unknown Source";

    // Create source logo text (first letter or first two letters)
    const logoText = sourceName
      .split(" ")
      .map((word) => word[0])
      .slice(0, 2)
      .join("");

    // Generate tags from article content
    const tags = generateTags(article);

    // Format publication date
    const publishedDate = formatPublishedDate(article.publishedAt);

    // Set initial propaganda level (random for demo purposes)
    const propagandaLevel = Math.floor(Math.random() * 100);
    let propagandaClass, propagandaColor;

    if (propagandaLevel >= 70) {
      propagandaClass = "propaganda-high";
      propagandaColor = "var(--danger)";
    } else if (propagandaLevel >= 30) {
      propagandaClass = "propaganda-medium";
      propagandaColor = "var(--warning)";
    } else {
      propagandaClass = "propaganda-low";
      propagandaColor = "var(--success)";
    }

    // Add the appropriate class
    newsSource.classList.add(propagandaClass);

    // Set the HTML content
    newsSource.innerHTML = `
      <div class="source-header">
        <h2>${sourceName}</h2>
        <div class="source-logo">${logoText}</div>
      </div>
      <p>${article.title}</p>
      <div class="propaganda-meter">
        <div class="propaganda-level" style="width: ${propagandaLevel}%; background-color: ${propagandaColor}"></div>
      </div>
      <div class="rating-container">
        <span>Propaganda Level:</span>
        <button class="rating-btn low" data-rating="low" data-source="${sourceId}">L</button>
        <button class="rating-btn medium" data-rating="medium" data-source="${sourceId}">M</button>
        <button class="rating-btn high" data-rating="high" data-source="${sourceId}">H</button>
      </div>
      <div class="community-rating">
        <span class="community-rating-label">Community Rating:</span>
        <span class="community-rating-value ${
          propagandaClass === "propaganda-high"
            ? "high"
            : propagandaClass === "propaganda-medium"
            ? "medium"
            : "low"
        }">
          ${
            propagandaClass === "propaganda-high"
              ? "High"
              : propagandaClass === "propaganda-medium"
              ? "Medium"
              : "Low"
          } (${propagandaLevel}%)
        </span>
      </div>
      <div class="source-meta">
        <div>
          ${tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
        </div>
        <div>Published: ${publishedDate}</div>
      </div>
      <div class="action-row">
        <a href="${
          article.url
        }" target="_blank" class="btn btn-outline">Read Full Article</a>
      </div>
    `;

    // Add event listeners to the rating buttons
    const ratingButtons = newsSource.querySelectorAll(".rating-btn");
    ratingButtons.forEach((button) => {
      button.addEventListener("click", handleRating);
    });

    // Add to fragment
    fragment.appendChild(newsSource);
  });

  // Append fragment to container
  if (newsContainer) {
    newsContainer.appendChild(fragment);
  } else {
    // If news container doesn't exist, append after the stats row
    const statsRow = document.querySelector(".stats-row");
    if (statsRow) {
      const container = document.createElement("div");
      container.className = "news-container";
      container.appendChild(fragment);
      statsRow.parentNode.insertBefore(container, statsRow.nextSibling);
    }
  }

  // Update the timestamp
  document.getElementById("date").textContent = new Date().toLocaleString();
}

/**
 * Clear existing news sources
 */
function clearExistingNews() {
  // Check if news container exists
  if (!newsContainer) {
    // Create news container if it doesn't exist
    const statsRow = document.querySelector(".stats-row");
    if (statsRow) {
      const container = document.createElement("div");
      container.className = "news-container";
      statsRow.parentNode.insertBefore(container, statsRow.nextSibling);
    }
    return;
  }

  // Remove all existing news sources
  const existingSources = newsContainer.querySelectorAll(".news-source");
  existingSources.forEach((source) => {
    source.remove();
  });
}

/**
 * Generate tags from article content
 * @param {Object} article - News article
 * @returns {Array} - Array of tags
 */
function generateTags(article) {
  const tags = [];

  // Add source name as a tag
  if (article.source?.name) {
    tags.push(article.source.name);
  }

  // Extract keywords from description
  if (article.description) {
    const keywords = extractKeywords(article.description);
    tags.push(...keywords.slice(0, 2)); // Add up to 2 keywords
  }

  // Ensure we have at least 2 tags
  if (tags.length < 2) {
    // Add default tags
    const defaultTags = [
      "News",
      "World",
      "Politics",
      "Business",
      "Technology",
      "Science",
      "Health",
      "Sports",
      "Entertainment",
    ];
    while (tags.length < 2) {
      const randomTag =
        defaultTags[Math.floor(Math.random() * defaultTags.length)];
      if (!tags.includes(randomTag)) {
        tags.push(randomTag);
      }
    }
  }

  return tags;
}

/**
 * Extract keywords from text
 * @param {string} text - Text to extract keywords from
 * @returns {Array} - Array of keywords
 */
function extractKeywords(text) {
  // Simple keyword extraction (for demo purposes)
  const stopWords = [
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "with",
    "by",
    "about",
    "as",
    "of",
    "is",
    "are",
    "was",
    "were",
  ];

  return text
    .split(/\W+/)
    .filter(
      (word) => word.length > 3 && !stopWords.includes(word.toLowerCase())
    )
    .slice(0, 5);
}

/**
 * Format published date
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date string
 */
function formatPublishedDate(dateString) {
  if (!dateString) {
    return "Recently";
  }

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) {
      return diffDay === 1 ? "1 day ago" : `${diffDay} days ago`;
    } else if (diffHour > 0) {
      return diffHour === 1 ? "1 hour ago" : `${diffHour} hours ago`;
    } else if (diffMin > 0) {
      return diffMin === 1 ? "1 minute ago" : `${diffMin} minutes ago`;
    } else {
      return "Just now";
    }
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Recently";
  }
}

/**
 * Show loading indicator
 */
function showLoadingIndicator() {
  // Check if loading indicator already exists
  if (document.querySelector(".loading-indicator")) {
    return;
  }

  // Create loading indicator
  const loadingIndicator = document.createElement("div");
  loadingIndicator.className = "loading-indicator";
  loadingIndicator.innerHTML = `
    <div class="spinner"></div>
    <p>Loading news...</p>
  `;

  // Style the loading indicator
  loadingIndicator.style.position = "fixed";
  loadingIndicator.style.top = "50%";
  loadingIndicator.style.left = "50%";
  loadingIndicator.style.transform = "translate(-50%, -50%)";
  loadingIndicator.style.backgroundColor = "var(--card-bg)";
  loadingIndicator.style.padding = "20px";
  loadingIndicator.style.borderRadius = "8px";
  loadingIndicator.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.3)";
  loadingIndicator.style.zIndex = "1000";
  loadingIndicator.style.textAlign = "center";

  // Style the spinner
  const spinner = loadingIndicator.querySelector(".spinner");
  spinner.style.width = "40px";
  spinner.style.height = "40px";
  spinner.style.margin = "0 auto 10px";
  spinner.style.border = "4px solid rgba(0, 0, 0, 0.1)";
  spinner.style.borderTopColor = "var(--primary)";
  spinner.style.borderRadius = "50%";
  spinner.style.animation = "spin 1s linear infinite";

  // Add animation keyframes
  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Add to document
  document.body.appendChild(loadingIndicator);
}

/**
 * Hide loading indicator
 */
function hideLoadingIndicator() {
  const loadingIndicator = document.querySelector(".loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.remove();
  }
}

// Re-export the showNotification function from propaganda-detector.js
// This assumes that the propaganda-detector.js file is loaded before this file
const showNotification =
  window.showNotification ||
  function (message) {
    alert(message);
  };
