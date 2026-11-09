// QUN News — shared helpers
const QN = (() => {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // inline: **bold**, [text](https://url)
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const prettyDate = d => { const [y, m, dd] = String(d).split("-").map(Number); return `${dd} ${months[m - 1]} ${y}`; };
  // Publication moment in Moscow time (UTC+3)
  const ts = a => Date.parse(`${a.date}T${a.time || "00:00"}:00+03:00`);
  const visible = list => list.filter(a => a.status === "published" && ts(a) <= Date.now()).sort((a, b) => ts(b) - ts(a));
  const load = () => fetch("./posts.json", { cache: "no-cache" }).then(r => { if (!r.ok) throw Error("posts.json"); return r.json(); });
  const readMin = a => Math.max(1, Math.round(((a.blocks || []).map(b => [].concat(b.x).join(" ")).join(" ").split(/\s+/).length) / 180));
  return { esc, inline, prettyDate, visible, load, readMin };
})();
