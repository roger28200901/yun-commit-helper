import * as vscode from 'vscode';
import { CommitType } from './types';
import { CONSTANTS } from './constants';

/**
 * Service class for generating WebView HTML content
 */
export class HtmlGenerator {
  private readonly commitTypes: CommitType[];

  constructor() {
    this.commitTypes = this.initializeCommitTypes();
  }

  /**
   * Initialize the predefined commit types following Conventional Commits specification
   */
  private initializeCommitTypes(): CommitType[] {
    return [
      { label: 'feat', description: '新增或修改功能（feature）' },
      { label: 'fix', description: '修補 bug（bug fix）' },
      { label: 'refactor', description: '重構（非 bug 或新功能）' },
      { label: 'docs', description: '改文件（documentation）' },
      { label: 'style', description: 'Coding Style 格式改變（non-code impact）' },
      { label: 'test', description: '增加測試（test cases）' },
      { label: 'chore', description: '其他不影響程式運行的雜項' },
      { label: 'perf', description: '改善效能（performance）' },
      { label: 'ci', description: 'CI/CD 相關（continuous integration/continuous delivery）' },
      { label: 'build', description: '改動建置或者依賴（build）' },
      { label: 'revert', description: '撤銷先前 commit' }
    ];
  }

  /**
   * Generates the complete HTML content for the webview
   */
  public generateHtml(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Commit Helper</title>
    <style>
        ${this.generateCSS()}
    </style>
</head>
<body>
    ${this.generateBody()}
    <script>
        ${this.generateJavaScript()}
    </script>
</body>
</html>`;
  }

  /**
   * Generates the CSS styles for the webview
   */
  private generateCSS(): string {
    return `
        body {
            margin: 0;
            padding: 8px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            overflow-x: hidden;
        }

        .commit-form {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 12px;
        }

        .form-row {
            display: flex;
            align-items: center;
            gap: 6px;
            min-height: 28px;
        }

        .form-row label {
            min-width: 45px;
            max-width: 45px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            flex-shrink: 0;
        }

        select, input[type="text"] {
            flex: 1;
            min-width: 0;
            padding: 3px 6px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            font-size: 12px;
            box-sizing: border-box;
        }

        select {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        select:focus, input[type="text"]:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }

        .message-input {
            width: 100%;
            min-height: 54px;
            max-height: 120px;
            resize: vertical;
            padding: 6px 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: 12px;
            box-sizing: border-box;
            line-height: 1.4;
        }

        .message-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }

        .commit-button {
            flex: 1;
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            min-height: 28px;
            box-sizing: border-box;
        }

