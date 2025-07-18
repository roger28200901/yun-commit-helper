// Constants for better maintainability and avoiding magic strings
export const CONSTANTS = {
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
  },
  TIMING: {
    DEBOUNCE_DELAY: 300 // milliseconds
  }
} as const; 