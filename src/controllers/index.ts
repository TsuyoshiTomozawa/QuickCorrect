/**
 * Controllers Index - コントローラーのエクスポート
 */

export { HotkeyController } from './HotkeyController';
export { ClipboardController } from './ClipboardController';
export { CorrectionController, AIProvider } from './CorrectionController';

// 統合初期化関数
export function initializeAllControllers(): void {
  console.log('QuickCorrect Controllers module loaded');
}