        .commit-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .commit-button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }

        .ai-generate-btn {
            flex: 0 0 auto;
            padding: 6px 10px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            min-height: 28px;
            box-sizing: border-box;
            transition: all 0.1s ease;
        }

        .ai-generate-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .ai-generate-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .ai-generate-btn.loading {
            opacity: 0.7;
        }

        .ai-generate-btn.loading::after {
            content: '⏳';
            margin-left: 4px;
        }

        .section-title {
            font-size: 10px;
            font-weight: 600;
            color: var(--vscode-sideBarSectionHeader-foreground);
            text-transform: uppercase;
            margin: 12px 0 6px 0;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .section-count {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 6px;
            padding: 1px 4px;
            font-size: 9px;
            font-weight: normal;
        }

        .file-section {
            margin-bottom: 12px;
        }

        .file-list {
            display: flex;
            flex-direction: column;
            gap: 1px;
            border: 1px solid var(--vscode-sideBar-border, transparent);
            border-radius: 3px;
            overflow: hidden;
        }

        .file-item {
            display: flex;
            align-items: center;
            padding: 4px 6px;
            cursor: pointer;
            font-size: 12px;
            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-sideBar-border, transparent);
            transition: background-color 0.1s ease;
            min-height: 24px;
        }

        .file-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .file-item:last-child {
            border-bottom: none;
        }

        .file-item.staged {
            background-color: color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #1e7e34) 10%, var(--vscode-sideBar-background));
        }

        .file-item.modified {
            background-color: color-mix(in srgb, var(--vscode-gitDecoration-modifiedResourceForeground, #ffa500) 10%, var(--vscode-sideBar-background));
        }

        .file-item.untracked {
            background-color: color-mix(in srgb, var(--vscode-gitDecoration-untrackedResourceForeground, #28a745) 10%, var(--vscode-sideBar-background));
        }

        .file-status {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            text-align: center;
            font-size: 9px;
            font-weight: bold;
            margin-right: 6px;
            border-radius: 2px;
            flex-shrink: 0;
        }

        .file-status[data-status="M"] {
            background-color: var(--vscode-gitDecoration-modifiedResourceForeground);
            color: var(--vscode-editor-background);
        }

        .file-status[data-status="A"] {
            background-color: var(--vscode-gitDecoration-addedResourceForeground);
            color: var(--vscode-editor-background);
        }

        .file-status[data-status="?"] {
            background-color: ${CONSTANTS.UI.COLORS.UNTRACKED};
            color: var(--vscode-editor-background);
        }

        .file-status[data-status="D"] {
            background-color: var(--vscode-gitDecoration-deletedResourceForeground);
            color: var(--vscode-editor-background);
        }

        .file-path {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: var(--vscode-editor-font-family, monospace);
        }

        .file-action {
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
            margin-left: 6px;
            opacity: 0;
            transition: opacity 0.1s ease;
        }

        .file-item:hover .file-action {
            opacity: 1;
        }

        .empty-state {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding: 12px 8px;
            border: 1px dashed var(--vscode-sideBar-border, #444);
            border-radius: 3px;
            background-color: var(--vscode-sideBar-background);
            font-size: 11px;
        }

        .stage-all-btn {
            background: none;
            border: none;
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            font-size: 9px;
            padding: 1px 3px;
            border-radius: 2px;
            text-decoration: underline;
        }

        .stage-all-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .refresh-btn {
            background: none;
            border: none;
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            font-size: 11px;
            padding: 1px 3px;
            border-radius: 2px;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .refresh-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .auto-update-indicator {
            color: var(--vscode-charts-green);
            font-size: 7px;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .settings-section {
            margin-bottom: 16px;
            border: 1px solid var(--vscode-sideBar-border, transparent);
            border-radius: 4px;
            background-color: var(--vscode-sideBar-background);
        }

        .settings-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            cursor: pointer;
            background-color: var(--vscode-list-hoverBackground);
            border-radius: 4px 4px 0 0;
            font-size: 11px;
            font-weight: 500;
            letter-spacing: 0.3px;
        }

        .settings-header:hover {
            background-color: var(--vscode-list-activeSelectionBackground);
        }

        .settings-content {
            padding: 12px;
            border-top: 1px solid var(--vscode-sideBar-border, transparent);
            display: none;
        }

        .settings-content.expanded {
            display: block;
        }

        .settings-row {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 12px;
        }

        .settings-row:last-child {
            margin-bottom: 0;
        }

        .settings-label {
            font-size: 11px;
            font-weight: 500;
            color: var(--vscode-foreground);
            opacity: 0.9;
        }

        .settings-input {
            padding: 4px 6px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            font-size: 11px;
            box-sizing: border-box;
        }

        .settings-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }

        .settings-description {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-top: 2px;
            line-height: 1.3;
        }

        .chevron {
            transition: transform 0.2s ease;
            font-size: 10px;
        }

        .chevron.expanded {
            transform: rotate(90deg);
        }

        .ai-status {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }

        .ai-status.configured {
            color: var(--vscode-charts-green);
        }

        .ai-status.not-configured {
            color: var(--vscode-charts-orange);
        }
    `;
  }

  /**
   * Generates the HTML body content
   */
  private generateBody(): string {
    return `
    <div class="settings-section">
        <div class="settings-header" id="settingsHeader">
            <div style="display: flex; align-items: center; gap: 6px;">
                <span>AI API Settings</span>
                <span class="ai-status" id="aiStatus">Not configured</span>
            </div>
            <span class="chevron" id="settingsChevron">▶</span>
        </div>
        <div class="settings-content" id="settingsContent">
            <div class="settings-row">
                <label class="settings-label">AI Provider:</label>
                <select class="settings-input" id="aiProvider">
                    <option value="rules">Rules Engine (Free, Offline)</option>
                    <option value="openai">OpenAI GPT</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="local">Local AI (Ollama)</option>
                </select>
                <div class="settings-description">Select AI content generation provider</div>
            </div>
            
            <div class="settings-row" id="apiKeyRow" style="display: none;">
                <label class="settings-label">API Key:</label>
                <input type="password" class="settings-input" id="apiKey" placeholder="Enter your API Key">
                <div class="settings-description" id="apiKeyDescription">API Key will be securely stored in VS Code settings</div>
            </div>
            
            <div class="settings-row" id="modelRow" style="display: none;">
                <label class="settings-label">AI Model:</label>
                <input type="text" class="settings-input" id="aiModel" placeholder="Enter model name (optional)">
                <div class="settings-description" id="modelDescription">Leave blank to use default model</div>
            </div>
            
            <div class="settings-row" id="endpointRow" style="display: none;">
                <label class="settings-label">Local Endpoint:</label>
                <input type="text" class="settings-input" id="aiEndpoint" value="http://localhost:11434/api/generate" placeholder="Local AI service endpoint">
                <div class="settings-description">Local AI service API endpoint</div>
            </div>
        </div>
    </div>

    <div class="commit-form">
        <div class="form-row">
            <label>Type:</label>
            <select id="commitType">
                <option value="">Select type</option>
                ${this.commitTypes.map(type => `<option value="${type.label}">${type.label} - ${type.description}</option>`).join('')}
            </select>
        </div>
        
        <div class="form-row">
            <label>Scope:</label>
            <input type="text" id="scope" placeholder="Optional, e.g. api, ui, auth">
        </div>
        
        <textarea 
            class="message-input" 
            id="message" 
            placeholder="Enter commit message..."
            rows="3"
        ></textarea>
        
        <div style="display: flex; gap: 6px;">
            <button class="ai-generate-btn" id="aiGenerateBtn" title="使用 AI 生成 commit 內容">
                Gen AI Commit
            </button>
            <button class="commit-button" id="commitBtn" disabled>
                Submit Commit
            </button>
        </div>
    </div>

    <div class="file-section">
        <div class="section-title">
            Staged Changes
            <span class="section-count" id="stagedCount">0</span>
        </div>
        <div id="stagedFiles" class="file-list">
            <div class="empty-state">No staged files</div>
        </div>
    </div>

    <div class="file-section">
        <div class="section-title">
            Changes
            <div style="display: flex; align-items: center; gap: 8px;">
                <button class="stage-all-btn" id="stageAllBtn" style="display: none;">Stage All</button>
                <button class="refresh-btn" id="refreshBtn" title="Refresh manually">↻</button>
                <span class="auto-update-indicator" title="Auto update enabled">●</span>
                <span class="section-count" id="unstagedCount">0</span>
            </div>
        </div>
        <div id="unstagedFiles" class="file-list">
            <div class="empty-state">Loading...</div>
        </div>
    </div>
    `;
  }

  /**
   * Generates the JavaScript code for the webview
   */
  private generateJavaScript(): string {
    return `
        const vscode = acquireVsCodeApi();
        
        // Main elements
        const commitType = document.getElementById('commitType');
        const scope = document.getElementById('scope');
        const message = document.getElementById('message');
        const commitBtn = document.getElementById('commitBtn');
        const stagedFiles = document.getElementById('stagedFiles');
        const unstagedFiles = document.getElementById('unstagedFiles');
        const stagedCount = document.getElementById('stagedCount');
        const unstagedCount = document.getElementById('unstagedCount');
        
        // Settings elements
        const settingsHeader = document.getElementById('settingsHeader');
        const settingsContent = document.getElementById('settingsContent');
        const settingsChevron = document.getElementById('settingsChevron');
        const aiProvider = document.getElementById('aiProvider');
        const apiKey = document.getElementById('apiKey');
        const aiModel = document.getElementById('aiModel');
        const aiEndpoint = document.getElementById('aiEndpoint');
        const aiStatus = document.getElementById('aiStatus');
        const apiKeyRow = document.getElementById('apiKeyRow');
        const modelRow = document.getElementById('modelRow');
        const endpointRow = document.getElementById('endpointRow');
        const apiKeyDescription = document.getElementById('apiKeyDescription');
        const modelDescription = document.getElementById('modelDescription');
        const stageAllBtn = document.getElementById('stageAllBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const aiGenerateBtn = document.getElementById('aiGenerateBtn');

        function updateCommitButton() {
            const isValid = commitType.value && message.value.trim();
            commitBtn.disabled = !isValid;
        }

        commitType.addEventListener('change', updateCommitButton);
        message.addEventListener('input', updateCommitButton);

        commitBtn.addEventListener('click', () => {
            if (commitType.value && message.value.trim()) {
                vscode.postMessage({
                    type: '${CONSTANTS.MESSAGES.TYPES.COMMIT}',
                    commitType: commitType.value,
                    scope: scope.value,
                    message: message.value.trim()
                });
            }
        });

        stageAllBtn.addEventListener('click', () => {
            vscode.postMessage({ type: '${CONSTANTS.MESSAGES.TYPES.STAGE_ALL}' });
        });

        refreshBtn.addEventListener('click', () => {
            vscode.postMessage({ type: '${CONSTANTS.MESSAGES.TYPES.REFRESH}' });
        });

        aiGenerateBtn.addEventListener('click', () => {
            aiGenerateBtn.disabled = true;
            aiGenerateBtn.classList.add('loading');
            vscode.postMessage({ type: '${CONSTANTS.MESSAGES.TYPES.GENERATE_AI_CONTENT}' });
        });

        // Settings panel functionality
        settingsHeader.addEventListener('click', () => {
            const isExpanded = settingsContent.classList.contains('expanded');
            settingsContent.classList.toggle('expanded');
            settingsChevron.classList.toggle('expanded');
        });

        // AI provider change handler
        aiProvider.addEventListener('change', () => {
            updateSettingsVisibility();
            updateAIStatus();
            saveAIConfiguration();
        });

        // AI configuration change handlers
        apiKey.addEventListener('input', () => {
            updateAIStatus();
            saveAIConfiguration();
        });

        aiModel.addEventListener('input', () => {
            saveAIConfiguration();
        });

        aiEndpoint.addEventListener('input', () => {
            saveAIConfiguration();
        });

        function updateSettingsVisibility() {
            const provider = aiProvider.value;
            
            // Show/hide API key row
            if (provider === 'openai' || provider === 'anthropic' || provider === 'gemini') {
                apiKeyRow.style.display = 'block';
                modelRow.style.display = 'block';
                endpointRow.style.display = 'none';
                
                // Update descriptions
                if (provider === 'openai') {
                    apiKeyDescription.textContent = 'OpenAI API Key (從 platform.openai.com 獲取)';
                    modelDescription.textContent = '例如: gpt-3.5-turbo, gpt-4';
                } else if (provider === 'anthropic') {
                    apiKeyDescription.textContent = 'Anthropic API Key (從 console.anthropic.com 獲取)';
                    modelDescription.textContent = '例如: claude-3-haiku-20240307, claude-3-sonnet-20240229';
                } else if (provider === 'gemini') {
                    apiKeyDescription.textContent = 'Google Gemini API Key (從 console.cloud.google.com 獲取)';
                    modelDescription.textContent = '例如: gemini-1.5-flash, gemini-1.5-pro';
                }
            } else if (provider === 'local') {
                apiKeyRow.style.display = 'none';
                modelRow.style.display = 'block';
                endpointRow.style.display = 'block';
                modelDescription.textContent = '例如: codellama, llama2, deepseek-coder';
            } else {
                apiKeyRow.style.display = 'none';
                modelRow.style.display = 'none';
                endpointRow.style.display = 'none';
            }
        }

        function updateAIStatus() {
            const provider = aiProvider.value;
            let status = '';
            let className = '';
            
            if (provider === 'rules') {
                status = 'Configured (Rules Engine)';
                className = 'configured';
            } else if (provider === 'local') {
                status = 'Local AI';
                className = 'configured';
            } else if (provider && apiKey.value.trim()) {
                status = 'Configured';
                className = 'configured';
            } else if (provider) {
                status = 'API Key required';
                className = 'not-configured';
            } else {
                status = 'Not configured';
                className = 'not-configured';
            }
            
            aiStatus.textContent = status;
            aiStatus.className = \`ai-status \${className}\`;
        }

        function saveAIConfiguration() {
            vscode.postMessage({
                type: '${CONSTANTS.MESSAGES.TYPES.UPDATE_AI_CONFIG}',
                config: {
                    provider: aiProvider.value,
                    apiKey: apiKey.value.trim(),
                    model: aiModel.value.trim(),
                    endpoint: aiEndpoint.value.trim()
                }
            });
        }

        function loadAIConfiguration(config) {
            if (config) {
                aiProvider.value = config.provider || 'rules';
                apiKey.value = config.apiKey || '';
                aiModel.value = config.model || '';
                aiEndpoint.value = config.endpoint || 'http://localhost:11434/api/generate';
                updateSettingsVisibility();
                updateAIStatus();
            }
        }

        // Receive messages from extension
        window.addEventListener('message', event => {
            const data = event.data;
            
            switch (data.type) {
                case '${CONSTANTS.MESSAGES.TYPES.UPDATE_FILES}':
                    updateFileList(data.files);
                    break;
                case '${CONSTANTS.MESSAGES.TYPES.CLEAR_INPUTS}':
                    commitType.value = '';
                    scope.value = '';
                    message.value = '';
                    updateCommitButton();
                    break;
                case '${CONSTANTS.MESSAGES.TYPES.AI_CONTENT_GENERATED}':
                    if (data.content) {
                        commitType.value = data.content.type;
                        scope.value = data.content.scope || '';
                        message.value = data.content.message;
                        updateCommitButton();
                    }
                    aiGenerateBtn.disabled = false;
                    aiGenerateBtn.classList.remove('loading');
                    break;
                case '${CONSTANTS.MESSAGES.TYPES.AI_GENERATION_FAILED}':
                    aiGenerateBtn.disabled = false;
                    aiGenerateBtn.classList.remove('loading');
                    break;
                case '${CONSTANTS.MESSAGES.TYPES.LOAD_AI_CONFIG}':
                    loadAIConfiguration(data.config);
                    break;
            }
        });

        function updateFileList(files) {
            const staged = files.filter(f => f.staged);
            const unstaged = files.filter(f => !f.staged);

            // Update counts
            stagedCount.textContent = staged.length;
            unstagedCount.textContent = unstaged.length;

            // Show/hide stage all button
            stageAllBtn.style.display = unstaged.length > 0 ? 'inline-block' : 'none';

            // Update staged files list
            if (staged.length === 0) {
                stagedFiles.innerHTML = '<div class="empty-state">No staged files</div>';
            } else {
                stagedFiles.innerHTML = staged.map(file => 
                    createFileItem(file, true)
                ).join('');
            }

            // Update unstaged files list
            if (unstaged.length === 0) {
                unstagedFiles.innerHTML = '<div class="empty-state">No changes</div>';
            } else {
                unstagedFiles.innerHTML = unstaged.map(file => 
                    createFileItem(file, false)
                ).join('');
            }
        }

        function createFileItem(file, isStaged) {
            const statusClass = isStaged ? 'staged' : 
                file.status === 'M' ? 'modified' : 'untracked';
            
            const actionText = isStaged ? 'Click to unstage' : 'Click to stage';
            
            // Escape HTML to prevent XSS and display special characters correctly
            const escapedPath = file.path
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            
            return \`
                <div class="file-item \${statusClass}" onclick="toggleFile('\${escapedPath}', \${isStaged})">
                    <span class="file-status" data-status="\${file.status}">\${file.status}</span>
                    <span class="file-path" title="\${escapedPath}">\${escapedPath}</span>
                    <span class="file-action">\${actionText}</span>
                </div>
            \`;
        }

        function toggleFile(filePath, isStaged) {
            vscode.postMessage({
                type: isStaged ? '${CONSTANTS.MESSAGES.TYPES.UNSTAGE_FILE}' : '${CONSTANTS.MESSAGES.TYPES.STAGE_FILE}',
                filePath: filePath
            });
        }

        // Notify extension when page is ready
        vscode.postMessage({ type: '${CONSTANTS.MESSAGES.TYPES.READY}' });
    `;
  }
} 