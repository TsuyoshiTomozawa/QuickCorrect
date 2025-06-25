#!/bin/bash

# 🛠️ Worker用ヘルパースクリプト
# メッセージから作業ディレクトリを抽出して移動

# メッセージから作業ディレクトリを抽出
extract_work_dir() {
    local message="$1"
    # macOS互換のsedを使用
    echo "$message" | sed -n 's/.*\[作業DIR: \([^]]*\)\].*/\1/p'
}

# プロジェクトタイプをチェック
check_project_type() {
    local dir="$1"
    if [[ -d "$dir/.git" ]]; then
        echo "git"
    else
        echo "normal"
    fi
}

# Workerの作業環境セットアップ
setup_work_environment() {
    local message="$1"
    local work_dir=$(extract_work_dir "$message")
    
    if [[ -n "$work_dir" ]]; then
        echo "📁 作業ディレクトリ: $work_dir"
        
        # ディレクトリ存在確認
        if [[ ! -d "$work_dir" ]]; then
            echo "❌ エラー: ディレクトリが存在しません: $work_dir"
            return 1
        fi
        
        # ディレクトリ移動
        cd "$work_dir" || {
            echo "❌ エラー: ディレクトリに移動できません: $work_dir"
            return 1
        }
        
        # プロジェクトタイプ確認
        local proj_type=$(check_project_type "$work_dir")
        echo "📦 プロジェクトタイプ: $proj_type"
        
        if [[ "$proj_type" == "git" ]]; then
            echo "🌿 現在のブランチ: $(git branch --show-current)"
            echo "📊 ステータス:"
            git status -s
        fi
        
        # CLAUDE.mdファイルを読み込む
        if [[ -f "$work_dir/CLAUDE.md" ]]; then
            echo ""
            echo "📄 プロジェクト指示書 (CLAUDE.md) を確認中..."
            echo "------------------------"
            # CLAUDE.mdの内容を表示（最初の50行まで）
            head -n 50 "$work_dir/CLAUDE.md"
            echo ""
            echo "※ 完全な内容は $work_dir/CLAUDE.md を参照してください"
            echo "------------------------"
        else
            echo "ℹ️  このプロジェクトにCLAUDE.mdファイルはありません"
        fi
        
        echo "✅ 作業環境準備完了"
        echo "------------------------"
        return 0
    else
        echo "ℹ️  作業ディレクトリ指定なし（現在のディレクトリで作業）"
        return 0
    fi
}

# 作業完了報告ヘルパー
report_completion() {
    local worker_name="$1"
    local task_desc="$2"
    local boss_name="${3:-boss1}"
    
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $worker_name: $task_desc 完了" >> logs/worker_completion.log
    
    # agent-send-v2.shを使って報告
    if [[ -x "./agent-send-v2.sh" ]]; then
        ./agent-send-v2.sh "$boss_name" "$worker_name: $task_desc を完了しました"
    else
        echo "⚠️  agent-send-v2.sh が見つかりません"
    fi
}

# プロジェクトのデフォルトブランチを取得
get_default_branch() {
    local project_name="$1"
    local projects_file="${AGENT_SYSTEM_HOME:-$(dirname "$0")}/projects.json"
    
    if [[ -f "$projects_file" ]]; then
        jq -r ".projects.\"$project_name\".default_branch // \"main\"" "$projects_file" 2>/dev/null || echo "main"
    else
        echo "main"
    fi
}

# PR作成ヘルパー
create_pr() {
    local worker_name="$1"
    local task_desc="$2"
    local work_dir="${3:-.}"
    
    # 現在のディレクトリを保存
    local original_dir=$(pwd)
    cd "$work_dir" || {
        echo "❌ エラー: ディレクトリに移動できません: $work_dir"
        return 1
    }
    
    # Gitリポジトリか確認
    if [[ ! -d ".git" ]]; then
        echo "❌ エラー: Gitリポジトリではありません"
        cd "$original_dir"
        return 1
    fi
    
    # 現在のブランチ名を取得
    local current_branch=$(git branch --show-current)
    
    # デフォルトブランチを特定
    local project_name=$(basename "$work_dir")
    local default_branch=$(get_default_branch "$project_name")
    
    echo "📌 現在のブランチ: $current_branch"
    echo "🎯 ベースブランチ: $default_branch"
    
    # 変更があるか確認
    if [[ -z $(git status --porcelain) ]]; then
        echo "ℹ️  変更がありません。PR作成をスキップします。"
        cd "$original_dir"
        return 0
    fi
    
    # コミットされていない変更をコミット
    if [[ -n $(git status --porcelain) ]]; then
        echo "📝 変更をコミット中..."
        git add -A
        git commit -m "$worker_name: $task_desc

自動生成されたコミット by worker-helper.sh"
    fi
    
    # リモートにpush
    echo "🚀 リモートにプッシュ中..."
    git push -u origin "$current_branch" || {
        echo "❌ エラー: プッシュに失敗しました"
        cd "$original_dir"
        return 1
    }
    
    # GitHub CLIがインストールされているか確認
    if command -v gh &> /dev/null; then
        echo "🔄 Pull Request を作成中..."
        
        # PR作成
        gh pr create \
            --base "$default_branch" \
            --head "$current_branch" \
            --title "$worker_name: $task_desc" \
            --body "## 概要
$task_desc の作業を完了しました。

## 作業者
$worker_name

## 変更内容
自動生成されたPRです。詳細は変更ファイルをご確認ください。

---
*このPRは worker-helper.sh により自動作成されました*" \
            --web || {
            echo "ℹ️  PR作成がスキップされました（既に存在する可能性があります）"
        }
    else
        echo "⚠️  GitHub CLI (gh) がインストールされていません"
        echo "手動でPRを作成してください："
        echo "  - ブランチ: $current_branch → $default_branch"
        echo "  - リポジトリ: $(git remote get-url origin)"
    fi
    
    # 元のディレクトリに戻る
    cd "$original_dir"
    return 0
}

# メイン処理（直接実行時）
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "$1" in
        setup)
            setup_work_environment "$2"
            ;;
        report)
            report_completion "$2" "$3" "$4"
            ;;
        create-pr)
            create_pr "$2" "$3" "$4"
            ;;
        *)
            cat << EOF
Worker Helper Script

使用方法:
  $0 setup "[メッセージ]"         - 作業環境をセットアップ
  $0 report [worker名] [タスク説明] [boss名] - 完了報告
  $0 create-pr [worker名] [タスク説明] [作業DIR] - PR作成

例:
  $0 setup "テスト実行 [作業DIR: /path/to/project]"
  $0 report worker1 "単体テスト実行" boss1
  $0 create-pr worker1 "認証機能の実装" /path/to/project
EOF
            ;;
    esac
fi