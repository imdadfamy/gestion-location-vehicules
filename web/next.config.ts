import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Le catalogue est sur l'accueil : l'ancienne page Véhicules (liens partagés, moteurs de recherche)
  // y renvoie, avec les dates, la catégorie et le véhicule éventuels.
  async redirects() {
    return [{ source: "/vehicules", destination: "/#vehicules", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
