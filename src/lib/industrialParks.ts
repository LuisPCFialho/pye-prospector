/**
 * Portuguese industrial parks — quick-start hotspots for solar prospecting.
 * Coordinates verified against OpenStreetMap.
 */
export interface IndustrialPark {
  slug: string;
  name: string;
  region: string;
  district: string;
  lat: number;
  lon: number;
  zoom: number;
  description: string;
  estimatedBuildings: number;
}

export const INDUSTRIAL_PARKS: IndustrialPark[] = [
  {
    slug: "maia",
    name: "Zona Industrial da Maia",
    region: "Norte",
    district: "Porto",
    lat: 41.236,
    lon: -8.624,
    zoom: 14,
    description: "Grande tecido industrial logístico e metalúrgico",
    estimatedBuildings: 250,
  },
  {
    slug: "matosinhos",
    name: "Porto de Leixões / Matosinhos Industrial",
    region: "Norte",
    district: "Porto",
    lat: 41.184,
    lon: -8.694,
    zoom: 14,
    description: "Pesca, conserveira, logística portuária",
    estimatedBuildings: 180,
  },
  {
    slug: "ovar",
    name: "Zona Industrial de Ovar",
    region: "Centro",
    district: "Aveiro",
    lat: 40.866,
    lon: -8.624,
    zoom: 14,
    description: "Cerâmica, metalúrgica, transformação",
    estimatedBuildings: 140,
  },
  {
    slug: "leiria",
    name: "Zona Industrial de Leiria",
    region: "Centro",
    district: "Leiria",
    lat: 39.745,
    lon: -8.812,
    zoom: 14,
    description: "Plásticos, moldes, indústria transformadora",
    estimatedBuildings: 160,
  },
  {
    slug: "alverca",
    name: "Zona Industrial de Alverca",
    region: "Lisboa",
    district: "Lisboa",
    lat: 38.898,
    lon: -9.027,
    zoom: 14,
    description: "Aeronáutica, logística, OGMA",
    estimatedBuildings: 120,
  },
  {
    slug: "carregado",
    name: "Carregado / Castanheira",
    region: "Lisboa",
    district: "Lisboa",
    lat: 39.020,
    lon: -8.964,
    zoom: 14,
    description: "Maior pólo logístico nacional",
    estimatedBuildings: 220,
  },
  {
    slug: "palmela",
    name: "AutoEuropa / Palmela",
    region: "Lisboa",
    district: "Setúbal",
    lat: 38.605,
    lon: -8.815,
    zoom: 14,
    description: "Automóvel, componentes, agro-alimentar",
    estimatedBuildings: 140,
  },
  {
    slug: "sines",
    name: "Zona Industrial e Logística de Sines",
    region: "Alentejo",
    district: "Setúbal",
    lat: 37.954,
    lon: -8.823,
    zoom: 14,
    description: "Petroquímica, porto, logística pesada",
    estimatedBuildings: 90,
  },
  {
    slug: "evora",
    name: "Parque Industrial e Tecnológico de Évora",
    region: "Alentejo",
    district: "Évora",
    lat: 38.575,
    lon: -7.929,
    zoom: 14,
    description: "Aeronáutica (Embraer), metalúrgica",
    estimatedBuildings: 60,
  },
  {
    slug: "loule",
    name: "Loulé Indústria",
    region: "Algarve",
    district: "Faro",
    lat: 37.135,
    lon: -8.025,
    zoom: 14,
    description: "Transformação, agro-alimentar, distribuição",
    estimatedBuildings: 80,
  },
];

export function getParkBySlug(slug: string): IndustrialPark | undefined {
  return INDUSTRIAL_PARKS.find((p) => p.slug === slug);
}
