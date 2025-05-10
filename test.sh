#!/bin/bash
###
 # @Date: 2025-05-08 17:15:19
 # @LastEditors: CZH
 # @LastEditTime: 2025-05-10 10:38:42
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

# 在屏幕中央画圆
echo -e "\n===== 开始画圆测试 ====="
center_x=800
center_y=500
radius=200
steps=400

for ((i=0; i<=steps; i++))
do
    angle=$(awk -v i=$i -v steps=$steps 'BEGIN {pi=3.14159; print 2*pi*i/steps}')
    x=$(awk -v cx=$center_x -v r=$radius -v a=$angle 'BEGIN {pi=3.14159; print int(cx + r * cos(a) + 0.5)}')
    y=$(awk -v cy=$center_y -v r=$radius -v a=$angle 'BEGIN {pi=3.14159; print int(cy + r * sin(a) + 0.5)}')
    
    echo "移动鼠标到($x,$y)"
    curl -X POST http://localhost:15800/mouse/move \
      -H "Content-Type: application/json" \
      -d "{\"x\":$x,\"y\":$y}"
    
done

# 测试键盘字符串输入
echo -e "\n===== 测试键盘字符串输入 ====="
test_string="helloworld"
echo "测试输入字符串: $test_string"
curl -X POST http://localhost:15800/keyboard/type \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"$test_string\"}"

# 测试全屏截图
echo -e "\n===== 测试全屏截图 ====="
screenshot_result=$(curl -s http://localhost:15800/screenshot)
echo "获取全屏截图..."
echo $screenshot_result | jq -r '.image' | base64 --decode > full_screenshot.png
if [ -f "full_screenshot.png" ]; then
    echo "全屏截图已保存为 full_screenshot.png"
else
    echo "全屏截图保存失败"
fi

# 测试区域截图
echo -e "\n===== 测试区域截图 ====="
region_x=100
region_y=100
region_width=300
region_height=200
echo "测试区域: x=$region_x, y=$region_y, width=$region_width, height=$region_height"
region_result=$(curl -s -X POST http://localhost:15800/screenshot/region \
  -H "Content-Type: application/json" \
  -d "{\"x\":$region_x,\"y\":$region_y,\"width\":$region_width,\"height\":$region_height}")
echo $region_result | jq -r '.image' | base64 --decode > region_screenshot.png
if [ -f "region_screenshot.png" ]; then
    echo "区域截图已保存为 region_screenshot.png"
else
    echo "区域截图保存失败"
fi
