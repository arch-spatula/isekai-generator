import { main } from './artifact-state'
if (import.meta.main) await main(process.argv.slice(2), true)
