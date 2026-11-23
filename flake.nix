{
  description = "Development environment for isekai-generator";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        config.allowUnfreePredicate = pkg: nixpkgs.lib.getName pkg == "claude-code";
      };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        ANTHROPIC_MODEL = "claude-opus-5-5";

        packages = with pkgs; [
          codex
          (claude-code.override {
            manifest = {
              version = "2.1.326";
              platforms.linux-x64 = {
                binary = "claude.zst";
                checksum = "8a6e8f4fdc137f93359285d0677640dcd73e67a35ffabeab8c042d433d685abd";
              };
            };
          })
          nodejs_24
          bun
          just
          lua5_1
          love
          godot_4_7
          (python3.withPackages (pythonPackages: [
            pythonPackages.pyyaml
          ]))
        ];
      };
    };
}
