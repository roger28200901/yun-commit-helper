import * as vscode from 'vscode';
import { AICommitContent } from './types';
import { CONSTANTS } from './constants';

/**
 * Configuration for AI service
 */
interface AIConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'local' | 'rules';
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

/**
 * OpenAI API response type
 */
interface OpenAIResponse {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * Anthropic API response type
 */
interface AnthropicResponse {
  content: Array<{
    text?: string;
  }>;
}

/**
 * Google Gemini API response type
 */
interface GeminiResponse {
  candidates: Array<{
    content?: {
      role?: string;
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
    index?: number;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
  responseId?: string;
}

/**
 * Local AI API response type
 */
interface LocalAIResponse {
  response?: string;
  text?: string;
  content?: string;
}

/**
 * Service class for AI-powered content generation
 */
export class AIService {
  private config: AIConfig;

  constructor() {
    this.config = this.loadConfiguration();
  }

  /**
   * Generates commit content using AI based on the diff summary
   */
  public async generateCommitContent(diffSummary: string): Promise<AICommitContent> {
    if (!diffSummary.trim()) {
      throw new Error(CONSTANTS.MESSAGES.ERRORS.NO_STAGED_FILES);
    }

    // Only check diff size for non-Gemini providers (Gemini has intelligent summary)
    const isLargeDiff = this.isLargeDiffForProvider(diffSummary);
    if (isLargeDiff && this.config.provider !== 'gemini') {
      console.log(`Large diff detected for ${this.config.provider}, using rule-based generation`);
      return this.generateWithEnhancedRules(diffSummary);
    }

    try {
      switch (this.config.provider) {
        case 'openai':
          return await this.generateWithOpenAI(diffSummary);
        case 'anthropic':
          return await this.generateWithAnthropic(diffSummary);
        case 'gemini':
          return await this.generateWithGemini(diffSummary);
        case 'local':
          return await this.generateWithLocalAI(diffSummary);
        case 'rules':
        default:
          // Use enhanced rule-based generation
          return this.generateWithEnhancedRules(diffSummary);
      }
    } catch (error) {
      console.error('AI generation failed:', error);
      // Show user-friendly error message
      this.showProviderError(error);
      // Always fallback to enhanced rules
      return this.generateWithEnhancedRules(diffSummary);
    }
  }

  /**
   * Shows provider-specific error messages to help user configure
   */
  private showProviderError(error: any): void {
    const errorMessage = error?.message || String(error);
    
    if (this.config.provider === 'local' && errorMessage.includes('fetch failed')) {
      vscode.window.showWarningMessage(
        'AI 服務連接失敗！請確認本地 AI 服務已啟動，或在設定中切換到其他提供者',
        '開啟設定',
        '使用規則引擎'
      ).then((choice) => {
        if (choice === '開啟設定') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'yun-commit-helper.ai');
        }
      });
    } else if (this.config.provider === 'openai' && errorMessage.includes('API key')) {
      vscode.window.showWarningMessage(
        'OpenAI API Key 未設定！請在設定中添加 API Key',
        '開啟設定'
      ).then((choice) => {
        if (choice === '開啟設定') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'yun-commit-helper.ai');
        }
      });
    } else if (this.config.provider === 'gemini' && errorMessage.includes('API key')) {
      vscode.window.showWarningMessage(
        'Google Gemini API Key 未設定！請在設定中添加 API Key',
        '開啟設定'
      ).then((choice) => {
        if (choice === '開啟設定') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'yun-commit-helper.ai');
        }
      });
    } else if (this.config.provider === 'gemini' && errorMessage.includes('truncated due to token limit')) {
      vscode.window.showWarningMessage(
        'Gemini 回應過長被截斷！請嘗試減少變更數量或分批提交',
        '了解'
      );
    } else if (this.config.provider === 'gemini' && errorMessage.includes('safety concerns')) {
      vscode.window.showWarningMessage(
        'Gemini 因安全考量封鎖回應！請檢查程式碼內容或使用其他 AI 提供者',
        '了解'
      );
    }
  }

  /**
   * Generates commit content using OpenAI API
   */
  private async generateWithOpenAI(diffSummary: string): Promise<AICommitContent> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model || CONSTANTS.AI.DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: CONSTANTS.AI.PROMPT.SYSTEM
          },
          {
            role: 'user',
            content: CONSTANTS.AI.PROMPT.USER_PREFIX + diffSummary
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      }),
      signal: AbortSignal.timeout(CONSTANTS.AI.TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json() as OpenAIResponse;
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    return this.parseAIResponse(content);
  }

  /**
   * Generates commit content using Anthropic Claude API
   */
  private async generateWithAnthropic(diffSummary: string): Promise<AICommitContent> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: CONSTANTS.AI.PROMPT.SYSTEM + '\n\n' + CONSTANTS.AI.PROMPT.USER_PREFIX + diffSummary
          }
        ]
      }),
      signal: AbortSignal.timeout(CONSTANTS.AI.TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json() as AnthropicResponse;
    const content = data.content[0]?.text;

    if (!content) {
      throw new Error('No content received from Anthropic');
    }

    return this.parseAIResponse(content);
  }

  /**
   * Generates commit content using Google Gemini API
   */
  private async generateWithGemini(diffSummary: string): Promise<AICommitContent> {
    if (!this.config.apiKey) {
      throw new Error('Google Gemini API key not configured');
    }

    // Use intelligent summary for large diffs
    let processedDiff = diffSummary;
    if (diffSummary.length > CONSTANTS.AI.GEMINI_MAX_DIFF_LENGTH) {
      console.log(`Large diff (${diffSummary.length} chars), creating intelligent summary...`);
      processedDiff = this.truncateDiffForGemini(diffSummary);
      
      // If even the summary is too long, fallback to rules
      if (processedDiff.length > CONSTANTS.AI.GEMINI_SUMMARY_LENGTH * 1.5) {
        console.log('Even intelligent summary too long, using rule-based generation');
        vscode.window.showInformationMessage(
          '代碼變更過於複雜，使用規則引擎生成 commit 內容',
          { modal: false }
        );
        return this.generateWithEnhancedRules(diffSummary);
      }
      
      // Show user-friendly message about intelligent processing
      vscode.window.showInformationMessage(
        '代碼變更較大，AI 正在智能分析關鍵變更...',
        { modal: false }
      );
    }

    // DEBUG: Show what we're sending to Gemini
    console.log('=== DEBUG: Processed Diff for Gemini ===');
    console.log(`Length: ${processedDiff.length} chars`);
    console.log('Content:');
    console.log(processedDiff);
    console.log('=== END Processed Diff ===');

    const model = this.config.model || 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;

    // Test API key first with a simple request
    try {
      const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        throw new Error(`Gemini API key validation failed: ${testResponse.status} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`Cannot connect to Google Gemini: ${error}. Please check your API key and internet connection.`);
    }

    // DEBUG: Show the complete prompt being sent
    const fullPrompt = this.createGeminiPrompt(processedDiff);
    console.log('=== DEBUG: Complete Gemini Prompt ===');
    console.log(`Prompt length: ${fullPrompt.length} chars`);
    console.log('Prompt content:');
    console.log(fullPrompt);
    console.log('=== END Complete Prompt ===');

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: fullPrompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,  // 降低創造性，減少思考
        // maxOutputTokens: model.includes('2.5-pro') ? 300 : 1000,  // 2.5-pro 需要思考空間
        topP: 0.4,  // 更確定的回應
        topK: 3,    // 限制選擇範圍
        candidateCount: 1
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    console.log('=== DEBUG: Gemini API Request ===');
    console.log('Endpoint:', endpoint);
    console.log('Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('=== END API Request ===');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(CONSTANTS.AI.TIMEOUT)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error Response:', errorText);
      
      // Handle quota exceeded (429) error - fallback to rules
      if (response.status === 429) {
        console.log('Gemini quota exceeded, falling back to rule-based generation');
        vscode.window.showWarningMessage(
          'Gemini API 免費配額已用完，自動切換到規則引擎生成 commit 內容',
          { modal: false }
        );
        return this.generateWithEnhancedRules(diffSummary);
      }
      
      throw new Error(`Google Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as GeminiResponse;
    console.log('Gemini API Response:', JSON.stringify(data, null, 2));

    // Check for API errors in response
    if (data.candidates && data.candidates.length === 0) {
      throw new Error('Gemini API returned no candidates. Check your API key and quota.');
    }

    const candidate = data.candidates?.[0];
    
    // Check if response was truncated due to token limit
    if (candidate?.finishReason === 'MAX_TOKENS') {
      console.warn('Gemini response truncated, falling back to rule-based generation');
      // Return a fallback response instead of throwing error
      return this.generateWithEnhancedRules(diffSummary);
    }
    
    // Check for other finish reasons that indicate problems
    if (candidate?.finishReason === 'SAFETY') {
      throw new Error('Gemini blocked the response due to safety concerns. Try a different input.');
    }
    
    if (candidate?.finishReason === 'RECITATION') {
      throw new Error('Gemini blocked the response due to recitation concerns.');
    }

    // Try different possible response structures
    let content = '';
    
    // Primary structure: candidates[0].content.parts[0].text
    if (candidate?.content?.parts?.[0]?.text) {
      content = candidate.content.parts[0].text;
    }
    // Alternative structure: candidates[0].output
    else if ((candidate as any)?.output) {
      content = (candidate as any).output;
    }
    // Alternative structure: text field directly
    else if ((data as any).text) {
      content = (data as any).text;
    }
    // Alternative structure: candidates[0].text
    else if ((candidate as any)?.text) {
      content = (candidate as any).text;
    }

    if (!content) {
      console.error('Gemini Response Structure:', data);
      throw new Error(`No content received from Google Gemini. Response structure: ${JSON.stringify(data)}`);
    }

    return this.parseAIResponse(content);
  }

  /**
   * Checks if diff is too large for the specified provider
   */
  private isLargeDiffForProvider(diffSummary: string): boolean {
    const length = diffSummary.length;
    
    switch (this.config.provider) {
      case 'gemini':
        return length > CONSTANTS.AI.GEMINI_MAX_DIFF_LENGTH;
      case 'openai':
      case 'anthropic':
        return length > CONSTANTS.AI.MAX_DIFF_LENGTH;
      case 'local':
        return length > CONSTANTS.AI.MAX_DIFF_LENGTH * 1.5; // Local AI can handle more
      default:
        return false; // Rules-based can handle any size
    }
  }

  /**
   * Creates intelligent summary for Gemini focusing on code semantics
   */
  private truncateDiffForGemini(diffSummary: string): string {
    const maxLength = CONSTANTS.AI.GEMINI_SUMMARY_LENGTH;
    
    if (diffSummary.length <= maxLength) {
      return diffSummary;
    }

    console.log('Creating intelligent summary for Gemini...');
    
    const lines = diffSummary.split('\n');
    let summary = '';
    
    // 1. 提取檔案基本信息
    const fileLines = lines.filter(line => line.includes('檔案:'));
    const statsLines = lines.filter(line => line.includes('新增:') && line.includes('刪除:'));
    
    for (let i = 0; i < Math.min(fileLines.length, 3); i++) {
      summary += fileLines[i] + '\n';
      if (i < statsLines.length) {
        summary += statsLines[i] + '\n';
      }
    }
    
    // 2. 智能提取關鍵變更內容
    const importLines = lines.filter(line => 
      line.includes('require(') || line.includes('import ') || line.includes('from ')
    );
    
    const functionLines = lines.filter(line => {
      const l = line.trim();
      return (l.startsWith('+') || l.startsWith('-')) && 
             (l.includes('function ') || l.includes('const ') || l.includes('= async') ||
              l.includes('= (') || l.includes('switch') || l.includes('case '));
    });
    
    const structuralLines = lines.filter(line => {
      const l = line.trim();
      return (l.startsWith('+') || l.startsWith('-')) && 
             (l.includes('class ') || l.includes('interface ') || l.includes('export ') ||
              l.includes('module.exports') || l.includes('extends') || l.includes('implements'));
    });
    
    // 3. 構建有意義的摘要
    if (importLines.length > 0) {
      summary += '\n新增模組: ';
      const modules = importLines.slice(0, 5).map(line => {
        // 提取模組名稱
        const match = line.match(/require\(['"]([^'"]+)['"]\)|from ['"]([^'"]+)['"]/);
        return match ? (match[1] || match[2]) : line.replace(/^[+-]\s*/, '').trim();
      }).filter(mod => mod.length > 0);
      summary += modules.join(', ') + '\n';
    }
    
    if (functionLines.length > 0) {
      summary += '\n主要函數變更: ';
      const functions = functionLines.slice(0, 8).map(line => {
        // 提取函數名稱和用途
        let clean = line.replace(/^[+-]\s*/, '').trim();
        
        // 簡化函數簽名
        if (clean.includes('function ')) {
          const match = clean.match(/function\s+(\w+)/);
          return match ? `${match[1]}()` : '新函數';
        } else if (clean.includes('const ') && clean.includes('=')) {
          const match = clean.match(/const\s+(\w+)\s*=/);
          return match ? `${match[1]}()` : '新常數';
        } else if (clean.includes('switch') || clean.includes('case')) {
          return clean.length > 50 ? clean.substring(0, 50) + '...' : clean;
        }
        
        return clean.length > 40 ? clean.substring(0, 40) + '...' : clean;
      }).filter(func => func.length > 3);
      
      summary += functions.join(', ') + '\n';
    }
    
    // 4. 添加變更規模信息
    const totalAdded = lines.filter(l => l.includes('新增:')).reduce((sum, line) => {
      const match = line.match(/新增:\s*\+(\d+)/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);
    
    const totalDeleted = lines.filter(l => l.includes('刪除:')).reduce((sum, line) => {
      const match = line.match(/刪除:\s*-(\d+)/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);
    
    if (totalAdded > 0 || totalDeleted > 0) {
      summary += `\n變更規模: +${totalAdded}/-${totalDeleted} 行`;
    }
    
    // 5. 如果還是太長，智能截斷但保留關鍵信息
    if (summary.length > maxLength) {
      const summarySections = summary.split('\n').filter(line => line.trim());
      let truncated = '';
      let currentLength = 0;
      
      for (const section of summarySections) {
        if (currentLength + section.length + 1 <= maxLength - 50) {
          truncated += section + '\n';
          currentLength += section.length + 1;
        } else {
          break;
        }
      }
      
      truncated += `\n(智能摘要，原始 ${diffSummary.length} 字符)`;
      summary = truncated;
    }
    
    console.log(`Gemini intelligent summary: ${summary.length} chars (from ${diffSummary.length})`);
    return summary;
  }

  /**
   * Creates a concise prompt specifically for Gemini to avoid token limits
   */
  private createGeminiPrompt(diffSummary: string): string {
    // Ultra-minimal prompt for 2.5-pro to reduce thinking
    if (this.config.model?.includes('2.5-pro')) {
      return `${diffSummary}\n\n直接回傳: {"type":"feat","scope":"","message":"中文描述","confidence":0.8}`;
    }
    
    // Standard prompt for other models
    return `根據代碼變更生成 commit 訊息：\n\n${diffSummary}\n\n只返回 JSON：\n{"type":"feat|fix|refactor|docs|style|test|chore","scope":"","message":"簡潔中文描述","confidence":0.8}`;
  }

  /**
   * Generates commit content using local AI endpoint
   */
  private async generateWithLocalAI(diffSummary: string): Promise<AICommitContent> {
    if (!this.config.endpoint) {
      throw new Error('Local AI endpoint not configured');
    }

    // Test connection first
    try {
      const testResponse = await fetch(this.config.endpoint.replace('/api/generate', '/api/tags'), {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (!testResponse.ok) {
        throw new Error(`Local AI service not available: ${testResponse.statusText}`);
      }
    } catch (error) {
      throw new Error(`Cannot connect to local AI service at ${this.config.endpoint}. Please check if Ollama or your local AI is running.`);
    }

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model || 'codellama',
        prompt: CONSTANTS.AI.PROMPT.SYSTEM + '\n\n' + CONSTANTS.AI.PROMPT.USER_PREFIX + diffSummary,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 200
        }
      }),
      signal: AbortSignal.timeout(CONSTANTS.AI.TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`Local AI error: ${response.statusText}`);
    }

    const data = await response.json() as LocalAIResponse;
    const content = data.response || data.text || data.content;

    if (!content) {
      throw new Error('No content received from local AI');
    }

    return this.parseAIResponse(content);
  }

  /**
   * Enhanced rule-based commit content generation with better accuracy
   */
  private generateWithEnhancedRules(diffSummary: string): AICommitContent {
    const lines = diffSummary.toLowerCase();
    const originalSummary = diffSummary;
    
    // Initialize with defaults
    let type = 'chore';
    let scope = '';
    let message = '更新代碼';
    let confidence = 0.6;

    // Analyze file patterns and content more accurately
    const filePatterns = this.extractFilePatterns(originalSummary);
    const changeStats = this.extractChangeStats(originalSummary);
    const contentAnalysis = this.analyzeContent(lines);

    // Determine commit type based on multiple factors
    const typeAnalysis = this.determineCommitType(filePatterns, contentAnalysis, changeStats);
    type = typeAnalysis.type;
    confidence = typeAnalysis.confidence;

    // Extract scope from file patterns
    scope = this.extractScope(filePatterns);

    // Generate appropriate message
    message = this.generateMessage(type, filePatterns, changeStats, contentAnalysis);

    return {
      type,
      scope: scope || undefined,
      message,
      confidence: Math.min(confidence, 0.9) // Cap at 90% for rule-based
    };
  }

  /**
   * Extract file patterns from diff summary
   */
  private extractFilePatterns(summary: string): string[] {
    const fileMatches = summary.match(/檔案: ([^\n]+)/g) || [];
    return fileMatches.map(match => match.replace('檔案: ', '').trim());
  }

  /**
   * Extract change statistics
   */
  private extractChangeStats(summary: string): { additions: number; deletions: number; fileCount: number } {
    const additionsMatch = summary.match(/新增: \+(\d+)/g);
    const deletionsMatch = summary.match(/刪除: -(\d+)/g);
    const fileCountMatch = summary.match(/變更檔案數量: (\d+)/);

    const additions = additionsMatch ? additionsMatch.reduce((sum, match) => 
      sum + parseInt(match.match(/\d+/)?.[0] || '0'), 0) : 0;
    const deletions = deletionsMatch ? deletionsMatch.reduce((sum, match) => 
      sum + parseInt(match.match(/\d+/)?.[0] || '0'), 0) : 0;
    const fileCount = fileCountMatch ? parseInt(fileCountMatch[1]) : 0;

    return { additions, deletions, fileCount };
  }

  /**
   * Analyze content for keywords and patterns
   */
  private analyzeContent(content: string): {
    hasNewFeature: boolean;
    hasBugFix: boolean;
    hasRefactor: boolean;
    hasTests: boolean;
    hasDocs: boolean;
    hasStyles: boolean;
    hasConfig: boolean;
  } {
    return {
      hasNewFeature: /新增|add|create|implement|feature/.test(content),
      hasBugFix: /fix|bug|error|修復|錯誤|問題/.test(content),
      hasRefactor: /refactor|重構|reorganize|restructure/.test(content),
      hasTests: /test|spec|測試/.test(content),
      hasDocs: /readme|doc|文檔|說明/.test(content),
      hasStyles: /style|format|css|scss|格式/.test(content),
      hasConfig: /config|setting|package\.json|\.json|設定/.test(content)
    };
  }

  /**
   * Determine commit type based on comprehensive analysis
   */
  private determineCommitType(
    filePatterns: string[], 
    contentAnalysis: any, 
    changeStats: any
  ): { type: string; confidence: number } {
    
    // Check file types
    const hasTestFiles = filePatterns.some(f => /\.(test|spec)\.(js|ts|jsx|tsx)$/.test(f) || f.includes('/test/') || f.includes('/tests/'));
    const hasDocFiles = filePatterns.some(f => /\.(md|txt|rst)$/i.test(f) || f.toLowerCase().includes('readme'));
    const hasConfigFiles = filePatterns.some(f => /\.(json|yml|yaml|toml|ini)$/.test(f) || f.includes('config'));
    const hasStyleFiles = filePatterns.some(f => /\.(css|scss|sass|less|stylus)$/.test(f));
    const hasNewFiles = changeStats.additions > changeStats.deletions * 2;
    const hasOnlyDeletions = changeStats.additions === 0 && changeStats.deletions > 0;

    // High confidence decisions
    if (hasTestFiles && contentAnalysis.hasTests) {
      return { type: 'test', confidence: 0.9 };
    }
    
    if (hasDocFiles && contentAnalysis.hasDocs) {
      return { type: 'docs', confidence: 0.9 };
    }

    if (contentAnalysis.hasBugFix) {
      return { type: 'fix', confidence: 0.85 };
    }

    if (hasNewFiles && contentAnalysis.hasNewFeature) {
      return { type: 'feat', confidence: 0.85 };
    }

    if (contentAnalysis.hasRefactor) {
      return { type: 'refactor', confidence: 0.8 };
    }

    if (hasStyleFiles && contentAnalysis.hasStyles) {
      return { type: 'style', confidence: 0.8 };
    }

    if (hasConfigFiles || contentAnalysis.hasConfig) {
      if (filePatterns.some(f => f.includes('package.json'))) {
        return { type: 'build', confidence: 0.8 };
      }
      return { type: 'chore', confidence: 0.75 };
    }

    // Medium confidence decisions
    if (hasOnlyDeletions) {
      return { type: 'refactor', confidence: 0.7 };
    }

    if (hasNewFiles) {
      return { type: 'feat', confidence: 0.7 };
    }

    if (changeStats.fileCount === 1) {
      return { type: 'fix', confidence: 0.65 };
    }

    return { type: 'chore', confidence: 0.6 };
  }

  /**
   * Extract scope from file patterns
   */
  private extractScope(filePatterns: string[]): string {
    if (filePatterns.length === 0) return '';
    
    // Extract common directory patterns
    const dirs = filePatterns
      .map(f => f.split('/')[0])
      .filter(d => d !== 'src' && d !== '.' && d.length > 0);
    
    const uniqueDirs = [...new Set(dirs)];
    
    if (uniqueDirs.length === 1) {
      return uniqueDirs[0];
    }
    
    // If multiple directories, check for common patterns
    const commonScopes = ['components', 'services', 'utils', 'api', 'auth', 'ui', 'core'];
    const foundScope = uniqueDirs.find(dir => commonScopes.includes(dir.toLowerCase()));
    
    return foundScope || '';
  }

  /**
   * Generate appropriate commit message
   */
  private generateMessage(
    type: string, 
    filePatterns: string[], 
    changeStats: any, 
    contentAnalysis: any
  ): string {
    const fileCount = changeStats.fileCount;
    const hasMultipleFiles = fileCount > 1;
    
    // Get primary file type
    const primaryFileType = this.getPrimaryFileType(filePatterns);
    
    switch (type) {
      case 'feat':
        if (contentAnalysis.hasNewFeature) {
          return hasMultipleFiles ? '新增功能模組' : '新增功能';
        }
        return primaryFileType ? `新增${primaryFileType}功能` : '新增功能';
        
      case 'fix':
        if (contentAnalysis.hasBugFix) {
          return hasMultipleFiles ? '修復多個問題' : '修復問題';
        }
        return primaryFileType ? `修復${primaryFileType}問題` : '修復問題';
        
      case 'docs':
        return hasMultipleFiles ? '更新文檔' : '更新說明文檔';
        
      case 'test':
        return hasMultipleFiles ? '更新測試用例' : '新增測試';
        
      case 'refactor':
        return primaryFileType ? `重構${primaryFileType}代碼` : '重構代碼';
        
      case 'style':
        return '調整代碼格式';
        
      case 'build':
        if (filePatterns.some(f => f.includes('package.json'))) {
          return '更新依賴配置';
        }
        return '更新建置配置';
        
      case 'chore':
      default:
        if (primaryFileType) {
          return `更新${primaryFileType}`;
        }
        return hasMultipleFiles ? '更新多個檔案' : '更新代碼';
    }
  }

  /**
   * Get primary file type for better message generation
   */
  private getPrimaryFileType(filePatterns: string[]): string {
    if (filePatterns.length === 0) return '';
    
    const types = filePatterns.map(f => {
      const ext = f.split('.').pop()?.toLowerCase();
      const path = f.toLowerCase();
      
      if (ext === 'tsx' || ext === 'jsx' || path.includes('component')) return '組件';
      if (ext === 'ts' || ext === 'js') return 'JS';
      if (ext === 'css' || ext === 'scss' || ext === 'sass') return '樣式';
      if (ext === 'md') return '文檔';
      if (ext === 'json' || ext === 'yml' || ext === 'yaml') return '配置';
      if (path.includes('test') || path.includes('spec')) return '測試';
      if (path.includes('api') || path.includes('service')) return 'API';
      return '';
    }).filter(t => t);
    
    // Return most common type
    const typeCount = types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(typeCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || '';
  }

  /**
   * Parses AI response and extracts commit content
   */
  private parseAIResponse(response: string): AICommitContent {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: parsed.type || 'chore',
          scope: parsed.scope || undefined,
          message: parsed.message || '更新代碼',
          confidence: parsed.confidence || 0.8
        };
      }
    } catch (error) {
      console.warn('Failed to parse JSON response:', error);
    }

    // Fallback: try to extract information from plain text
    const lines = response.split('\n');
    let type = 'chore';
    let scope = '';
    let message = response.split('\n')[0] || '更新代碼';
    
    // Look for conventional commit format
    const commitMatch = response.match(/^(feat|fix|refactor|docs|style|test|chore|perf|ci|build|revert)(\([^)]+\))?: (.+)/);
    if (commitMatch) {
      type = commitMatch[1];
      scope = commitMatch[2] ? commitMatch[2].slice(1, -1) : '';
      message = commitMatch[3];
    }

    return {
      type,
      scope: scope || undefined,
      message: message.replace(/^["""''`]+|["""''`]+$/g, '').trim(),
      confidence: 0.7
    };
  }

  /**
   * Loads AI configuration from VS Code settings
   */
  private loadConfiguration(): AIConfig {
    const config = vscode.workspace.getConfiguration('yun-commit-helper.ai');
    
    return {
      provider: config.get('provider') || 'rules',
      apiKey: config.get('apiKey') || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY,
      model: config.get('model'),
      endpoint: config.get('endpoint') || 'http://localhost:11434/api/generate'
    };
  }

  /**
   * Updates AI configuration
   */
  public updateConfiguration(newConfig: Partial<AIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Tests if AI service is properly configured
   */
  public isConfigured(): boolean {
    switch (this.config.provider) {
      case 'openai':
      case 'anthropic':
      case 'gemini':
        return !!this.config.apiKey;
      case 'local':
        return !!this.config.endpoint;
      case 'rules':
      default:
        return true; // Rule-based fallback always works
    }
  }
} 