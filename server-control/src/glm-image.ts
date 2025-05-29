/*
 * @Date: 2025-05-08 16:49:34
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-28 17:19:09
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



// 通过分析网页源代码 sourceCode 来回答用户需求 userIntent 的函数
// 调用模型为 glm4-flash
export async function analyzeSourceCode(
    sourceCode: string,
    userIntent: string,
    options: {
        model?: string;
        timeout?: number;
    } = { timeout: 3000000 }
): Promise<{
    content: string;
    fullResponse: any;
}> {
    try {
        const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            model: options.model || "glm-4-flash-250414",
            messages: [
                {
                    role: "system",
                    content: `你是一个专业的前端开发，善于理解用户的需求，并观察网页源代码给出能完成用户需求的的js代码。
                        网页源代码:【\n${sourceCode}\n\n】
                        
                        要求：
                        1. 只需要输出js代码即可，不需要输出思考过程。
                        2. 确保输出的js代码可以在浏览器环境里执行。
                        3. 用户的需求如果是点击某个按钮，则输出点击按钮的js代码。
                    `
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `${userIntent}`
                        }
                    ]
                }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GLM_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: options.timeout
        });

        console.log(`你是一个专业的前端开发，善于理解用户的需求，并观察网页源代码给出能完成用户需求的的js代码。
                        网页源代码:【\n${sourceCode}\n\n】
                        
                        要求：
                        1. 只需要输出js代码即可，不需要输出思考过程。
                        2. 确保输出的js代码可以在浏览器环境里执行。
                        3. 用户的需求如果是点击某个按钮，则输出点击按钮的js代码。
                    `)

        return {
            content: response.data.choices[0].message.content,
            fullResponse: response.data
        };
    } catch (error) {
        console.error('源代码分析失败:', error instanceof Error ? error.message : error);
        throw new Error(`源代码分析失败: ${error instanceof Error ? error.message : error}`);
    }
}
