# Yun Commit Helper

A powerful VS Code extension that helps you create standardized Git commits following the [Conventional Commits](https://www.conventionalcommits.org/) specification with Traditional Chinese interface.

## ✨ Features

### 🤖 **AI-Powered Commit Generation**
- **Intelligent analysis** - Analyzes staged files and generates appropriate commit messages
- **Multiple AI providers** - Support for OpenAI, Anthropic Claude, local AI, and smart rules
- **Confidence scoring** - Shows how confident the AI is about the generated content
- **Fallback system** - Always works even without internet or API keys

### 🚀 **Smart Git Integration**
- **Real-time file monitoring** - Automatically detects file changes without manual refresh
- **Intelligent staging** - Stage/unstage files with a single click
- **Git status visualization** - Clear visual indicators for modified, added, deleted, and untracked files

### 📝 **Conventional Commits Support**
- **Pre-defined commit types** - feat, fix, refactor, docs, style, test, chore, perf, ci, build, revert
- **Scope support** - Optional scope field for better organization
- **Standardized format** - Automatically formats commits as `type(scope): message`
- **AI enhancement** - AI can automatically fill in all fields based on your changes

### 🎯 **User Experience**
- **Traditional Chinese interface** - Native support for Traditional Chinese users
- **Sidebar integration** - Seamlessly integrated into VS Code's sidebar
- **Auto-refresh** - Real-time updates when files change
- **Space-safe filenames** - Properly handles filenames with spaces and special characters
- **One-click generation** - Generate commit content with a single click

### 🔧 **Advanced Features**
- **Debounced updates** - Prevents excessive refreshes during rapid file changes
- **Visibility-aware** - Auto-refreshes when the panel becomes visible
- **Memory management** - Proper cleanup of watchers and resources
- **Error handling** - Robust error handling with user-friendly messages

## 📦 Installation

### From VSIX Package
1. Download the latest `.vsix` file from releases
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open command palette
4. Type "Extensions: Install from VSIX..." and select it
5. Browse and select the downloaded `.vsix` file
6. Restart VS Code if prompted

### From Source
1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press `F5` to launch a new VS Code window with the extension loaded

## 🚀 Usage

### Opening the Extension
1. Open VS Code in a Git repository
2. Look for "快速 COMMIT" in the sidebar (Explorer panel)
3. The extension will automatically load and display your Git status

### Making a Commit
1. **Stage files** - Click on files to stage/unstage them, or use "全部暫存" to stage all
2. **Generate AI content** (optional) - Click "🤖 AI 生成" to automatically generate commit content
3. **Select commit type** - Choose from the dropdown (feat, fix, refactor, etc.) or let AI fill it
4. **Add scope** (optional) - Specify the area of change (e.g., api, ui, auth) or let AI suggest it
5. **Write commit message** - Describe what you've changed or use AI-generated message
6. **Commit** - Click "提交變更" to create the commit

### AI-Powered Workflow
1. **Stage your changes** - Add files you want to commit to staging area
2. **Click "🤖 AI 生成"** - AI analyzes your changes and generates:
   - Appropriate commit type (feat, fix, refactor, etc.)
   - Relevant scope based on file paths
   - Descriptive commit message in Traditional Chinese
   - Confidence score (how sure the AI is)
3. **Review and adjust** - Check the generated content and modify if needed
4. **Commit** - Submit your standardized commit

### File Management
- **Click on unstaged files** to stage them
- **Click on staged files** to unstage them
- **Use "全部暫存"** to stage all unstaged files at once
- **Manual refresh** available with the ↻ button
- **Auto-update indicator** (green pulsing dot) shows real-time monitoring is active

## 🎯 AI Generation Examples

### Before AI (Manual Work)
```
You need to think about:
- What type of commit is this? 
- What scope should I use?
- How do I describe this in Traditional Chinese?
- Is this following Conventional Commits format?
```

### After AI (One Click)
```
🤖 Analyzing your changes...

Modified files:
- src/components/UserAuth.tsx
- src/services/auth.service.ts  
- tests/auth.test.ts

✅ Generated (Confidence: 87%)
Type: feat
Scope: auth  
Message: 新增用戶認證功能與測試

Ready to commit!
```

### Real Examples

| Your Changes | AI Generates |
|-------------|-------------|
| Modified `README.md` | `docs: 更新說明文檔` |
| Added new React component | `feat(components): 新增用戶界面組件` |
| Fixed a bug in API call | `fix(api): 修復用戶登錄請求問題` |
| Updated test files | `test: 更新用戶認證測試用例` |
| Refactored code structure | `refactor(core): 重構核心業務邏輯` |

## 🎨 Interface

The extension provides a clean, intuitive interface with:

- **Commit Form**: Type selection, scope input, and message textarea
- **Staged Changes**: Files ready to be committed (green background)
- **Changes**: Modified, added, or untracked files (color-coded by status)
- **File Status Indicators**: 
  - `M` - Modified files
  - `A` - Added files
  - `D` - Deleted files
  - `?` - Untracked files

## ⚙️ Configuration

The extension works out of the box with no configuration required. It automatically:
- Detects Git repositories
- Monitors file changes
- Updates the interface in real-time

### AI Service Configuration

You can configure different AI providers in VS Code settings (`Ctrl+,` → search for "yun-commit-helper"):

#### 🧠 Rules Engine (Default)
```json
{
  "yun-commit-helper.ai.provider": "rules"
}
```
- **Pros**: Free, fast, works offline, no API key needed
- **Cons**: Less sophisticated than real AI
- **Best for**: Most users, privacy-conscious developers

#### 🤖 OpenAI GPT
```json
{
  "yun-commit-helper.ai.provider": "openai",
  "yun-commit-helper.ai.apiKey": "your-openai-api-key",
  "yun-commit-helper.ai.model": "gpt-3.5-turbo"
}
```
- **Pros**: Very intelligent, understands context well
- **Cons**: Requires API key, costs money, needs internet
- **Best for**: Professional developers who want the best AI

#### 🧠 Anthropic Claude
```json
{
  "yun-commit-helper.ai.provider": "anthropic",
  "yun-commit-helper.ai.apiKey": "your-anthropic-api-key",
  "yun-commit-helper.ai.model": "claude-3-haiku-20240307"
}
```
- **Pros**: Good at following instructions, reliable
- **Cons**: Requires API key, costs money, needs internet
- **Best for**: Users who prefer Claude's style

#### 💎 Google Gemini
```json
{
  "yun-commit-helper.ai.provider": "gemini",
  "yun-commit-helper.ai.apiKey": "your-gemini-api-key",
  "yun-commit-helper.ai.model": "gemini-1.5-flash"
}
```
- **Pros**: Fast, cost-effective, good code understanding
- **Cons**: Requires API key, costs money, needs internet
- **Best for**: Users who want Google's AI capabilities

#### 🏠 Local AI (Ollama)
```json
{
  "yun-commit-helper.ai.provider": "local",
  "yun-commit-helper.ai.model": "codellama",
  "yun-commit-helper.ai.endpoint": "http://localhost:11434/api/generate"
}
```
- **Pros**: Free, private, no API key needed
- **Cons**: Requires local setup, slower than cloud AI
- **Best for**: Privacy-focused developers with local AI setup

### Setting up Local AI (Ollama)

1. **Install Ollama**: Download from [ollama.ai](https://ollama.ai)
2. **Start Ollama**: Run `ollama serve` in terminal
3. **Install a model**: Run `ollama pull codellama` or `ollama pull llama2`
4. **Configure extension**: Set provider to "local" in VS Code settings

## 🔍 Commit Types

| Type | Description (中文) | When to Use |
|------|-------------------|-------------|
| `feat` | 新增或修改功能（feature） | Adding new features or functionality |
| `fix` | 修補 bug（bug fix） | Fixing bugs or issues |
| `refactor` | 重構（非 bug 或新功能） | Code refactoring without changing functionality |
| `docs` | 改文件（documentation） | Documentation changes |
| `style` | Coding Style 格式改變（non-code impact） | Code style changes (formatting, etc.) |
| `test` | 增加測試（test cases） | Adding or updating tests |
| `chore` | 其他不影響程式運行的雜項 | Maintenance tasks, build process, etc. |
| `perf` | 改善效能（performance） | Performance improvements |
| `ci` | CI/CD 相關 | Continuous integration/deployment changes |
| `build` | 改動建置或者依賴（build） | Build system or external dependencies |
| `revert` | 撤銷先前 commit | Reverting previous commits |

## 🛠️ Development

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- VS Code

### Setup
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes during development
npm run watch
```

### Building
```bash
# Compile the extension
npm run compile

# Package into VSIX
npm run package
```

## 📝 Requirements

- **VS Code**: Version 1.60.0 or higher
- **Git**: Must be installed and accessible from command line
- **Git Repository**: The workspace must be a Git repository

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Guidelines
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using this extension! 😉
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Conventional Commits](https://www.conventionalcommits.org/)
- Built for the Traditional Chinese developer community
- Thanks to all contributors and users

## 📞 Support

### Troubleshooting AI Features

#### AI Generation Failed
- **Rules Engine**: Should always work as it's built-in
- **OpenAI/Anthropic**: Check your API key in settings
- **Local AI**: Ensure Ollama is running (`ollama serve`)

#### Common Issues
1. **"AI 服務連接失敗"**: Your local AI service isn't running
2. **"API Key 未設定"**: Add your API key in VS Code settings
3. **Poor AI results**: Try different providers or adjust settings

#### Getting Better Results
- **Stage meaningful changes**: AI works better with clear, focused changes
- **Use descriptive file names**: Helps AI understand your project structure
- **Review and edit**: AI suggestions are starting points, feel free to modify

### General Support

If you encounter any issues or have suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Contribute to the project
- Share your AI generation examples!

---

**Made with ❤️ for Traditional Chinese developers**
