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
      CLEAR_INPUTS: 'clearInputs',
      GENERATE_AI_CONTENT: 'generateAIContent',
      AI_CONTENT_GENERATED: 'aiContentGenerated',
      AI_GENERATION_FAILED: 'aiGenerationFailed',
      UPDATE_AI_CONFIG: 'updateAIConfig',
      LOAD_AI_CONFIG: 'loadAIConfig'
    } as const,
    ERRORS: {
      NOT_GIT_REPO: '目前不在 Git repository 中',
      NO_WORKSPACE: '找不到工作區資料夾',
      COMMIT_VALIDATION: '請選擇 commit 類型並輸入訊息',
      COMMIT_FAILED: 'Commit 失敗',
      STAGE_FAILED: '加入檔案暫存失敗',
      UNSTAGE_FAILED: '移除檔案暫存失敗',
      AI_GENERATION_FAILED: 'AI 內容生成失敗',
      NO_STAGED_FILES: '沒有已暫存的檔案可供分析',
      AI_API_ERROR: 'AI API 呼叫失敗'
    } as const,
    SUCCESS: {
      COMMIT: 'Commit 成功',
      STAGE: '已加入暫存',
      UNSTAGE: '已移除暫存',
      STAGE_ALL: '所有變更已加入暫存區',
      AI_CONTENT_GENERATED: 'AI 內容生成成功'
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
      CHECK_STAGED: 'git diff --cached --name-only',
      DIFF_STAGED: 'git diff --cached',
      DIFF_STAGED_STAT: 'git diff --cached --stat',
      DIFF_STAGED_NUMSTAT: 'git diff --cached --numstat'
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
  },
  AI: {
    MAX_DIFF_LENGTH: 8000, // Maximum characters to send to AI
    GEMINI_MAX_DIFF_LENGTH: 3000, // Trigger intelligent summary above this size
    GEMINI_SUMMARY_LENGTH: 800, // Target length for intelligent summary (more conservative)
    DEFAULT_MODEL: 'gpt-3.5-turbo',
    TIMEOUT: 30000, // 30 seconds timeout
    PROMPT: {
      SYSTEM: `你是一個專業的 Git commit 訊息生成助手。請根據提供的程式碼變更，生成符合 Conventional Commits 規範的 commit 訊息。

撰寫規則：
1. 使用繁體中文描述
2. 格式：type(scope): description
3. type 必須是：feat, fix, refactor, docs, style, test, chore, perf, ci, build, revert 之一
4. description 要**詳細但精準**，說明「做了什麼」和「影響範圍」
5. **多檔案處理**：當涉及多個檔案時，整合描述共同目標，不要逐一列舉檔案
6. **適當長度**：描述應為 15-50 字，避免過短（<10字）或冗長（>60字）
7. scope 選擇：單一模組用具體名稱，跨模組變更可省略或用通用詞

描述品質標準：
✅ 好的描述：「新增用戶身份驗證功能並集成 JWT token 管理」
✅ 好的描述：「重構資料庫連接層以提升性能和錯誤處理」
✅ 好的描述：「修復檔案上傳時的記憶體洩漏和進度追蹤問題」
❌ 避免過短：「修復 bug」、「更新檔案」
❌ 避免過長：「修復了在特定情況下當用戶嘗試上傳大檔案時可能出現的記憶體洩漏問題並改善了進度條顯示邏輯」

請返回 JSON 格式：
{
  "type": "feat|fix|refactor|docs|style|test|chore|perf|ci|build|revert",
  "scope": "模組名稱或省略",
  "message": "詳細且精準的變更描述（15-50字）",
  "confidence": 0.0-1.0
}`,
      USER_PREFIX: '請分析以下 Git diff 並生成 commit 訊息：\n\n'
    }
  }
} as const; 