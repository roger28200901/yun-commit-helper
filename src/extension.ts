import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Constants for better maintainability and avoiding magic strings
const CONSTANTS = {
  VIEW_TYPE: 'commit-helper-view',
  MESSAGES: {
    TYPES: {
      COMMIT: 'commit',
      STAGE_FILE: 'stageFile',
      UNSTAGE_FILE: 'unstageFile',
      REFRESH: 'refresh',
      STAGE_ALL: 'stageAll',
      READY: 'ready',
      UPDATE_FILES: 'updateFiles',
      CLEAR_INPUTS: 'clearInputs'
    } as const,
    ERRORS: {
      NOT_GIT_REPO: '目前不在 Git repository 中',
      NO_WORKSPACE: '找不到工作區資料夾',
      COMMIT_VALIDATION: '請選擇 commit 類型並輸入訊息',
      COMMIT_FAILED: 'Commit 失敗',
      STAGE_FAILED: '加入檔案暫存失敗',
      UNSTAGE_FAILED: '移除檔案暫存失敗'
    } as const,
    SUCCESS: {
      COMMIT: 'Commit 成功',
      STAGE: '已加入暫存',
      UNSTAGE: '已移除暫存',
      STAGE_ALL: '所有變更已加入暫存區'
    } as const
  },
  GIT: {
    COMMANDS: {
      STATUS: 'git status --porcelain',
      ADD: 'git add',
      ADD_ALL: 'git add .',
      RESTORE_STAGED: 'git restore --staged',
      RESET_HEAD: 'git reset HEAD',
      COMMIT: 'git commit -m',
      CHECK_REPO: 'git rev-parse --git-dir',
      CHECK_STAGED: 'git diff --cached --name-only'
    } as const,
    STATUS_CODES: {
      MODIFIED: 'M',
      ADDED: 'A',
      DELETED: 'D',
      RENAMED: 'R',
      COPIED: 'C',
      UNTRACKED: '?',
      SPACE: ' '
    } as const
  },
  UI: {
    COLORS: {
      UNTRACKED: '#8e44ad' // Purple color for untracked files
    }
  }
} as const;

/**
 * Represents a commit type with its label and description
 */
interface CommitType {
  label: string;
  description: string;
}

/**
 * Represents the status of a file in Git
 */
interface GitFileStatus {
  path: string;
  status: string;
  description: string;
  staged: boolean;
}

/**
 * Message types for communication between webview and extension
 */
type MessageType = typeof CONSTANTS.MESSAGES.TYPES[keyof typeof CONSTANTS.MESSAGES.TYPES];

/**
 * Main provider class for the Commit Helper WebView
 * Implements the VS Code WebviewViewProvider interface
 */
class CommitHelperProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = CONSTANTS.VIEW_TYPE;

  private _view?: vscode.WebviewView;
  private readonly commitTypes: CommitType[];
  private fileWatcher?: vscode.FileSystemWatcher;
  private gitWatcher?: vscode.FileSystemWatcher;
  private refreshTimer?: NodeJS.Timeout;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) {
    this.commitTypes = this.initializeCommitTypes();
    this.setupFileWatching();
  }

  /**
   * Sets up file system watchers to automatically detect changes
   */
  private setupFileWatching(): void {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    try {
      // 監聽工作區中所有檔案的變化（排除 node_modules, .git 等）
      this.fileWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceFolder, '**/*'),
        false, // 不忽略創建事件
        false, // 不忽略修改事件
        false  // 不忽略刪除事件
      );

      // 監聽 .git 目錄中的關鍵檔案變化
      this.gitWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceFolder, '.git/{index,HEAD,refs/**}'),
        false,
        false,
        false
      );

      // 檔案變化事件處理
      this.fileWatcher.onDidCreate(() => this.debouncedRefresh(), null, this.disposables);
      this.fileWatcher.onDidChange(() => this.debouncedRefresh(), null, this.disposables);
      this.fileWatcher.onDidDelete(() => this.debouncedRefresh(), null, this.disposables);

      // Git 狀態變化事件處理
      this.gitWatcher.onDidCreate(() => this.debouncedRefresh(), null, this.disposables);
      this.gitWatcher.onDidChange(() => this.debouncedRefresh(), null, this.disposables);
      this.gitWatcher.onDidDelete(() => this.debouncedRefresh(), null, this.disposables);

      // 監聽工作區變化
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.disposeWatchers();
        this.setupFileWatching();
        this.debouncedRefresh();
      }, null, this.disposables);

      console.log('File watching setup completed');
    } catch (error) {
      console.error('Failed to setup file watching:', error);
    }
  }

  /**
   * 防抖刷新，避免過度頻繁的更新
   */
  private debouncedRefresh(): void {
    // 清除之前的計時器
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // 設置新的計時器，300ms 後執行刷新
    this.refreshTimer = setTimeout(() => {
      this.refresh().catch(error => {
        console.error('Auto refresh failed:', error);
      });
    }, 300);
  }

  /**
   * 清理文件監聽器
   */
  private disposeWatchers(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
    }
    if (this.gitWatcher) {
      this.gitWatcher.dispose();
      this.gitWatcher = undefined;
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * 清理所有資源
   */
  public dispose(): void {
    this.disposeWatchers();
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables.length = 0;
  }

  /**
   * Initialize the predefined commit types following Conventional Commits specification
   * @returns Array of commit types with descriptions
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
   * Resolves the webview view when it becomes visible
   * Sets up the webview with HTML content and message handlers
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this.generateWebviewHtml(webviewView.webview);

    // Set up message handler for webview communication
    webviewView.webview.onDidReceiveMessage(
      this.handleWebviewMessage.bind(this),
      undefined,
      this.disposables
    );

    // 監聽 webview 可見性變化，當變為可見時自動刷新
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.refresh().catch(error => {
          console.error('Failed to refresh on visibility change:', error);
        });
      }
    }, null, this.disposables);

    // 初始載入時刷新一次
    this.refresh().catch(error => {
      console.error('Failed to initial refresh:', error);
    });
  }

  /**
   * Handles incoming messages from the webview
   * @param data Message data from webview
   */
  private async handleWebviewMessage(data: { type: MessageType; [key: string]: any }): Promise<void> {
    try {
      switch (data.type) {
        case CONSTANTS.MESSAGES.TYPES.COMMIT:
          await this.handleCommit(data.commitType, data.scope, data.message);
          break;
        case CONSTANTS.MESSAGES.TYPES.STAGE_FILE:
          await this.stageFile(data.filePath);
          break;
        case CONSTANTS.MESSAGES.TYPES.UNSTAGE_FILE:
          await this.unstageFile(data.filePath);
          break;
        case CONSTANTS.MESSAGES.TYPES.REFRESH:
        case CONSTANTS.MESSAGES.TYPES.READY:
          await this.refresh();
          break;
        case CONSTANTS.MESSAGES.TYPES.STAGE_ALL:
          await this.stageAllUnstagedFiles();
          break;
        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error handling webview message:', error);
      this.showErrorMessage(`處理操作時發生錯誤: ${error}`);
    }
  }

  /**
   * Refreshes the file list in the webview by fetching current Git status
   */
  public async refresh(): Promise<void> {
    if (!this._view) {
      return;
    }

    try {
      const files = await this.getGitFileStatus();
      this._view.webview.postMessage({
        type: CONSTANTS.MESSAGES.TYPES.UPDATE_FILES,
        files
      });
    } catch (error) {
      console.error('Error refreshing file list:', error);
      this.showErrorMessage('更新檔案列表失敗');
    }
  }

  /**
   * Handles the commit operation with validation and error handling
   * @param commitType Type of commit (feat, fix, etc.)
   * @param scope Optional scope for the commit
   * @param message Commit message content
   */
  private async handleCommit(commitType: string, scope: string, message: string): Promise<void> {
    try {
      // Input validation
      if (!this.validateCommitInput(commitType, message)) {
        this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.COMMIT_VALIDATION);
        return;
      }

      // Repository validation
      if (!(await this.isGitRepository())) {
        this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NOT_GIT_REPO);
        return;
      }

      // Check for staged changes or offer to stage all
      if (!(await this.ensureStagedChanges())) {
        return; // User cancelled or no changes to commit
      }

      // Execute commit
      const commitMessage = this.formatCommitMessage(commitType, scope, message);
      await this.executeGitCommit(commitMessage);
      
      // Update UI
      await this.refresh();
      this.clearInputs();

    } catch (error) {
      console.error('Commit operation failed:', error);
      this.showErrorMessage(`${CONSTANTS.MESSAGES.ERRORS.COMMIT_FAILED}：${error}`);
    }
  }

  /**
   * Validates commit input parameters
   * @param commitType Selected commit type
   * @param message Commit message
   * @returns True if input is valid
   */
  private validateCommitInput(commitType: string, message: string): boolean {
    return !!(commitType && message?.trim());
  }

  /**
   * Formats commit message according to Conventional Commits specification
   * @param commitType Type of commit
   * @param scope Optional scope
   * @param message Message content
   * @returns Formatted commit message
   */
  private formatCommitMessage(commitType: string, scope: string, message: string): string {
    const scopeStr = scope ? `(${scope})` : '';
    return `${commitType}${scopeStr}: ${message}`;
  }

  /**
   * Ensures there are staged changes, offering to stage all if none exist
   * @returns True if there are staged changes or user chose to stage all
   */
  private async ensureStagedChanges(): Promise<boolean> {
    if (await this.hasStagedChanges()) {
      return true;
    }

    const action = await vscode.window.showInformationMessage(
      '沒有檔案在 staging area，是否要加入所有變更？',
      '是',
      '否'
    );

    if (action === '是') {
      await this.stageAllUnstagedFiles();
      return true;
    }

    return false;
  }

  /**
   * Clears input fields in the webview
   */
  private clearInputs(): void {
    this._view?.webview.postMessage({
      type: CONSTANTS.MESSAGES.TYPES.CLEAR_INPUTS
    });
  }

  /**
   * Stages a single file
   * @param filePath Path of the file to stage
   */
  private async stageFile(filePath: string): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NO_WORKSPACE);
        return;
      }

      // Sanitize file path to prevent command injection
      const sanitizedPath = this.sanitizeFilePath(filePath);
      await execAsync(`${CONSTANTS.GIT.COMMANDS.ADD} "${sanitizedPath}"`, { 
        cwd: workspaceFolder.uri.fsPath 
      });
      
      await this.refresh();
      vscode.window.showInformationMessage(`${CONSTANTS.MESSAGES.SUCCESS.STAGE}: ${filePath}`);
    } catch (error) {
      console.error('Stage file error:', error);
      this.showErrorMessage(`${CONSTANTS.MESSAGES.ERRORS.STAGE_FAILED}: ${error}`);
    }
  }

  /**
   * Unstages a single file
   * @param filePath Path of the file to unstage
   */
  private async unstageFile(filePath: string): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NO_WORKSPACE);
        return;
      }

      // Sanitize file path to prevent command injection
      const sanitizedPath = this.sanitizeFilePath(filePath);
      
      // 使用 git restore --staged 替代 git reset HEAD，更現代和可靠
      try {
        await execAsync(`${CONSTANTS.GIT.COMMANDS.RESTORE_STAGED} "${sanitizedPath}"`, { 
          cwd: workspaceFolder.uri.fsPath 
        });
      } catch (error) {
        // 如果 git restore 不支援，回退到 git reset HEAD
        await execAsync(`${CONSTANTS.GIT.COMMANDS.RESET_HEAD} "${sanitizedPath}"`, { 
          cwd: workspaceFolder.uri.fsPath 
        });
      }
      
      await this.refresh();
      vscode.window.showInformationMessage(`${CONSTANTS.MESSAGES.SUCCESS.UNSTAGE}: ${filePath}`);
    } catch (error) {
      console.error('Unstage file error:', error);
      this.showErrorMessage(`${CONSTANTS.MESSAGES.ERRORS.UNSTAGE_FAILED}: ${error}`);
    }
  }

  /**
   * Fetches the current Git file status from the workspace
   * @returns Array of GitFileStatus objects
   */
  private async getGitFileStatus(): Promise<GitFileStatus[]> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return [];
      }

      const { stdout } = await execAsync(CONSTANTS.GIT.COMMANDS.STATUS, { cwd: workspaceFolder.uri.fsPath });
      console.log('Git status output:', stdout); // 調試信息
      
      const lines = stdout.split('\n').filter(line => line.length > 0);
      const fileMap = new Map<string, GitFileStatus>(); // 使用 Map 防止重複

      lines.forEach(line => {
        if (line.length < 3) return; // 防止無效行
        
        const indexStatus = line[0]; // 第一個字符：index (staging area) 狀態
        const workTreeStatus = line[1]; // 第二個字符：working tree 狀態
        let path = line.substring(3).trim(); // 路徑從第4個字符開始
        
        // 移除 git 在檔案名包含空格時添加的引號
        if (path.startsWith('"') && path.endsWith('"')) {
          path = path.slice(1, -1);
          // 處理 git 在引號內的轉義字符
          path = path.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
        
        console.log(`Processing line: "${line}", indexStatus: "${indexStatus}", workTreeStatus: "${workTreeStatus}", path: "${path}"`);

        // 處理已暫存的檔案 (index 有變化)
        if (indexStatus !== CONSTANTS.GIT.STATUS_CODES.SPACE && indexStatus !== CONSTANTS.GIT.STATUS_CODES.UNTRACKED) {
          let status = '';
          let description = '';
          
          switch (indexStatus) {
            case CONSTANTS.GIT.STATUS_CODES.MODIFIED:
              status = 'M';
              description = 'Modified';
              break;
            case CONSTANTS.GIT.STATUS_CODES.ADDED:
              status = 'A';
              description = 'Added';
              break;
            case CONSTANTS.GIT.STATUS_CODES.DELETED:
              status = 'D';
              description = 'Deleted';
              break;
            case CONSTANTS.GIT.STATUS_CODES.RENAMED:
              status = 'R';
              description = 'Renamed';
              break;
            case CONSTANTS.GIT.STATUS_CODES.COPIED:
              status = 'C';
              description = 'Copied';
              break;
            default:
              status = 'C';
              description = 'Changed';
          }

          fileMap.set(`${path}_staged`, {
            path,
            status,
            description,
            staged: true
          });
        }

        // 處理未暫存的檔案 (working tree 有變化)
        if (workTreeStatus !== CONSTANTS.GIT.STATUS_CODES.SPACE && indexStatus !== CONSTANTS.GIT.STATUS_CODES.UNTRACKED && workTreeStatus !== CONSTANTS.GIT.STATUS_CODES.UNTRACKED) {
          let status = '';
          let description = '';
          
          switch (workTreeStatus) {
            case CONSTANTS.GIT.STATUS_CODES.MODIFIED:
              status = 'M';
              description = 'Modified';
              break;
            case CONSTANTS.GIT.STATUS_CODES.DELETED:
              status = 'D';
              description = 'Deleted';
              break;
            case CONSTANTS.GIT.STATUS_CODES.ADDED:
              status = 'A';
              description = 'Added';
              break;
            default:
              status = 'C';
              description = 'Changed';
          }

          fileMap.set(`${path}_unstaged`, {
            path,
            status,
            description,
            staged: false
          });
        }

        // 處理未追蹤的檔案
        if (indexStatus === CONSTANTS.GIT.STATUS_CODES.UNTRACKED && workTreeStatus === CONSTANTS.GIT.STATUS_CODES.UNTRACKED) {
          fileMap.set(`${path}_untracked`, {
            path,
            status: '?',
            description: 'Untracked',
            staged: false
          });
        }
      });

      const result = Array.from(fileMap.values());
      console.log('Final file status result:', result); // 調試信息
      return result;
    } catch (error) {
      console.error('Get git file status error:', error);
      return [];
    }
  }

  /**
   * Checks if the current workspace is a Git repository
   * @returns True if it is a Git repository, false otherwise
   */
  private async isGitRepository(): Promise<boolean> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return false;
      }
      
      await execAsync(CONSTANTS.GIT.COMMANDS.CHECK_REPO, { cwd: workspaceFolder.uri.fsPath });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if there are staged changes in the current repository
   * @returns True if there are staged changes, false otherwise
   */
  private async hasStagedChanges(): Promise<boolean> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return false;
      }
      
      const { stdout } = await execAsync(CONSTANTS.GIT.COMMANDS.CHECK_STAGED, { cwd: workspaceFolder.uri.fsPath });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Executes the Git commit command
   * @param commitMsg The formatted commit message
   */
  private async executeGitCommit(commitMsg: string): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NO_WORKSPACE);
        return;
      }
      
      // Sanitize commit message to prevent command injection
      const sanitizedMessage = this.sanitizeCommitMessage(commitMsg);
      
      await execAsync(`${CONSTANTS.GIT.COMMANDS.COMMIT} "${sanitizedMessage}"`, { 
        cwd: workspaceFolder.uri.fsPath 
      });
      
      vscode.window.showInformationMessage(`${CONSTANTS.MESSAGES.SUCCESS.COMMIT}: ${commitMsg}`);
    } catch (error: any) {
      const errorMsg = error.stderr || error.message || '未知錯誤';
      this.showErrorMessage(`${CONSTANTS.MESSAGES.ERRORS.COMMIT_FAILED}: ${errorMsg}`);
    }
  }

  /**
   * Stages all unstaged files in the current repository
   */
  private async stageAllUnstagedFiles(): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NO_WORKSPACE);
        return;
      }

      await execAsync(CONSTANTS.GIT.COMMANDS.ADD_ALL, { cwd: workspaceFolder.uri.fsPath });
      await this.refresh();
      vscode.window.showInformationMessage(`${CONSTANTS.MESSAGES.SUCCESS.STAGE_ALL}`);
    } catch (error) {
      this.showErrorMessage(`${CONSTANTS.MESSAGES.ERRORS.STAGE_FAILED}: ${error}`);
    }
  }

  /**
   * Generates the HTML content for the webview
   * @param webview The VS Code Webview instance
   * @returns HTML string for the webview
   */
  private generateWebviewHtml(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Commit Helper</title>
    <style>
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
            min-width: 0; /* 重要：允許縮小 */
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
            background-color: var(--vscode-gitDecoration-addedResourceForeground, #1e7e34);
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
    </style>
</head>
<body>
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

    <script>
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

        // 接收來自擴展的消息
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

            // 更新計數
            stagedCount.textContent = staged.length;
            unstagedCount.textContent = unstaged.length;

            // 顯示/隱藏全部暫存按鈕
            stageAllBtn.style.display = unstaged.length > 0 ? 'inline-block' : 'none';

            // 更新已暫存檔案列表
            if (staged.length === 0) {
                stagedFiles.innerHTML = '<div class="empty-state">沒有已暫存的檔案</div>';
            } else {
                stagedFiles.innerHTML = staged.map(file => 
                    createFileItem(file, true)
                ).join('');
            }

            // 更新未暫存檔案列表
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
            
            // 對檔案路徑進行HTML轉義，防止XSS攻擊並正確顯示特殊字符
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

        // 頁面載入完成時通知擴展
        vscode.postMessage({ type: '${CONSTANTS.MESSAGES.TYPES.READY}' });
    </script>
</body>
</html>`;
  }

  /**
   * 防 command injection 攻擊
   * Sanitizes file paths to prevent command injection attacks
   * @param filePath The file path to sanitize
   * @returns Sanitized file path
   */
  private sanitizeFilePath(filePath: string): string {
    // 對於檔案路徑，我們只需要移除一些明顯危險的字符
    // 但要保留空格和其他合法字符
    return filePath
      .replace(/[;&|`$(){}[\]]/g, '') // Remove shell metacharacters but keep backslashes for paths
      .replace(/\.\.\//g, '') // Remove directory traversal patterns
      .trim();
  }

  /**
   * 防 command injection 攻擊
   * Sanitizes commit messages to prevent command injection attacks
   * @param message The commit message to sanitize
   * @returns Sanitized commit message
   */
  private sanitizeCommitMessage(message: string): string {
    // Escape double quotes and remove dangerous characters
    return message
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/[`$\\]/g, '\\$&') // Escape backticks, dollar signs, and backslashes
      .trim();
  }

  /**
   * Shows an error message in the VS Code window
   * @param message Error message to display
   */
  private showErrorMessage(message: string): void {
    vscode.window.showErrorMessage(message);
  }
}

/**
 * Extension activation point
 * Called when the extension is activated by VS Code
 * @param context The extension context provided by VS Code
 */
export function activate(context: vscode.ExtensionContext): void {
  try {
    const provider = new CommitHelperProvider(context.extensionUri);

    // Register WebView provider for the commit helper view
    const webviewDisposable = vscode.window.registerWebviewViewProvider(
      CommitHelperProvider.viewType, 
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true // Keep webview state when hidden
        }
      }
    );

    // 確保 provider 在擴展停用時被正確清理
    context.subscriptions.push(webviewDisposable);
    context.subscriptions.push(provider);

    // Register commands for the extension
    registerCommands(context, provider);

    console.log('Commit Helper extension activated successfully');
  } catch (error) {
    console.error('Failed to activate Commit Helper extension:', error);
    vscode.window.showErrorMessage('無法啟動 Commit Helper 擴展，請檢查日誌');
  }
}

/**
 * Registers all commands for the extension
 * @param context Extension context for subscriptions
 * @param provider The commit helper provider instance
 */
function registerCommands(context: vscode.ExtensionContext, provider: CommitHelperProvider): void {
  // Command to show commit helper view (legacy support)
  context.subscriptions.push(
    vscode.commands.registerCommand('commit-helper.commit', async () => {
      try {
        await vscode.commands.executeCommand('workbench.view.extension.commit-helper');
      } catch (error) {
        console.error('Error executing commit-helper.commit command:', error);
        vscode.window.showErrorMessage('無法開啟 Commit Helper 視圖');
      }
    })
  );

  // Command to refresh the file list
  context.subscriptions.push(
    vscode.commands.registerCommand('commit-helper.refresh', async () => {
      try {
        await provider.refresh();
      } catch (error) {
        console.error('Error executing commit-helper.refresh command:', error);
        vscode.window.showErrorMessage('無法重新整理檔案列表');
      }
    })
  );
}

/**
 * Extension deactivation point
 * Called when the extension is deactivated by VS Code
 * Cleanup any resources here if needed
 */
export function deactivate(): void {
  // Currently no cleanup needed
  // Future: dispose of any long-running processes, file watchers, etc.
  console.log('Commit Helper extension deactivated');
}