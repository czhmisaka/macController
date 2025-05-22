#!/bin/bash
###
 # @Date: 2025-05-16 01:53:20
 # @LastEditors: CZH
 # @LastEditTime: 2025-05-16 02:05:11
 # @FilePath: /指令控制电脑/query_image.sh
### 
# 多模态图片查询脚本

# 检查图片文件是否存在
if [ ! -f "full_screenshot.png" ]; then
    echo "错误: full_screenshot.png 文件不存在"
    exit 1
fi

# 检查jq是否安装
if ! command -v jq &> /dev/null; then
    echo "错误: jq 工具未安装，请先安装"
    exit 1
fi

# 将图片转为base64
IMG_BASE64=$(base64 -i full_screenshot.png)

# 构造JSON请求
JSON_DATA=$(jq -n \
  --arg model "qwen2.5-vl-7b-instruct" \
  --arg img "$IMG_BASE64" \
  '{
    "model": $model,
    "messages": [
      {
        "role": "user", 
        "content": [
          {"type": "text", "text": ""},
          {"type": "image_url", "image_url": {"url": "data:image/png;base64,\($img)", "detail": "high"}}
        ]
      }
    ],
    "temperature": 0.7,
    "max_tokens": 1000,
    "stream": false
  }')

# 发送请求并输出结果
echo "正在向LM Studio发送请求..."
START_TIME=$(date +%s.%N)

RESPONSE=$(curl -s -X POST http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "$JSON_DATA")

END_TIME=$(date +%s.%N)
ELAPSED=$(echo "$END_TIME - $START_TIME" | bc -l)

# 提取并格式化输出
echo ""
echo "=== 响应内容 ==="
echo "$RESPONSE" | jq -r '.choices[0].message.content'
echo ""
echo "=== 完整响应 ===" 
echo "$RESPONSE" | jq
echo ""
echo "执行耗时: ${ELAPSED}秒"
echo ""

exit 0
