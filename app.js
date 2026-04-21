let chartInstance = null;

async function loadData() {
    try {
        const timestamp = Date.now();
        const [summaryResponse, dataResponse] = await Promise.all([
            fetch(`data/health-summary.json?t=${timestamp}`),
            fetch(`data/health-data.json?t=${timestamp}`)
        ]);

        if (!summaryResponse.ok || !dataResponse.ok) {
            throw new Error('Failed to load data');
        }

        const summary = await summaryResponse.json();
        const data = await dataResponse.json();

        return { summary, data };
    } catch (error) {
        console.error('Error loading data:', error);
        return null;
    }
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

function formatRelativeTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

function updateStatusIndicator(summary) {
    const statusBadge = document.querySelector('.status-badge');
    const statusText = document.querySelector('.status-text');
    const lastCheck = document.getElementById('lastCheck');
    const responseTime = document.getElementById('responseTime');
    const sslStatus = document.getElementById('sslStatus');

    const status = summary.current.status;

    statusBadge.classList.remove('up', 'down', 'unknown');
    statusBadge.classList.add(status);

    const statusLabels = {
        'up': 'Online',
        'down': 'Offline',
        'unknown': 'Unknown'
    };

    statusText.textContent = statusLabels[status] || 'Unknown';

    if (summary.current.lastCheck) {
        lastCheck.textContent = `Last check: ${formatRelativeTime(summary.current.lastCheck)}`;
        responseTime.textContent = `Response time: ${summary.current.responseTime}ms`;
        sslStatus.textContent = `SSL: Valid (${summary.current.sslDaysRemaining} days remaining)`;
    }
}

function updateUptimeCards(summary) {
    const uptimeData = [
        { id: 'uptime24h', value: summary.uptime.last24h },
        { id: 'uptime7d', value: summary.uptime.last7d },
        { id: 'uptime30d', value: summary.uptime.last30d },
        { id: 'uptimeAll', value: summary.uptime.allTime }
    ];

    uptimeData.forEach(({ id, value }) => {
        const element = document.getElementById(id);
        const card = element.closest('.uptime-card');

        element.textContent = `${value.toFixed(1)}%`;

        card.classList.remove('excellent', 'good', 'poor');
        if (value >= 99) {
            card.classList.add('excellent');
        } else if (value >= 95) {
            card.classList.add('good');
        } else {
            card.classList.add('poor');
        }
    });
}

function createResponseChart(checks) {
    const canvas = document.getElementById('responseChart');
    const ctx = canvas.getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    const last7Days = checks.slice(-168);

    const labels = last7Days.map(check =>
        new Date(check.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    );

    const data = last7Days.map(check => check.responseTime);

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Response Time (ms)',
                data: data,
                borderColor: 'rgb(102, 126, 234)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxTicksLimit: 8,
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Response Time (ms)'
                    }
                }
            }
        }
    });
}

function updateHistoryTable(checks) {
    const tbody = document.getElementById('historyBody');
    const recentChecks = checks.slice(-20).reverse();

    if (recentChecks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = recentChecks.map(check => `
        <tr>
            <td>${formatTimestamp(check.timestamp)}</td>
            <td class="status-${check.status}">${check.status.toUpperCase()}</td>
            <td>${check.responseTime}ms</td>
            <td>${check.httpStatus}</td>
            <td class="check-icon ${check.sslValid ? 'yes' : 'no'}">${check.sslValid ? '✓' : '✗'}</td>
            <td class="check-icon ${check.contentCheck ? 'yes' : 'no'}">${check.contentCheck ? '✓' : '✗'}</td>
        </tr>
    `).join('');
}

function updateLastUpdated(metadata) {
    const lastUpdated = document.getElementById('lastUpdated');
    if (metadata.lastUpdated) {
        lastUpdated.textContent = `Last updated: ${formatTimestamp(metadata.lastUpdated)}`;
    }
}

async function initialize() {
    const result = await loadData();

    if (!result) {
        console.error('Failed to load data');
        return;
    }

    const { summary, data } = result;

    updateStatusIndicator(summary);
    updateUptimeCards(summary);
    createResponseChart(data.checks);
    updateHistoryTable(data.checks);
    updateLastUpdated(data.metadata);
}

document.addEventListener('DOMContentLoaded', initialize);
