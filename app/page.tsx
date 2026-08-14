import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  GitCompare,
  Library,
  MessageSquare,
  Play,

  Sparkles,

} from "lucide-react";
import { InstagramIcon, YouTubeIcon } from "@/components/icons";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Library,
    title: "A library built for research",
    description: "Bring supported Shorts and Reels into one workspace. Keep source links, available metadata, and transcript status together.",
    detail: <div className="mt-5 space-y-2"><div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-2.5"><span className="flex h-8 w-6 items-center justify-center rounded bg-violet-400/10 text-violet-200"><Play className="h-3 w-3" /></span><span className="min-w-0 flex-1 truncate text-xs text-zinc-300">A stronger opening in 15 seconds</span><span className="text-[10px] text-zinc-500">Ready</span></div><div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-2.5"><span className="flex h-8 w-6 items-center justify-center rounded bg-sky-400/10 text-sky-200"><Play className="h-3 w-3" /></span><span className="min-w-0 flex-1 truncate text-xs text-zinc-300">The story behind the product</span><span className="text-[10px] text-zinc-500">Metadata</span></div></div>,
  },
  {
    icon: GitCompare,
    title: "Compare with context",
    description: "Place selected videos side by side and inspect differences in structure, themes, available metrics, and evidence.",
    detail: <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-lg border border-violet-300/10 bg-violet-300/[0.04] p-3"><p className="text-[10px] uppercase tracking-wider text-violet-200/75">Opening</p><p className="mt-2 text-xs leading-relaxed text-zinc-300">Question-led hook</p></div><div className="rounded-lg border border-sky-300/10 bg-sky-300/[0.04] p-3"><p className="text-[10px] uppercase tracking-wider text-sky-200/75">Opening</p><p className="mt-2 text-xs leading-relaxed text-zinc-300">Product-first hook</p></div></div>,
  },
  {
    icon: Sparkles,
    title: "AI observations, not hype",
    description: "Groq AI can organize patterns from supplied transcripts and metadata. Every generated interpretation remains distinct from retrieved facts.",
    detail: <div className="mt-5 rounded-lg border border-white/[0.06] bg-black/20 p-3.5"><div className="flex items-center gap-2 text-xs font-medium text-zinc-200"><Sparkles className="h-3.5 w-3.5 text-violet-300" /> Editorial observation</div><p className="mt-2 text-xs leading-relaxed text-zinc-400">“The opening establishes a clear question before introducing the product.”</p></div>,
  },
  {
    icon: MessageSquare,
    title: "Ask better questions",
    description: "Search your workspace's available transcript and metadata evidence, then explore it through a research-oriented chat.",
    detail: <div className="mt-5 rounded-lg border border-white/[0.06] bg-black/20 p-3"><p className="text-[10px] text-zinc-500">RESEARCH QUESTION</p><p className="mt-2 text-xs text-zinc-300">Which clips open with a question?</p><div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3 text-[10px] text-zinc-500"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-400/10 text-violet-200">1</span> Source excerpt available</div></div>,
  },
  {
    icon: BarChart3,
    title: "Analytics with caveats",
    description: "Review the metrics that providers returned and the current coverage of your workspace—without inventing missing data.",
    detail: <div className="mt-5 flex h-[72px] items-end gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-4 pb-3 pt-4" aria-label="Illustrative bar chart"><span className="h-6 flex-1 rounded-t bg-violet-300/50" /><span className="h-10 flex-1 rounded-t bg-violet-300/70" /><span className="h-8 flex-1 rounded-t bg-sky-300/55" /><span className="h-12 flex-1 rounded-t bg-violet-300/80" /><span className="h-7 flex-1 rounded-t bg-sky-300/50" /><span className="h-9 flex-1 rounded-t bg-violet-300/60" /></div>,
  },
  {
    icon: FileText,
    title: "Take the research with you",
    description: "Report generation code prepares portable workspace summaries in PDF, CSV, and Markdown formats.",
    detail: <div className="mt-5 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-3"><span className="flex h-9 w-8 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-violet-200"><FileText className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-xs text-zinc-300">Workspace research</p><p className="mt-1 text-[10px] text-zinc-500">PDF · CSV · Markdown</p></div><ArrowDown className="h-3.5 w-3.5 text-zinc-500" /></div>,
  },
];

