import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { BaseComponentProps, CorrectionMode } from '../../types/interfaces';
import { getFocusShadow } from '../contexts/ThemeContext';

interface TextInputProps extends BaseComponentProps {
  value: string;
  onChange: (text: string) => void;
  onCorrect: () => void;
  isLoading: boolean;
  placeholder?: string;
  maxLength?: number;
  correctionMode: CorrectionMode;
  onModeChange: (mode: CorrectionMode) => void;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
  flex: 1;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Title = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textSubtle};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const ModeSelector = styled.div`
  display: flex;
  gap: 8px;
`;

const ModeButton = styled.button<{ $isActive: boolean }>`
  padding: 6px 16px;
  border: 1px solid ${props => props.$isActive ? props.theme.colors.accent : props.theme.colors.border};
  background: ${props => props.$isActive ? props.theme.colors.accent : 'transparent'};
  color: ${props => props.$isActive ? props.theme.colors.textInverse : props.theme.colors.text};
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$isActive ? props.theme.colors.accentHover : props.theme.colors.surfaceHover};
  }

  &:focus {
    outline: none;
    box-shadow: ${props => getFocusShadow(props.theme)};
  }

  &:focus:not(:focus-visible) {
    box-shadow: none;
  }
`;

const InputWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
`;

const TextArea = styled.textarea`
  flex: 1;
  width: 100%;
  padding: 20px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.6;
  resize: none;
  transition: all 0.2s ease;
  font-family: 'Inter', 'Noto Sans JP', inherit;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
    background: ${({ theme }) => theme.colors.surface};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSubtle};
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: ${({ theme }) => theme.colors.surface};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const CharacterCount = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSubtle};
`;

const CorrectButton = styled(motion.button)<{ $disabled: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: ${props => props.$disabled ? props.theme.colors.border : props.theme.colors.accent};
  color: ${({ theme }) => theme.colors.textInverse};
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$disabled ? props.theme.colors.border : props.theme.colors.accentHover};
    transform: ${props => props.$disabled ? 'none' : 'translateY(-1px)'};
  }
`;

const LoadingDot = styled(motion.span)`
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
`;

const HintText = styled(motion.div)`
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
`;

const MODE_LABELS: Record<CorrectionMode, string> = {
  business: 'ビジネス',
  academic: '学術',
  casual: 'カジュアル',
  presentation: 'プレゼン'
};

const MODE_DESCRIPTIONS: Record<CorrectionMode, string> = {
  business: '丁寧で正式なビジネス文書',
  academic: '厳密で客観的な学術文書',
  casual: '親しみやすい日常会話',
  presentation: '聴衆に伝わりやすい発表原稿'
};

export const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  onCorrect,
  isLoading,
  placeholder = 'テキストを入力するか、Ctrl+T で選択したテキストを読み込んでください...',
  maxLength = 5000,
  correctionMode,
  onModeChange,
  className,
  style
}) => {
  const [showHint, setShowHint] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (value && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      if (!isLoading && value.trim()) {
        onCorrect();
      }
    }
  };

  const characterPercentage = (value.length / maxLength) * 100;
  const isNearLimit = characterPercentage > 90;

  return (
    <Container className={className} style={style}>
      <Header>
        <Title>入力テキスト</Title>
        <ModeSelector>
          {(Object.keys(MODE_LABELS) as CorrectionMode[]).map(mode => (
            <ModeButton
              key={mode}
              $isActive={correctionMode === mode}
              onClick={() => onModeChange(mode)}
              title={MODE_DESCRIPTIONS[mode]}
            >
              {MODE_LABELS[mode]}
            </ModeButton>
          ))}
        </ModeSelector>
      </Header>

      <InputWrapper>
        <TextArea
          ref={textAreaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={isLoading}
        />
      </InputWrapper>

      <Footer>
        <CharacterCount>
          <span style={{ color: isNearLimit ? '#dc3545' : 'inherit' }}>
            {value.length.toLocaleString()} / {maxLength.toLocaleString()}
          </span>
          {value.length > 0 && (
            <span style={{ fontSize: '11px', color: '#adb5bd' }}>
              （約{Math.ceil(value.length / 400)}分）
            </span>
          )}
        </CharacterCount>

        <CorrectButton
          $disabled={isLoading || !value.trim()}
          onClick={() => onCorrect()}
          onMouseEnter={() => setShowHint(true)}
          onMouseLeave={() => setShowHint(false)}
          whileHover={{ scale: isLoading || !value.trim() ? 1 : 1.02 }}
          whileTap={{ scale: isLoading || !value.trim() ? 1 : 0.98 }}
        >
          {isLoading ? (
            <>
              <span>添削中</span>
              <motion.div style={{ display: 'flex', gap: '4px' }}>
                <LoadingDot
                  animate={{ y: [-2, 2, -2] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                />
                <LoadingDot
                  animate={{ y: [-2, 2, -2] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                />
                <LoadingDot
                  animate={{ y: [-2, 2, -2] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                />
              </motion.div>
            </>
          ) : (
            <>
              <span>添削実行</span>
              <span style={{ fontSize: '11px', opacity: 0.8 }}>Ctrl+Enter</span>
            </>
          )}
        </CorrectButton>
      </Footer>

      <AnimatePresence>
        {showHint && !isLoading && value.trim() && (
          <HintText
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            Ctrl+Enter でも実行できます
          </HintText>
        )}
      </AnimatePresence>
    </Container>
  );
};