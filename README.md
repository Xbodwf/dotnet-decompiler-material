# .NET Decompiler Web GUI

一个基于 Web 的 .NET 反编译工具，使用 ILSpy 反编译引擎。

## 功能特点

- 📦 支持 .dll 和 .exe 文件
- 🔍 搜索类型、方法、属性
- 🌳 树形结构浏览类型成员
- 📝 语法高亮的代码查看
- 🎨 现代化深色主题界面
- 🔄 支持多文件上传
- 💻 跨平台支持（Linux、Windows、macOS）

## 技术栈

- **后端**: C# / .NET 10 + ICSharpCode.Decompiler
- **前端**: 纯 HTML/CSS/JavaScript + CodeMirror

## 快速开始

### 依赖

- .NET SDK 10.0+
- Python 3（用于静态文件服务）

### 启动服务

```bash
./start.sh
```

### 访问界面

打开浏览器访问: http://localhost:8080

### 单独启动后端

```bash
cd backend
dotnet run
```

后端服务将运行在 http://localhost:3721

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/upload` | POST | 上传程序集文件 |
| `/api/assemblies` | GET | 获取已加载的程序集列表 |
| `/api/types` | GET | 获取程序集中的类型（?assembly=xxx） |
| `/api/decompile` | GET | 反编译类型或程序集 |
| `/api/search` | GET | 搜索类型和成员 |

## 使用方法

1. 启动服务后，打开浏览器访问 http://localhost:8080
2. 点击"打开程序集"按钮或拖放 .dll/.exe 文件到页面
3. 在左侧面板选择要查看的程序集
4. 展开类型树查看类、方法、属性等
5. 点击类型或成员查看反编译后的代码

## 快捷键

- `Ctrl+O`: 打开文件
- `Ctrl+F`: 搜索

## 许可证

MIT License
