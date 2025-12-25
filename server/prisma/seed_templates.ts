// Corrected seed script for templates
// Run with: npx tsx prisma/seed_templates_fixed.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Use string literals instead of enum (compatible with TemplateCategory)
type TemplateCategory = 'WASHING' | 'DECOR' | 'MECHANICAL' | 'DENTING_PAINTING' | 'GENERAL' | 'CUSTOM';
type LineType = 'LABOUR' | 'PART' | 'OTHER';

type TemplateItemInput = {
  lineType: LineType;
  description: string;
  quantity: number;
  unitPrice: number; // in rupees (will be converted to paise)
  sortOrder?: number;
  inventoryItemId?: number;
};

async function upsertJobCardTemplate(params: {
  category: TemplateCategory;
  name: string;
  description?: string;
  items: TemplateItemInput[];
}) {
  const { category, name, description, items } = params;

  // Keep one template per category+name combination
  const existing = await prisma.jobCardTemplate.findFirst({
    where: { category, name },
    select: { id: true },
  });

  // If exists, update and recreate items
  if (existing) {
    await prisma.jobCardTemplate.update({
      where: { id: existing.id },
      data: {
        name,
        description: description ?? null,
        isActive: true,
      },
    });

    // Delete old items
    await prisma.jobCardTemplateItem.deleteMany({
      where: { templateId: existing.id },
    });

    // Create new items
    await prisma.jobCardTemplateItem.createMany({
      data: items.map((it, idx) => ({
        templateId: existing.id,
        lineType: it.lineType,
        description: it.description,
        quantity: it.quantity,
        unitPrice: Math.round(it.unitPrice * 100), // Convert to paise
        sortOrder: it.sortOrder ?? idx,
        inventoryItemId: it.inventoryItemId ?? null,
      })),
    });

    return;
  }

  // Create new template + items
  await prisma.jobCardTemplate.create({
    data: {
      name,
      category,
      description: description ?? null,
      isActive: true,
      lineItems: {
        create: items.map((it, idx) => ({
          lineType: it.lineType,
          description: it.description,
          quantity: it.quantity,
          unitPrice: Math.round(it.unitPrice * 100), // Convert to paise
          sortOrder: it.sortOrder ?? idx,
          inventoryItemId: it.inventoryItemId ?? null,
        })),
      },
    },
  });
}

