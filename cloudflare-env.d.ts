declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AZURE_DEVOPS_ORGANIZATION?: string;
    AZURE_DEVOPS_PROJECT?: string;
    AZURE_DEVOPS_PAT?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
  }
}
