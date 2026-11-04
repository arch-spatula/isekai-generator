{
  description = "Development environment for isekai-generator";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          codex
          nodejs_24
          bun
          just
          (python3.withPackages (pythonPackages: [
            pythonPackages.pyyaml
          ]))
        ];
      };
    };
}
