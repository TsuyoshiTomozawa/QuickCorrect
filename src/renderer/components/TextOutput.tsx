import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { BaseComponentProps, CorrectionResult } from '../../types/interfaces';
import { getFocusShadow } from '../contexts/ThemeContext';

interface TextOutputProps extends BaseComponentProps {
  correctionResult: CorrectionResult | null;
  isLoading: boolean;
  error: string | null;
  onCopy?: () => void;
  onApplyToInput?: () => void;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 8px;
  margin: 8px;
  box-shadow: 0 2px 10px ${({ theme }) => theme.colors.shadow};
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const StatusBadge = styled.div<{ $type: 'success' | 'loading' | 'error' | 'idle' }>`
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => {
    const opacity = props.theme.mode === 'dark' ? '33' : '1A'; // 20% and 10% in hex
    switch (props.$type) {
      case 'success': return `${props.theme.colors.success}${opacity}`;
      case 'loading': return `${props.theme.colors.accent}${opacity}`;
      case 'error': return `${props.theme.colors.error}${opacity}`;
      default: return props.theme.colors.borderSubtle;
    }
  }};
  color: ${props => {
    switch (props.$type) {
      case 'success': return props.theme.colors.success;
      case 'loading': return props.theme.colors.accent;
      case 'error': return props.theme.colors.error;
      default: return props.theme.colors.textSubtle;
    }
  }};
`;

const ContentWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ResultArea = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  position: relative;
`;

const TextDisplay = styled.div`
  font-size: 16px;
  line-height: 1.8;
  color: ${({ theme }) => theme.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
`;

const LoadingContainer = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 20px;
`;

const LoadingSpinner = styled(motion.div)`
  width: 40px;
  height: 40px;
  border: 3px solid ${({ theme }) => theme.colors.borderSubtle};
  border-top: 3px solid ${({ theme }) => theme.colors.accent};
  border-radius: 50%;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${({ theme }) => theme.colors.textSubtle};
  text-align: center;
  padding: 40px;
`;

const ErrorContainer = styled(motion.div)`
  background: ${({ theme }) => `${theme.colors.error}${theme.mode === 'dark' ? '33' : '1A'}`};
  color: ${({ theme }) => theme.colors.error};
  padding: 16px;
  border-radius: 6px;
  margin: 20px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const MetaInfo = styled.div`
  display: flex;
  gap: 20px;
  padding: 12px 20px;
  background: ${({ theme }) => theme.colors.surface};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSubtle};
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ActionBar = styled.div`
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  background: ${({ theme }) => theme.colors.surface};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const ActionButton = styled(motion.button)`
  flex: 1;
  padding: 10px 16px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
    border-color: ${({ theme }) => theme.colors.borderSubtle};
  }

  &:active {
    background: ${({ theme }) => theme.colors.borderSubtle};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
    box-shadow: ${({ theme }) => getFocusShadow(theme)};
  }

  &:focus:not(:focus-visible) {
    box-shadow: none;
  }
`;

const CopyConfirmation = styled(motion.div)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: ${({ theme }) => theme.colors.success};
  color: ${({ theme }) => theme.colors.textInverse};
  padding: 16px 32px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  pointer-events: none;
  z-index: 10;
`;

const ChangesPanel = styled(motion.div)`
  background: ${({ theme }) => theme.colors.surfaceHover};
  border-radius: 6px;
  padding: 16px;
  margin-top: 20px;
`;

const ChangeItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 4px;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const ChangeText = styled.div`
  display: flex;
  gap: 12px;
  font-size: 14px;
`;

const OriginalText = styled.span`
  color: ${({ theme }) => theme.colors.error};
  text-decoration: line-through;
  opacity: 0.8;
`;

const CorrectedText = styled.span`
  color: ${({ theme }) => theme.colors.success};
  font-weight: 500;
`;

const ChangeReason = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSubtle};
  padding-left: 12px;
