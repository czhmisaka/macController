// 初始化图表
const cpuChart = initChart('cpu-chart', 'CPU 使用率 (%)', 'rgba(0, 240, 255, 0.5)');
const memoryChart = initChart('memory-chart', '内存使用 (%)', 'rgba(255, 42, 109, 0.5)');
const diskChart = initChart('disk-chart', '磁盘空间 (%)', 'rgba(199, 36, 177, 0.5)');
const networkChart = initChart('network-chart', '网络活动 (KB/s)', 'rgba(5, 240, 165, 0.5)');

// 初始化函数
function initChart(canvasId, label, backgroundColor) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(60).fill(''), // 60个数据点
            datasets: [{
                label: label,
                data: Array(60).fill(0),
                backgroundColor: backgroundColor,
                borderColor: backgroundColor.replace('0.5', '1'),
                borderWidth: 1,
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 1.5,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 240, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(224, 224, 224, 0.7)'
                    }
                },
                x: {
                    display: false,
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: 'rgba(224, 224, 224, 0.7)'
                    }
                }
            }
        }
    });
}

// 模拟数据更新
function updateCharts() {
    // CPU 数据
    updateChart(cpuChart, Math.random() * 100);

    // 内存数据
    updateChart(memoryChart, 30 + Math.random() * 50);

    // 磁盘数据
    updateChart(diskChart, 10 + Math.random() * 80);

    // 网络数据
    updateChart(networkChart, Math.random() * 1000);

    // 更新进程表格
    updateProcessTable();

    // 更新时间戳
    updateTimestamp();

    // 1秒后再次更新
    setTimeout(updateCharts, 1000);
}

function updateChart(chart, newValue) {
    // 移除第一个数据点
    chart.data.datasets[0].data.shift();
    // 添加新数据点
    chart.data.datasets[0].data.push(newValue);
    // 更新图表
    chart.update();
}

// 更新进程表格
function updateProcessTable() {
    const processBody = document.getElementById('process-body');
    processBody.innerHTML = '';

    // 模拟进程数据
    const processes = [
        { pid: 1234, name: 'node', cpu: (Math.random() * 30).toFixed(1), memory: (10 + Math.random() * 20).toFixed(1) },
        { pid: 5678, name: 'chrome', cpu: (Math.random() * 40).toFixed(1), memory: (20 + Math.random() * 30).toFixed(1) },
        { pid: 9012, name: 'vscode', cpu: (Math.random() * 20).toFixed(1), memory: (15 + Math.random() * 25).toFixed(1) },
        { pid: 3456, name: 'terminal', cpu: (Math.random() * 10).toFixed(1), memory: (5 + Math.random() * 10).toFixed(1) }
    ];

    processes.forEach(proc => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${proc.pid}</td>
            <td>${proc.name}</td>
            <td>${proc.cpu}</td>
            <td>${proc.memory}</td>
        `;
        processBody.appendChild(row);
    });
}

// 更新时间戳
function updateTimestamp() {
    const now = new Date();
    const timestampElement = document.getElementById('last-updated');
    timestampElement.textContent = `最后更新: ${now.toLocaleString('zh-CN')}`;
}

// 鼠标控制功能
document.getElementById('move-mouse').addEventListener('click', () => {
    const x = document.getElementById('mouse-x').value;
    const y = document.getElementById('mouse-y').value;
    alert(`模拟移动鼠标到坐标 (${x}, ${y})`);
});

// 键盘控制功能
document.getElementById('send-keys').addEventListener('click', () => {
    const text = document.getElementById('keyboard-input').value;
    if (text) {
        alert(`模拟发送按键: ${text}`);
        document.getElementById('keyboard-input').value = '';
    }
});

// 启动数据更新
updateCharts();
