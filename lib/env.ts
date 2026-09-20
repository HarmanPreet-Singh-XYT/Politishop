function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable ${name}. Add it to .env (see .env.example).`,
    );
  }
  return value;
}

export const env = {
  get browserbaseApiKey(): string {
    return required("BROWSERBASE_API_KEY");
  },
  get elevenLabsApiKey(): string {
    return required("ELEVENLABS_API_KEY");
  },
  get openaiApiKey(): string {
    return required("OPENAI_API_KEY");
  },
  get gptzeroApiKey(): string {
    return required("GPTZERO_API_KEY");
  },
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  get factCheckApiKey(): string {
    return required("GOOGLE_FACTCHECK_API_KEY");
  },
  get fredApiKey(): string {
    return required("FRED_API_KEY");
  },
  hasGptzero(): boolean {
    return Boolean(process.env.GPTZERO_API_KEY?.trim());
  },
  hasFactCheck(): boolean {
    return Boolean(process.env.GOOGLE_FACTCHECK_API_KEY?.trim());
  },
  hasFred(): boolean {
    return Boolean(process.env.FRED_API_KEY?.trim());
  },
  get openaiModel(): string {
    return process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
  },
};
