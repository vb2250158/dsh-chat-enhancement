"""通过 Python SDK 的正式 profile 读取原会话恢复结果与通知。"""
import json
import os
from pathlib import Path
import sys
import time

root, directory, patch = map(Path, sys.argv[1:4])
sys.path.insert(0, str(root / "python/sdk/src"))
from deepseek_harness import DeepSeekHarness, DeepSeekHarnessConfig

node = os.environ["DSH_NODE_BIN"]
shim = directory / "dsh.cmd"
shim.write_text(f'@echo off\n"{node}" "{root / "apps/cli/lib/bin.js"}" %*\n', encoding="utf-8")
config = DeepSeekHarnessConfig(
    dsh_bin=str(shim), profile="sdk", patches=(str(patch),),
    dsh_home=str(directory / ".dsh"), runtime_cwd=str(root), cwd=str(directory),
    provider="fixture", model="fixture", initialize_timeout_seconds=60,
    env={**os.environ, "DSH_SOURCE_ROOT": str(root), "DSH_NATIVE_RECOVERY_DIR": str(directory)},
)
harness = DeepSeekHarness(config)
subscription = harness.client.subscribe_session_notifications("native-recovery-root")
def await_file(name):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        file = directory / name
        if file.exists():
            return file.read_text(encoding="utf-8")
        time.sleep(0.02)
    raise TimeoutError(f"profile did not produce {name}")

try:
    harness.client.start()
    await_file("loaded")
    harness.start()
    (directory / "start").write_text("", encoding="utf-8")
    result = json.loads(await_file("result.json"))
    if "error" in result:
        raise RuntimeError(result["error"])
    types = []
    def collect(notification):
        event = notification.payload.get("event", {})
        event_type = event.get("type")
        if event_type in ("turn/start", "step/start", "assistant/message", "step/end", "turn/end"):
            types.append(event_type)
        elif event_type == "user/message" and event["data"]["source"]["kind"] in ("user", "agent"):
            types.append(event_type)
    subscription.drain(collect)
    observed = {
        "root_id": "native-recovery-root", "child_id": "native-recovery-child",
        "native_start_accepted": result["accepted"], "duplicate_accepted": result["duplicate"],
        "child_start_accepted": result["child"],
        "root_user_texts": [event["text"] for event in result["root"] if event["type"] == "user/message" and event["source"] == "user"],
        "root_finish_reasons": [event["reason"] for event in result["root"] if event["type"] == "turn/end"],
        "child_user_texts": result["childUserTexts"], "child_finish_reasons": result["childTurns"],
        "notification_event_types": types,
    }
    assert observed["native_start_accepted"] and observed["child_start_accepted"]
    assert not observed["duplicate_accepted"]
    assert "assistant/message" in types
    (directory / "python-observed.json").write_text(json.dumps(observed, ensure_ascii=False), encoding="utf-8")
finally:
    subscription.close()
    harness.close()
