/*
 * @Date: 2025-05-16 02:31:01
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-16 02:31:12
 * @FilePath: /指令控制电脑/server-control/test-image-analysis.js
 */
const { analyzeScreenshot } = require('./src/screen-utils');

(async () => {
    try {
        console.log('开始截图并分析...');
        const result = await analyzeScreenshot({
            model: 'qwen2.5-vl-7b-instruct',
            prompt: '请详细描述这张图片的内容',
            detailLevel: 'high'
        });

        console.log('分析完成，耗时:', result.elapsed + 'ms');
        console.log('分析结果:');
        console.log(result.content);
        console.log('\n完整响应:');
        console.log(JSON.stringify(result.fullResponse, null, 2));
    } catch (error) {
        console.error('分析失败:', error.message);
        process.exit(1);
    }
})();
