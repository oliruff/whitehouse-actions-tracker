function refreshData() {
    localStorage.removeItem('whActionsCache');
    localStorage.removeItem('whActionsCacheTime');
    document.getElementById('actions-container').innerHTML = '';
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error-message').textContent = '';
    fetchPresidentialActions(); const proxyUrl = 'https://whitehouse-actions-tracker.onrender.com';
}

// Add search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.action-card');
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
});
