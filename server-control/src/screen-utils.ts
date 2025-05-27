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

// 多模态分析相关类型
export interface ImageAnalysisOptions {
    prompt?: string;
    detailLevel?: 'low' | 'high';
    timeout?: number;
}

export interface ImageAnalysisResult {
    content: string;
    fullResponse: any;
    elapsed: number;
}

// 分析Base64格式图片
export async function analyzeImage(
    base64Image: string,
    options: ImageAnalysisOptions = {}
): Promise<ImageAnalysisResult> {
    // Qwen模型固定配置
    const {
        prompt = '请详细描述这张图片的内容', // 默认分析提示词
        detailLevel = 'high', // 默认高细节分析
        timeout = 300000 // 默认30秒超时
    } = options;
    const model = 'qwen2.5-vl-7b-instruct'; // 固定使用Qwen多模态模型

    const startTime = Date.now();
    console.log('开始分析图片...', { prompt, detailLevel, timeout });
    // try {
    // 构造Qwen API请求
    const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model, // 模型名称
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt }, // 文本提示
                    {
                        type: 'image_url', // 图片数据
                        image_url: {
                            url: `data:image/png;base64,${base64Image}`,
                            detail: detailLevel // 分析细节级别
                        }
                    }
                ]
            }],
            temperature: 0.7, // 生成多样性控制
            max_tokens: 1000 // 最大输出token数
        }),
        signal: AbortSignal.timeout(timeout) // 请求超时控制
    });

    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const elapsed = Date.now() - startTime;
    console.log('图片分析完成:', data, data.choices[0]?.message?.content);
    return {
        content: data.choices[0]?.message?.content || '',
        fullResponse: data,
        elapsed
    };
    // } catch (error) {
    //     console.error('图片分析失败:', error);
    //     throw new Error(`图片分析失败: ${error instanceof Error ? error.message : String(error)}`);
    // }
}

// 截图并分析
export async function analyzeScreenshot(
    options: ScreenshotOptions & ImageAnalysisOptions = {}
): Promise<ImageAnalysisResult> {
    const base64Image = await captureScreenshotAsBase64(options);
    return analyzeImage(base64Image, options);
}

// 辅助函数：获取临时目录路径
export function getTempDir(): string {
    return path.join(process.cwd(), 'temp');
}
