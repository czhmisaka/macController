/*
 * @Date: 2025-05-08 16:49:34
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-28 15:06:58
 * @FilePath: /指令控制电脑/server-control/src/glm-image.ts
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import sharp from 'sharp';

dotenv.config();

async function compressImageToTargetSize(
    buffer: Buffer,
    targetKB: number,
    initialQuality = 80
): Promise<Buffer> {
    let quality = initialQuality;
    let compressedBuffer = buffer;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
        const currentSizeKB = compressedBuffer.length / 1024;
        if (currentSizeKB <= targetKB) break;

        quality = Math.max(10, quality - 10);
        compressedBuffer = await sharp(compressedBuffer)
            .jpeg({ quality })
            .toBuffer();

        attempts++;
    }

    const finalSizeKB = compressedBuffer.length / 1024;
    if (finalSizeKB > targetKB) {
        console.warn(`图片压缩后仍超过目标大小: ${finalSizeKB.toFixed(1)}KB (目标: ${targetKB}KB)`);
    }

    return compressedBuffer;
}


export async function analyzeImage(
    imagePath: string,
    options: {
        prompt?: string;
        model?: string;
        detailLevel?: 'low' | 'high';
        timeout?: number;
    } = {}
): Promise<{
    content: string;
    fullResponse: any;
}> {
    const prompt = options.prompt || '请用准确的语句完整的描述出当前屏幕内的内容';
    try {
        // 检查图片文件是否存在
        if (!fs.existsSync(imagePath)) {
            throw new Error(`图片文件不存在: ${imagePath}`);
        }

        // 读取图片
        let imageBuffer = await fs.promises.readFile(imagePath);

        // 检查图片质量
        const metadata = await sharp(imageBuffer).metadata();
        if (!metadata.width || !metadata.height) {
            console.warn('无法获取图片尺寸信息');
        } else if (metadata.width < 100 || metadata.height < 100) {
            console.warn(`图片分辨率较低(${metadata.width}x${metadata.height})，可能影响识别效果`);
        }

        // 检查并压缩图片
        const maxSizeKB = 500;
        if (imageBuffer.length / 1024 > maxSizeKB) {
            imageBuffer = await compressImageToTargetSize(imageBuffer, maxSizeKB);
        }

        // 转换为base64
        const imageBase64 = imageBuffer.toString('base64');

        // 构造请求
        const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            model: "glm-4v-flash",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${imageBase64}`
                            }
                        },
                        {
                            type: "text",
                            text: prompt
                        }
                    ]
                }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GLM_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.choices[0].message;
    } catch (error) {
        console.error('图片处理失败:', error instanceof Error ? error.message : error);
        throw new Error(`图片处理失败: ${error instanceof Error ? error.message : error}`);
    }
}
