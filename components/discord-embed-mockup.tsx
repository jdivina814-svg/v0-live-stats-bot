export default function DiscordEmbedMockup() {
  return (
    <div className="space-y-2">
      {/* Initial !hyperlink embed with button */}
      <div
        className="mt-1 rounded overflow-hidden max-w-md"
        style={{
          backgroundColor: "oklch(0.26 0.005 260)",
          borderLeft: "4px solid #5865f2",
        }}
      >
        <div className="p-3 space-y-2.5">
          <p className="text-sm font-semibold text-primary">Hide a Link with Hyperlink</p>
          <p className="text-xs text-foreground leading-relaxed">
            Want to disguise a long URL as a clean hyperlink?
            <br />
            Click <span className="font-semibold">Submit Link</span> below, paste your URL, and the bot will return a formatted hyperlink you can share anywhere.
          </p>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">How it works</p>
            <p className="text-xs text-muted-foreground">Your URL is posted to <span className="text-primary font-mono">linkurlshort.page.gd</span> and returned as a masked hyperlink.</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Privacy</p>
            <p className="text-xs text-muted-foreground">The link is visible only to you in this message reply.</p>
          </div>
          <div className="pt-1 border-t border-border flex items-center gap-1.5">
            <p className="text-[10px] text-muted-foreground">Powered by linkurlshort.page.gd</p>
          </div>
        </div>
        {/* Button row */}
        <div className="px-3 pb-3">
          <button
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded transition-colors cursor-default"
            tabIndex={-1}
            aria-disabled="true"
          >
            <span>🔗</span> Submit Link
          </button>
        </div>
      </div>

      {/* Result embed after submission */}
      <div
        className="mt-1 rounded overflow-hidden max-w-md"
        style={{
          backgroundColor: "oklch(0.26 0.005 260)",
          borderLeft: "4px solid #57f287",
        }}
      >
        <div className="p-3 space-y-2.5">
          <p className="text-sm font-semibold" style={{ color: "#57f287" }}>Your hyperlink is ready!</p>
          <p className="text-xs text-foreground leading-relaxed">
            Here is your disguised hyperlink:
            <br /><br />
            <a
              href="https://linkurlshort.page.gd/abc123"
              className="font-semibold text-primary hover:underline"
            >
              Click here (hidden link)
            </a>
          </p>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Original URL</p>
            <code
              className="text-xs font-mono px-1.5 py-0.5 rounded block"
              style={{ backgroundColor: "oklch(0.22 0.005 260)" }}
            >
              https://example.com/very/long/url/that/nobody/wants/to/see
            </code>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Short / Hidden URL</p>
            <code
              className="text-xs font-mono px-1.5 py-0.5 rounded block"
              style={{ backgroundColor: "oklch(0.22 0.005 260)" }}
            >
              https://linkurlshort.page.gd/abc123
            </code>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Markdown to copy</p>
            <code
              className="text-xs font-mono px-1.5 py-0.5 rounded block text-green-400"
              style={{ backgroundColor: "oklch(0.22 0.005 260)" }}
            >
              {`[Click here (hidden link)](https://linkurlshort.page.gd/abc123)`}
            </code>
          </div>

          <div className="pt-1 border-t border-border flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-secondary shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              Requested by user • linkurlshort.page.gd
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
