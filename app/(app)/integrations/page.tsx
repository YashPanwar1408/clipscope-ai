import type { Metadata } from "next"
import { Activity, CheckCircle2, XCircle, AlertCircle, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Integration Status" }

interface Integration {
  name: string
  key: string
  description: string
  required: boolean
  configured: boolean
  docsUrl: string
}

function getIntegrations(): Integration[] {
  return [
    {
      name: "Supabase",
      key: "NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      description: "PostgreSQL database, auth, and file storage",
      required: true,
      configured: isSupabaseConfigured(),
      docsUrl: "https://supabase.com/docs",
    },
    {
      name: "Groq AI",
      key: "GROQ_API_KEY",
      description: "Free-tier AI analysis, comparisons, and research chat",
      required: false,
      configured: !!(process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes("your-")),
      docsUrl: "https://console.groq.com/keys",
    },
    {
      name: "Inngest",
      key: "INNGEST_EVENT_KEY",
      description: "Durable background workflows for video processing",
      required: false,
      configured: !!(process.env.INNGEST_EVENT_KEY && !process.env.INNGEST_EVENT_KEY.includes("your-")),
      docsUrl: "https://www.inngest.com/docs",
    },
    {
      name: "YouTube Data API",
      key: "YOUTUBE_API_KEY",
      description: "Enhanced metadata retrieval for YouTube Shorts",
      required: false,
      configured: !!(process.env.YOUTUBE_API_KEY && !process.env.YOUTUBE_API_KEY.includes("your-")),
      docsUrl: "https://developers.google.com/youtube/v3",
    },
    {
      name: "RapidAPI (Instagram)",
      key: "RAPIDAPI_KEY",
      description: "Metadata retrieval for Instagram Reels",
      required: false,
      configured: !!(process.env.RAPIDAPI_KEY && !process.env.RAPIDAPI_KEY.includes("your-")),
      docsUrl: "https://rapidapi.com",
    },
  ]
}

function StatusIcon({ configured, required }: { configured: boolean; required: boolean }) {
  if (configured) return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
  if (required) return <XCircle className="h-4 w-4 text-red-400" />
  return <AlertCircle className="h-4 w-4 text-amber-400" />
}

export default function IntegrationsPage() {
  const integrations = getIntegrations()
  const configuredCount = integrations.filter((i) => i.configured).length

  return (
    <div className="space-y-6 p-4 animate-fade-in sm:p-6 xl:p-8">
      <PageHeader
        eyebrow="Provider setup"
        title="Integration status"
        description="Configuration indicators for the services used by this environment."
        actions={<div className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 text-xs text-zinc-300"><Activity className="h-3.5 w-3.5 text-violet-200" />{configuredCount}/{integrations.length} configured</div>}
      />

      {configuredCount < integrations.filter((i) => i.required).length && (
        <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.045] px-4 py-3 text-sm leading-6 text-amber-200/90">
          <strong>Setup required:</strong> Some required integrations are not configured. Copy{" "}
          <code className="rounded bg-amber-600/10 px-1 py-0.5 text-xs">.env.example</code> to{" "}
          <code className="rounded bg-amber-600/10 px-1 py-0.5 text-xs">.env.local</code> and fill in your credentials.
        </div>
      )}

      <div className="space-y-3">
        {integrations.map((integration) => (
          <Card key={integration.key}>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex min-w-0 items-start gap-3">
                <StatusIcon configured={integration.configured} required={integration.required} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-200">{integration.name}</p>
                    {integration.required ? (
                      <Badge variant="secondary" className="text-[10px]">Required</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Optional</Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{integration.description}</p>
                  <code className="text-[10px] text-zinc-600 mt-1 block">{integration.key}</code>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                {integration.configured ? (
                  <Badge variant="success">Connected</Badge>
                ) : (
                  <Badge variant="warning">Not configured</Badge>
                )}
                <a
                  href={integration.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.075] bg-white/[0.018] px-4 py-4 text-sm text-zinc-500">
        <p className="font-medium text-zinc-400 mb-1">Setup instructions</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Copy <code className="text-zinc-400">.env.example</code> to <code className="text-zinc-400">.env</code></li>
          <li>Fill in your Supabase project URL and API keys</li>
          <li>Create a free Groq API key and add it as <code className="text-zinc-400">GROQ_API_KEY</code> in <code className="text-zinc-400">.env</code></li>
          <li>Configure Inngest event and signing keys</li>
          <li>Optionally add YouTube and Instagram API keys for enhanced metadata</li>
          <li>Restart the development server</li>
        </ol>
      </div>
    </div>
  )
}
