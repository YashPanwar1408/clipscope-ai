import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import {
  ingestJob,
  aiAnalysisWorkflow,
  generateComparison,
  generateReport,
  reconcileJobs,
} from "@/lib/inngest/functions"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ingestJob,
    aiAnalysisWorkflow,
    generateComparison,
    generateReport,
    reconcileJobs,
  ],
})
