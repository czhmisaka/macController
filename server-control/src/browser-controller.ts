/*
 * @Date: 2025-05-22 11:01:36
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-23 17:04:34
 * @FilePath: /指令控制电脑/server-control/src/browser-controller.ts
 */
import puppeteer, { Browser, Page } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { ImageAnalysisOptions, analyzeImage } from './screen-utils';
import { analyzeImage as analyzeImageGLM } from './glm-image';

export class BrowserController {
    private browser: Browser | null = null;
    private page: Page | null = null;

    async launch() {
        this.browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        return { success: true };
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
        return { success: true };
    }

    async navigate(url: string) {
        if (!this.page) throw new Error('Browser not launched');
        await this.page.goto(url);
        return { success: true, url };
    }

    async screenshot(fullPage = false) {
        if (!this.page) throw new Error('Browser not launched');
        const screenshotBuffer = await this.page.screenshot({ fullPage, encoding: 'base64' });
        return { success: true, screenshot: screenshotBuffer };
    }

    async evaluate(script: string) {
        if (!this.page) throw new Error('Browser not launched');
        const result = await this.page.evaluate(script);
        return { success: true, result };
    }

    async analyzeScreenshot(options: ImageAnalysisOptions = {
        model: 'qwen',
        prompt: '请详细分析这个网页截图，包括主要内容、布局结构、关键元素和整体风格',
        detailLevel: 'high'
    }): Promise<{
        url: string;
        title: string;
        elementsCount: number;
        loadTime: number;
        memoryUsage: number;
        cpuUsage: number;
        isSecure: boolean;
        cookiesCount: number;
        localStorageItems: number;
        imagesCount: number;
        scriptsCount: number;
        stylesheetsCount: number;
        analysis?: {
            content: string;
            elements?: Array<{
                type: string;
                description: string;
                position?: { x: number; y: number; width: number; height: number };
            }>;
            layout?: string;
            sentiment?: string;
            fullResponse?: any;
            elapsed: number;
        };
    }> {
        if (!this.page) throw new Error('Browser not launched');

        // 1. 获取页面基本信息
        const url = await this.page.url();
        const title = await this.page.title();

        // 2. 获取页面元素统计
        const elementsCount = await this.page.$$eval('*', elements => elements.length);
        const imagesCount = await this.page.$$eval('img', images => images.length);
        const scriptsCount = await this.page.$$eval('script', scripts => scripts.length);
        const stylesheetsCount = await this.page.$$eval('link[rel="stylesheet"]', links => links.length);

        // 3. 获取性能指标
        const performance = await this.page.evaluate(() => {
            const timing = window.performance.timing;
            return {
                loadTime: timing.loadEventEnd - timing.navigationStart,
                memory: (window.performance as any).memory,
                cpu: (window.performance as any).cpu
            };
        });

        // 4. 获取安全信息
        const securityState = await this.page.evaluate(() => window.location.protocol === 'https:');
        const cookiesCount = (await this.page.cookies()).length;
        const localStorageItems = await this.page.evaluate(() => localStorage.length);

        // 5. 获取浏览器截图并分析
        const result: {
            url: string;
            title: string;
            elementsCount: number;
            loadTime: number;
            memoryUsage: number;
            cpuUsage: number;
            isSecure: boolean;
            cookiesCount: number;
            localStorageItems: number;
            imagesCount: number;
            scriptsCount: number;
            stylesheetsCount: number;
            analysis?: {
                content: string;
                elements?: Array<{
                    type: string;
                    description: string;
                    position?: { x: number; y: number; width: number; height: number };
                }>;
                layout?: string;
                sentiment?: string;
                fullResponse?: any;
                elapsed: number;
            };
        } = {
            url,
            title,
            elementsCount,
            loadTime: performance.loadTime || 0,
            memoryUsage: performance.memory?.usedJSHeapSize ?
                Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)) : 0,
            cpuUsage: performance.cpu?.usage || 0,
            isSecure: securityState,
            cookiesCount,
            localStorageItems,
            imagesCount,
            scriptsCount,
            stylesheetsCount,
            analysis: undefined
        };

        try {
            const { screenshot } = await this.screenshot(true);

            // 根据选项选择不同的分析模型
            if (options.model === 'glm') {
                const tempPath = path.join(process.cwd(), 'temp', 'screenshot.png');
                fs.writeFileSync(tempPath, Buffer.from(screenshot, 'base64'));
                const glmResult = await analyzeImageGLM(tempPath, options);
                result.analysis = {
                    content: glmResult.content,
                    fullResponse: glmResult,
                    elapsed: 0 // GLM API不返回处理时间
                };
            } else {
                // 默认使用Qwen模型
                const qwenResult = await analyzeImage(screenshot, options);
                result.analysis = {
                    content: qwenResult.content,
                    fullResponse: qwenResult.fullResponse,
                    elapsed: qwenResult.elapsed
                };
            }

            // 尝试解析结构化数据
            if (result.analysis?.content) {
                try {
                    const jsonMatch = result.analysis.content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        result.analysis.elements = parsed.elements;
                        result.analysis.layout = parsed.layout;
                        result.analysis.sentiment = parsed.sentiment;
                    }
                } catch (e) {
                    console.log('无法解析AI返回的结构化数据:', e);
                }
            }
        } catch (error) {
            console.error('图片分析失败:', error);
            // 即使图片分析失败也返回基本浏览器信息
        }

        return result;
    }
}
