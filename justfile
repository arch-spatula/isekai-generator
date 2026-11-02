default:
    @just --list

# Enter the Nix development shell.
shell:
    nix develop 'path:.'

# Show versions of the development tools provided by Nix.
versions:
    @nix develop 'path:.' --command sh -c 'printf "node="; node --version; printf "npm="; npm --version; printf "bun="; bun --version; printf "just="; just --version'
