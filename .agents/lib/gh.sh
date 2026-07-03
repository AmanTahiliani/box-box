#!/usr/bin/env bash
# .agents/lib/gh.sh — harness-agnostic helpers for the box-box agentic dev lifecycle.
#
# Source it, then call the functions:
#   source .agents/lib/gh.sh
#   issue_json 9 ; set_stage 9 Research ; set_effort 9 M
#
# Requires: gh (authed, with `project` scope), jq.
# Config is overridable via env vars.

REPO="${BOXBOX_REPO:-AmanTahiliani/box-box}"
PROJECT_OWNER="${BOXBOX_PROJECT_OWNER:-AmanTahiliani}"
PROJECT_NUMBER="${BOXBOX_PROJECT_NUMBER:-2}"

_BOXBOX_CACHE="${TMPDIR:-/tmp}/boxbox-agent"
mkdir -p "$_BOXBOX_CACHE" 2>/dev/null

# ---------- issues ----------
issue_json()     { gh issue view "$1" -R "$REPO" --json number,title,body,labels,url,state; }
issue_body()     { gh issue view "$1" -R "$REPO" --json body  -q .body; }
issue_title()    { gh issue view "$1" -R "$REPO" --json title -q .title; }
issue_url()      { gh issue view "$1" -R "$REPO" --json url   -q .url; }
set_issue_body() { gh issue edit "$1" -R "$REPO" --body-file "$2"; }        # <issue#> <file>
add_comment()    { gh issue comment "$1" -R "$REPO" --body-file "$2"; }     # <issue#> <file>

# Native sub-issue children of an epic (issue numbers, one per line).
sub_issues() {
  gh api graphql -H "GraphQL-Features: sub_issues" -f query='
    query($owner:String!,$repo:String!,$num:Int!){
      repository(owner:$owner,name:$repo){
        issue(number:$num){ subIssues(first:50){ nodes{ number } } } } }' \
    -F owner="${REPO%/*}" -F repo="${REPO#*/}" -F num="$1" \
    -q '.data.repository.issue.subIssues.nodes[].number'
}

# ---------- project fields (cached per shell invocation) ----------
_fields_file="$_BOXBOX_CACHE/fields.json"
_items_file="$_BOXBOX_CACHE/items.json"
_pid_file="$_BOXBOX_CACHE/project_id"

_refresh_fields() { gh project field-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json > "$_fields_file"; }
_refresh_items()  { gh project item-list  "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json --limit 200 > "$_items_file"; }
project_refresh() { _refresh_fields; _refresh_items; }   # call once at the start of a session to get fresh state

_project_id() { [ -s "$_pid_file" ] || gh project view "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json | jq -r .id > "$_pid_file"; cat "$_pid_file"; }
_field_id()   { [ -s "$_fields_file" ] || _refresh_fields; jq -r --arg n "$1" '.fields[]|select(.name==$n)|.id' "$_fields_file"; }
_option_id()  { [ -s "$_fields_file" ] || _refresh_fields; jq -r --arg f "$1" --arg o "$2" '.fields[]|select(.name==$f)|.options[]?|select(.name==$o)|.id' "$_fields_file"; }
_item_id()    { [ -s "$_items_file" ]  || _refresh_items;  jq -r --arg n "$1" '.items[]|select(.content.number==($n|tonumber))|.id' "$_items_file"; }

# set_field <issue#> <FieldName> <OptionName>   (single-select fields: Stage/Priority/Effort/Phase)
set_field() {
  local item opt fld pid
  item="$(_item_id "$1")"; fld="$(_field_id "$2")"; opt="$(_option_id "$2" "$3")"; pid="$(_project_id)"
  if [ -z "$item" ] || [ -z "$fld" ] || [ -z "$opt" ]; then
    echo "set_field: could not resolve issue=$1 field=$2 option=$3 (item=$item field=$fld opt=$opt)" >&2; return 1
  fi
  gh project item-edit --id "$item" --project-id "$pid" --field-id "$fld" --single-select-option-id "$opt" >/dev/null \
    && echo "set #$1 $2=$3"
}
set_stage()    { set_field "$1" Stage    "$2"; }
set_priority() { set_field "$1" Priority "$2"; }
set_effort()   { set_field "$1" Effort   "$2"; }

# get_field <issue#> <FieldName>  -> current value (single-word field names only)
get_field() {
  [ -s "$_items_file" ] || _refresh_items
  jq -r --arg n "$1" --arg f "$2" '.items[]|select(.content.number==($n|tonumber))|.[($f|ascii_downcase)] // "-"' "$_items_file"
}
