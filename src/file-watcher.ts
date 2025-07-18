import * as vscode from 'vscode';
import { CONSTANTS } from './constants';

/**
 * Callback function type for file change events
 */
export type FileChangeCallback = () => void;

/**
 * Service class for handling file system watching
 */
export class FileWatcher {
  private fileWatcher?: vscode.FileSystemWatcher;
  private gitWatcher?: vscode.FileSystemWatcher;
  private refreshTimer?: NodeJS.Timeout;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onChangeCallback: FileChangeCallback;

  constructor(onChangeCallback: FileChangeCallback) {
    this.onChangeCallback = onChangeCallback;
  }

  /**
   * Sets up file system watchers to automatically detect changes
   */
  public setupWatching(workspaceFolder: vscode.WorkspaceFolder): void {
    try {
      // Watch all files in workspace (excluding common ignore patterns)
      this.fileWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceFolder, '**/*'),
        false, // Don't ignore create events
        false, // Don't ignore change events
        false  // Don't ignore delete events
      );

      // Watch Git-specific files
      this.gitWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceFolder, '.git/{index,HEAD,refs/**}'),
        false,
        false,
        false
      );

      // File change event handlers
      this.fileWatcher.onDidCreate(() => this.debouncedRefresh(), null, this.disposables);
      this.fileWatcher.onDidChange(() => this.debouncedRefresh(), null, this.disposables);
      this.fileWatcher.onDidDelete(() => this.debouncedRefresh(), null, this.disposables);

      // Git state change event handlers
      this.gitWatcher.onDidCreate(() => this.debouncedRefresh(), null, this.disposables);
      this.gitWatcher.onDidChange(() => this.debouncedRefresh(), null, this.disposables);
      this.gitWatcher.onDidDelete(() => this.debouncedRefresh(), null, this.disposables);

      // Listen for workspace changes
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.disposeWatchers();
        const newWorkspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (newWorkspaceFolder) {
          this.setupWatching(newWorkspaceFolder);
          this.debouncedRefresh();
        }
      }, null, this.disposables);

      console.log('File watching setup completed');
    } catch (error) {
      console.error('Failed to setup file watching:', error);
    }
  }

  /**
   * Debounced refresh to prevent excessive updates
   */
  private debouncedRefresh(): void {
    // Clear previous timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Set new timer to execute refresh after delay
    this.refreshTimer = setTimeout(() => {
      try {
        this.onChangeCallback();
      } catch (error) {
        console.error('Auto refresh failed:', error);
      }
    }, CONSTANTS.TIMING.DEBOUNCE_DELAY);
  }

  /**
   * Forces an immediate refresh
   */
  public forceRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.onChangeCallback();
  }

  /**
   * Disposes of file watchers
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
   * Disposes all resources
   */
  public dispose(): void {
    this.disposeWatchers();
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables.length = 0;
  }
} 