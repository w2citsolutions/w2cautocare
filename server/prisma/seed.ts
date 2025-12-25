// server/prisma/seed.ts
import { PrismaClient, InspectionTemplateKind } from "@prisma/client";

const prisma = new PrismaClient();

type ItemInput = {
  label: string;
  section?: string;
  sortOrder?: number;
  isCritical?: boolean;
};

async function upsertTemplate(params: {
  kind: InspectionTemplateKind;
  name: string;
  description?: string;
  items: ItemInput[];
}) {
  const { kind, name, description, items } = params;

  // keep one template per kind
  const existing = await prisma.inspectionTemplate.findFirst({
    where: { kind },
    select: { id: true },
  });

  // If exists, update name/description, delete old items, recreate items
  if (existing) {
    await prisma.inspectionTemplate.update({
      where: { id: existing.id },
      data: {
        name,
        description: description ?? null,
        isActive: true,
      },
    });

    // delete items (so the list stays exactly as in seed)
    await prisma.inspectionTemplateItem.deleteMany({
      where: { templateId: existing.id },
    });

    await prisma.inspectionTemplateItem.createMany({
      data: items.map((it, idx) => ({
        templateId: existing.id,
        label: it.label,
        section: it.section ?? null,
        sortOrder: it.sortOrder ?? idx,
        isCritical: it.isCritical ?? false,
      })),
    });

    return;
  }

  // Create new template + items
  await prisma.inspectionTemplate.create({
    data: {
      name,
      kind,
      description: description ?? null,
      isActive: true,
      items: {
        create: items.map((it, idx) => ({
          label: it.label,
          section: it.section ?? null,
          sortOrder: it.sortOrder ?? idx,
          isCritical: it.isCritical ?? false,
        })),
      },
    },
  });
}

async function main() {
  await upsertTemplate({
    kind: InspectionTemplateKind.GENERAL_SERVICE,
    name: "General Service",
    description: "Standard periodic service checklist",
    items: [
      { section: "Engine", label: "Engine oil level / condition", isCritical: true },
      { section: "Engine", label: "Oil filter condition / replacement" },
      { section: "Engine", label: "Coolant level / leaks", isCritical: true },
      { section: "Engine", label: "Drive belts condition" },

      { section: "Brakes", label: "Brake pads/shoes thickness", isCritical: true },
      { section: "Brakes", label: "Brake fluid level / condition", isCritical: true },
      { section: "Brakes", label: "Brake lines / leaks" },

      { section: "Tyres", label: "Tyre tread & wear pattern", isCritical: true },
      { section: "Tyres", label: "Tyre pressure set", isCritical: true },
      { section: "Tyres", label: "Spare tyre condition" },

      { section: "Electrical", label: "Battery health / terminals", isCritical: true },
      { section: "Electrical", label: "Headlights / indicators / brake lights" },
      { section: "Electrical", label: "Horn operation" },

      { section: "Fluids", label: "Windshield washer fluid" },
      { section: "Fluids", label: "Power steering fluid (if applicable)" },

      { section: "Underbody", label: "Suspension / bushings / noises" },
      { section: "Underbody", label: "Exhaust leaks / mounting" },

      { section: "Cabin", label: "Cabin filter condition" },
      { section: "Cabin", label: "Wipers / washer spray", isCritical: true },
    ],
  });

  await upsertTemplate({
    kind: InspectionTemplateKind.AC_SERVICE,
    name: "AC Service",
    description: "Air-conditioning inspection and service checklist",
    items: [
      { section: "Performance", label: "Vent temperature check" },
      { section: "Performance", label: "Cooling performance under idle" },

      { section: "System", label: "Gas pressure check" },
      { section: "System", label: "Leak check (UV / nitrogen / soap)", isCritical: true },
      { section: "System", label: "Compressor noise / clutch operation", isCritical: true },

      { section: "Airflow", label: "Blower speed operation" },
      { section: "Airflow", label: "Cabin filter clean/replace" },

      { section: "Condenser", label: "Condenser fins clean/blocked" },
      { section: "Condenser", label: "Radiator fan operation", isCritical: true },

      { section: "Hoses", label: "AC hoses / joints condition" },
      { section: "Hoses", label: "Drain pipe blockage / water inside cabin" },
    ],
  });

  await upsertTemplate({
    kind: InspectionTemplateKind.BRAKE_JOB,
    name: "Brake Job",
    description: "Brake service/repair checklist",
    items: [
      { section: "Inspection", label: "Brake pad thickness (front)", isCritical: true },
      { section: "Inspection", label: "Brake pad thickness (rear)", isCritical: true },
      { section: "Inspection", label: "Disc condition / scoring / runout", isCritical: true },
      { section: "Inspection", label: "Drum condition (if applicable)" },

      { section: "Hydraulics", label: "Brake fluid level / contamination", isCritical: true },
      { section: "Hydraulics", label: "Caliper/piston leakage", isCritical: true },
      { section: "Hydraulics", label: "Brake lines / hose cracks", isCritical: true },

      { section: "Hardware", label: "Caliper pins / lubrication" },
      { section: "Hardware", label: "Handbrake cable adjustment" },

      { section: "Road Test", label: "Brake noise / vibration" },
      { section: "Road Test", label: "Brake pulling left/right" },
    ],
  });

  console.log("✅ Seeded inspection templates: General Service, AC Service, Brake Job");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
