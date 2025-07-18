import * as vscode from 'vscode';

/**
 * Interface for command provider that can refresh
 */
export interface RefreshableProvider {
  refresh(): Promise<void>;
}

/**
 * Registers all commands for the extension
 */
export function registerCommands(
  context: vscode.ExtensionContext, 
  provider: RefreshableProvider
): void {
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