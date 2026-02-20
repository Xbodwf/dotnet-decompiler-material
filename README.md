# .NET Decompiler Web GUI

一个基于 Web 的 .NET 反编译工具，使用 ILSpy 反编译引擎，提供类似 dnSpy/ILSpy 的 GUI 体验。

## 功能特点

### 核心功能
- 📦 支持 .dll 和 .exe 文件反编译
- 🌳 树形结构浏览：程序集 → 命名空间 → 类 → 成员
- 🔍 搜索类型、方法、属性
- 📝 Monaco Editor 代码编辑器（VS Code 同款）
- 🎨 Material Design 3 现代化界面

### 高级功能
- 📂 文件浏览器：浏览服务器文件系统打开程序集
- 📤 导出为项目：按命名空间组织文件夹结构导出 .cs 文件
- 📁 在文件管理器中打开：快速定位程序集文件
- 🔄 拖拽排序：程序集列表和标签页支持拖拽重排
- 📏 可调整面板：程序集列表和类型浏览器高度可拖动调整
- 🌐 国际化：支持中文/英文切换

### 右键菜单
- 在文件管理器中打开
- 导出为项目（生成 .csproj + 源代码）
- 删除程序集

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | C# / .NET 10 + ICSharpCode.Decompiler 9.1 |
| 前端 | React 19 + TypeScript + Vite |
| UI | Material UI (MUI) 7 + Material Design 3 |
| 编辑器 | Monaco Editor |
| 拖拽 | @dnd-kit |
| 国际化 | i18next |

## 项目结构

```
dotnet-decompiler/
├── backend/
│   ├── DecompilerService.cs      # 后端服务主程序
│   └── DecompilerService.csproj  # .NET 项目文件
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # 主应用组件
│   │   ├── FilePicker.tsx        # 文件选择器
│   │   ├── api.ts                # API 客户端
│   │   ├── theme.ts              # MD3 主题配置
│   │   ├── types.ts              # TypeScript 类型定义
│   │   └── i18n/                 # 国际化
│   │       ├── en.ts
│   │       ├── zh.ts
│   │       └── index.ts
│   └── package.json
├── start.sh                      # 启动脚本
└── README.md
```

## 快速开始

### 依赖

- .NET SDK 10.0+
- Node.js 18+ / pnpm

### 启动服务

```bash
cd dotnet-decompiler
./start.sh
```

这将同时启动：
- 后端 API 服务：http://localhost:3721
- 前端开发服务器：http://localhost:5173

### 单独启动

**后端：**
```bash
cd backend
dotnet run
```

**前端：**
```bash
cd frontend
pnpm install
pnpm dev
```

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/upload` | POST | 上传程序集文件 |
| `/api/assemblies` | GET | 获取已加载的程序集列表 |
| `/api/types` | GET | 获取程序集中的类型树 |
| `/api/decompile` | GET | 反编译类型或程序集 |
| `/api/search` | GET | 搜索类型和成员 |
| `/api/fs/list` | GET | 列出目录内容 |
| `/api/fs/open` | POST | 通过路径打开程序集 |
| `/api/assembly/{id}` | DELETE | 删除程序集 |
| `/api/assembly/{id}/open-folder` | POST | 在文件管理器中打开 |
| `/api/assembly/{id}/export-project` | POST | 导出为项目 |

## 使用方法

1. 启动服务后，打开浏览器访问 http://localhost:5173
2. 点击「浏览文件」在服务器文件系统中选择程序集
3. 或点击「上传文件」上传本地 .dll/.exe 文件
4. 在左侧面板选择程序集，展开类型树
5. 点击类型或成员查看反编译后的 C# 代码
6. 右键点击程序集可导出为项目或删除

## 导出项目结构

导出的项目按命名空间组织：

```
exported/
└── AssemblyName/
    ├── AssemblyName.csproj
    ├── NamespaceA/
    │   ├── ClassA.cs
    │   └── SubNamespace/
    │       └── ClassB.cs
    └── NamespaceB/
        └── ClassC.cs
```

## 许可证

MIT License