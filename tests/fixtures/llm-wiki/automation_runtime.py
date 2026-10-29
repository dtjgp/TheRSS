#!/usr/bin/env python3
"""Repository-side automation lease and audit observability runtime."""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import re
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any, Iterator, Sequence


SCHEMA_VERSION = 1
DEFAULT_CONFIG = Path("System/Configs/Automation_Runtime_Scopes.json")
DEFAULT_STATE = Path(".runtime/automation/leases.json")
DEFAULT_AUDIT_GLOB = (
    "Automation_Conversations/"
    "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]__*.md"
)
OWNER_PATTERN = re.compile(r"^[A-Za-z0-9._:@-]{1,128}$")
SECRET_KEY_PATTERN = re.compile(
    r"secret|token|password|cookie|authorization|credential|api[_-]?key",
    re.IGNORECASE,
)
SECRET_VALUE_PATTERN = re.compile(r"\bBearer\s+|\bsk-[A-Za-z0-9]", re.IGNORECASE)
TERMINAL_PATTERN = re.compile(r"^- \*\*Status:\*\*\s*(\S+)\s*$", re.MULTILINE)
FRONTMATTER_STATUS_PATTERN = re.compile(r"^status:\s*(\S+)\s*$", re.MULTILINE)


class RuntimeContractError(RuntimeError):
    """Raised when a lease or audit contract would be violated."""


def _now(value: datetime | None) -> datetime:
    return value or datetime.now().astimezone()


def _iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def _normalize_scope(raw: str) -> str:
    scope = raw.strip().replace("\\", "/")
    path = PurePosixPath(scope)
    if not scope or scope.startswith("/") or ".." in path.parts or scope == ".":
        raise RuntimeContractError(f"invalid_scope:{raw}")
    return path.as_posix().rstrip("/")


def _scope_overlap(left: str, right: str) -> str | None:
    left_parts = PurePosixPath(left).parts
    right_parts = PurePosixPath(right).parts
    shorter = min(len(left_parts), len(right_parts))
    if left_parts[:shorter] == right_parts[:shorter]:
        return left if len(left_parts) <= len(right_parts) else right
    return None


def _metadata_is_safe(value: Any, *, key: str = "") -> bool:
    if key and SECRET_KEY_PATTERN.search(key):
        return False
    if isinstance(value, dict):
        return all(
            _metadata_is_safe(item, key=str(item_key))
            for item_key, item in value.items()
        )
    if isinstance(value, (list, tuple)):
        return all(_metadata_is_safe(item) for item in value)
    if isinstance(value, str) and SECRET_VALUE_PATTERN.search(value):
        return False
    return value is None or isinstance(value, (str, int, float, bool, list, tuple, dict))


def load_config(path: Path) -> dict[str, Any]:
    try:
        config = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeContractError("cannot_read_runtime_config") from exc
    if config.get("schema_version") != SCHEMA_VERSION:
        raise RuntimeContractError("invalid_config_schema")
    statuses = config.get("terminal_statuses")
    if not isinstance(statuses, list) or not statuses or not all(
        isinstance(status, str) and status for status in statuses
    ):
        raise RuntimeContractError("invalid_terminal_statuses")
    automations = config.get("automations")
    if not isinstance(automations, dict) or not automations:
        raise RuntimeContractError("invalid_automations")
    normalized: dict[str, Any] = {}
    for automation_id, contract in automations.items():
        if not isinstance(contract, dict):
            raise RuntimeContractError(f"invalid_automation:{automation_id}")
        raw_scopes = contract.get("lock_scopes")
        if not isinstance(raw_scopes, list) or not raw_scopes:
            raise RuntimeContractError(f"missing_lock_scopes:{automation_id}")
        scopes = tuple(dict.fromkeys(_normalize_scope(str(scope)) for scope in raw_scopes))
        normalized[str(automation_id)] = {**contract, "lock_scopes": list(scopes)}
    return {**config, "automations": normalized}