async function main() {
  console.log("🌱 Seeding job card templates...");

  // ========================================
  // WASHING TEMPLATES
  // ========================================
  
  await upsertJobCardTemplate({
    category: 'WASHING',
    name: "Basic Wash",
    description: "Standard car washing service",
    items: [
      { lineType: 'LABOUR', description: "Exterior Wash", quantity: 1, unitPrice: 200 },
      { lineType: 'LABOUR', description: "Interior Vacuum", quantity: 1, unitPrice: 100 },
      { lineType: 'OTHER', description: "Tyre Polish", quantity: 1, unitPrice: 50 },
    ],
  });

  await upsertJobCardTemplate({
    category: 'WASHING',
    name: "Premium Wash",
    description: "Premium wash with waxing",
    items: [
      { lineType: 'LABOUR', description: "Exterior Deep Wash", quantity: 1, unitPrice: 300 },
      { lineType: 'LABOUR', description: "Interior Detailed Cleaning", quantity: 1, unitPrice: 200 },
      { lineType: 'LABOUR', description: "Dashboard Polish", quantity: 1, unitPrice: 100 },
      { lineType: 'PART', description: "Car Wax Application", quantity: 1, unitPrice: 150 },
      { lineType: 'OTHER', description: "Tyre Shine", quantity: 1, unitPrice: 75 },
      { lineType: 'OTHER', description: "Glass Cleaning", quantity: 1, unitPrice: 50 },
    ],
  });

  // ========================================
  // DECOR TEMPLATES
  // ========================================
  
  await upsertJobCardTemplate({
    category: 'DECOR',
    name: "Interior Detailing",
    description: "Complete interior detailing service",
    items: [
      { lineType: 'LABOUR', description: "Deep Interior Cleaning", quantity: 1, unitPrice: 500 },
      { lineType: 'LABOUR', description: "Seat Shampooing", quantity: 1, unitPrice: 400 },
      { lineType: 'LABOUR', description: "Dashboard & Console Polish", quantity: 1, unitPrice: 200 },
      { lineType: 'LABOUR', description: "Door Panel Cleaning", quantity: 1, unitPrice: 150 },
      { lineType: 'PART', description: "Interior Cleaner", quantity: 1, unitPrice: 200 },
      { lineType: 'PART', description: "Dashboard Polish", quantity: 1, unitPrice: 150 },
    ],
  });

  await upsertJobCardTemplate({
    category: 'DECOR',
    name: "Exterior Detailing",
    description: "Exterior detailing with coating",
    items: [
      { lineType: 'LABOUR', description: "Paint Correction", quantity: 1, unitPrice: 800 },
      { lineType: 'LABOUR', description: "Ceramic Coating Application", quantity: 1, unitPrice: 1500 },
      { lineType: 'PART', description: "Ceramic Coating", quantity: 1, unitPrice: 2500 },
      { lineType: 'OTHER', description: "Headlight Restoration", quantity: 1, unitPrice: 400 },
    ],
  });

  // ========================================
  // MECHANICAL TEMPLATES
  // ========================================
  
  await upsertJobCardTemplate({
    category: 'MECHANICAL',
    name: "Oil Change Service",
    description: "Engine oil and filter change",
    items: [
      { lineType: 'LABOUR', description: "Oil Change Labour", quantity: 1, unitPrice: 200 },
      { lineType: 'PART', description: "Engine Oil (5W-30)", quantity: 4, unitPrice: 400 },
      { lineType: 'PART', description: "Oil Filter", quantity: 1, unitPrice: 250 },
      { lineType: 'PART', description: "Drain Plug Washer", quantity: 1, unitPrice: 20 },
    ],
  });

  await upsertJobCardTemplate({
    category: 'MECHANICAL',
    name: "Full Service",
    description: "Complete vehicle service",
    items: [
      { lineType: 'LABOUR', description: "Full Service Labour", quantity: 1, unitPrice: 800 },
      { lineType: 'PART', description: "Engine Oil (5W-30)", quantity: 4, unitPrice: 400 },
      { lineType: 'PART', description: "Oil Filter", quantity: 1, unitPrice: 250 },
      { lineType: 'PART', description: "Air Filter", quantity: 1, unitPrice: 300 },
      { lineType: 'PART', description: "Cabin Filter", quantity: 1, unitPrice: 350 },
      { lineType: 'PART', description: "Spark Plugs", quantity: 4, unitPrice: 200 },
      { lineType: 'OTHER', description: "Coolant Top-up", quantity: 1, unitPrice: 150 },
    ],
  });

  await upsertJobCardTemplate({
    category: 'MECHANICAL',
    name: "Brake Service",
    description: "Brake pads and fluid service",
    items: [
      { lineType: 'LABOUR', description: "Brake Service Labour", quantity: 1, unitPrice: 600 },
      { lineType: 'PART', description: "Front Brake Pads", quantity: 1, unitPrice: 1200 },
      { lineType: 'PART', description: "Rear Brake Pads", quantity: 1, unitPrice: 1000 },
      { lineType: 'PART', description: "Brake Fluid", quantity: 1, unitPrice: 300 },
      { lineType: 'OTHER', description: "Brake Bleeding", quantity: 1, unitPrice: 200 },
    ],
  });

  await upsertJobCardTemplate({
    category: 'MECHANICAL',
    name: "AC Service",
    description: "Air conditioning service",
    items: [
      { lineType: 'LABOUR', description: "AC Service Labour", quantity: 1, unitPrice: 500 },
      { lineType: 'PART', description: "AC Gas (R134a)", quantity: 1, unitPrice: 800 },
      { lineType: 'PART', description: "AC Filter/Drier", quantity: 1, unitPrice: 450 },
      { lineType: 'OTHER', description: "AC Performance Test", quantity: 1, unitPrice: 100 },
    ],
  });

  // ========================================
  // DENTING & PAINTING TEMPLATES
  // ========================================
  
  await upsertJobCardTemplate({
    category: 'DENTING_PAINTING',
    name: "Minor Dent Repair",
    description: "Small dent repair and touch-up",
    items: [
      { lineType: 'LABOUR', description: "Dent Removal Labour", quantity: 1, unitPrice: 800 },
      { lineType: 'LABOUR', description: "Surface Preparation", quantity: 1, unitPrice: 300 },
      { lineType: 'LABOUR', description: "Painting Labour", quantity: 1, unitPrice: 500 },
      { lineType: 'PART', description: "Primer", quantity: 1, unitPrice: 200 },
      { lineType: 'PART', description: "Paint", quantity: 1, unitPrice: 600 },
      { lineType: 'PART', description: "Clear Coat", quantity: 1, unitPrice: 300 },
      { lineType: 'OTHER', description: "Polishing", quantity: 1, unitPrice: 200 },
    ],
  });

  await upsertJobCardTemplate({
    category: 'DENTING_PAINTING',
    name: "Full Panel Paint",
    description: "Complete panel painting",
    items: [
      { lineType: 'LABOUR', description: "Panel Preparation", quantity: 1, unitPrice: 600 },
      { lineType: 'LABOUR', description: "Painting Labour", quantity: 1, unitPrice: 1200 },
      { lineType: 'PART', description: "Primer (1 ltr)", quantity: 1, unitPrice: 400 },
      { lineType: 'PART', description: "Paint (1 ltr)", quantity: 1, unitPrice: 1200 },
      { lineType: 'PART', description: "Clear Coat (1 ltr)", quantity: 1, unitPrice: 600 },
      { lineType: 'PART', description: "Sandpaper Kit", quantity: 1, unitPrice: 150 },
      { lineType: 'OTHER', description: "Masking & Protection", quantity: 1, unitPrice: 300 },
      { lineType: 'OTHER', description: "Buffing & Polishing", quantity: 1, unitPrice: 400 },
    ],
  });

  // ========================================
  // GENERAL TEMPLATES
  // ========================================
  
  await upsertJobCardTemplate({
    category: 'GENERAL',
    name: "General Inspection",
    description: "Basic vehicle inspection",
    items: [
      { lineType: 'LABOUR', description: "Visual Inspection", quantity: 1, unitPrice: 200 },
      { lineType: 'LABOUR', description: "Diagnostic Scan", quantity: 1, unitPrice: 300 },
      { lineType: 'OTHER', description: "Inspection Report", quantity: 1, unitPrice: 100 },
    ],
  });

  await upsertJobCardTemplate({
    category: 'GENERAL',
    name: "Battery Service",
    description: "Battery testing and replacement",
    items: [
      { lineType: 'LABOUR', description: "Battery Testing & Installation", quantity: 1, unitPrice: 200 },
      { lineType: 'PART', description: "Car Battery", quantity: 1, unitPrice: 4500 },
      { lineType: 'OTHER', description: "Terminal Cleaning", quantity: 1, unitPrice: 50 },
    ],
  });

  console.log("✅ Seeded 13 job card templates successfully!");
  console.log("   - Washing: 2 templates");
  console.log("   - Decor: 2 templates");
  console.log("   - Mechanical: 4 templates");
  console.log("   - Denting & Painting: 3 templates");
  console.log("   - General: 2 templates");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });