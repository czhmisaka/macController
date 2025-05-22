/*
 * @Date: 2025-05-08 16:21:48
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-22 15:53:32
 * @FilePath: /指令控制电脑/server-control/src/server.ts
 */
import express from 'express';
import { WebSocketServer } from 'ws';
import robot from 'robotjs';
import dotenv from 'dotenv';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { PassThrough } from 'stream';
import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';
import { analyzeImage } from './glm-image';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { captureAndProcessScreenshot, getDisplayScaling, captureScreenshotAsBase64 } from './screen-utils';
import { VideoStreamer } from './video-utils';
import { BrowserController } from './browser-controller';

import si from 'systeminformation';

// 初始化浏览器控制器
const browserController = new BrowserController();
import { execSync } from 'child_process';

// 扩展systeminformation类型定义
declare module 'systeminformation' {
    interface GraphicsDisplayData {
        id: string;
        dpiX?: number;
        dpiY?: number;
    }
}

// 保留robotjs导入但添加错误处理
try {
    require('robotjs');
} catch (err) {
    console.warn('robotjs模块加载失败，鼠标/键盘控制功能将不可用:', err);
}

// Swagger配置
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: '远程控制服务器API',
            version: '1.0.0',
            description: '用于控制鼠标、键盘和屏幕分析的API文档',
        },
        servers: [
            {
                url: `http://localhost:${process.env.SERVER_PORT || 15800}`,
            },
        ],
    },
    apis: ['./src/server.ts'], // 包含API文档的文件
};

const specs = swaggerJsdoc(options);

dotenv.config();

const app = express();
const port = process.env.SERVER_PORT || 15800;

// 添加Swagger UI路由
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.use(express.json());

/**
 * @swagger
 * /mouse/move:
 *   post:
 *     summary: 控制鼠标移动
 *     description: 将鼠标移动到指定坐标位置
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               x:
 *                 type: number
 *                 description: X坐标
 *                 example: 100
 *               y:
 *                 type: number
 *                 description: Y坐标
 *                 example: 200
 *     responses:
 *       200:
 *         description: 移动成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 */
app.post('/mouse/move', (req, res) => {
    const { x, y } = req.body;
    robot.moveMouse(x, y);
    res.json({ success: true });
});

/**
 * @swagger
 * /keyboard/type:
 *   post:
 *     summary: 模拟键盘输入
 *     description: 模拟键盘输入指定文本
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 description: 要输入的文本
 *                 example: "Hello World"
 *     responses:
 *       200:
 *         description: 输入成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 */
app.post('/keyboard/type', (req, res) => {
    const { text } = req.body;
    robot.typeString(text);
    res.json({ success: true });
});

/**
 * @swagger
 * /screen/info:
 *   get:
 *     summary: 获取屏幕信息
 *     description: 返回屏幕类型、尺寸和DPI等详细信息
 *     responses:
 *       200:
 *         description: 成功获取屏幕信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 screenCount:
 *                   type: number
 *                   description: 屏幕数量
 *                 primaryScreen:
 *                   type: object
 *                   properties:
 *                     width:
 *                       type: number
 *                     height:
 *                       type: number
 *                     dpi:
 *                       type: number
 *                     scaling:
 *                       type: object
 *                       properties:
 *                         scaleX:
 *                           type: number
 *                         scaleY:
 *                           type: number
 *                 displays:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                       width:
 *                         type: number
 *                       height:
 *                         type: number
 *                       dpi:
 *                         type: number
 *                       isPrimary:
 *                         type: boolean
 */
