// ============================================================
// GRAINWATCH — Commodity Definitions & Mock Data Generator
// ============================================================

// Default commodities shipped with the app
const DEFAULT_COMMODITY_IDS = [
  "wheat", "corn", "rice", "soybean", "sugar", "coffee",
  "cocoa", "palm_oil", "cotton", "barley", "oats", "sunflower",
];

// Full catalog: defaults + extras available from World Bank / simulation
const ALL_COMMODITIES = [
  // ── DEFAULTS (12) ──
  { id: "wheat",       name: "Blé",             nameEN: "Wheat",           code: "WHEAT",     icon: "🌾", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 215,    category: "cereals" },
  { id: "corn",        name: "Maïs",            nameEN: "Corn",            code: "CORN",      icon: "🌽", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 178,    category: "cereals" },
  { id: "rice",        name: "Riz",             nameEN: "Rice",            code: "RICE",      icon: "🍚", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 420,    category: "cereals" },
  { id: "soybean",     name: "Soja",            nameEN: "Soybean",         code: "SOYBEAN",   icon: "🫘", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 440,    category: "oilseeds" },
  { id: "sugar",       name: "Sucre",           nameEN: "Sugar",           code: "SUGAR",     icon: "🍬", unit: "c/kg",     unitWB: "c/kg",     basePrice: 19.80,  category: "softs" },
  { id: "coffee",      name: "Café",            nameEN: "Coffee",          code: "COFFEE",    icon: "☕", unit: "c/kg",     unitWB: "c/kg",     basePrice: 182.50, category: "softs" },
  { id: "cocoa",       name: "Cacao",           nameEN: "Cocoa",           code: "COCOA",     icon: "🍫", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 8450,   category: "softs" },
  { id: "palm_oil",    name: "Huile de palme",  nameEN: "Palm Oil",        code: "PALMOIL",   icon: "🌴", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 865,    category: "oilseeds" },
  { id: "cotton",      name: "Coton",           nameEN: "Cotton",          code: "COTTON",    icon: "☁️", unit: "c/kg",     unitWB: "c/kg",     basePrice: 72.30,  category: "fibers" },
  { id: "barley",      name: "Orge",            nameEN: "Barley",          code: "BARLEY",    icon: "🌿", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 198,    category: "cereals" },
  { id: "oats",        name: "Avoine",          nameEN: "Oats",            code: "OATS",      icon: "🥣", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 145,    category: "cereals" },
  { id: "sunflower",   name: "Tournesol",       nameEN: "Sunflower Oil",   code: "SUNFLWR",   icon: "🌻", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 520,    category: "oilseeds" },

  // ── EXTRAS (catalogue étendu) ──
  { id: "soybean_oil", name: "Huile de soja",   nameEN: "Soybean Oil",     code: "SOYOIL",    icon: "🫗", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 980,    category: "oilseeds" },
  { id: "rapeseed",    name: "Colza",           nameEN: "Rapeseed",        code: "RAPESEED",  icon: "🌼", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 475,    category: "oilseeds" },
  { id: "rubber",      name: "Caoutchouc",      nameEN: "Rubber",          code: "RUBBER",    icon: "🛞", unit: "c/kg",     unitWB: "c/kg",     basePrice: 155,    category: "industrials" },
  { id: "tea",         name: "Thé",             nameEN: "Tea",             code: "TEA",       icon: "🍵", unit: "c/kg",     unitWB: "c/kg",     basePrice: 265,    category: "softs" },
  { id: "orange",      name: "Jus d'orange",    nameEN: "Orange Juice",    code: "ORANGE",    icon: "🍊", unit: "c/kg",     unitWB: "c/kg",     basePrice: 320,    category: "softs" },
  { id: "banana",      name: "Banane",          nameEN: "Banana",          code: "BANANA",    icon: "🍌", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 950,    category: "softs" },
  { id: "olive_oil",   name: "Huile d'olive",   nameEN: "Olive Oil",       code: "OLIVOIL",   icon: "🫒", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 4200,   category: "oilseeds" },
  { id: "sorghum",     name: "Sorgho",          nameEN: "Sorghum",         code: "SORGHUM",   icon: "🌱", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 195,    category: "cereals" },
  { id: "coconut_oil", name: "Huile de coco",   nameEN: "Coconut Oil",     code: "COCOIL",    icon: "🥥", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 1150,   category: "oilseeds" },
  { id: "wool",        name: "Laine",           nameEN: "Wool",            code: "WOOL",      icon: "🐑", unit: "c/kg",     unitWB: "c/kg",     basePrice: 980,    category: "fibers" },
  { id: "tobacco",     name: "Tabac",           nameEN: "Tobacco",         code: "TOBACCO",   icon: "🍂", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 4800,   category: "softs" },
  { id: "groundnut",   name: "Arachide",        nameEN: "Groundnut",       code: "GRDNUT",    icon: "🥜", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 1350,   category: "oilseeds" },
  { id: "lentils",     name: "Lentilles",       nameEN: "Lentils",         code: "LENTILS",   icon: "🫘", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 680,    category: "cereals" },
  { id: "millet",      name: "Mil",             nameEN: "Millet",          code: "MILLET",    icon: "🌾", unit: "$/tonne",  unitWB: "$/tonne",  basePrice: 310,    category: "cereals" },
];

// Active commodities list (will be managed by the app)
let COMMODITIES = ALL_COMMODITIES.filter(c => DEFAULT_COMMODITY_IDS.includes(c.id));

// Exchange rates (approximate)
const EXCHANGE_RATES = {
  USD: 1,
  EUR: 0.92,
};

// Currency symbols
const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
};

// ============================================================
// REALISTIC DATA GENERATOR
// Uses seeded random walk to produce consistent, realistic
// commodity price histories
// ============================================================

function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generatePriceHistory(commodity, days) {
  // Seed based on commodity id for consistency
  let seed = 0;
  for (let i = 0; i < commodity.id.length; i++) {
    seed += commodity.id.charCodeAt(i) * (i + 1);
  }
  seed = seed * 1000 + days;
  const rng = seededRandom(seed);

  const prices = [];
  const now = new Date();
  let price = commodity.basePrice;

  // Volatility varies by commodity type
  const volatility = {
    cereals: 0.012,
    oilseeds: 0.015,
    softs: 0.018,
    fibers: 0.010,
  }[commodity.category] || 0.015;

  // Generate from oldest to newest
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(12, 0, 0, 0);

    // Random walk with mean reversion
    const drift = (commodity.basePrice - price) * 0.005; // mean reversion
    const shock = (rng() - 0.5) * 2 * volatility * price;

    // Add seasonal component for agricultural commodities
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    const seasonal = Math.sin(dayOfYear / 365 * Math.PI * 2) * price * 0.003;

    price = price + drift + shock + seasonal;
    price = Math.max(price * 0.7, Math.min(price * 1.3, price)); // clamp

    prices.push({
      date: date.toISOString().split('T')[0],
      timestamp: date.getTime(),
      price: Math.round(price * 100) / 100,
    });
  }

  return prices;
}

function getCurrentPrice(commodity) {
  const history = generatePriceHistory(commodity, 1);
  return history[history.length - 1].price;
}

function getPriceChange(commodity, days) {
  const history = generatePriceHistory(commodity, days);
  const first = history[0].price;
  const last = history[history.length - 1].price;
  const change = ((last - first) / first) * 100;
  return {
    absolute: last - first,
    percent: Math.round(change * 100) / 100,
    direction: change >= 0 ? "up" : "down",
  };
}
