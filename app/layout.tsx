import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ToasterProvider } from "@/components/providers/toaster"
import { QueryProvider } from "@/components/providers/query"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { cookies } from "next/headers"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: {
    default: "ClipScope AI — Short-form Intelligence",
    template: "%s | ClipScope AI",
  },
  description:
    "Short-form intelligence. Smarter content decisions. AI-powered research platform for comparing YouTube Shorts and Instagram Reels. Analyze hooks, storytelling patterns, engagement metrics, and content strategy.",
  keywords: ["YouTube Shorts", "Instagram Reels", "content analysis", "AI research", "video comparison", "ClipScope AI"],
  authors: [{ name: "ClipScope AI" }],
  openGraph: {
    type: "website",
    title: "ClipScope AI — Short-form Intelligence",
    description: "Short-form intelligence. Smarter content decisions. AI-powered research platform for comparing YouTube Shorts and Instagram Reels.",
    siteName: "ClipScope AI",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const initialTheme = cookieStore.get("clipscope-theme")?.value === "light" ? "light" : "dark"

  return (
    <html lang="en" className={inter.variable} data-theme={initialTheme} suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-950 antialiased overflow-x-hidden">
        <QueryProvider>
          <ThemeProvider initialTheme={initialTheme}>
            {children}
            <ToasterProvider />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
