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
            width: 100%;
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
    `;
  }

  /**
   * Generates the HTML body content
   */
  private generateBody(): string {
    return `
    <div class="commit-form">
        <div class="form-row">
            <label>類型:</label>
            <select id="commitType">
                <option value="">選擇類型</option>
                ${this.commitTypes.map(type => `<option value="${type.label}">${type.label} - ${type.description}</option>`).join('')}
            </select>
        </div>
        
        <div class="form-row">
            <label>範圍:</label>
            <input type="text" id="scope" placeholder="可選，例如: api, ui, auth">
        </div>
        
        <textarea 
            class="message-input" 
            id="message" 
            placeholder="輸入 commit 訊息..."
            rows="3"
        ></textarea>
        
        <button class="commit-button" id="commitBtn" disabled>
            提交變更
        </button>
    </div>

    <div class="file-section">
        <div class="section-title">
            已暫存的變更
            <span class="section-count" id="stagedCount">0</span>
        </div>
        <div id="stagedFiles" class="file-list">
            <div class="empty-state">沒有已暫存的檔案</div>
        </div>
    </div>

    <div class="file-section">
        <div class="section-title">
            變更
            <div style="display: flex; align-items: center; gap: 8px;">
                <button class="stage-all-btn" id="stageAllBtn" style="display: none;">全部暫存</button>
                <button class="refresh-btn" id="refreshBtn" title="手動刷新">↻</button>
                <span class="auto-update-indicator" title="自動更新已啟用">●</span>
                <span class="section-count" id="unstagedCount">0</span>
            </div>
        </div>
        <div id="unstagedFiles" class="file-list">
            <div class="empty-state">載入中...</div>
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
        
        const commitType = document.getElementById('commitType');
        const scope = document.getElementById('scope');
        const message = document.getElementById('message');
        const commitBtn = document.getElementById('commitBtn');
        const stagedFiles = document.getElementById('stagedFiles');
        const unstagedFiles = document.getElementById('unstagedFiles');
        const stagedCount = document.getElementById('stagedCount');
        const unstagedCount = document.getElementById('unstagedCount');
        const stageAllBtn = document.getElementById('stageAllBtn');
        const refreshBtn = document.getElementById('refreshBtn');

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
                stagedFiles.innerHTML = '<div class="empty-state">沒有已暫存的檔案</div>';
            } else {
                stagedFiles.innerHTML = staged.map(file => 
                    createFileItem(file, true)
                ).join('');
            }

            // Update unstaged files list
            if (unstaged.length === 0) {
                unstagedFiles.innerHTML = '<div class="empty-state">沒有變更</div>';
            } else {
                unstagedFiles.innerHTML = unstaged.map(file => 
                    createFileItem(file, false)
                ).join('');
            }
        }

        function createFileItem(file, isStaged) {
            const statusClass = isStaged ? 'staged' : 
                file.status === 'M' ? 'modified' : 'untracked';
            
            const actionText = isStaged ? '點擊移除暫存' : '點擊加入暫存';
            
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