// Load .env with override:true so the project's .env always wins over any
// stale OS-level environment variables (a common source of "wrong API key"
// bugs on Windows). Must be the FIRST import in server.ts — other modules
// read process.env at import time.
import { config } from "dotenv";

config({ override: true });
