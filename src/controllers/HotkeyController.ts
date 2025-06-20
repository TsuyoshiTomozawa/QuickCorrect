/**
 * QuickCorrect - Hotkey Controller
 * 
 * Manages global hotkey registration and handling
 */

import { globalShortcut } from 'electron';

export class HotkeyController {
  private registeredHotkeys: Map<string, () => void> = new Map();
  
  /**
   * Register a global hotkey
   */
  registerHotkey(accelerator: string, callback: () => void): boolean {
    try {
      // Unregister if already exists
      if (this.registeredHotkeys.has(accelerator)) {
        this.unregisterHotkey(accelerator);
      }
      
      const success = globalShortcut.register(accelerator, callback);
      
      if (success) {
        this.registeredHotkeys.set(accelerator, callback);
        console.log(`Hotkey registered: ${accelerator}`);
      } else {
        console.error(`Failed to register hotkey: ${accelerator}`);
      }
      
      return success;
    } catch (error) {
      console.error('Error registering hotkey:', error);
      return false;
    }
  }
  
  /**
   * Unregister a specific hotkey
   */
  unregisterHotkey(accelerator: string): void {
    try {
      globalShortcut.unregister(accelerator);
      this.registeredHotkeys.delete(accelerator);
      console.log(`Hotkey unregistered: ${accelerator}`);
    } catch (error) {
      console.error('Error unregistering hotkey:', error);
    }
  }
  
  /**
   * Unregister all hotkeys
   */
  unregisterAll(): void {
    try {
      globalShortcut.unregisterAll();
      this.registeredHotkeys.clear();
      console.log('All hotkeys unregistered');
    } catch (error) {
      console.error('Error unregistering all hotkeys:', error);
    }
  }
  
  /**
   * Check if a hotkey is registered
   */
  isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator);
  }
  
  /**
   * Get all registered hotkeys
   */
  getRegisteredHotkeys(): string[] {
    return Array.from(this.registeredHotkeys.keys());
  }
}