const workflow = [
  { number: "01", title: "Import videos", copy: "Add supported public Shorts and Reels URLs to a workspace." },
  { number: "02", title: "Retrieve what is available", copy: "Provider access and video permissions determine which metadata can be returned." },
  { number: "03", title: "Analyze and compare", copy: "Review available evidence, add transcripts, and ask structured questions." },
  { number: "04", title: "Export your research", copy: "Prepare a shareable report from the records in your workspace." },
];

const principles = [
  "Unavailable metrics stay unavailable—not silently replaced with zero.",
  "Provider extraction errors are visible instead of disguised as facts.",
  "AI output is an interpretation of supplied evidence, not a performance promise.",
  "Cross-platform numbers deserve context; raw counts are not interchangeable.",
];

function ProductPreview() {
  return (
    <div className="preview-frame mx-auto w-full max-w-[1100px] overflow-hidden rounded-2xl">
      <div className="flex h-12 items-center justify-between border-b border-white/[0.07] px-4 sm:px-5">
        <div className="flex items-center gap-2.5"><BrandMark compact /><span className="text-xs font-medium text-zinc-300">Research workspace</span></div>
        <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-500">Illustrative preview</span>
      </div>
      <div className="grid min-h-[410px] grid-cols-1 md:grid-cols-[148px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/[0.06] bg-black/20 p-3 md:block">
          <p className="mb-3 px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-600">Workspace</p>
          {["Overview", "Video library", "Compare", "AI insights", "Research chat", "Analytics"].map((item, i) => <div key={item} className={`mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-[10px] ${i === 1 ? "bg-violet-300/[0.09] text-violet-100" : "text-zinc-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${i === 1 ? "bg-violet-300" : "bg-zinc-700"}`} />{item}</div>)}
          <div className="mt-8 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"><p className="text-[9px] text-zinc-500">CURRENT COLLECTION</p><p className="mt-1.5 text-[10px] text-zinc-300">Opening patterns</p><p className="mt-1 text-[9px] text-zinc-600">2 selected videos</p></div>
        </aside>
        <div className="min-w-0 p-3 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[9px] font-medium uppercase tracking-[0.14em] text-violet-200/70">CONTENT RESEARCH / COMPARE</p><h3 className="mt-1 text-base font-semibold tracking-tight text-zinc-100 sm:text-lg">Compare opening patterns</h3></div>
            <span className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[9px] text-zinc-500">Evidence-led view</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
            {[{ platform: "YouTube Shorts", title: "A stronger opening in 15 seconds", tag: "Question-led", color: "violet" }, { platform: "Instagram Reels", title: "The story behind the product", tag: "Narrative-led", color: "sky" }].map((video) => <div key={video.platform} className="min-w-0 rounded-xl border border-white/[0.07] bg-[#101319] p-3">
              <div className={`mb-3 flex aspect-[16/7] items-center justify-center overflow-hidden rounded-lg border border-white/[0.05] bg-gradient-to-br ${video.color === "violet" ? "from-violet-500/15 via-[#15151e] to-[#101319]" : "from-sky-500/15 via-[#131821] to-[#101319]"}`}><div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70"><Play className="h-3.5 w-3.5 fill-current" /></div></div>
              <div className="flex items-center justify-between gap-2"><span className="truncate text-[9px] text-zinc-500">{video.platform}</span><ArrowUpRight className="h-3 w-3 shrink-0 text-zinc-600" /></div>
              <p className="mt-2 line-clamp-2 min-h-8 text-xs font-medium leading-relaxed text-zinc-200">{video.title}</p>
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5"><span className="text-[9px] text-zinc-500">Opening pattern</span><span className={`rounded-full border px-2 py-0.5 text-[9px] ${video.color === "violet" ? "border-violet-300/15 bg-violet-300/[0.06] text-violet-200" : "border-sky-300/15 bg-sky-300/[0.06] text-sky-200"}`}>{video.tag}</span></div>
              <p className="mt-3 rounded-md bg-black/25 p-2 text-[10px] leading-relaxed text-zinc-400">“Wait—what if the first detail changes everything?”</p>
            </div>)}
            <div className="rounded-xl border border-white/[0.07] bg-[#101319] p-3 lg:col-span-1">
              <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-200"><Sparkles className="h-3.5 w-3.5 text-violet-300" /> Evidence note</div>
              <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">The selected excerpts introduce different opening structures. Review transcript context before drawing a conclusion.</p>
              <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-2.5"><p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-zinc-600">SOURCE EXCERPT</p><p className="mt-2 text-[9px] leading-relaxed text-zinc-300">“Wait—what if the first detail changes everything?”</p><p className="mt-2 text-[8px] text-violet-200/70">Video record · illustrative</p></div>
              <div className="mt-3 flex items-center justify-between text-[9px] text-zinc-600"><span>Metrics</span><span>Available values only</span></div>
              <div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded-md bg-black/20 p-2"><p className="text-[8px] text-zinc-600">Views</p><p className="mt-1 text-[10px] text-zinc-400">—</p></div><div className="rounded-md bg-black/20 p-2"><p className="text-[8px] text-zinc-600">Duration</p><p className="mt-1 text-[10px] text-zinc-400">—</p></div></div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5"><div className="flex items-center gap-2 text-[9px] text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300/70" />Records stay tied to their workspace</div><span className="text-[9px] text-zinc-600">Preview uses illustrative content</span></div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen overflow-hidden bg-[#08090b] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#08090b]/85 backdrop-blur-xl">
        <nav aria-label="Main navigation" className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="ClipScope AI home" className="shrink-0"><BrandMark /></Link>
          <div className="hidden items-center gap-7 md:flex">
            <a href="#product" className="text-xs text-zinc-400 transition-colors hover:text-zinc-100">Product</a>
            <a href="#features" className="text-xs text-zinc-400 transition-colors hover:text-zinc-100">Features</a>
            <a href="#workflow" className="text-xs text-zinc-400 transition-colors hover:text-zinc-100">Workflow</a>
            <a href="#evidence" className="text-xs text-zinc-400 transition-colors hover:text-zinc-100">Insights</a>
            <a href="https://github.com/YashPanwar1408/ClipScope-AI#readme" className="text-xs text-zinc-400 transition-colors hover:text-zinc-100">Documentation</a>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild><Link href="/auth/login">Sign in</Link></Button>
            <Button size="sm" className="border border-violet-200/20 bg-violet-500/90 shadow-[0_0_22px_rgba(155,135,245,.16)] hover:bg-violet-400" asChild><Link href="/auth/register">Start analyzing<ArrowRight className="h-3.5 w-3.5" /></Link></Button>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero-atmosphere relative px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8 lg:pt-28">
          <div className="ambient-orb absolute -top-24 left-[35%] h-[440px] w-[440px] rounded-full" />
          <div className="light-sweep pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-30" />
          <div className="relative mx-auto max-w-[1240px] text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200/90">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(155,135,245,.75)]" />AI-powered short-form intelligence
            </div>
            <h1 className="mx-auto max-w-4xl text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.055em] text-zinc-50 sm:text-5xl md:text-6xl lg:text-[72px]">
              See what makes short-form <span className="bg-gradient-to-r from-violet-200 via-[#c2b7ff] to-sky-200 bg-clip-text text-transparent">content work.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base sm:leading-8">
              Analyze YouTube Shorts and Instagram Reels, compare storytelling patterns, and uncover evidence-backed content insights in one workspace.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Button size="lg" className="h-11 border border-violet-100/20 bg-violet-500 text-white shadow-[0_8px_34px_rgba(114,94,208,.22)] hover:bg-violet-400" asChild><Link href="/auth/register">Start analyzing<ArrowRight className="h-4 w-4" /></Link></Button>
              <Button size="lg" variant="outline" className="h-11 border-white/10 bg-white/[0.025] text-zinc-200 hover:border-white/20 hover:bg-white/[0.06]" asChild><a href="#product">Explore the platform<ArrowDown className="h-4 w-4" /></a></Button>
            </div>
            <p className="mt-5 text-[11px] tracking-wide text-zinc-600">Research grounded in available content and real evidence.</p>
            <div id="product" className="relative mt-14 scroll-mt-24 sm:mt-20">
              <div className="ambient-orb absolute -inset-x-12 top-10 -z-10 h-64 rounded-full opacity-60" />
              <ProductPreview />
            </div>
          </div>
        </section>

        <section aria-label="Supported platforms" className="border-y border-white/[0.06] bg-white/[0.012] px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-[1040px] gap-4 md:grid-cols-2">
            <article className="group flex min-w-0 items-center gap-4 rounded-xl border border-white/[0.07] bg-[#0d0f13] p-4 transition-colors hover:border-white/[0.14] sm:p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-300/10 bg-red-400/[0.07] text-red-300"><YouTubeIcon className="h-5 w-5 max-h-5 max-w-5" /></span>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-sm font-medium text-zinc-100">YouTube Shorts</h2><ArrowUpRight className="h-3 w-3 text-zinc-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div><p className="mt-1 text-xs leading-relaxed text-zinc-500">Review available channel, duration, and engagement metadata.</p><p className="mt-2 text-[9px] uppercase tracking-[0.12em] text-zinc-600">Provider access required · transcripts may be unavailable</p></div>
              <div className="hidden shrink-0 text-right sm:block"><p className="text-[9px] text-zinc-600">AVAILABLE FIELDS</p><p className="mt-1 text-[10px] text-zinc-400">Metadata · metrics</p></div>
            </article>
            <article className="group flex min-w-0 items-center gap-4 rounded-xl border border-white/[0.07] bg-[#0d0f13] p-4 transition-colors hover:border-white/[0.14] sm:p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-fuchsia-300/10 bg-fuchsia-400/[0.07] text-fuchsia-200"><InstagramIcon className="h-5 w-5 max-h-5 max-w-5" /></span>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-sm font-medium text-zinc-100">Instagram Reels</h2><ArrowUpRight className="h-3 w-3 text-zinc-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div><p className="mt-1 text-xs leading-relaxed text-zinc-500">Keep Reel sources and provider-returned metadata together.</p><p className="mt-2 text-[9px] uppercase tracking-[0.12em] text-zinc-600">Provider access required · availability varies</p></div>
              <div className="hidden shrink-0 text-right sm:block"><p className="text-[9px] text-zinc-600">AVAILABLE FIELDS</p><p className="mt-1 text-[10px] text-zinc-400">Caption · metrics</p></div>
            </article>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-10 flex flex-col justify-between gap-4 sm:mb-12 sm:flex-row sm:items-end">
              <div><p className="eyebrow">A focused research toolkit</p><h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.045em] text-zinc-100 sm:text-4xl">Everything you need to research short-form video.</h2></div>
              <p className="max-w-sm text-sm leading-6 text-zinc-500">Built to move from scattered clips to clear, reviewable content research.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description, detail }, index) => <article key={title} className={`hover-lift min-w-0 rounded-xl border border-white/[0.075] bg-[#0d0f13] p-5 sm:p-6 ${index === 0 || index === 3 ? "lg:row-span-1" : ""}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-300/10 bg-violet-300/[0.06] text-violet-200"><Icon className="h-4 w-4" strokeWidth={1.8} /></div>
                <h3 className="mt-4 text-sm font-semibold tracking-[-0.015em] text-zinc-100">{title}</h3><p className="mt-2 text-xs leading-6 text-zinc-500">{description}</p>{detail}
              </article>)}
            </div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-24 border-y border-white/[0.06] bg-[#0b0d11] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-11 max-w-xl"><p className="eyebrow">From URL to understanding</p><h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.045em] text-zinc-100 sm:text-4xl">A clear path through your research.</h2><p className="mt-4 text-sm leading-6 text-zinc-500">Data availability depends on platform access, provider response, and each video&apos;s permissions.</p></div>
            <div className="relative grid gap-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              <div className="absolute left-5 right-5 top-5 hidden h-px bg-gradient-to-r from-violet-300/35 via-white/[0.09] to-sky-300/25 lg:block" />
              {workflow.map((step) => <article key={step.number} className="relative flex gap-4 lg:block"><span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200/15 bg-[#0b0d11] text-[10px] font-semibold tracking-wider text-violet-200 shadow-[0_0_18px_rgba(155,135,245,.08)]">{step.number}</span><div className="pt-0.5 lg:mt-5"><h3 className="text-sm font-semibold text-zinc-100">{step.title}</h3><p className="mt-2 max-w-xs text-xs leading-6 text-zinc-500">{step.copy}</p></div></article>)}
            </div>
          </div>
        </section>

        <section id="evidence" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto grid max-w-[1120px] gap-9 rounded-2xl border border-white/[0.08] bg-[linear-gradient(125deg,rgba(155,135,245,.045),transparent_44%),#0d0f13] p-6 sm:p-9 lg:grid-cols-[.85fr_1.15fr] lg:gap-14 lg:p-12">
            <div><p className="eyebrow">Evidence comes first</p><h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.045em] text-zinc-100">Useful insight starts with honest inputs.</h2><p className="mt-4 text-sm leading-7 text-zinc-500">ClipScope keeps what was retrieved separate from what the model inferred, so researchers can inspect the source before acting on an observation.</p><div className="mt-6 flex items-center gap-2 text-xs text-zinc-400"><CheckCircle2 className="h-4 w-4 text-emerald-300/80" />Research grounded in available content</div></div>
            <ul className="grid content-center gap-3">
              {principles.map((item) => <li key={item} className="flex items-start gap-3 rounded-lg border border-white/[0.055] bg-black/15 px-3.5 py-3 text-xs leading-5 text-zinc-400"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200"><Check className="h-2.5 w-2.5" /></span>{item}</li>)}
            </ul>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
          <div className="relative mx-auto max-w-[1240px] overflow-hidden rounded-2xl border border-violet-200/10 bg-[#0d0f13] px-6 py-12 text-center sm:px-10 sm:py-16">
            <div className="ambient-orb absolute -top-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full opacity-60" />
            <div className="relative"><p className="eyebrow">Make room for better research</p><h2 className="mx-auto mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.05em] text-zinc-100 sm:text-4xl">Turn scattered clips into structured insight.</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-500">Bring your videos together, investigate patterns, and build better-informed content strategies.</p><Button size="lg" className="mt-7 h-11 border border-violet-100/20 bg-violet-500 text-white shadow-[0_8px_34px_rgba(114,94,208,.2)] hover:bg-violet-400" asChild><Link href="/auth/register">Create your workspace<ArrowRight className="h-4 w-4" /></Link></Button></div>
          </div>
        </section>
      </main>

      <footer id="footer" className="border-t border-white/[0.07] bg-[#090a0d]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div><Link href="/" aria-label="ClipScope AI home"><BrandMark /></Link><p className="mt-3 text-[11px] text-zinc-600">Short-form intelligence. Smarter content decisions.</p></div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-zinc-500"><a href="#product" className="transition-colors hover:text-zinc-200">Product</a><a href="#features" className="transition-colors hover:text-zinc-200">Features</a><a href="#workflow" className="transition-colors hover:text-zinc-200">Workflow</a><a href="https://github.com/YashPanwar1408/ClipScope-AI#readme" className="transition-colors hover:text-zinc-200">Documentation</a><Link href="/auth/login" className="transition-colors hover:text-zinc-200">Sign in</Link></div>
          <p className="flex items-center gap-1.5 text-[10px] text-zinc-600"><Clock3 className="h-3 w-3" />Built for careful content research</p>
        </div>
      </footer>
    </div>
  );
}
