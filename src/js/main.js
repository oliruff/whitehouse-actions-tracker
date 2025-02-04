/**
 * Main JavaScript file for the White House Presidential Actions Tracker.
 * Handles fetching data from the White House API, parsing the XML feed,
 * caching mechanisms, and rendering the presidential actions to the DOM.
 * Includes error handling and retry logic.
 */

// Constants
const PROXY_URL = 'https://whitehouse-actions-tracker.onrender.com/proxy?url=';
const WHITE_HOUSE_FEED_URL = 'https://www.whitehouse.gov/feed/';
const CACHE_KEY = 'whActionsCache';
const CACHE_TIMESTAMP_KEY = 'whActionsCacheTime';
const CACHE_TTL = 3600000; // 1 hour in milliseconds
const MAX_RETRIES = 3;

// State
let retryCount = 0;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

/**
 * Initializes the application by checking the cache and setting up event listeners.
 */
function initializeApp() {
  checkCache();
  setupSearch();
  setupRefreshButton();
}

/**
 * Checks if cached data exists and is valid. If valid, renders the cached data.
 * Otherwise, fetches new data from the API.
 */
function checkCache() {
  const cachedData = localStorage.getItem(CACHE_KEY);
  const cacheTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

  if (isCacheValid(cachedData, cacheTimestamp)) {
    renderActions(JSON.parse(cachedData));
    hideLoading();
  } else {
    fetchPresidentialActions();
  }
}

/**
 * Validates the cache based on its existence and age.
 * @param {string} data - Cached data.
 * @param {string} timestamp - Cache timestamp.
 * @returns {boolean} - True if the cache is valid, false otherwise.
 */
function isCacheValid(data, timestamp) {
  return data && timestamp && Date.now() - parseInt(timestamp, 10) < CACHE_TTL;
}

/**
 * Fetches presidential actions from the White House API with retry logic.
 */
async function fetchPresidentialActions() {
  showLoading();

  try {
    const response = await fetchWithRetry();
    const data = await parseXMLResponse(response);
    cacheData(data);
    renderActions(data);
    retryCount = 0; // Reset retry count on success
  } catch (error) {
    handleError(error);
  } finally {
    hideLoading();
  }
}

/**
 * Fetches data from the API with retry logic.
 * @returns {Response} - The API response.
 */
async function fetchWithRetry() {
  try {
    const response = await fetch(`${PROXY_URL}${encodeURIComponent(WHITE_HOUSE_FEED_URL)}`);
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait before retrying
      return fetchWithRetry();
    }
    throw error;
  }
}

/**
 * Parses the XML response from the API and extracts presidential actions.
 * @param {Response} response - The API response.
 * @returns {Array} - An array of presidential actions.
 */
async function parseXMLResponse(response) {
  const text = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, 'text/xml');
  return extractActionsFromXML(xmlDoc);
}

/**
 * Extracts presidential actions from the XML document.
 * @param {Document} xmlDoc - The XML document.
 * @returns {Array} - An array of presidential actions.
 */
function extractActionsFromXML(xmlDoc) {
  const items = Array.from(xmlDoc.getElementsByTagName('item'));
  return items
    .filter((item) =>
      Array.from(item.getElementsByTagName('category')).some(
        (category) => category.textContent === 'Presidential Actions'
      )
    )
    .map((item) => ({
      title: sanitizeHTML(item.getElementsByTagName('title')[0].textContent),
      link: item.getElementsByTagName('link')[0].textContent,
      pubDate: item.getElementsByTagName('pubDate')[0].textContent,
      description: sanitizeHTML(item.getElementsByTagName('description')[0].textContent),
    }));
}

/**
 * Caches the fetched data in localStorage.
 * @param {Array} data - The data to cache.
 */
function cacheData(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
}

/**
 * Renders the presidential actions to the DOM.
 * @param {Array} actions - An array of presidential actions.
 */
function renderActions(actions) {
  const container = document.getElementById('actions-container');
  container.innerHTML = '';

  if (actions.length === 0) {
    showError('No presidential actions found.');
    return;
  }

  actions.forEach((action) => {
    container.appendChild(createActionCard(action));
  });
}

/**
 * Creates a DOM element for a single presidential action.
 * @param {Object} action - A presidential action.
 * @returns {HTMLElement} - The DOM element.
 */
function createActionCard(action) {
  const card = document.createElement('article');
  card.className = 'action-card';

  const pubDate = new Date(action.pubDate).toLocaleDateString('en-US', { dateStyle: 'long' });

  card.innerHTML = `
    <p class="action-date">${pubDate}</p>
    <h2 class="action-title">${action.title}</h2>
    <div class="action-summary">${action.description}</div>
    <a href="${action.link}" class="full-document-link" target="_blank" rel="noopener noreferrer">
      Read Full Document
    </a>
  `;

  return card;
}

/**
 * Sanitizes HTML to prevent XSS attacks.
 * @param {string} str - The HTML string to sanitize.
 * @returns {string} - The sanitized HTML string.
 */
function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Handles errors during the fetch process.
 * @param {Error} error - The error object.
 */
function handleError(error) {
  console.error('Error fetching presidential actions:', error);
  showError('Failed to load presidential actions. Please try again later.');
}

/**
 * Displays a loading spinner.
 */
function showLoading() {
  document.getElementById('loading').style.display = 'block';
}

/**
 * Hides the loading spinner.
 */
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

/**
 * Displays an error message to the user.
 * @param {string} message - The error message.
 */
function showError(message) {
  const errorContainer = document.getElementById('error-message');
  errorContainer.innerHTML = `
    <div class="error-alert">
      ⚠️ ${message}
      <button class="retry-button" onclick="refreshData()">Retry</button>
    </div>
  `;
}

/**
 * Clears the cache and fetches new data.
 */
function refreshData() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  document.getElementById('actions-container').innerHTML = '';
  document.getElementById('error-message').innerHTML = '';
  fetchPresidentialActions();
}

/**
 * Sets up the search functionality.
 */
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', debounce(handleSearch, 300));
}

/**
 * Handles the search input and filters the displayed actions.
 * @param {Event} event - The input event.
 */
function handleSearch(event) {
  const searchTerm = event.target.value.toLowerCase();
  const cards = document.querySelectorAll('.action-card');

  cards.forEach((card) => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(searchTerm) ? 'block' : 'none';
  });
}

/**
 * Debounces a function to limit its execution frequency.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The debounce delay in milliseconds.
 * @returns {Function} - The debounced function.
 */
function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Sets up the refresh button functionality.
 */
function setupRefreshButton() {
  const refreshButton = document.querySelector('.refresh-button');
  refreshButton.addEventListener('click', refreshData);
}
