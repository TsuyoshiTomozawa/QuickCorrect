/**
 * QuickCorrect - Clipboard Controller
 * 
 * Handles clipboard operations including getting selected text and copying text
 */

import { clipboard } from 'electron';

export class ClipboardController {
  /**
   * Get currently selected text from clipboard
   */
  async getSelectedText(): Promise<string> {
    try {
      // First, clear the clipboard to ensure we get fresh selection
      const originalClipboard = clipboard.readText();
      
      // TODO: Implement system-specific keyboard simulation to copy selected text
      // For now, return current clipboard content
      return clipboard.readText();
    } catch (error) {
      console.error('Error getting selected text:', error);
      return '';
    }
  }
  
  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  }
  
  /**
   * Get current clipboard text
   */
  async getClipboardText(): Promise<string> {
    try {
      return clipboard.readText();
    } catch (error) {
      console.error('Error reading clipboard:', error);
      return '';
    }
  }
}