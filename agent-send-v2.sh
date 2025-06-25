#!/bin/bash

# 🚀 汎用Agent間メッセージ送信スクリプト v2

# プロジェクト設定ファイル
PROJECTS_FILE="${AGENT_SYSTEM_HOME:-$(dirname "$0")}/projects.json"

# エージェント→tmuxターゲット マッピング
get_agent_target() {
    case "$1" in
        "president") echo "president" ;;
        "boss1") echo "multiagent:0.0" ;;
        "worker1") echo "multiagent:0.1" ;;
        "worker2") echo "multiagent:0.2" ;;
        "worker3") echo "multiagent:0.3" ;;
        *) echo "" ;;
    esac
}

# プロジェクト情報取得
get_project_path() {
    local project="$1"
    if [[ ! -f "$PROJECTS_FILE" ]]; then
        echo ""
        return
    fi
    jq -r ".projects.\"$project\".path // empty" "$PROJECTS_FILE" 2>/dev/null
}

# Worktree作成
create_worktree() {
    local project_path="$1"
    local worker_name="$2"
    local branch_suffix="$3"
    local worktree_base=$(jq -r '.worktree_base // "/tmp/agent-worktrees"' "$PROJECTS_FILE")
    
    local project_name=$(basename "$project_path")
    local worktree_name="${project_name}-${worker_name}-${branch_suffix}"
    local worktree_path="${worktree_base}/${worktree_name}"
    
    # Worktreeベースディレクトリ作成
    mkdir -p "$worktree_base"
    
    # 既存のworktreeがあれば削除
    if [[ -d "$worktree_path" ]]; then
        (cd "$project_path" && git worktree remove -f "$worktree_path" 2>/dev/null || true)
    fi
    
    # 新しいworktree作成
    local branch_name="feature/${worker_name}-${branch_suffix}"
    (cd "$project_path" && git worktree add -b "$branch_name" "$worktree_path")
    
    echo "$worktree_path"
}

show_usage() {
    cat << EOF
🤖 汎用Agent間メッセージ送信 v2

使用方法:
  $0 [エージェント名] [メッセージ] [オプション]
  $0 --list
  $0 --projects

オプション:
  --project [プロジェクト名]      作業プロジェクトを指定
  --worktree [ブランチ接尾辞]     git worktreeを作成して作業
  
利用可能エージェント:
  president - プロジェクト統括責任者
  boss1     - チームリーダー  
  worker1   - 実行担当者A
  worker2   - 実行担当者B
  worker3   - 実行担当者C

使用例:
  # 通常の送信
  $0 boss1 "Hello World プロジェクト開始指示"
  
  # プロジェクト指定付き送信
  $0 worker1 "テストを実行" --project pwe-api
  
  # Worktree作成付き送信
  $0 worker1 "login.jsを修正" --project pwe-api --worktree auth-feature
  
  # Boss向けの複雑な指示
  $0 boss1 "pwe-apiにworker1を、pwe-frontendにworker2を割り当ててビルドしてください"
EOF
}

# プロジェクト一覧表示
show_projects() {
    if [[ ! -f "$PROJECTS_FILE" ]]; then
        echo "❌ プロジェクト設定ファイルが見つかりません: $PROJECTS_FILE"
        return 1
    fi
    
    echo "📋 登録済みプロジェクト:"
    echo "========================"
    jq -r '.projects | to_entries[] | "  \(.key) → \(.value.path)"' "$PROJECTS_FILE"
}

# エージェント一覧表示
show_agents() {
    echo "📋 利用可能なエージェント:"
    echo "=========================="
    echo "  president → president:0     (プロジェクト統括責任者)"
    echo "  boss1     → multiagent:0.0  (チームリーダー)"
    echo "  worker1   → multiagent:0.1  (実行担当者A)"
    echo "  worker2   → multiagent:0.2  (実行担当者B)" 
    echo "  worker3   → multiagent:0.3  (実行担当者C)"
}

# ログ記録
log_send() {
    local agent="$1"
    local message="$2"
    local project="$3"
    local worktree="$4"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    mkdir -p logs
    local log_entry="[$timestamp] $agent: SENT - \"$message\""
    [[ -n "$project" ]] && log_entry+=" [project: $project]"
    [[ -n "$worktree" ]] && log_entry+=" [worktree: $worktree]"
    
    echo "$log_entry" >> logs/send_log.txt
}

# メッセージ送信
send_message() {
    local target="$1"
    local message="$2"
    
    echo "📤 送信中: $target ← '$message'"
    
    # Claude Codeのプロンプトを一度クリア
    tmux send-keys -t "$target" C-c
    sleep 0.3
    
    # メッセージ送信
    tmux send-keys -t "$target" "$message"
    sleep 0.1
    
    # エンター押下
    tmux send-keys -t "$target" C-m
    sleep 0.5
}

# ターゲット存在確認
check_target() {
    local target="$1"
    local session_name="${target%%:*}"
    
    if ! tmux has-session -t "$session_name" 2>/dev/null; then
        echo "❌ セッション '$session_name' が見つかりません"
        return 1
    fi
    
    return 0
}

# メイン処理
main() {
    if [[ $# -eq 0 ]]; then
        show_usage
        exit 1
    fi
    
    # --listオプション
    if [[ "$1" == "--list" ]]; then
        show_agents
        exit 0
    fi
    
    # --projectsオプション
    if [[ "$1" == "--projects" ]]; then
        show_projects
        exit 0
    fi
    
    if [[ $# -lt 2 ]]; then
        show_usage
        exit 1
    fi
    
    local agent_name="$1"
    local base_message="$2"
    shift 2
    
    # オプション解析
    local project=""
    local worktree=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --project)
                project="$2"
                shift 2
                ;;
            --worktree)
                worktree="$2"
                shift 2
                ;;
            *)
                echo "❌ 不明なオプション: $1"
                exit 1
                ;;
        esac
    done
    
    # エージェントターゲット取得
    local target
    target=$(get_agent_target "$agent_name")
    
    if [[ -z "$target" ]]; then
        echo "❌ エラー: 不明なエージェント '$agent_name'"
        echo "利用可能エージェント: $0 --list"
        exit 1
    fi
    
    # ターゲット確認
    if ! check_target "$target"; then
        exit 1
    fi
    
    # メッセージ構築
    local message="$base_message"
    local work_path=""
    
    # プロジェクト指定がある場合
    if [[ -n "$project" ]]; then
        local project_path
        project_path=$(get_project_path "$project")
        
        if [[ -z "$project_path" ]]; then
            echo "❌ エラー: 不明なプロジェクト '$project'"
            echo "登録済みプロジェクト: $0 --projects"
            exit 1
        fi
        
        # Worktree指定がある場合
        if [[ -n "$worktree" ]]; then
            work_path=$(create_worktree "$project_path" "$agent_name" "$worktree")
            message+=" [作業DIR: $work_path]"
        else
            work_path="$project_path"
            message+=" [作業DIR: $work_path]"
        fi
    fi
    
    # メッセージ送信
    send_message "$target" "$message"
    
    # ログ記録
    log_send "$agent_name" "$base_message" "$project" "$worktree"
    
    echo "✅ 送信完了: $agent_name に '$message'"
    
    return 0
}

main "$@"