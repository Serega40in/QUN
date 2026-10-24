import json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import runpod_comfyui as provider
from runpod_comfyui import RunPodError, _contains_inline_media, _replace_prompt, generate

class RunPodAdapterTests(unittest.TestCase):
    def workflow_file(self, directory):
        path = Path(directory) / "workflow.json"
        path.write_text(json.dumps({"6": {"inputs": {"text": "__QUN_PROMPT__"}}}), encoding="utf-8")
        return path

    def test_prompt_replaces_only_exact_values(self):
        self.assertEqual(_replace_prompt({"text":"__QUN_PROMPT__", "other":"prefix __QUN_PROMPT__"}, 'a "quoted" prompt'),
                         {"text":'a "quoted" prompt', "other":"prefix __QUN_PROMPT__"})

    def test_media_detector_accepts_durable_urls(self):
        self.assertFalse(_contains_inline_media({"images":[{"type":"s3_url","data":"https://storage.example/scene.png"}]}))
        self.assertTrue(_contains_inline_media({"images":[{"type":"base64","data":"aGVsbG8="}]}))
        self.assertTrue(_contains_inline_media({"result":"data:video/mp4;base64,AAAA"}))

    def test_missing_config_fails_without_network(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaisesRegex(RunPodError, "Configure RUNPOD_API_KEY"): generate("test")

    def test_non_object_workflow_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"workflow.json"; path.write_text("[]",encoding="utf-8")
            with self.assertRaisesRegex(RunPodError,"non-empty"):
                generate("test",path,api_key="test",endpoint_id="endpoint")

    def test_successful_job_returns_url_metadata_and_sends_workflow(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=self.workflow_file(tmp)
            replies=[{"id":"job-123"},{"status":"COMPLETED","output":{"message":"https://storage.example/scene.png","status":"success"}}]
            with patch.object(provider,"_request_json",side_effect=replies) as request, patch.object(provider.time,"sleep"):
                result=generate("emerald spirit",path,api_key="test",endpoint_id="endpoint",timeout_seconds=10,poll_seconds=.5)
            self.assertEqual(result["provider_job_id"],"job-123")
            self.assertEqual(request.call_args_list[0].args[1]["input"]["workflow"]["6"]["inputs"]["text"],"emerald spirit")

    def test_inline_base64_output_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=self.workflow_file(tmp)
            replies=[{"id":"job-456"},{"status":"COMPLETED","output":{"images":["aGVsbG8="]}}]
            with patch.object(provider,"_request_json",side_effect=replies), patch.object(provider.time,"sleep"):
                with self.assertRaisesRegex(RunPodError,"inline media"):
                    generate("test",path,api_key="test",endpoint_id="endpoint",timeout_seconds=10,poll_seconds=.5)

    def test_provider_failure_is_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=self.workflow_file(tmp)
            replies=[{"id":"job-789"},{"status":"FAILED","error":"model missing"}]
            with patch.object(provider,"_request_json",side_effect=replies), patch.object(provider.time,"sleep"):
                with self.assertRaisesRegex(RunPodError,"model missing"):
                    generate("test",path,api_key="test",endpoint_id="endpoint",timeout_seconds=10,poll_seconds=.5)

if __name__ == "__main__": unittest.main()
