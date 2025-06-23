/**
 * HotkeyInput - Hotkey input component
 * 
 * Allows users to set custom keyboard shortcuts by capturing key combinations
 */

import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';

// Styled components
const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: #333;
  min-width: 100px;
`;

const InputWrapper = styled.div`
  position: relative;
  flex: 1;
`;

const Input = styled.input<{ isRecording: boolean; hasError: boolean }>`
  width: 100%;
  padding: 8px 12px;
  border: 2px solid ${props => props.hasError ? '#dc3545' : props.isRecording ? '#007bff' : '#ddd'};
  border-radius: 4px;
  font-size: 14px;
  background-color: ${props => props.isRecording ? '#f0f8ff' : '#fff'};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: ${props => props.hasError ? '#dc3545' : '#007bff'};
  }
  
  &:hover {
    border-color: ${props => props.hasError ? '#dc3545' : '#999'};
  }
`;

const Button = styled.button`
  padding: 8px 16px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: #5a6268;
  }
  
  &:active {
    background-color: #545b62;
  }
`;

const ErrorMessage = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  font-size: 12px;
  color: #dc3545;
`;

const HintMessage = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  font-size: 12px;
  color: #6c757d;
`;

// Props interface
interface HotkeyInputProps {
  value: string;
  onChange: (hotkey: string) => void;
  onValidate?: (isValid: boolean, error?: string) => void;
  label?: string;
  placeholder?: string;
}

// Common OS shortcuts that should be avoided
const RESERVED_SHORTCUTS = [
  'CommandOrControl+C',
  'CommandOrControl+V',
  'CommandOrControl+X',
  'CommandOrControl+A',
  'CommandOrControl+Z',
  'CommandOrControl+S',
  'CommandOrControl+O',
  'CommandOrControl+P',
  'CommandOrControl+Q',
  'CommandOrControl+W',
  'CommandOrControl+Tab',
  'Alt+Tab',
  'Alt+F4',
  'CommandOrControl+Shift+Esc'
];

export const HotkeyInput: React.FC<HotkeyInputProps> = ({
  value,
  onChange,
  onValidate,
  label = 'ホットキー',
  placeholder = 'クリックして新しいホットキーを入力'
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const [error, setError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Update display value when prop changes
  useEffect(() => {
    setDisplayValue(formatHotkey(value));
  }, [value]);

  // Get platform
  const platform = window.electronAPI?.platform || 'darwin';
  
  // Format hotkey for display
  const formatHotkey = (hotkey: string): string => {
    if (!hotkey) return '';
    
    // Convert platform-specific modifiers
    return hotkey
      .replace('CommandOrControl', platform === 'darwin' ? '⌘' : 'Ctrl')
      .replace('Command', '⌘')
      .replace('Control', 'Ctrl')
      .replace('Alt', platform === 'darwin' ? '⌥' : 'Alt')
      .replace('Shift', '⇧')
      .replace('Plus', '+')
      .replace('Space', 'Space')
      .replace(/\+/g, ' + ');
  };

  // Validate hotkey
  const validateHotkey = (hotkey: string): { isValid: boolean; error?: string } => {
    if (!hotkey) {
      return { isValid: false, error: 'ホットキーを設定してください' };
    }

    // Check if it has at least one modifier
    const hasModifier = hotkey.includes('CommandOrControl') || 
                       hotkey.includes('Command') || 
                       hotkey.includes('Control') || 
                       hotkey.includes('Alt');
    
    if (!hasModifier) {
      return { isValid: false, error: '修飾キー（Cmd/Ctrl/Alt）が必要です' };
    }

    // Check if it has a regular key
    const parts = hotkey.split('+');
    const hasRegularKey = parts.length > 1 && parts[parts.length - 1].length > 0;
    
    if (!hasRegularKey) {
      return { isValid: false, error: '通常のキーも含めてください' };
    }

    // Check against reserved shortcuts
    if (RESERVED_SHORTCUTS.includes(hotkey)) {
      return { isValid: false, error: 'このショートカットは予約されています' };
    }

    return { isValid: true };
  };

  // Handle key down event
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isRecording) return;

    e.preventDefault();
    e.stopPropagation();

    const keys: string[] = [];

    // Detect modifiers
    if (e.metaKey || e.ctrlKey) {
      keys.push('CommandOrControl');
    } else if (e.altKey) {
      keys.push('Alt');
    }
    
    if (e.shiftKey) {
      keys.push('Shift');
    }

    // Detect regular key
    const key = e.key;
    if (key && !['Control', 'Meta', 'Alt', 'Shift'].includes(key)) {
      // Special key mappings
      let mappedKey = key;
      if (key === ' ') mappedKey = 'Space';
      else if (key === 'ArrowUp') mappedKey = 'Up';
      else if (key === 'ArrowDown') mappedKey = 'Down';
      else if (key === 'ArrowLeft') mappedKey = 'Left';
      else if (key === 'ArrowRight') mappedKey = 'Right';
      else if (key === 'Escape') mappedKey = 'Esc';
      else if (key.length === 1) mappedKey = key.toUpperCase();
      
      keys.push(mappedKey);
    }

    // Build hotkey string
    if (keys.length > 1 || (keys.length === 1 && keys[0] !== 'CommandOrControl' && keys[0] !== 'Alt' && keys[0] !== 'Shift')) {
      const hotkey = keys.join('+');
      const validation = validateHotkey(hotkey);
      
      if (validation.isValid) {
        onChange(hotkey);
        setError('');
        onValidate?.(true);
      } else {
        setError(validation.error || '');
        onValidate?.(false, validation.error);
      }
      
      setIsRecording(false);
    }
  };

  // Handle input click
  const handleClick = () => {
    setIsRecording(true);
    setError('');
    inputRef.current?.focus();
  };

  // Handle blur
  const handleBlur = () => {
    setTimeout(() => {
      setIsRecording(false);
    }, 200);
  };

  // Reset to default
  const handleReset = () => {
    const defaultHotkey = 'CommandOrControl+T';
    onChange(defaultHotkey);
    setError('');
    onValidate?.(true);
  };

  return (
    <Container>
      <Label>{label}:</Label>
      <InputWrapper>
        <Input
          ref={inputRef}
          type="text"
          value={isRecording ? 'キーを押してください...' : displayValue}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          readOnly
          isRecording={isRecording}
          hasError={!!error}
          placeholder={placeholder}
        />
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {isRecording && !error && (
          <HintMessage>修飾キー（{platform === 'darwin' ? 'Cmd' : 'Ctrl'}/Alt/Shift）と通常のキーを組み合わせてください</HintMessage>
        )}
      </InputWrapper>
      <Button onClick={handleReset}>デフォルト</Button>
    </Container>
  );
};

export default HotkeyInput;