// 通知功能
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="padding: 10px 15px; 
                   background: ${type === 'error' ? '#e74a3b' : type === 'success' ? '#1cc88a' : '#36b9cc'}; 
                   color: white; 
                   border-radius: 4px; 
                   margin-bottom: 10px;
                   box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                   animation: fadeIn 0.3s ease-in-out;">
            ${message}
        </div>
    `;

    const notificationArea = document.getElementById('notification-area');
    notificationArea.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-in-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
    }
`;
document.head.appendChild(style);

// 初始化图表 - 按需初始化
let cpuChart, memoryChart, diskChart, networkChart;

// 只在有对应canvas元素的页面初始化图表
if (document.getElementById('cpu-chart')) {
    cpuChart = initChart('cpu-chart', 'CPU 使用率 (%)', 'rgba(0, 240, 255, 0.5)');
}
if (document.getElementById('memory-chart')) {
    memoryChart = initChart('memory-chart', '内存使用 (%)', 'rgba(255, 42, 109, 0.5)');
}
if (document.getElementById('disk-chart')) {
    diskChart = initChart('disk-chart', '磁盘空间 (%)', 'rgba(199, 36, 177, 0.5)');
}
if (document.getElementById('network-chart')) {
    networkChart = initChart('network-chart', '网络活动 (KB/s)', 'rgba(5, 240, 165, 0.5)');
}

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

// 从服务获取数据并更新图表
function updateCharts() {
    fetch('/system-info')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // CPU 数据
                updateChart(cpuChart, data.cpu.usage);

                // 内存数据
                updateChart(memoryChart, data.memory.usage);

                // 磁盘数据
                updateChart(diskChart, data.disk.usage);

                // 网络数据
                updateChart(networkChart, data.network.speed);

                // 更新进程表格
                updateProcessTable(data.processes);
            }
        })
        .catch(error => console.error('获取系统信息失败:', error));

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
function updateProcessTable(processes = []) {
    const processBody = document.getElementById('process-body');
    processBody.innerHTML = '';

    processes.forEach((proc, i) => {
        if (i < 10) {
            const row = document.createElement('tr');
            row.innerHTML = `
            <td>${proc.pid}</td>
            <td>${proc.name}</td>
            <td>${proc.cpu}</td>
            <td>${proc.memory}</td>`;
            processBody.appendChild(row);
        }
    });
}

// 更新时间戳
function updateTimestamp() {
    const now = new Date();
    const timestampElement = document.getElementById('last-updated');
    timestampElement.textContent = `最后更新: ${now.toLocaleString('zh-CN')}`;
}

// 浏览器控制功能
document.getElementById('launch-browser').addEventListener('click', async () => {
    try {
        const response = await fetch('/browser/launch', { method: 'POST' });
        const result = await response.json();
        showNotification(result.success ? '浏览器启动成功' : '浏览器启动失败',
            result.success ? 'success' : 'error');
    } catch (error) {
        console.error('浏览器启动失败:', error);
        showNotification(`浏览器启动失败: ${error.message}`, 'error');
    }
});

document.getElementById('close-browser').addEventListener('click', async () => {
    try {
        const response = await fetch('/browser/close', { method: 'POST' });
        const result = await response.json();
        showNotification(result.success ? '浏览器已关闭' : '浏览器关闭失败',
            result.success ? 'success' : 'error');
    } catch (error) {
        console.error('浏览器关闭失败:', error);
        showNotification(`浏览器关闭失败: ${error.message}`, 'error');
    }
});

