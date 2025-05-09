#!/bin/bash
###
 # @Date: 2025-05-08 17:15:19
 # @LastEditors: CZH
 # @LastEditTime: 2025-05-09 18:01:12
 # @FilePath: /指令控制电脑/test.sh
### 

# 测试屏幕信息接口
echo -e "\n===== 测试屏幕信息接口 ====="
screen_info=$(curl -s http://localhost:15800/screen/info)
echo "屏幕信息:"
echo $screen_info | jq -r '.displays[] | "显示器 \(.vendor) \(.model): \(.width)x\(.height) @ \(.refreshRate)Hz"'

# 测试屏幕分析功能
echo -e "\n===== 测试屏幕分析(默认提示词) ====="
analysis_result=$(curl -s -X POST http://localhost:15800/screen/analyze)
echo "分析结果:"
echo $analysis_result | jq -r '.result'

# 测试带提示词的屏幕分析
echo -e "\n===== 测试屏幕分析(自定义提示词) ====="
custom_prompt="屏幕中最大块的文本哪有什么信息？"
analysis_result=$(curl -s -X POST http://localhost:15800/screen/analyze \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"$custom_prompt\"}")
echo "提示词: $custom_prompt"
echo "分析结果:"
echo $analysis_result | jq -r '.result'

# # 在屏幕中央画圆
# echo -e "\n===== 开始画圆测试 ====="
# center_x=800
# center_y=500
# radius=200
# steps=20

# for ((i=0; i<=steps; i++))
# do
#     angle=$(awk -v i=$i -v steps=$steps 'BEGIN {pi=3.14159; print 2*pi*i/steps}')
#     x=$(awk -v cx=$center_x -v r=$radius -v a=$angle 'BEGIN {pi=3.14159; print int(cx + r * cos(a) + 0.5)}')
#     y=$(awk -v cy=$center_y -v r=$radius -v a=$angle 'BEGIN {pi=3.14159; print int(cy + r * sin(a) + 0.5)}')
    
#     echo "移动鼠标到($x,$y)"
#     curl -X POST http://localhost:15800/mouse/move \
#       -H "Content-Type: application/json" \
#       -d "{\"x\":$x,\"y\":$y}"
    
# done
