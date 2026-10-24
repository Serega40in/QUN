import json
import tempfile
import unittest
from pathlib import Path

from preflight_runpod import build_report, inspect_workflow


class RunPodPreflightTests(unittest.TestCase):
    def test_missing_configuration_is_safe_and_non_billable(self):
        report = build_report(env={}, workflow_path=None)
        self.assertEqual(report["network_requests"], 0)
        self.assertEqual(report["gpu_jobs_submitted"], 0)
        self.assertEqual(report["resources_created"], 0)
        self.assertFalse(report["ready_for_health_check"])
        self.assertFalse(report["ready_for_render"])

    def test_valid_reviewed_workflow(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "workflow.json"
            path.write_text(json.dumps({"6": {"inputs": {"text": "__QUN_PROMPT__"}}}), encoding="utf-8")
            ok, message = inspect_workflow(str(path))
            self.assertTrue(ok, message)

    def test_rejects_missing_or_duplicate_prompt_placeholder(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "workflow.json"
            path.write_text(json.dumps({"6": {"inputs": {"text": "static prompt"}}}), encoding="utf-8")
            self.assertFalse(inspect_workflow(str(path))[0])
            path.write_text(json.dumps({"6": {"inputs": {"text": "__QUN_PROMPT__"}}, "7": {"inputs": {"text": "__QUN_PROMPT__"}}}), encoding="utf-8")
            self.assertFalse(inspect_workflow(str(path))[0])

    def test_never_prints_secret_values(self):
        report = build_report(env={
            "RUNPOD_API_KEY": "DO_NOT_LEAK",
            "RUNPOD_COMFYUI_ENDPOINT_ID": "endpoint",
            "QUN_OUTPUT_STORAGE_VERIFIED": "true",
        })
        self.assertNotIn("DO_NOT_LEAK", json.dumps(report))
        self.assertFalse(report["ready_for_render"])


if __name__ == "__main__":
    unittest.main()
