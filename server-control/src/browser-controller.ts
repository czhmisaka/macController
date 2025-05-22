/*
 * @Date: 2025-05-22 11:01:36
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-22 11:01:53
 * @FilePath: /指令控制电脑/server-control/src/browser-controller.ts
 */
import puppeteer, { Browser, Page } from 'puppeteer';

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
        const screenshot = await this.page.screenshot({ fullPage });
        return { success: true, screenshot };
    }

    async evaluate(script: string) {
        if (!this.page) throw new Error('Browser not launched');
        const result = await this.page.evaluate(script);
        return { success: true, result };
    }
}
