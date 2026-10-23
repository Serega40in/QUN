import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from runpod_comfyui import RunPodError, _replace_prompt, generate


class RunPodAdapterTests(unittest.TestCase):
    def test_prompt_replaces_only_exact_values(self):
        value = {"inputs": {"text": "__QUN_PROMPT__", "other": "prefix __QUN_PROMPT__"}}
        self.assertEqual(
            _replace_prompt(value, 'a "quoted" prompt'),
            {"inputs": {"text": 'a "quoted" prompt', "other": "prefix __QUN_PROMPT__"}},
        )

    def test_missing_config_fails_without_network(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaisesRegex(RunPodError, "Configure RUNPOD_API_KEY"):
                generate("test")

    def test_non_object_workflow_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "workflow.json"
            path.write_text(json.dumps([]), encoding="utf-8")
            with self.assertRaisesRegex(RunPodError, "non-empty"):
                generate("test", path, api_key="not-a-real-key", endpoint_id="not-a-real-endpoint")


if __name__ == "__main__":
    unittest.main()