app.get('/screen/info', async (req, res) => {
    try {
        console.log('尝试获取显示器信息...');
        const graphics = await si.graphics();
        const displays = graphics.displays;
        console.log('获取到显示器数量:', displays.length);

        const primaryDisplay = displays.find(d => d.main) || displays[0];
        console.log('主显示器信息:', {
            resolution: `${primaryDisplay.resolutionX}x${primaryDisplay.resolutionY}`,
            refreshRate: primaryDisplay.currentRefreshRate,
            size: primaryDisplay.sizeX ? `${primaryDisplay.sizeX}英寸` : '未知'
        });

        res.json({
            screenCount: displays.length,
            primaryScreen: {
                vendor: primaryDisplay.vendor,
                model: primaryDisplay.model,
                width: primaryDisplay.resolutionX,
                height: primaryDisplay.resolutionY,
                refreshRate: primaryDisplay.currentRefreshRate,
                size: primaryDisplay.sizeX ? `${primaryDisplay.sizeX}英寸` : null,
                connection: primaryDisplay.connection,
                isBuiltIn: primaryDisplay.builtin,
                scaling: getDisplayScaling()
            },
            displays: displays.map(display => ({
                vendor: display.vendor,
                model: display.model,
                width: display.resolutionX,
                height: display.resolutionY,
                refreshRate: display.currentRefreshRate,
                size: display.sizeX ? `${display.sizeX}英寸` : null,
                connection: display.connection,
                isPrimary: display.main,
                isBuiltIn: display.builtin
            }))
        });
    } catch (error) {
        console.error('获取屏幕信息失败:', error);
        res.status(500).json({
            error: 'Failed to get screen info',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * @swagger
 * /screen/analyze:
 *   post:
 *     summary: 屏幕分析
 *     description: 捕获屏幕并发送到AI模型进行分析
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: 自定义提示词
 *                 example: "请描述屏幕内容并定位搜索框位置"
 *     responses:
 *       200:
 *         description: 分析成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   description: AI分析结果
 *                   example: "屏幕上显示的是一个登录界面"
 *       500:
 *         description: 分析失败
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Screen analysis failed"
 */
app.post('/screen/analyze', async (req, res) => {
    const { prompt } = req.body;
    try {
        // 捕获并处理屏幕截图
        const { filePath } = await captureAndProcessScreenshot();

        // 使用GLM-4V模型分析截图
        const result = await analyzeImage(filePath, prompt);
        res.json({ result });
    } catch (error) {
        console.error('屏幕分析失败:', error);
        res.status(500).json({
            error: 'Screen analysis failed',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// 确保temp目录存在
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`已创建临时目录: ${tempDir}`);
}

/**
 * @swagger
 * /api/system/cpu:
 *   get:
 *     summary: 获取CPU使用信息
 *     description: 返回CPU负载、核心数和频率等信息
 *     responses:
 *       200:
 *         description: 成功获取CPU信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currentLoad:
 *                   type: number
 *                   description: 当前CPU总负载百分比
 *                 cores:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       load:
 *                         type: number
 *                       speed:
 *                         type: number
 */
app.get('/api/system/cpu', async (req, res) => {
    try {
        const cpu = await si.currentLoad();
        res.json(cpu);
    } catch (error) {
        console.error('获取CPU信息失败:', error);
        res.status(500).json({
            error: 'Failed to get CPU info',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * @swagger
 * /api/system/memory:
 *   get:
 *     summary: 获取内存使用信息
 *     description: 返回内存总量、使用量和空闲量
 *     responses:
 *       200:
 *         description: 成功获取内存信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                   description: 总内存(字节)
 *                 free:
 *                   type: number
 *                   description: 空闲内存(字节)
 *                 used:
 *                   type: number
 *                   description: 已用内存(字节)
 */
app.get('/api/system/memory', async (req, res) => {
    try {
        const memory = await si.mem();
        res.json(memory);
    } catch (error) {
        console.error('获取内存信息失败:', error);
        res.status(500).json({
            error: 'Failed to get memory info',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * @swagger
 * /api/system/disk:
 *   get:
 *     summary: 获取磁盘使用信息
 *     description: 返回磁盘总量、使用量和空闲量
 *     responses:
 *       200:
 *         description: 成功获取磁盘信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 size:
 *                   type: number
 *                   description: 总大小(字节)
 *                 used:
 *                   type: number
 *                   description: 已用空间(字节)
 *                 available:
 *                   type: number
 *                   description: 可用空间(字节)
 */
app.get('/api/system/disk', async (req, res) => {
    try {
        const disks = await si.fsSize();
        res.json(disks);
    } catch (error) {
        console.error('获取磁盘信息失败:', error);
        res.status(500).json({
            error: 'Failed to get disk info',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * @swagger
 * /api/system/network:
 *   get:
 *     summary: 获取网络状态信息
 *     description: 返回网络接口状态和流量统计
 *     responses:
 *       200:
 *         description: 成功获取网络信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 interfaces:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       iface:
 *                         type: string
 *                       operstate:
 *                         type: string
 *                       rx_bytes:
 *                         type: number
 *                       tx_bytes:
 *                         type: number
 */
app.get('/api/system/network', async (req, res) => {
    try {
        const network = await si.networkStats();
        res.json(network);
    } catch (error) {
        console.error('获取网络信息失败:', error);
        res.status(500).json({
            error: 'Failed to get network info',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * @swagger
 * /api/system/processes:
 *   get:
 *     summary: 获取进程列表
 *     description: 返回系统当前运行的进程列表
 *     responses:
 *       200:
 *         description: 成功获取进程列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 list:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       pid:
 *                         type: number
 *                       name:
 *                         type: string
 *                       cpu:
 *                         type: number
 *                       mem:
 *                         type: number
 */
app.get('/api/system/processes', async (req, res) => {
    try {
        const processes = await si.processes();
        res.json(processes);
    } catch (error) {
        console.error('获取进程列表失败:', error);
        res.status(500).json({
            error: 'Failed to get processes',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * @swagger
 * /system-info:
 *   get:
 *     summary: 获取所有系统信息
 *     description: 返回CPU、内存、磁盘、网络和进程的综合信息
 *     responses:
 *       200:
 *         description: 成功获取系统信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 cpu:
 *                   type: object
 *                   properties:
 *                     usage:
 *                       type: number
 *                 memory:
 *                   type: object
 *                   properties:
 *                     usage:
 *                       type: number
 *                 disk:
 *                   type: object
 *                   properties:
 *                     usage:
 *                       type: number
 *                 network:
 *                   type: object
 *                   properties:
 *                     speed:
 *                       type: number
 *                 processes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       pid:
 *                         type: number
 *                       name:
 *                         type: string
 *                       cpu:
 *                         type: number
 *                       mem:
 *                         type: number
 */
app.get('/system-info', async (req, res) => {
    try {
        const [cpu, memory, disks, network, processes] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.fsSize(),
            si.networkStats(),
            si.processes()
        ]);

        // 计算磁盘总使用率
        const totalDisk = disks.reduce((acc, disk) => {
            acc.used += disk.used;
            acc.size += disk.size;
            return acc;
        }, { used: 0, size: 0 });

        const diskUsage = totalDisk.size > 0 ?
            Math.round((totalDisk.used / totalDisk.size) * 100) : 0;

        res.json({
            success: true,
            cpu: {
                usage: cpu.currentLoad
            },
            memory: {
                usage: memory.used / memory.total * 100
            },
            disk: {
                usage: diskUsage
            },
            network: {
                speed: network[0]?.rx_bytes || 0
            },
            processes: processes.list.map((p: any) => {
                return {
                    pid: p.pid,
                    name: p.name,
                    cpu: p.cpu,
                    memory: p.mem
                }
            })
        });
    } catch (error) {
        console.error('获取系统信息失败:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get system info',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * @swagger
 * /screenshot:
 *   get:
 *     summary: 获取全屏截图
 *     description: 返回Base64编码的全屏截图
 *     responses:
 *       200:
 *         description: 成功获取截图
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 image:
 *                   type: string
 *                   description: Base64编码的PNG图片
 *       500:
 *         description: 截图失败
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to capture screenshot"
 */
app.get('/screenshot', async (req, res) => {
    try {
        const base64Image = await captureScreenshotAsBase64();
        res.json({ image: base64Image });
    } catch (error) {
        console.error('截图失败:', error);
        res.status(500).json({
            error: 'Failed to capture screenshot',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * @swagger
 * /screenshot/region:
 *   post:
 *     summary: 获取区域截图
 *     description: 返回Base64编码的指定区域截图
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               x:
 *                 type: number
 *                 description: 区域左上角X坐标
 *               y:
 *                 type: number
 *                 description: 区域左上角Y坐标
 *               width:
 *                 type: number
 *                 description: 区域宽度
 *               height:
 *                 type: number
 *                 description: 区域高度
 *     responses:
 *       200:
 *         description: 成功获取区域截图
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 image:
 *                   type: string
 *                   description: Base64编码的PNG图片
 *       400:
 *         description: 无效参数
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid region parameters"
 *       500:
 *         description: 截图失败
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to capture region screenshot"
 */

/**
 * @swagger
 * /browser/launch:
 *   post:
 *     summary: 启动浏览器
 *     description: 启动一个新的浏览器实例
 *     responses:
 *       200:
 *         description: 浏览器启动成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 */
app.post('/browser/launch', async (req, res) => {
    try {
        const result = await browserController.launch();
        res.json(result);
    } catch (error) {
        console.error('浏览器启动失败:', error);
        res.status(500).json({
            error: 'Failed to launch browser',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * @swagger
 * /browser/close:
 *   post:
 *     summary: 关闭浏览器
 *     description: 关闭当前浏览器实例
 *     responses:
 *       200:
 *         description: 浏览器关闭成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 */
app.post('/browser/close', async (req, res) => {
    try {
        const result = await browserController.close();
        res.json(result);
    } catch (error) {
        console.error('浏览器关闭失败:', error);
        res.status(500).json({
            error: 'Failed to close browser',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * @swagger
 * /browser/navigate:
 *   post:
 *     summary: 导航到URL
 *     description: 在当前浏览器页面导航到指定URL
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: 要导航到的URL
 *                 example: "https://example.com"
 *     responses:
 *       200:
 *         description: 导航成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 url:
 *                   type: string
 *                   example: "https://example.com"
 */
app.post('/browser/navigate', async (req, res) => {
    const { url } = req.body;
    try {
        const result = await browserController.navigate(url);
        res.json(result);
    } catch (error) {
        console.error('导航失败:', error);
        res.status(500).json({
            error: 'Failed to navigate',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * @swagger
 * /browser/screenshot:
 *   get:
 *     summary: 获取浏览器截图
 *     description: 返回当前浏览器页面的Base64编码截图
 *     responses:
 *       200:
 *         description: 截图成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 screenshot:
 *                   type: string
 *                   description: Base64编码的PNG图片
 */
app.get('/browser/screenshot', async (req, res) => {
    try {
        const result = await browserController.screenshot();
        res.json(result);
    } catch (error) {
        console.error('截图失败:', error);
        res.status(500).json({
            error: 'Failed to capture screenshot',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

app.post('/screenshot/region', async (req, res) => {
    const { x, y, width, height } = req.body;

    // 参数验证
    if (x === undefined || y === undefined ||
        width === undefined || height === undefined) {
        return res.status(400).json({
            error: 'Invalid region parameters',
            details: 'x, y, width and height are required'
        });
    }

    if (width <= 0 || height <= 0) {
        return res.status(400).json({
            error: 'Invalid region parameters',
            details: 'width and height must be positive numbers'
        });
    }

    try {
        const base64Image = await captureScreenshotAsBase64({
            region: { x, y, width, height }
        });
        res.json({ image: base64Image });
    } catch (error) {
        console.error('区域截图失败:', error);
        res.status(500).json({
            error: 'Failed to capture region screenshot',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// 服务控制面板静态文件
const panelPath = path.join(__dirname, '../control-panel');
console.log('控制面板路径:', panelPath);
console.log('路径是否存在:', fs.existsSync(panelPath));
app.use('/', express.static(panelPath, {
    index: 'index.html',
    fallthrough: false
}));

// 添加错误处理中间件
app.use('/panel', (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    console.error('控制面板服务错误:', err);
    res.status(500).send('控制面板服务出错');
});

// 调试控制面板路径
const fullPanelPath = path.resolve(panelPath);
console.log('完整控制面板路径:', fullPanelPath);
console.log('目录内容:', fs.readdirSync(fullPanelPath));

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// 创建WebSocket服务器
const wss = new WebSocketServer({ server });

// 创建视频流实例
const videoStreamer = new VideoStreamer({
    fps: 15,
    quality: 23,
    device: '1' // 默认使用第一个视频设备
});

// 处理WebSocket视频流
wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    // 创建视频流管道
    const stream = new PassThrough();

    // 启动视频流
    videoStreamer.start(stream);
    console.log('视频流已启动');

    // 将视频流数据发送给客户端
    stream.on('data', (chunk) => {
        console.log('收到视频数据块，长度:', chunk.length, '字节');
        console.log('前16字节:', chunk.slice(0, 16).toString('hex'));
        ws.send(JSON.stringify({
            type: 'video',
            data: chunk.toString('base64')
        }));
    });

    // 处理错误
    stream.on('error', (err) => {
        console.error('视频流错误:', err);
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        videoStreamer.stop();
    });
});
