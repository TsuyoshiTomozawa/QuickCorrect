#!/bin/bash

# 🎯 Boss用タスク割り当てヘルパー
# 自然言語の指示から作業割り当てを解析・実行

# プロジェクト設定ファイル
PROJECTS_FILE="${AGENT_SYSTEM_HOME:-$(dirname "$0")}/projects.json"

# 指示から作業割り当てを解析
parse_allocation() {
    local instruction="$1"
    
    # 簡易的なパターンマッチング
    # 例: "pwe-apiをworker1に、pwe-frontendをworker2に"
    
    local allocations=()
    
    # パターン1: "XXXをworkerNに"
    while [[ "$instruction" =~ ([a-zA-Z0-9-]+)を(worker[0-9]+)に ]]; do
        local project="${BASH_REMATCH[1]}"
        local worker="${BASH_REMATCH[2]}"
        allocations+=("$project:$worker")
        # マッチした部分を削除して次を探す
        instruction="${instruction/${BASH_REMATCH[0]}/}"
    done
    
    # パターン2: "workerNはXXXで"
    while [[ "$instruction" =~ (worker[0-9]+)は([a-zA-Z0-9-]+)で ]]; do
        local worker="${BASH_REMATCH[1]}"
        local project="${BASH_REMATCH[2]}"
        allocations+=("$project:$worker")
        instruction="${instruction/${BASH_REMATCH[0]}/}"
    done
    
    printf '%s\n' "${allocations[@]}"
}

# タスクタイプを判定
detect_task_type() {
    local instruction="$1"
    
    # キーワードベースでタスクを判定
    if [[ "$instruction" =~ (テスト|test|単体テスト|統合テスト) ]]; then
        echo "test"
    elif [[ "$instruction" =~ (ビルド|build|コンパイル) ]]; then
        echo "build"
    elif [[ "$instruction" =~ (デプロイ|deploy|リリース) ]]; then
        echo "deploy"
    elif [[ "$instruction" =~ (修正|fix|実装|implement) ]]; then
        echo "develop"
    else
        echo "general"
    fi
}

# 競合可能性をチェック
check_conflict_possibility() {
    local instruction="$1"
    local allocations=("$@")
    
    # 同じプロジェクトに複数のworkerが割り当てられているか
    local projects=()
    for allocation in "${allocations[@]:1}"; do
        local project="${allocation%%:*}"
        if [[ " ${projects[@]} " =~ " $project " ]]; then
            # 同じプロジェクトに複数worker → 競合可能性あり
            return 0
        fi
        projects+=("$project")
    done
    
    # 特定のキーワードがある場合も競合可能性あり
    if [[ "$instruction" =~ (同じファイル|同時に修正|並行して編集) ]]; then
        return 0
    fi
    
    return 1
}

# 作業割り当て実行
execute_allocation() {
    local instruction="$1"
    local use_worktree="$2"
    
    echo "📋 作業割り当て分析中..."
    
    # 割り当て解析
    local allocations
    mapfile -t allocations < <(parse_allocation "$instruction")
    
    if [[ ${#allocations[@]} -eq 0 ]]; then
        echo "⚠️  明確な割り当て指示が見つかりません"
        return 1
    fi
    
    echo "🎯 検出された割り当て:"
    for allocation in "${allocations[@]}"; do
        echo "   $allocation"
    done
    
    # タスクタイプ判定
    local task_type=$(detect_task_type "$instruction")
    echo "📝 タスクタイプ: $task_type"
    
    # 競合チェック
    if check_conflict_possibility "$instruction" "${allocations[@]}"; then
        echo "⚠️  競合の可能性を検出 → Worktreeを使用します"
        use_worktree="true"
    fi
    
    # 各割り当てを実行
    for allocation in "${allocations[@]}"; do
        local project="${allocation%%:*}"
        local worker="${allocation##*:}"
        
        echo ""
        echo "🚀 $worker を $project に割り当て中..."
        
        # メッセージ構築
        local message="プロジェクト:$project でタスクを実行してください"
        
        # コマンド構築
        local cmd="./agent-send-v2.sh $worker \"$message\" --project $project"
        
        if [[ "$use_worktree" == "true" ]]; then
            local branch_suffix="${task_type}-$(date +%Y%m%d-%H%M%S)"
            cmd+=" --worktree $branch_suffix"
        fi
        
        echo "実行: $cmd"
        eval "$cmd"
    done
    
    echo ""
    echo "✅ 全ての割り当てが完了しました"
}

# Boss用の統合レポート生成
generate_report() {
    local report_file="logs/boss_report_$(date +%Y%m%d-%H%M%S).txt"
    mkdir -p logs
    
    cat > "$report_file" << EOF
=== Boss Task Allocation Report ===
Date: $(date)

Active Workers:
EOF
    
    # 各workerの状態を確認（簡易版）
    for i in {1..3}; do
        echo "- worker$i: [状態確認中...]" >> "$report_file"
    done
    
    echo ""
    echo "📊 レポート生成: $report_file"
}

# メイン処理
main() {
    case "$1" in
        allocate)
            shift
            execute_allocation "$*" "${USE_WORKTREE:-false}"
            ;;
        report)
            generate_report
            ;;
        *)
            cat << EOF
Boss Allocator - タスク割り当てヘルパー

使用方法:
  $0 allocate "割り当て指示"
  $0 report

環境変数:
  USE_WORKTREE=true  - 常にWorktreeを使用

例:
  $0 allocate "pwe-apiをworker1に、pwe-frontendをworker2に割り当ててテストを実行"
  $0 allocate "worker1はpwe-apiで、worker2はpwe-frontendでビルドを実行"
  
  USE_WORKTREE=true $0 allocate "全員同じファイルを修正"
EOF
            ;;
    esac
}

main "$@"