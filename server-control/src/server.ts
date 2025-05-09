/*
 * @Date: 2025-05-08 16:21:48
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-09 14:30:50
 * @FilePath: /指令控制电脑/server-control/src/server.ts
 */
import express from 'express';
import robot from 'robotjs';
import dotenv from 'dotenv';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { analyzeImage } from './glm-image';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import si from 'systeminformation';

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
 * /screen/analyze:
 *   post:
 *     summary: 屏幕分析
 *     description: 捕获屏幕并发送到AI模型进行分析
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
                isBuiltIn: primaryDisplay.builtin
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

app.post('/screen/analyze', async (req, res) => {
    try {
        // 1. 检查temp目录
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
            console.log(`已创建临时目录: ${tempDir}`);
        }

        // 2. 捕获屏幕截图
        console.log('开始捕获屏幕截图...');
        const screenshot = robot.screen.capture();
        if (!screenshot || !screenshot.image) {
            throw new Error('屏幕截图捕获失败');
        }
        console.log('截图捕获成功，尺寸:', screenshot.width, 'x', screenshot.height);

        // 3. 保存截图文件
        const tempPath = path.join(tempDir, 'screenshot.png');
        console.log(`正在保存截图到: ${tempPath}`);

        try {
            const canvas = createCanvas(screenshot.width, screenshot.height);
            const ctx = canvas.getContext('2d');

            // 将robotjs的BGRA数据转换为RGBA
            const imageData = ctx.createImageData(screenshot.width, screenshot.height);
            const bgraData = screenshot.image;
            for (let y = 0; y < screenshot.height; y++) {
                for (let x = 0; x < screenshot.width; x++) {
                    const idx = (y * screenshot.width + x) * 4;
                    // BGRA -> RGBA 转换
                    imageData.data[idx] = bgraData[idx + 2];     // R
                    imageData.data[idx + 1] = bgraData[idx + 1]; // G
                    imageData.data[idx + 2] = bgraData[idx];     // B
                    imageData.data[idx + 3] = bgraData[idx + 3]; // A
                }
            }
            ctx.putImageData(imageData, 0, 0);

            // 保存为PNG
            const out = fs.createWriteStream(tempPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
            await new Promise<void>((resolve, reject) => {
                out.on('finish', () => resolve());
                out.on('error', (err) => reject(err));
            });
            console.log(`截图已成功保存到: ${tempPath}`);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : '未知错误';
            console.error('截图保存失败:', errorMsg);
            throw new Error(`截图保存失败: ${errorMsg}`);
        }

        // 4. 验证文件
        if (!fs.existsSync(tempPath)) {
            throw new Error(`截图文件不存在，路径: ${tempPath}`);
        }

        // 使用GLM-4V模型分析截图
        const result = await analyzeImage(tempPath);
        res.json({ result });
    } catch (error) {
        res.status(500).json({ error: 'Screen analysis failed' });
    }
});

// 确保temp目录存在
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`已创建临时目录: ${tempDir}`);
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
