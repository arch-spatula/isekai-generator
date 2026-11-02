default:
    @just --list

# Enter the Nix development shell.
shell:
    nix develop 'path:.'

# Install JavaScript dependencies.
install:
    nix develop 'path:.' --command bun install

# Print a complete chart report from the supplied birth profile.
report *args:
    nix develop 'path:.' --command bun scripts/chart-report.ts {{ args }}

# Run automated tests.
test:
    nix develop 'path:.' --command bun test

# Show versions of the development tools provided by Nix.
versions:
    @nix develop 'path:.' --command sh -c 'printf "node="; node --version; printf "npm="; npm --version; printf "bun="; bun --version; printf "just="; just --version'
