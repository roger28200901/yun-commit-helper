import * as vscode from 'vscode';
import { CommitHelperProvider } from './webview-provider';
import { registerCommands } from './commands';

/**
 * Extension activation point
 * Called when the extension is activated by VS Code
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

    // Ensure provider is properly cleaned up when extension is deactivated
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
 * Extension deactivation point
 * Called when the extension is deactivated by VS Code
 */
export function deactivate(): void {
  console.log('Commit Helper extension deactivated');
}