def _contract(config: dict[str, Any], automation_id: str) -> dict[str, Any]:
    try:
        return config["automations"][automation_id]
    except KeyError as exc:
        raise RuntimeContractError(f"unknown_automation:{automation_id}") from exc


def _validate_owner(owner_id: str) -> None:
    if not OWNER_PATTERN.fullmatch(owner_id):
        raise RuntimeContractError("invalid_owner_id")


def _validate_ttl(ttl_seconds: int) -> None:
    if not 30 <= ttl_seconds <= 86400:
        raise RuntimeContractError("invalid_ttl_seconds")


def _empty_state() -> dict[str, Any]:
    return {"schema_version": SCHEMA_VERSION, "leases": [], "events": []}


def _read_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return _empty_state()
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeContractError("cannot_read_runtime_state") from exc
    if state.get("schema_version") != SCHEMA_VERSION:
        raise RuntimeContractError("invalid_state_schema")
    if not isinstance(state.get("leases"), list) or not isinstance(
        state.get("events"), list
    ):
        raise RuntimeContractError("invalid_runtime_state")
    return state


def _write_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    os.replace(temporary, path)


@contextmanager
def _locked_state(path: Path) -> Iterator[dict[str, Any]]:
    path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = path.with_suffix(path.suffix + ".lock")
    with lock_path.open("a+", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        state = _read_state(path)
        yield state
        _write_state(path, state)
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _append_event(state: dict[str, Any], event: dict[str, Any]) -> None:
    state["events"] = [*state["events"], event][-200:]


def _reap_expired(state: dict[str, Any], now: datetime) -> int:
    active: list[dict[str, Any]] = []
    expired: list[dict[str, Any]] = []
    for lease in state["leases"]:
        try:
            expires_at = datetime.fromisoformat(lease["expires_at"])
        except (KeyError, TypeError, ValueError) as exc:
            raise RuntimeContractError("invalid_lease_timestamp") from exc
        (expired if expires_at <= now else active).append(lease)
    state["leases"] = active
    for lease in expired:
        _append_event(
            state,
            {
                "event": "expired",
                "automation_id": lease["automation_id"],
                "owner_id": lease["owner_id"],
                "at": _iso(now),
            },
        )
    return len(expired)


def begin_lease(
    config_path: Path,
    state_path: Path,
    automation_id: str,
    owner_id: str,
    ttl_seconds: int,
    *,
    now: datetime | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    config = load_config(config_path)
    contract = _contract(config, automation_id)
    _validate_owner(owner_id)
    _validate_ttl(ttl_seconds)
    safe_metadata = metadata or {}
    if not _metadata_is_safe(safe_metadata):
        raise RuntimeContractError("secret_like_metadata")
    timestamp = _now(now)
    scopes = contract["lock_scopes"]
    with _locked_state(state_path) as state:
        expired_reaped = _reap_expired(state, timestamp)
        for lease in state["leases"]:
            if lease["automation_id"] == automation_id and lease["owner_id"] == owner_id:
                return {
                    "status": "already-owned",
                    "automation_id": automation_id,
                    "owner_id": owner_id,
                    "lock_scopes": scopes,
                    "expires_at": lease["expires_at"],
                    "expired_reaped": expired_reaped,
                }
            for requested in scopes:
                for held in lease["lock_scopes"]:
                    overlap = _scope_overlap(requested, held)
                    if overlap:
                        raise RuntimeContractError(
                            f"scope_conflict:{overlap}:held_by:{lease['automation_id']}:{lease['owner_id']}"
                        )
        expires_at = timestamp + timedelta(seconds=ttl_seconds)
        lease = {
            "automation_id": automation_id,
            "owner_id": owner_id,
            "lock_scopes": scopes,
            "acquired_at": _iso(timestamp),
            "heartbeat_at": _iso(timestamp),
            "expires_at": _iso(expires_at),
            "metadata": safe_metadata,
        }
        state["leases"].append(lease)
        _append_event(
            state,
            {
                "event": "begin",
                "automation_id": automation_id,
                "owner_id": owner_id,
                "at": _iso(timestamp),
                "lock_scopes": scopes,
            },
        )
        return {
            "status": "acquired",
            "automation_id": automation_id,
            "owner_id": owner_id,
            "lock_scopes": scopes,
            "expires_at": _iso(expires_at),
            "expired_reaped": expired_reaped,
        }


def _owned_lease(
    state: dict[str, Any], automation_id: str, owner_id: str
) -> dict[str, Any]:
    for lease in state["leases"]:
        if lease["automation_id"] == automation_id:
            if lease["owner_id"] != owner_id:
                raise RuntimeContractError("lease_owner_mismatch")
            return lease
    raise RuntimeContractError("lease_not_found")


def heartbeat_lease(
    config_path: Path,
    state_path: Path,
    automation_id: str,
    owner_id: str,
    ttl_seconds: int,
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    config = load_config(config_path)
    _contract(config, automation_id)
    _validate_owner(owner_id)
    _validate_ttl(ttl_seconds)
    timestamp = _now(now)
    with _locked_state(state_path) as state:
        _reap_expired(state, timestamp)
        lease = _owned_lease(state, automation_id, owner_id)
        lease["heartbeat_at"] = _iso(timestamp)
        lease["expires_at"] = _iso(timestamp + timedelta(seconds=ttl_seconds))
        _append_event(
            state,
            {
                "event": "heartbeat",
                "automation_id": automation_id,
                "owner_id": owner_id,
                "at": _iso(timestamp),
            },
        )
        return {
            "status": "renewed",
            "automation_id": automation_id,
            "owner_id": owner_id,
            "expires_at": lease["expires_at"],
        }


def finish_lease(
    config_path: Path,
    state_path: Path,
    automation_id: str,
    owner_id: str,
    terminal_status: str,
    *,
    now: datetime | None = None,
    audit_record_path: str | None = None,
) -> dict[str, Any]:
    config = load_config(config_path)
    _contract(config, automation_id)
    _validate_owner(owner_id)
    if terminal_status not in config["terminal_statuses"]:
        raise RuntimeContractError(f"invalid_terminal_status:{terminal_status}")
    timestamp = _now(now)
    with _locked_state(state_path) as state:
        _reap_expired(state, timestamp)
        lease = _owned_lease(state, automation_id, owner_id)
        if not audit_record_path:
            raise RuntimeContractError("missing_audit_record")
        audit = audit_record(Path(audit_record_path), config["terminal_statuses"])
        if audit["status"] != "valid":
            errors = ",".join(audit["errors"])
            raise RuntimeContractError(f"invalid_audit_record:{errors}")
        if audit["terminal_status"] != terminal_status:
            raise RuntimeContractError(
                "audit_terminal_status_mismatch:"
                f"{audit['terminal_status']}:{terminal_status}"
            )
        state["leases"] = [item for item in state["leases"] if item is not lease]
        event = {
            "event": "finish",
            "automation_id": automation_id,
            "owner_id": owner_id,
            "at": _iso(timestamp),
            "outcome": terminal_status,
        }
        event["audit_record"] = audit_record_path
        _append_event(state, event)
        return {
            "status": "released",
            "automation_id": automation_id,
            "owner_id": owner_id,
            "terminal_status": terminal_status,
        }


def runtime_status(
    config_path: Path, state_path: Path, *, now: datetime | None = None
) -> dict[str, Any]:
    load_config(config_path)
    timestamp = _now(now)
    with _locked_state(state_path) as state:
        expired_reaped = _reap_expired(state, timestamp)
        leases = sorted(
            state["leases"], key=lambda item: (item["automation_id"], item["owner_id"])
        )
        return {
            "schema_version": SCHEMA_VERSION,
            "generated_at": _iso(timestamp),
            "active": len(leases),
            "expired_reaped": expired_reaped,
            "leases": leases,
            "recent_events": state["events"][-20:],
        }


def audit_record(path: Path, terminal_statuses: Sequence[str] | None = None) -> dict[str, Any]:
    statuses = set(terminal_statuses or (
        "completed", "partial", "blocked", "no-change", "no-source", "skipped"
    ))
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return {"path": str(path), "status": "invalid", "errors": ["cannot_read_record"]}
    frontmatter = FRONTMATTER_STATUS_PATTERN.search(text)
    terminal = TERMINAL_PATTERN.search(text)
    errors: list[str] = []
    frontmatter_status = frontmatter.group(1) if frontmatter else None
    terminal_status = terminal.group(1) if terminal else None
    if not frontmatter_status:
        errors.append("missing_frontmatter_status")
    if not terminal_status:
        errors.append("missing_terminal_status")
    if terminal_status and terminal_status not in statuses:
        errors.append(f"invalid_terminal_status:{terminal_status}")
    if frontmatter_status and terminal_status and frontmatter_status != terminal_status:
        errors.append(f"status_mismatch:{frontmatter_status}:{terminal_status}")
    return {
        "path": str(path),
        "status": "invalid" if errors else "valid",
        "frontmatter_status": frontmatter_status,
        "terminal_status": terminal_status,
        "errors": errors,
    }


def audit_records(paths: Sequence[Path], terminal_statuses: Sequence[str]) -> dict[str, Any]:
    records = [audit_record(path, terminal_statuses) for path in paths]
    valid = sum(1 for record in records if record["status"] == "valid")
    return {
        "schema_version": SCHEMA_VERSION,
        "summary": {
            "records": len(records),
            "valid": valid,
            "invalid": len(records) - valid,
            "overall_status": "valid" if valid == len(records) else "invalid",
        },
        "records": records,
    }


def _parse_metadata(raw: str | None) -> dict[str, Any] | None:
    if raw is None:
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeContractError("invalid_metadata_json") from exc
    if not isinstance(value, dict):
        raise RuntimeContractError("metadata_must_be_object")
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--now", help="ISO timestamp override")
    subparsers = parser.add_subparsers(dest="command", required=True)

    begin_parser = subparsers.add_parser("begin")
    begin_parser.add_argument("automation_id")
    begin_parser.add_argument("owner_id")
    begin_parser.add_argument("--ttl-seconds", type=int, default=1800)
    begin_parser.add_argument("--metadata")

    heartbeat_parser = subparsers.add_parser("heartbeat")
    heartbeat_parser.add_argument("automation_id")
    heartbeat_parser.add_argument("owner_id")
    heartbeat_parser.add_argument("--ttl-seconds", type=int, default=1800)

    finish_parser = subparsers.add_parser("finish")
    finish_parser.add_argument("automation_id")
    finish_parser.add_argument("owner_id")
    finish_parser.add_argument("terminal_status")
    finish_parser.add_argument("--audit-record")

    subparsers.add_parser("status")
    audit_parser = subparsers.add_parser("audit")
    audit_parser.add_argument("records", nargs="*", type=Path)

    args = parser.parse_args()
    timestamp = datetime.fromisoformat(args.now) if args.now else None
    try:
        if args.command == "begin":
            result = begin_lease(
                args.config,
                args.state,
                args.automation_id,
                args.owner_id,
                args.ttl_seconds,
                now=timestamp,
                metadata=_parse_metadata(args.metadata),
            )
        elif args.command == "heartbeat":
            result = heartbeat_lease(
                args.config,
                args.state,
                args.automation_id,
                args.owner_id,
                args.ttl_seconds,
                now=timestamp,
            )
        elif args.command == "finish":
            result = finish_lease(
                args.config,
                args.state,
                args.automation_id,
                args.owner_id,
                args.terminal_status,
                now=timestamp,
                audit_record_path=args.audit_record,
            )
        elif args.command == "status":
            result = runtime_status(args.config, args.state, now=timestamp)
        else:
            config = load_config(args.config)
            records = tuple(args.records) or tuple(
                sorted(Path.cwd().glob(DEFAULT_AUDIT_GLOB))
            )
            result = audit_records(records, config["terminal_statuses"])
    except RuntimeContractError as exc:
        print(json.dumps({"status": "rejected", "error": str(exc)}, indent=2))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.command == "audit" and result["summary"]["overall_status"] != "valid":
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
