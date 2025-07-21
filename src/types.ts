/**
 * Represents a commit type with its label and description
 */
export interface CommitType {
  label: string;
  description: string;
}

/**
 * Represents the status of a file in Git
 */
export interface GitFileStatus {
  path: string;
  status: string;
  description: string;
  staged: boolean;
}

/**
 * Message types for communication between webview and extension
 */
export type MessageType = 'commit' | 'stageFile' | 'unstageFile' | 'refresh' | 'stageAll' | 'ready' | 'updateFiles' | 'clearInputs' | 'generateAIContent' | 'updateAIConfig' | 'loadAIConfig';

/**
 * Message data structure for webview communication
 */
export interface WebviewMessage {
  type: MessageType;
  [key: string]: any;
}

/**
 * Configuration interface for Git operations
 */
export interface GitConfig {
  workspacePath: string;
}

/**
 * AI Configuration interface
 */
export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'local' | 'rules';
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

/**
 * AI-generated commit content
 */
export interface AICommitContent {
  type: string;
  scope?: string;
  message: string;
  confidence: number;
}

/**
 * Git diff information for AI analysis
 */
export interface GitDiffInfo {
  filePath: string;
  status: string;
  additions: number;
  deletions: number;
  content: string;
} 