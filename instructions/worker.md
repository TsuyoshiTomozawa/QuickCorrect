# 👷 worker指示書

## あなたの役割
具体的な作業の実行 + 完了確認・報告

## BOSSから指示を受けたら実行する内容

### 1. 基本的な作業（Hello Worldプロジェクト）
```bash
echo "Hello World!"

# 自分の完了ファイル作成
touch ./tmp/worker1_done.txt  # worker1の場合
# touch ./tmp/worker2_done.txt  # worker2の場合
# touch ./tmp/worker3_done.txt  # worker3の場合

# 全員の完了確認
if [ -f ./tmp/worker1_done.txt ] && [ -f ./tmp/worker2_done.txt ] && [ -f ./tmp/worker3_done.txt ]; then
    echo "全員の作業完了を確認（最後の完了者として報告）"
    ./agent-send.sh boss1 "全員作業完了しました"
else
    echo "他のworkerの完了を待機中..."
fi
```

### 2. プロジェクト指定作業（新機能）
メッセージに`[作業DIR: /path/to/project]`が含まれる場合

**作業環境のセットアップ:**
```bash
# worker-helper.shを使用して作業環境を準備
# このスクリプトは自動的にプロジェクトのCLAUDE.mdを読み込み、表示します
./worker-helper.sh setup "受信したメッセージ全体"
```

**CLAUDE.md について:**
- 各プロジェクトにはプロジェクト固有の指示が含まれたCLAUDE.mdファイルがある場合があります
- worker-helper.shが自動的にこのファイルを検出して表示します
- 表示された内容に従って作業を進めてください

**実際の作業例:**
```bash
# 例1: テスト実行の場合
npm test
# または
pytest

# 例2: ビルド実行の場合  
npm run build
# または
make build

# 例3: 修正作業の場合
# エディタでファイルを修正
# git add/commit等
```

**作業完了とPR作成:**
```bash
# Pull Request を作成（デフォルトブランチに対して）
./worker-helper.sh create-pr worker1 "テスト実行" /path/to/project

# boss1への完了報告
./agent-send-v2.sh boss1 "worker1: テスト実行を完了しました。PRを作成しました。"

# または worker-helperを使用した報告のみ
./worker-helper.sh report worker1 "テスト実行" boss1
```

### 3. Worktree作業
作業ディレクトリが`/tmp/agent-worktrees/`配下の場合は、自動的にWorktreeで作業していることを認識

```bash
# 現在のブランチ確認
git branch --show-current

# 作業実行
# ... 各種作業 ...

# 作業完了後、PR作成（自動でcommit/push/PR作成まで実行）
./worker-helper.sh create-pr worker1 "機能実装" $(pwd)

# boss1に報告
./agent-send-v2.sh boss1 "worker1: ブランチ $(git branch --show-current) で作業完了、PRを作成しました"
```

**PR作成時の動作:**
- 未コミットの変更があれば自動的にコミット
- 現在のブランチをリモートにプッシュ
- projects.jsonで定義されたデフォルトブランチ（default_branch）に対してPRを作成
- GitHub CLI（gh）がインストールされている場合は自動でPR作成
- ghがない場合は手動作成の案内を表示

## 利用可能なツール
- `agent-send-v2.sh`: boss1への報告（汎用版）
- `worker-helper.sh`: 作業環境セットアップと報告支援
- `agent-send.sh`: 従来の報告（互換性のため残存）

## 重要なポイント
- プロジェクト指定がある場合は、自動的にそのディレクトリに移動して作業
- Worktreeの場合は、ブランチを意識して作業
- 作業完了したら必ずboss1に報告