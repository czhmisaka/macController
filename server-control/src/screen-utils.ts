// server-control/src/screen-utils.ts

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import robot from 'robotjs';
import { execSync } from 'child_process';

// 类型定义
interface DisplayScaling {
    scaleX: number;
    scaleY: number;
}

interface ScreenshotOptions {
    quality?: number; // 图片质量 (1-100)
    compressionLevel?: number; // 压缩级别 (0-9)
    outputDir?: string; // 输出目录
    fileName?: string; // 文件名
}

interface ScreenshotResult {
    filePath: string;
    logicalWidth: number;
    logicalHeight: number;
    physicalWidth: number;
    physicalHeight: number;
    scaling: DisplayScaling;
}

// 获取显示器缩放比例
export function getDisplayScaling(): DisplayScaling {
    try {
        const displayInfo = execSync('system_profiler SPDisplaysDataType -json', { encoding: 'utf-8' });
        const parsedInfo = JSON.parse(displayInfo);
        const displays = parsedInfo.SPDisplaysDataType[0].spdisplays_ndrvs;
        const mainDisplay = displays.find((d: any) => d['spdisplays_main'] === 'spdisplays_yes');
        if (!mainDisplay) return { scaleX: 1, scaleY: 1 };
        const logicalRes = mainDisplay['_spdisplays_resolution'].match(/(\d+) x (\d+)/);
        const physicalRes = mainDisplay['_spdisplays_pixels'].match(/(\d+) x (\d+)/);

        if (!logicalRes || !physicalRes || logicalRes.length < 3 || physicalRes.length < 3) {
            console.error('无法解析显示器分辨率');
            return { scaleX: 1, scaleY: 1 };
        }

        return {
            scaleX: parseInt(physicalRes[1]) / parseInt(logicalRes[1]),
            scaleY: parseInt(physicalRes[2]) / parseInt(logicalRes[2])
        };
    } catch (e) {
        console.error('获取屏幕缩放比例失败:', e);
        return { scaleX: 1, scaleY: 1 };
    }
}

// 移除行填充
export function removeRowPadding(
    imageBuffer: Buffer,
    width: number,
    height: number,
    bytesPerPixel: number,
    paddingBytes: number
): Buffer {
    const result = Buffer.alloc(width * height * bytesPerPixel);
    for (let y = 0; y < height; y++) {
        const sourceOffset = y * (width * bytesPerPixel + paddingBytes);
        const targetOffset = y * width * bytesPerPixel;
        imageBuffer.copy(result, targetOffset, sourceOffset, sourceOffset + width * bytesPerPixel);
    }
    return result;
}

// 扩展截图选项
interface Region {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

interface ScreenshotOptions {
    quality?: number; // 图片质量 (1-100)
    compressionLevel?: number; // 压缩级别 (0-9)
    outputDir?: string; // 输出目录
    fileName?: string; // 文件名
    region?: Region; // 截图区域
}

// 完整的截图捕获和处理流程
export async function captureAndProcessScreenshot(
    options: ScreenshotOptions = {}
): Promise<ScreenshotResult> {
    const {
        quality = 80,
        compressionLevel = 6,
        outputDir = path.join(process.cwd(), 'temp'),
        fileName = 'screenshot.png',
        region
    } = options;

    // 1. 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 2. 捕获屏幕截图
    const screenshot = region
        ? robot.screen.capture(region.x, region.y, region.width, region.height)
        : robot.screen.capture();

    if (!screenshot || !screenshot.image) {
        throw new Error('屏幕截图捕获失败');
    }

    // 验证区域参数
    if (region) {
        if (region.x === undefined || region.y === undefined ||
            region.width === undefined || region.height === undefined) {
            throw new Error('区域截图需要完整的x,y,width,height参数');
        }
        if (region.width <= 0 || region.height <= 0) {
            throw new Error('截图区域宽高必须大于0');
        }
    }

    // 3. 获取显示器缩放信息
    const scaling = getDisplayScaling();
    const logicalWidth = Math.floor(screenshot.width / scaling.scaleX);
    const logicalHeight = Math.floor(screenshot.height / scaling.scaleY);

    // 4. 处理图像数据
    const strippedBuffer = removeRowPadding(
        screenshot.image,
        screenshot.width,
        screenshot.height,
        4, // RGBA
        screenshot.byteWidth - (screenshot.width * 4)
    );

    // 5. 保存图像文件
    const filePath = path.join(outputDir, 'zip.png');
    console.log('保存截图到:', filePath);
    await sharp(strippedBuffer, {
        raw: {
            width: screenshot.width,
            height: screenshot.height,
            channels: 4
        }
    })
        .resize(logicalWidth, logicalHeight, {
            fit: 'fill',
            kernel: sharp.kernel.nearest
        })
        .toColorspace('srgb')
        .png({ quality, compressionLevel })
        .toFile(filePath);

    return {
        filePath,
        logicalWidth,
        logicalHeight,
        physicalWidth: screenshot.width,
        physicalHeight: screenshot.height,
        scaling
    };
    // } catch (error) {
    //     console.error('截图处理失败:', error);
    //     throw new Error(`截图处理失败: ${error instanceof Error ? error.message : String(error)}`);
    // }
}

// 新增: 获取Base64格式截图
export async function captureScreenshotAsBase64(
    options: ScreenshotOptions = {}
): Promise<string> {
    const result = await captureAndProcessScreenshot(options);
    // console.log('截图保存到:', result);
    const imageBuffer = fs.readFileSync(result.filePath);
    // fs.unlinkSync(result.filePath); // 删除临时文件
    return imageBuffer.toString('base64');
}

// 辅助函数：获取临时目录路径
export function getTempDir(): string {
    return path.join(process.cwd(), 'temp');
}
