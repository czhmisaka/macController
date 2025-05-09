# macController 🖥️

[![GitHub stars](https://img.shields.io/github/stars/czhmisaka/macController?style=social)](https://github.com/czhmisaka/macController)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.20.8-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4%2B-blue)](https://www.typescriptlang.org/)

一个用于Mac系统监控和远程控制的Node.js/TypeScript服务。

## ✨ 功能特性

### 系统监控
- CPU/内存/磁盘使用率监控
- 网络状态检测
- 进程管理

### **远程控制**
- 屏幕截图捕获
- 键盘鼠标模拟
- 应用程序控制

### API服务
- RESTful API接口
- WebSocket实时通信
- 类型安全的TypeScript实现

## 📡 API文档

### 🖱️ 鼠标控制
**POST /mouse/move**  
移动鼠标到指定坐标  
请求参数:
```json
{
  "x": 100,
  "y": 200
}
```

### ⌨️ 键盘控制  
**POST /keyboard/type**  
模拟键盘输入文本  
请求参数:
```json
{
  "text": "Hello World"
}
```

### 🖥️ 屏幕信息  
**GET /screen/info**  
获取屏幕分辨率、DPI等信息  
响应示例:
```json
{
  "screenCount": 1,
  "primaryScreen": {
    "width": 2560,
    "height": 1440,
    "dpi": 96,
    "scaling": {
      "scaleX": 1,
      "scaleY": 1
    }
  }
}
```

### 🔍 屏幕分析  
**POST /screen/analyze**  
捕获屏幕并发送AI分析  
请求参数:
```json
{
  "prompt": "请描述屏幕内容并定位搜索框位置"
}
```

## 安装要求
- Node.js 18.20.8 (推荐使用nvm管理版本)
- npm 8+
- TypeScript 4+
- 环境变量配置:
  ```bash
  # 服务器端口(默认15800)
  SERVER_PORT=15800
  
  # GLM API密钥
  GLM_API_KEY=your_api_key_here
  ```

## 🚀 快速开始
1. 克隆仓库
2. 切换到项目目录并设置Node版本：
   ```bash
   nvm use
   ```
3. 安装依赖：
   ```bash
   npm install
   ```
4. 创建.env文件并配置环境变量
5. 编译并运行：
   ```bash
   npm run build
   npm start
   ```

## 🔧 开发指南
- 使用`npm run dev`启动开发服务器
- 代码位于`src/`目录
- 类型定义在`src/types/`

## 📜 许可证
MIT © [czhmisaka](https://github.com/czhmisaka)