document.getElementById('navigate-btn').addEventListener('click', async () => {
    const url = document.getElementById('browser-url').value;
    if (!url) {
        showNotification('请输入有效的URL', 'error');
        return;
    }

    try {
        const response = await fetch('/browser/navigate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        const result = await response.json();
        showNotification(result.success ? `已导航到: ${result.url}` : '导航失败',
            result.success ? 'success' : 'error');
    } catch (error) {
        console.error('导航失败:', error);
        showNotification(`导航失败: ${error.message}`, 'error');
    }
});

document.getElementById('screenshot-btn').addEventListener('click', async () => {
    try {
        const response = await fetch('/browser/screenshot');
        const result = await response.json();
        if (result.success && result.screenshot) {
            const container = document.getElementById('screenshot-container');
            const img = document.getElementById('browser-screenshot');
            img.src = `data:image/png;base64,${result.screenshot}`;
            container.style.display = 'block';
        } else {
            showNotification('浏览器截图失败', 'error');
        }
    } catch (error) {
        console.error('浏览器截图失败:', error);
        showNotification(`浏览器截图失败: ${error.message}`, 'error');
    }
});

document.getElementById('screen-screenshot-btn').addEventListener('click', async () => {
    try {
        const response = await fetch('/screenshot');
        const result = await response.json();
        if (result.image) {
            const container = document.getElementById('screen-screenshot-container');
            const img = document.getElementById('screen-screenshot');
            img.src = `data:image/png;base64,${result.image}`;
            container.style.display = 'block';
        } else {
            showNotification('屏幕截图失败', 'error');
        }
    } catch (error) {
        console.error('屏幕截图失败:', error);
        showNotification(`屏幕截图失败: ${error.message}`, 'error');
    }
});

// 浏览器分析功能
document.getElementById('analyze-btn').addEventListener('click', async () => {
    try {
        showNotification('正在分析浏览器...', 'info');
        const response = await fetch('/browser/analyze');
        const result = await response.json();

        if (result.success) {
            const container = document.getElementById('analysis-results');
            const content = document.getElementById('analysis-content');

            // 显示模型分析结果
            let html = '<div class="analysis-text-content">';
            html += result.modelAnswer.content.replace(/\n/g, '<br>');
            html += '</div>';
            content.innerHTML = html;
            container.style.display = 'block';
            showNotification('浏览器分析完成', 'success');
        } else {
            showNotification('浏览器分析失败', 'error');
        }
    } catch (error) {
        console.error('浏览器分析失败:', error);
        showNotification(`浏览器分析失败: ${error.message}`, 'error');
    }
});

// 源代码分析功能
document.getElementById('analyze-source-btn').addEventListener('click', async () => {
    const prompt = document.getElementById('analysis-prompt').value;
    if (!prompt) {
        showNotification('请输入分析提示', 'error');
        return;
    }

    try {
        showNotification('正在分析源代码...', 'info');

        const response = await fetch('/browser/analyze-source', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });

        const result = await response.json();

        if (result.error) {
            showNotification(`分析失败: ${result.error}`, 'error');
            return;
        }

        // 显示分析结果
        const resultContainer = document.getElementById('source-analysis-result');
        resultContainer.innerHTML = `<div class="analysis-text-content">${result.result.replace(/\n/g, '<br>')}</div>`;

        // 显示源代码
        const sourceContainer = document.getElementById('page-source-code');
        sourceContainer.textContent = result.sourceCode;

        // 显示分析区域
        document.getElementById('source-analysis-container').style.display = 'block';

        showNotification('源代码分析完成', 'success');
    } catch (error) {
        console.error('源代码分析失败:', error);
        showNotification(`源代码分析失败: ${error.message}`, 'error');
    }
});

// 启动数据更新
updateCharts();

// 按需初始化视频流功能
function initVideoStream() {
    const ws = new WebSocket(`ws://${window.location.hostname}:${window.location.port || 80}`);

    // 创建视频元素
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.style.position = 'fixed';
    videoElement.style.top = '0';
    videoElement.style.left = '0';
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.objectFit = 'cover';
    videoElement.style.zIndex = '-1';
    document.body.appendChild(videoElement);

    // 创建MediaSource和SourceBuffer
    const mediaSource = new MediaSource();
    videoElement.src = URL.createObjectURL(mediaSource);

    let sourceBuffer;
    mediaSource.addEventListener('sourceopen', () => {
        sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.64001E"');
    });

    ws.onopen = () => {
        console.log('WebSocket视频流连接已建立');
    };

    ws.onmessage = (event) => {
        try {
            if (sourceBuffer && !sourceBuffer.updating && event.data instanceof ArrayBuffer) {
                sourceBuffer.appendBuffer(new Uint8Array(event.data));
            }
        } catch (error) {
            console.error('视频流数据处理错误:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket视频流错误:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket视频流连接已关闭');
    };

    return ws;
}
