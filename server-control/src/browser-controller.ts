/*
 * @Date: 2025-05-22 11:01:36
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-28 02:18:14
 * @FilePath: /指令控制电脑/server-control/src/browser-controller.ts
 */
import puppeteer, { Browser, Page } from 'puppeteer';
import { ImageAnalysisOptions, analyzeImage } from './screen-utils';

export class BrowserController {
    private browser: Browser | null = null;
    private page: Page | null = null;

    async launch() {
        this.browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1
        });
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
        prompt: '请详细分析这个网页截图，告诉我简要内容',
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
            console.log(screenshot, '截图')

            // 使用Qwen模型进行分析
            const qwenResult = await analyzeImage(screenshot, options);
            result.analysis = {
                content: qwenResult.content,
                fullResponse: qwenResult.fullResponse,
                elapsed: qwenResult.elapsed
            };

        } catch (error) {
            console.error('图片分析失败:', error);
            // 即使图片分析失败也返回基本浏览器信息
            return error as any
        }

        return result;
    }
}
