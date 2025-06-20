/**
 * Controllers Module
 * 
 * QuickCorrectのController層をエクスポート
 */

export { HotkeyController, hotkeyController, HotkeyEvent } from './HotkeyController';
export { ClipboardController, clipboardController, ClipboardEvent, ClipboardOptions } from './ClipboardController';
export { CorrectionController, correctionController, CorrectionRequest, CorrectionOptions, AIProviderInterface } from './CorrectionController';

// 全コントローラーの初期化関数
export function initializeControllers(): void {
  // 各コントローラーは既にシングルトンとして初期化済み
  // 必要に応じて追加の初期化処理をここに記述
  
  console.log('QuickCorrect Controllers initialized');
}

// 全コントローラーのクリーンアップ関数
export function cleanupControllers(): void {
  hotkeyController.destroy();
  clipboardController.destroy();
  correctionController.destroy();
  
  console.log('QuickCorrect Controllers cleaned up');
}