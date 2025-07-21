import * as vscode from 'vscode';
import { WebviewMessage, MessageType } from './types';
import { CONSTANTS } from './constants';
import { GitService } from './git-service';
import { FileWatcher } from './file-watcher';
import { HtmlGenerator } from './html-generator';
import { AIService } from './ai-service';
import { RefreshableProvider } from './commands';

/**
 * Main provider class for the Commit Helper WebView
 * Implements the VS Code WebviewViewProvider interface
 */
export class CommitHelperProvider implements vscode.WebviewViewProvider, RefreshableProvider {
  public static readonly viewType = CONSTANTS.VIEW_TYPE;

  private _view?: vscode.WebviewView;
  private gitService?: GitService;
  private fileWatcher?: FileWatcher;
  private htmlGenerator: HtmlGenerator;
  private aiService: AIService;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) {
    this.htmlGenerator = new HtmlGenerator();
    this.aiService = new AIService();
    this.setupServices();
  }

  /**
   * Sets up the Git service and file watcher
   */
  private setupServices(): void {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      console.warn('No workspace folder found');
      return;
    }

    this.gitService = new GitService(workspaceFolder);
    this.fileWatcher = new FileWatcher(() => this.refreshFileList());
    this.fileWatcher.setupWatching(workspaceFolder);
  }

  /**
   * Resolves the webview view when it becomes visible
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

    webviewView.webview.html = this.htmlGenerator.generateHtml(webviewView.webview);

    // Set up message handler for webview communication
    webviewView.webview.onDidReceiveMessage(
      this.handleWebviewMessage.bind(this),
      undefined,
      this.disposables
    );

    // Listen for webview visibility changes and auto-refresh when visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.refreshFileList();
      }
    }, null, this.disposables);

    // Initial refresh
    this.refreshFileList();
    
    // Load AI configuration
    this.loadAIConfiguration();
  }

  /**
   * Handles incoming messages from the webview
   */
  private async handleWebviewMessage(data: WebviewMessage): Promise<void> {
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
          await this.refreshFileList();
          break;
        case CONSTANTS.MESSAGES.TYPES.STAGE_ALL:
          await this.stageAllFiles();
          break;
        case CONSTANTS.MESSAGES.TYPES.GENERATE_AI_CONTENT:
          await this.generateAIContent();
          break;
        case CONSTANTS.MESSAGES.TYPES.UPDATE_AI_CONFIG:
          await this.updateAIConfiguration(data.config);
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
   * Generates AI content for commit message
   */
  private async generateAIContent(): Promise<void> {
    if (!this.gitService) {
      this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NO_WORKSPACE);
      this.sendAIGenerationFailed();
      return;
    }

    try {
      // Check if there are staged changes
      if (!(await this.gitService.hasStagedChanges())) {
        this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NO_STAGED_FILES);
        this.sendAIGenerationFailed();
        return;
      }

      // Get diff summary for AI analysis
      const diffSummary = await this.gitService.getStagedChangesSummary();
      if (!diffSummary) {
        this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NO_STAGED_FILES);
        this.sendAIGenerationFailed();
        return;
      }

      // Generate AI content
      const aiContent = await this.aiService.generateCommitContent(diffSummary);

      // Send generated content to webview
      this._view?.webview.postMessage({
        type: CONSTANTS.MESSAGES.TYPES.AI_CONTENT_GENERATED,
        content: aiContent
      });

      // Show success message with confidence level
      const confidencePercent = Math.round(aiContent.confidence * 100);
      vscode.window.showInformationMessage(
        `${CONSTANTS.MESSAGES.SUCCESS.AI_CONTENT_GENERATED} (信心度: ${confidencePercent}%)`
      );

    } catch (error) {
      console.error('AI content generation failed:', error);
      this.showErrorMessage(`${CONSTANTS.MESSAGES.ERRORS.AI_GENERATION_FAILED}: ${error}`);
      this.sendAIGenerationFailed();
    }
  }

  /**
   * Sends AI generation failed message to webview
   */
  private sendAIGenerationFailed(): void {
    this._view?.webview.postMessage({
      type: CONSTANTS.MESSAGES.TYPES.AI_GENERATION_FAILED
    });
  }

  /**
   * Public method to refresh file list (implements RefreshableProvider)
   */
  public async refresh(): Promise<void> {
    await this.refreshFileList();
  }

  /**
   * Refreshes the file list in the webview
   */
  private async refreshFileList(): Promise<void> {
    if (!this._view || !this.gitService) {
      return;
    }

    try {
      const files = await this.gitService.getFileStatus();
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
   * Handles the commit operation
   */
  private async handleCommit(commitType: string, scope: string, message: string): Promise<void> {
    if (!this.gitService) {
      this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NO_WORKSPACE);
      return;
    }

    try {
      // Input validation
      if (!this.validateCommitInput(commitType, message)) {
        this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.COMMIT_VALIDATION);
        return;
      }

      // Repository validation
      if (!(await this.gitService.isGitRepository())) {
        this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NOT_GIT_REPO);
        return;
      }

      // Check for staged changes or offer to stage all
      if (!(await this.ensureStagedChanges())) {
        return; // User cancelled or no changes to commit
      }

      // Execute commit
      const commitMessage = this.gitService.formatCommitMessage(commitType, scope, message);
      await this.gitService.commit(commitMessage);
      
      // Update UI
      await this.refreshFileList();
      this.clearInputs();
      
      vscode.window.showInformationMessage(`${CONSTANTS.MESSAGES.SUCCESS.COMMIT}: ${commitMessage}`);
    } catch (error) {
      console.error('Commit operation failed:', error);
      this.showErrorMessage(`${CONSTANTS.MESSAGES.ERRORS.COMMIT_FAILED}：${error}`);
    }
  }

  /**
   * Stages a single file
   */
  private async stageFile(filePath: string): Promise<void> {
    if (!this.gitService) {
      this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NO_WORKSPACE);
      return;
    }

    try {
      await this.gitService.stageFile(filePath);
      await this.refreshFileList();
      vscode.window.showInformationMessage(`${CONSTANTS.MESSAGES.SUCCESS.STAGE}: ${filePath}`);
    } catch (error) {
      console.error('Stage file error:', error);
      this.showErrorMessage(`${CONSTANTS.MESSAGES.ERRORS.STAGE_FAILED}: ${error}`);
    }
  }

  /**
   * Unstages a single file
   */
  private async unstageFile(filePath: string): Promise<void> {
    if (!this.gitService) {
      this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NO_WORKSPACE);
      return;
    }

    try {
      await this.gitService.unstageFile(filePath);
      await this.refreshFileList();
      vscode.window.showInformationMessage(`${CONSTANTS.MESSAGES.SUCCESS.UNSTAGE}: ${filePath}`);
    } catch (error) {
      console.error('Unstage file error:', error);
      this.showErrorMessage(`${CONSTANTS.MESSAGES.ERRORS.UNSTAGE_FAILED}: ${error}`);
    }
  }

  /**
   * Stages all unstaged files
   */
  private async stageAllFiles(): Promise<void> {
    if (!this.gitService) {
      this.showErrorMessage(CONSTANTS.MESSAGES.ERRORS.NO_WORKSPACE);
      return;
    }

    try {
      await this.gitService.stageAllFiles();
      await this.refreshFileList();
      vscode.window.showInformationMessage(CONSTANTS.MESSAGES.SUCCESS.STAGE_ALL);
    } catch (error) {
      console.error('Stage all files error:', error);
      this.showErrorMessage(`${CONSTANTS.MESSAGES.ERRORS.STAGE_FAILED}: ${error}`);
    }
  }

  /**
   * Validates commit input parameters
   */
  private validateCommitInput(commitType: string, message: string): boolean {
    return !!(commitType && message?.trim());
  }

  /**
   * Ensures there are staged changes, offering to stage all if none exist
   */
  private async ensureStagedChanges(): Promise<boolean> {
    if (!this.gitService) {
      return false;
    }

    if (await this.gitService.hasStagedChanges()) {
      return true;
    }

    const action = await vscode.window.showInformationMessage(
      '沒有檔案在 staging area，是否要加入所有變更？',
      '是',
      '否'
    );

    if (action === '是') {
      await this.stageAllFiles();
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
   * Updates AI configuration settings
   */
  private async updateAIConfiguration(config: any): Promise<void> {
    try {
      const vsCodeConfig = vscode.workspace.getConfiguration('yun-commit-helper.ai');
      
      if (config.provider) {
        await vsCodeConfig.update('provider', config.provider, vscode.ConfigurationTarget.Global);
      }
      
      if (config.apiKey !== undefined) {
        await vsCodeConfig.update('apiKey', config.apiKey, vscode.ConfigurationTarget.Global);
      }
      
      if (config.model !== undefined) {
        await vsCodeConfig.update('model', config.model, vscode.ConfigurationTarget.Global);
      }
      
      if (config.endpoint !== undefined) {
        await vsCodeConfig.update('endpoint', config.endpoint, vscode.ConfigurationTarget.Global);
      }

      // Update the AI service configuration
      if (this.aiService) {
        this.aiService.updateConfiguration(config);
      }
      
      console.log('AI configuration updated:', config);
    } catch (error) {
      console.error('Failed to update AI configuration:', error);
      this.showErrorMessage('AI 設定更新失敗');
    }
  }

  /**
   * Loads and sends current AI configuration to webview
   */
  private loadAIConfiguration(): void {
    if (!this._view) {
      return;
    }

    try {
      const config = vscode.workspace.getConfiguration('yun-commit-helper.ai');
      
      const aiConfig = {
        provider: config.get('provider') || 'rules',
        apiKey: config.get('apiKey') || '',
        model: config.get('model') || '',
        endpoint: config.get('endpoint') || 'http://localhost:11434/api/generate'
      };

      this._view.webview.postMessage({
        type: CONSTANTS.MESSAGES.TYPES.LOAD_AI_CONFIG,
        config: aiConfig
      });
    } catch (error) {
      console.error('Failed to load AI configuration:', error);
    }
  }

  /**
   * Shows an error message in the VS Code window
   */
  private showErrorMessage(message: string): void {
    vscode.window.showErrorMessage(message);
  }

  /**
   * Disposes all resources
   */
  public dispose(): void {
    this.fileWatcher?.dispose();
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables.length = 0;
  }
} 