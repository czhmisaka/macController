/*
 * @Date: 2025-05-08 16:49:34
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-09 17:56:56
 * @FilePath: /指令控制电脑/server-control/src/glm-image.ts
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import sharp from 'sharp';

dotenv.config();

export async function analyzeImage(imagePath: string, prompt: string = '请用准确的语句完整的描述出当前屏幕内的内容') {
    try {
        // 检查图片文件是否存在
        if (!fs.existsSync(imagePath)) {
            throw new Error(`图片文件不存在: ${imagePath}`);
        }

        // 读取图片
        const imageBuffer = await fs.promises.readFile(imagePath);

        // 检查图片质量
        const metadata = await sharp(imageBuffer).metadata();
        if (!metadata.width || !metadata.height) {
            console.warn('无法获取图片尺寸信息');
        } else if (metadata.width < 100 || metadata.height < 100) {
            console.warn(`图片分辨率较低(${metadata.width}x${metadata.height})，可能影响识别效果`);
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
