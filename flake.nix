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
        packages = with pkgs; [
          codex
          (claude-code.override {
            manifest = {
              version = "2.1.311";
              platforms.linux-x64 = {
                binary = "claude.zst";
                checksum = "d0c00b80761f3030f34cf0812266f6c6f8210ff9af7242f7c6c76c5600499caf";
              };
            };
          })
          nodejs_24
          bun
          just
          lua5_1
          love
          (python3.withPackages (pythonPackages: [
            pythonPackages.pyyaml
          ]))
        ];
      };
    };
}
