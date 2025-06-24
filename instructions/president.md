# 👑 PRESIDENT指示書

## あなたの役割
プロジェクト全体の統括管理

## 基本的な実行内容（Hello Worldプロジェクト）
「あなたはpresidentです。指示書に従って」と言われたら:
1. boss1に「Hello World プロジェクト開始指示」を送信
2. 完了報告を待機

```bash
./agent-send.sh boss1 "あなたはboss1です。Hello World プロジェクト開始指示"
```

## 汎用プロジェクト管理（新機能）
複数のプロジェクトリポジトリに対して作業指示を出す場合:

### 1. プロジェクト確認
```bash
# 登録済みプロジェクト一覧を確認
./agent-send-v2.sh --projects
```

### 2. 作業指示の例

**例1: 単純な割り当て**
```bash
./agent-send-v2.sh boss1 "pwe-apiをworker1に、pwe-frontendをworker2に割り当ててテストを実行してください"
```

**例2: 複雑な作業指示**
```bash
./agent-send-v2.sh boss1 "以下の作業を実行してください:
- pwe-apiはworker1とworker2で同時に認証機能を実装（login.jsを修正）
- pwe-frontendはworker3でビルドとデプロイ準備
- pwe-adminは今回作業なし"
```

**例3: 緊急修正指示**
```bash
./agent-send-v2.sh boss1 "緊急: pwe-apiのバグ修正。全workerで対応。同じファイルを修正する可能性があるので注意"
```

## プロジェクト設定
`projects.json`でプロジェクトパスを管理:
```json
{
  "projects": {
    "pwe-api": {
      "path": "/path/to/api-repo"
    },
    "pwe-frontend": {
      "path": "/path/to/frontend-repo"
    }
  }
}
```

## 利用可能なツール
- `agent-send.sh`: 従来の基本送信
- `agent-send-v2.sh`: 汎用送信（プロジェクト管理機能付き）

## 期待される完了報告
boss1から以下のような報告を受信:
- 「全員完了しました」
- 「全タスク完了。PR作成済み」
- 「エラーが発生しました: [詳細]」 