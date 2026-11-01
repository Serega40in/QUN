import tempfile
import unittest
from pathlib import Path

from qun_storage import persist_outputs
from qun_assembly import _download_signed, _local_output
from qun_compress import cap_output_size


class RenderSafetyTests(unittest.TestCase):
    def test_no_outputs_are_a_noop(self):
        result = {"engine": "test"}
        self.assertIs(persist_outputs(
            {"job_id": "test"}, result, api=None, node_id="", node_token="",
            supabase_url="", publishable_key="", output_dir=Path(".")
        ), result)

    def test_local_output_stays_inside_configured_root(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            media = root / "inside.mp4"
            media.write_bytes(b"fake-media")
            self.assertEqual(_local_output(
                {"filename": "inside.mp4", "subfolder": ""},
                root,
                {".mp4"}
            ), media)

    def test_rejects_parent_traversal_for_local_output(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            with self.assertRaises(RuntimeError):
                _local_output(
                    {"filename": "outside.mp4", "subfolder": "../"},
                    root,
                    {".mp4"}
                )

    def test_small_mp4_does_not_require_recompression(self):
        with tempfile.TemporaryDirectory() as temp:
            media = Path(temp) / "small.mp4"
            media.write_bytes(b"small")
            self.assertEqual(cap_output_size(media, "ffmpeg", True), media)

    def test_rejects_untrusted_hosts_for_signed_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(RuntimeError):
                _download_signed(
                    {"signed_url": "https://example.com/file.mp4?token=x"},
                    Path(temp),
                    "scene",
                    "public-key"
                )


if __name__ == "__main__":
    unittest.main()
