-- Permit common safe-to-download document, media and generic binary attachments.
-- HTML, SVG and executable files remain rejected by the web client and are never rendered inline.
update storage.buckets
set public=false,
    file_size_limit=8388608,
    allowed_mime_types=array[
      'image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif',
      'application/pdf','text/plain','text/csv','application/zip','application/octet-stream',
      'application/msword','application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'audio/mpeg','audio/mp4','audio/webm','video/mp4','video/webm','video/quicktime'
    ]::text[]
where id='qun-chat-attachments';

update storage.buckets
set public=false,file_size_limit=8388608,
    allowed_mime_types=array['audio/mp4','audio/webm','audio/webm;codecs=opus']::text[]
where id='qun-voice-messages';