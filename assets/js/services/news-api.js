/**
 * News API service for news.aiworld.com.br
 * Uses gnews.io API to fetch news articles
 */

// API key for gnews.io
const API_KEY = "1d73f339556339ed5462d66586426c56";
const BASE_URL = "https://gnews.io/api/v4";

/**
 * Fetch top headlines from gnews.io
 * @param {Object} options - Options for the API request
 * @param {string} options.category - News category (optional)
 * @param {string} options.country - Country code (optional)
 * @param {string} options.lang - Language code (optional)
 * @param {number} options.max - Maximum number of results (optional)
 * @returns {Promise<Array>} - Array of news articles
 */
async function fetchTopHeadlines(options = {}) {
  const { category, country = "us", lang = "en", max = 10 } = options;

  let url = `${BASE_URL}/top-headlines?apikey=${API_KEY}&lang=${lang}&country=${country}&max=${max}`;

  if (category) {
    url += `&category=${category}`;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.articles || [];
  } catch (error) {
    console.error("Error fetching top headlines:", error);
    return [];
  }
}

/**
 * Search for news articles from gnews.io
 * @param {string} query - Search query
 * @param {Object} options - Options for the API request
 * @param {string} options.lang - Language code (optional)
 * @param {string} options.country - Country code (optional)
 * @param {number} options.max - Maximum number of results (optional)
 * @param {string} options.from - Start date in YYYY-MM-DD format (optional)
 * @param {string} options.to - End date in YYYY-MM-DD format (optional)
 * @returns {Promise<Array>} - Array of news articles
 */
async function searchNews(query, options = {}) {
  const { lang = "en", country = "us", max = 10, from, to } = options;

  let url = `${BASE_URL}/search?apikey=${API_KEY}&q=${encodeURIComponent(
    query
  )}&lang=${lang}&country=${country}&max=${max}`;

  if (from) {
    url += `&from=${from}`;
  }

  if (to) {
    url += `&to=${to}`;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.articles || [];
  } catch (error) {
    console.error("Error searching news:", error);
    return [];
  }
}

// Export the functions
window.NewsAPI = {
  fetchTopHeadlines,
  searchNews,
};
