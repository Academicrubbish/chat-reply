# Chat Reply Server

## 环境要求

- Node.js >= 18
- npm >= 9

## 安装

```bash
npm install
```

## 启动

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build && npm start
```

## better-sqlite3 编译问题

后端使用 `better-sqlite3`（C++ 原生模块），安装时需要本地编译。

如果 `npm install` 报错提示编译失败，需要先安装 C++ 编译工具：

### Windows

**方式一（推荐）：** 一行命令安装

```bash
npm install -g windows-build-tools
```

需要以 **管理员身份** 运行 PowerShell 或 CMD。

**方式二：** 手动安装 Visual Studio Build Tools

1. 下载 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. 安装时勾选 **「使用 C++ 的桌面开发」** 工作负载
3. 确保系统已安装 Python（Node.js 自带的即可）
4. 重新执行 `npm install`

### macOS

```bash
xcode-select --install
```

### Linux (Ubuntu/Debian)

```bash
sudo apt-get install build-essential python3
```

## 环境变量

在 `chat-reply-server` 目录下创建 `.env` 文件：

```
OPENAI_API_KEY=你的key
OPENAI_BASE_URL=你的代理地址（可选）
PORT=3001
```
