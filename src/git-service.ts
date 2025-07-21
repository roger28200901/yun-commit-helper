import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GitFileStatus, GitDiffInfo } from './types';
import { CONSTANTS } from './constants';

const execAsync = promisify(exec);

/**
 * Service class for handling Git operations
 */
export class GitService {
  private workspaceFolder: vscode.WorkspaceFolder;

  constructor(workspaceFolder: vscode.WorkspaceFolder) {
    this.workspaceFolder = workspaceFolder;
  }

  /**
   * Checks if the current workspace is a Git repository
   */
  public async isGitRepository(): Promise<boolean> {
    try {
      await execAsync(CONSTANTS.GIT.COMMANDS.CHECK_REPO, { 
        cwd: this.workspaceFolder.uri.fsPath 
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if there are staged changes in the current repository
   */
  public async hasStagedChanges(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(CONSTANTS.GIT.COMMANDS.CHECK_STAGED, { 
        cwd: this.workspaceFolder.uri.fsPath 
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Gets detailed diff information for staged files for AI analysis
   */
  public async getStagedDiffInfo(): Promise<GitDiffInfo[]> {
    try {
      // Get numstat (additions/deletions count)
      const { stdout: numstat } = await execAsync(CONSTANTS.GIT.COMMANDS.DIFF_STAGED_NUMSTAT, {
        cwd: this.workspaceFolder.uri.fsPath
      });

      // Get actual diff content
      const { stdout: diffContent } = await execAsync(CONSTANTS.GIT.COMMANDS.DIFF_STAGED, {
        cwd: this.workspaceFolder.uri.fsPath
      });

      const diffInfos: GitDiffInfo[] = [];
      const numstatLines = numstat.trim().split('\n').filter(line => line.length > 0);

      for (const line of numstatLines) {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const additions = parseInt(parts[0]) || 0;
          const deletions = parseInt(parts[1]) || 0;
          const filePath = parts[2];

          // Extract relevant diff content for this file
          const fileContent = this.extractFileDiff(diffContent, filePath);
          
          diffInfos.push({
            filePath,
            status: this.getFileStatusFromDiff(diffContent, filePath),
            additions,
            deletions,
            content: fileContent
          });
        }
      }

      return diffInfos;
    } catch (error) {
      console.error('Error getting staged diff info:', error);
      return [];
    }
  }

  /**
   * Gets the full staged changes diff for AI analysis
   */
  public async getStagedChangesSummary(): Promise<string> {
    try {
      // Return the raw git diff output directly
      const { stdout } = await execAsync(CONSTANTS.GIT.COMMANDS.DIFF_STAGED, { 
        cwd: this.workspaceFolder.uri.fsPath 
      });
      
      return stdout.trim();
    } catch (error) {
      console.error('Error getting staged changes diff:', error);
      return '';
    }
  }



  /**
   * Fetches the current Git file status from the workspace
   */
  public async getFileStatus(): Promise<GitFileStatus[]> {
    try {
      const { stdout } = await execAsync(CONSTANTS.GIT.COMMANDS.STATUS, { 
        cwd: this.workspaceFolder.uri.fsPath 
      });
      
      const lines = stdout.split('\n').filter(line => line.length > 0);
      const fileMap = new Map<string, GitFileStatus>();

      lines.forEach(line => {
        if (line.length < 3) return;
        
        const indexStatus = line[0];
        const workTreeStatus = line[1];
        let path = line.substring(3).trim();
        
        // Handle quoted paths with spaces
        if (path.startsWith('"') && path.endsWith('"')) {
          path = path.slice(1, -1);
          path = path.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }

        // Handle staged files
        if (indexStatus !== CONSTANTS.GIT.STATUS_CODES.SPACE && 
            indexStatus !== CONSTANTS.GIT.STATUS_CODES.UNTRACKED) {
          const { status, description } = this.getStatusInfo(indexStatus);
          fileMap.set(`${path}_staged`, {
            path,
            status,
            description,
            staged: true
          });
        }

        // Handle unstaged files
        if (workTreeStatus !== CONSTANTS.GIT.STATUS_CODES.SPACE && 
            indexStatus !== CONSTANTS.GIT.STATUS_CODES.UNTRACKED && 
            workTreeStatus !== CONSTANTS.GIT.STATUS_CODES.UNTRACKED) {
          const { status, description } = this.getStatusInfo(workTreeStatus);
          fileMap.set(`${path}_unstaged`, {
            path,
            status,
            description,
            staged: false
          });
        }

        // Handle untracked files
        if (indexStatus === CONSTANTS.GIT.STATUS_CODES.UNTRACKED && 
            workTreeStatus === CONSTANTS.GIT.STATUS_CODES.UNTRACKED) {
          fileMap.set(`${path}_untracked`, {
            path,
            status: '?',
            description: 'Untracked',
            staged: false
          });
        }
      });

      return Array.from(fileMap.values());
    } catch (error) {
      console.error('Get git file status error:', error);
      return [];
    }
  }

  /**
   * Stages a single file
   */
  public async stageFile(filePath: string): Promise<void> {
    const sanitizedPath = this.sanitizeFilePath(filePath);
    await execAsync(`${CONSTANTS.GIT.COMMANDS.ADD} "${sanitizedPath}"`, { 
      cwd: this.workspaceFolder.uri.fsPath 
    });
  }

  /**
   * Unstages a single file
   */
  public async unstageFile(filePath: string): Promise<void> {
    const sanitizedPath = this.sanitizeFilePath(filePath);
    
    try {
      await execAsync(`${CONSTANTS.GIT.COMMANDS.RESTORE_STAGED} "${sanitizedPath}"`, { 
        cwd: this.workspaceFolder.uri.fsPath 
      });
    } catch (error) {
      // Fallback to git reset HEAD if git restore is not supported
      await execAsync(`${CONSTANTS.GIT.COMMANDS.RESET_HEAD} "${sanitizedPath}"`, { 
        cwd: this.workspaceFolder.uri.fsPath 
      });
    }
  }

  /**
   * Stages all unstaged files
   */
  public async stageAllFiles(): Promise<void> {
    await execAsync(CONSTANTS.GIT.COMMANDS.ADD_ALL, { 
      cwd: this.workspaceFolder.uri.fsPath 
    });
  }

  /**
   * Executes a Git commit with the given message
   */
  public async commit(message: string): Promise<void> {
    const sanitizedMessage = this.sanitizeCommitMessage(message);
    await execAsync(`${CONSTANTS.GIT.COMMANDS.COMMIT} "${sanitizedMessage}"`, { 
      cwd: this.workspaceFolder.uri.fsPath 
    });
  }

  /**
   * Formats commit message according to Conventional Commits specification
   */
  public formatCommitMessage(commitType: string, scope: string, message: string): string {
    const scopeStr = scope ? `(${scope})` : '';
    return `${commitType}${scopeStr}: ${message}`;
  }

  /**
   * Extracts diff content for a specific file
   */
  private extractFileDiff(fullDiff: string, filePath: string): string {
    const lines = fullDiff.split('\n');
    const fileStartPattern = new RegExp(`^diff --git a/${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} b/${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    
    let startIndex = -1;
    let endIndex = lines.length;
    
    // Find start of this file's diff
    for (let i = 0; i < lines.length; i++) {
      if (fileStartPattern.test(lines[i])) {
        startIndex = i;
        break;
      }
    }
    
    if (startIndex === -1) return '';
    
    // Find end of this file's diff (start of next file or end)
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('diff --git')) {
        endIndex = i;
        break;
      }
    }
    
    return lines.slice(startIndex, endIndex).join('\n');
  }

  /**
   * Determines file status from diff content
   */
  private getFileStatusFromDiff(diffContent: string, filePath: string): string {
    if (diffContent.includes(`new file mode`)) return 'A';
    if (diffContent.includes(`deleted file mode`)) return 'D';
    if (diffContent.includes(`rename from`) && diffContent.includes(`rename to`)) return 'R';
    return 'M'; // Default to modified
  }

  /**
   * Gets status information for a given Git status code
   */
  private getStatusInfo(statusCode: string): { status: string; description: string } {
    switch (statusCode) {
      case CONSTANTS.GIT.STATUS_CODES.MODIFIED:
        return { status: 'M', description: 'Modified' };
      case CONSTANTS.GIT.STATUS_CODES.ADDED:
        return { status: 'A', description: 'Added' };
      case CONSTANTS.GIT.STATUS_CODES.DELETED:
        return { status: 'D', description: 'Deleted' };
      case CONSTANTS.GIT.STATUS_CODES.RENAMED:
        return { status: 'R', description: 'Renamed' };
      case CONSTANTS.GIT.STATUS_CODES.COPIED:
        return { status: 'C', description: 'Copied' };
      default:
        return { status: 'C', description: 'Changed' };
    }
  }

  /**
   * Sanitizes file paths to prevent command injection attacks
   */
  private sanitizeFilePath(filePath: string): string {
    return filePath
      .replace(/[;&|`$(){}[\]]/g, '')
      .replace(/\.\.\//g, '')
      .trim();
  }

  /**
   * Sanitizes commit messages to prevent command injection attacks
   */
  private sanitizeCommitMessage(message: string): string {
    return message
      .replace(/"/g, '\\"')
      .replace(/[`$\\]/g, '\\$&')
      .trim();
  }
} 