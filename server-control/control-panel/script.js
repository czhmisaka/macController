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
// 启动数据更新
updateCharts();

// WebSocket连接
const ws = new WebSocket(`ws://${window.location.hostname}:${window.location.port || 80}`);

ws.onopen = () => {
    console.log('WebSocket连接已建立');
};

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

ws.onmessage = (event) => {
    console.log('收到数据:', event.data);
    if (sourceBuffer && !sourceBuffer.updating && event.data instanceof ArrayBuffer) {
        sourceBuffer.appendBuffer(new Uint8Array(event.data));
    }
};

ws.onerror = (error) => {
    console.error('WebSocket错误:', error);
};

ws.onclose = () => {
    console.log('WebSocket连接已关闭');
};
