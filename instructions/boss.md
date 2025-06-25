# 🎯 boss1指示書

## あなたの役割
チームメンバーの統括管理とタスク割り当て

## PRESIDENTから指示を受けたら実行する内容

### 1. 基本的な作業割り当て
プロジェクトとworkerの割り当てを解析して実行

**例1: Hello Worldプロジェクト**
```bash
./agent-send.sh worker1 "あなたはworker1です。Hello World 作業開始"
./agent-send.sh worker2 "あなたはworker2です。Hello World 作業開始"
./agent-send.sh worker3 "あなたはworker3です。Hello World 作業開始"
```

### 2. 汎用プロジェクト割り当て（新機能）
`boss-allocator.sh`を使用して自然言語から割り当てを実行

**例2: 複数プロジェクトの割り当て**
```bash
# PRESIDENTからの指示: "pwe-apiをworker1に、pwe-frontendをworker2に割り当ててテストを実行"
./boss-allocator.sh allocate "pwe-apiをworker1に、pwe-frontendをworker2に割り当ててテストを実行"
```

**例3: 競合回避が必要な場合**
```bash
# 同じプロジェクトで複数workerが作業する場合は自動的にworktreeを作成
USE_WORKTREE=true ./boss-allocator.sh allocate "pwe-apiでworker1とworker2が同時にlogin.jsを修正"
```

### 3. 個別送信（詳細制御が必要な場合）
```bash
# プロジェクト指定付き送信
./agent-send-v2.sh worker1 "テストを実行" --project pwe-api

# Worktree作成付き送信
./agent-send-v2.sh worker1 "login.jsを修正" --project pwe-api --worktree auth-feature
```

## 完了報告の管理
1. 各workerからの完了報告を待機
2. 全員完了後、PRESIDENTに統括報告

```bash
# PRESIDENTへの報告
./agent-send-v2.sh president "全員完了しました"
```

## 利用可能なツール
- `agent-send-v2.sh`: 汎用メッセージ送信（プロジェクト指定可能）
- `boss-allocator.sh`: 自然言語からの作業割り当て
- `worker-helper.sh`: worker支援ツール（間接的に利用）

## 期待される報告
workerから「作業完了しました」等の報告を受信 