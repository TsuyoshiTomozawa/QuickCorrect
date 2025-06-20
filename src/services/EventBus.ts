/**
 * EventBus - 中央イベント管理システム
 * 
 * アプリケーション全体のイベントを管理し、
 * コントローラー間の通信を円滑にする
 */

import { EventEmitter } from 'events';
import { 
  CorrectionResult, 
  CorrectionMode, 
  ErrorCode,
  AppError 
} from '../types/interfaces';

// イベントタイプの定義
export enum EventType {
  // ホットキーイベント
  HOTKEY_PRESSED = 'hotkey:pressed',
  HOTKEY_REGISTERED = 'hotkey:registered',
  HOTKEY_UNREGISTERED = 'hotkey:unregistered',
  HOTKEY_ERROR = 'hotkey:error',
  
  // テキスト選択イベント
  TEXT_SELECTED = 'text:selected',
  TEXT_SELECTION_FAILED = 'text:selection-failed',
  
  // 添削イベント
  CORRECTION_STARTED = 'correction:started',
  CORRECTION_COMPLETED = 'correction:completed',
  CORRECTION_FAILED = 'correction:failed',
  CORRECTION_PROGRESS = 'correction:progress',
  
  // クリップボードイベント
  CLIPBOARD_COPIED = 'clipboard:copied',
  CLIPBOARD_COPY_FAILED = 'clipboard:copy-failed',
  CLIPBOARD_CHANGED = 'clipboard:changed',
  
  // ウィンドウイベント
  WINDOW_SHOW = 'window:show',
  WINDOW_HIDE = 'window:hide',
  WINDOW_FOCUS = 'window:focus',
  WINDOW_BLUR = 'window:blur',
  
  // 設定イベント
  SETTINGS_CHANGED = 'settings:changed',
  SETTINGS_LOADED = 'settings:loaded',
  SETTINGS_SAVED = 'settings:saved',
  
  // システムイベント
  SYSTEM_READY = 'system:ready',
  SYSTEM_ERROR = 'system:error',
  SYSTEM_SHUTDOWN = 'system:shutdown',
  
  // 統計イベント
  STATS_UPDATED = 'stats:updated',
  USAGE_RECORDED = 'usage:recorded'
}

// イベントペイロードの型定義
export interface EventPayloads {
  [EventType.HOTKEY_PRESSED]: {
    hotkey: string;
    timestamp: Date;
  };
  [EventType.TEXT_SELECTED]: {
    text: string;
    source: 'hotkey' | 'manual' | 'clipboard';
    timestamp: Date;
  };
  [EventType.CORRECTION_STARTED]: {
    text: string;
    mode: CorrectionMode;
    requestId: string;
  };
  [EventType.CORRECTION_COMPLETED]: {
    result: CorrectionResult;
    requestId: string;
    duration: number;
  };
  [EventType.CORRECTION_FAILED]: {
    error: AppError;
    requestId: string;
    text: string;
  };
  [EventType.CLIPBOARD_COPIED]: {
    text: string;
    format: 'plain' | 'rich';
    timestamp: Date;
  };
  [EventType.SYSTEM_ERROR]: {
    error: AppError;
    context?: any;
  };
}

export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private eventHistory: Array<{
    type: EventType;
    payload: any;
    timestamp: Date;
  }> = [];
  private readonly maxHistorySize = 1000;
  
  private constructor() {
    super();
    this.setMaxListeners(50); // 多くのリスナーに対応
  }
  
  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  
  /**
   * 型安全なイベント発行
   */
  emit<T extends EventType>(
    event: T,
    payload: T extends keyof EventPayloads ? EventPayloads[T] : any
  ): boolean {
    // イベント履歴に記録
    this.recordEvent(event, payload);
    
    // ログ出力（開発環境）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[EventBus] ${event}`, payload);
    }
    
    return super.emit(event, payload);
  }
  
  /**
   * 型安全なイベントリスナー登録
   */
  on<T extends EventType>(
    event: T,
    listener: (payload: T extends keyof EventPayloads ? EventPayloads[T] : any) => void
  ): this {
    return super.on(event, listener);
  }
  
  /**
   * 型安全な一度だけのイベントリスナー
   */
  once<T extends EventType>(
    event: T,
    listener: (payload: T extends keyof EventPayloads ? EventPayloads[T] : any) => void
  ): this {
    return super.once(event, listener);
  }
  
  /**
   * イベントを履歴に記録
   */
  private recordEvent(type: EventType, payload: any): void {
    this.eventHistory.push({
      type,
      payload,
      timestamp: new Date()
    });
    
    // 履歴サイズの制限
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }
  
  /**
   * イベント履歴を取得
   */
  getEventHistory(type?: EventType, limit: number = 100): any[] {
    let history = this.eventHistory;
    
    if (type) {
      history = history.filter(event => event.type === type);
    }
    
    return history.slice(-limit);
  }
  
  /**
   * イベント統計を取得
   */
  getEventStatistics(): Map<EventType, number> {
    const stats = new Map<EventType, number>();
    
    this.eventHistory.forEach(event => {
      const count = stats.get(event.type) || 0;
      stats.set(event.type, count + 1);
    });
    
    return stats;
  }
  
  /**
   * 特定のイベントタイプのリスナー数を取得
   */
  getListenerCount(event: EventType): number {
    return this.listenerCount(event);
  }
  
  /**
   * イベント履歴をクリア
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
  
  /**
   * 全てのイベントリスナーを削除
   */
  removeAllListeners(event?: EventType): this {
    if (event) {
      return super.removeAllListeners(event);
    }
    return super.removeAllListeners();
  }
  
  /**
   * デバッグ情報を出力
   */
  debug(): void {
    console.log('=== EventBus Debug Info ===');
    console.log('Active Events:', this.eventNames());
    console.log('Event Statistics:', this.getEventStatistics());
    console.log('Recent Events:', this.getEventHistory(undefined, 10));
    console.log('==========================');
  }
}

// グローバルイベントバスのエクスポート
export const eventBus = EventBus.getInstance();