`;

export const TextOutput: React.FC<TextOutputProps> = ({
  correctionResult,
  isLoading,
  error,
  onCopy,
  onApplyToInput,
  className,
  style
}) => {
  const [showCopyConfirmation, setShowCopyConfirmation] = useState(false);
  const [showChanges, setShowChanges] = useState(false);

  useEffect(() => {
    if (correctionResult && window.electronAPI) {
      window.electronAPI.copyToClipboard(correctionResult.text);
      setShowCopyConfirmation(true);
      setTimeout(() => setShowCopyConfirmation(false), 2000);
    }
  }, [correctionResult]);

  const handleCopy = async () => {
    if (correctionResult && window.electronAPI) {
      await window.electronAPI.copyToClipboard(correctionResult.text);
      setShowCopyConfirmation(true);
      setTimeout(() => setShowCopyConfirmation(false), 2000);
    }
    onCopy?.();
  };

  const getStatus = () => {
    if (isLoading) return 'loading';
    if (error) return 'error';
    if (correctionResult) return 'success';
    return 'idle';
  };

  const getStatusText = () => {
    if (isLoading) return 'AIが添削中...';
    if (error) return 'エラー';
    if (correctionResult) return '添削完了';
    return '待機中';
  };

  return (
    <Container className={className} style={style}>
      <Header>
        <Title>添削結果</Title>
        <StatusBadge $type={getStatus()}>
          {getStatusText()}
        </StatusBadge>
      </Header>

      <ContentWrapper>
        <ResultArea>
          <AnimatePresence mode="wait">
            {isLoading && (
              <LoadingContainer
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <LoadingSpinner
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <div style={{ color: '#6c757d' }}>
                  <div>AIが文章を添削しています...</div>
                  <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>
                    通常10〜30秒かかります
                  </div>
                </div>
              </LoadingContainer>
            )}

            {error && !isLoading && (
              <ErrorContainer
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <span>❌</span>
                <div>
                  <div style={{ fontWeight: 500 }}>エラーが発生しました</div>
                  <div style={{ fontSize: '14px', marginTop: '4px' }}>{error}</div>
                </div>
              </ErrorContainer>
            )}

            {correctionResult && !isLoading && !error && (
              <motion.div
                key="result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <TextDisplay>{correctionResult.text}</TextDisplay>

                {correctionResult.changes.length > 0 && (
                  <ChangesPanel>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}
                    >
                      <div style={{ fontWeight: 500, color: '#495057' }}>
                        変更箇所 ({correctionResult.changes.length}件)
                      </div>
                      <button
                        onClick={() => setShowChanges(!showChanges)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#007bff',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        {showChanges ? '閉じる' : '詳細を表示'}
                      </button>
                    </div>

                    <AnimatePresence>
                      {showChanges && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          {correctionResult.changes.map((change, index) => (
                            <ChangeItem key={index}>
                              <ChangeText>
                                <OriginalText>{change.original}</OriginalText>
                                <span>→</span>
                                <CorrectedText>{change.corrected}</CorrectedText>
                              </ChangeText>
                              <ChangeReason>{change.reason}</ChangeReason>
                            </ChangeItem>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </ChangesPanel>
                )}
              </motion.div>
            )}

            {!correctionResult && !isLoading && !error && (
              <EmptyState key="empty">
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                <div style={{ fontSize: '16px', fontWeight: 500 }}>
                  添削結果がここに表示されます
                </div>
                <div style={{ fontSize: '14px', marginTop: '8px' }}>
                  左側にテキストを入力して「添削実行」をクリックしてください
                </div>
              </EmptyState>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showCopyConfirmation && (
              <CopyConfirmation
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                ✓ クリップボードにコピーしました
              </CopyConfirmation>
            )}
          </AnimatePresence>
        </ResultArea>

        {correctionResult && (
          <>
            <MetaInfo>
              <MetaItem>
                <span>🤖</span>
                <span>{correctionResult.model}</span>
              </MetaItem>
              <MetaItem>
                <span>⚡</span>
                <span>{(correctionResult.processingTime / 1000).toFixed(1)}秒</span>
              </MetaItem>
              <MetaItem>
                <span>📊</span>
                <span>信頼度: {Math.round(correctionResult.confidence * 100)}%</span>
              </MetaItem>
              {correctionResult.explanation && (
                <MetaItem>
                  <span>💡</span>
                  <span>説明あり</span>
                </MetaItem>
              )}
            </MetaInfo>

            <ActionBar>
              <ActionButton
                onClick={handleCopy}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span>📋</span>
                <span>再度コピー</span>
              </ActionButton>
              {onApplyToInput && (
                <ActionButton
                  onClick={onApplyToInput}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span>↩️</span>
                  <span>入力欄に戻す</span>
                </ActionButton>
              )}
            </ActionBar>
          </>
        )}
      </ContentWrapper>
    </Container>
  );
};