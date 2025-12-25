import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

interface InventoryItemBody {
  name: string;
  category?: string;
  sku?: string;
  brand?: string;
  unit?: string;
  minStock?: number;
}

interface StockTransactionBody {
  type: "IN" | "OUT";
  quantity: number;
  unitPrice?: number; // rupees (for IN)
  reason?: string;
  date?: string; // ISO
}

// helper: compute current stock from transactions
function computeCurrentStock(
  transactions: { type: "IN" | "OUT"; quantity: number }[]
) {
  let stock = 0;
  for (const t of transactions) {
    if (t.type === "IN") stock += t.quantity;
    else stock -= t.quantity;
  }
  return stock;
}

// Map DB item + transactions -> API
function mapItem(item: any, transactions: any[] = []) {
  const currentStock = computeCurrentStock(
    transactions as { type: "IN" | "OUT"; quantity: number }[]
  );

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    sku: item.sku,
    brand: item.brand,
    unit: item.unit,
    minStock: item.minStock,
    currentStock,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

// POST /inventory  -> create item
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, category, sku, brand, unit, minStock } =
      req.body as InventoryItemBody;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name,
        category: category ?? null,
        sku: sku ?? null,
        brand: brand ?? null,
        unit: unit ?? null,
        minStock: typeof minStock === "number" ? minStock : 0,
      },
    });

    return res.status(201).json(mapItem(item));
  } catch (err) {
    console.error("Create inventory item error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /inventory  -> list items with current stock
router.get("/", authMiddleware, async (_req: AuthRequest, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: "asc" },
      include: {
        stockTransactions: {
          select: {
            type: true,
            quantity: true,
          },
        },
      },
    });

    const result = items.map((i: any) => mapItem(i, i.stockTransactions));
    return res.json(result);
  } catch (err) {
    console.error("List inventory error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /inventory/:id  -> item with current stock
router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        stockTransactions: {
          select: {
            type: true,
            quantity: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    return res.json(mapItem(item, item.stockTransactions));
  } catch (err) {
    console.error("Get inventory item error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /inventory/:id  -> update basic fields
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const { name, category, sku, brand, unit, minStock } =
      req.body as InventoryItemBody;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name,
        category: category ?? null,
        sku: sku ?? null,
        brand: brand ?? null,
        unit: unit ?? null,
        minStock: typeof minStock === "number" ? minStock : 0,
      },
      include: {
        stockTransactions: {
          select: { type: true, quantity: true },
        },
      },
    });

    return res.json(mapItem(item, item.stockTransactions));
  } catch (err: any) {
    console.error("Update inventory item error:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Item not found" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /inventory/:id/stock  -> add stock IN/OUT
router.post("/:id/stock", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    const { type, quantity, unitPrice, reason, date } =
      req.body as StockTransactionBody;

    if (!type || !["IN", "OUT"].includes(type)) {
      return res
        .status(400)
        .json({ message: 'type must be "IN" or "OUT"' });
    }

    if (!quantity || quantity <= 0) {
      return res
        .status(400)
        .json({ message: "quantity must be a positive number" });
    }

    let unitPricePaise: number | null = null;
    if (typeof unitPrice === "number") {
      unitPricePaise = Math.round(unitPrice * 100);
    }

    const tx = await prisma.stockTransaction.create({
      data: {
        itemId: item.id,
        type,
        quantity,
        unitPrice: unitPricePaise,
        reason: reason ?? null,
        date: date ? new Date(date) : new Date(),
      },
    });

    return res.status(201).json({
      id: tx.id,
      itemId: tx.itemId,
      type: tx.type,
      quantity: tx.quantity,
      unitPrice: tx.unitPrice != null ? tx.unitPrice / 100 : null,
      reason: tx.reason,
      date: tx.date,
      createdAt: tx.createdAt,
    });
  } catch (err) {
    console.error("Create stock transaction error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /inventory/:id/stock-transactions
router.get(
  "/:id/stock-transactions",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid item id" });
      }

      const item = await prisma.inventoryItem.findUnique({ where: { id } });
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      const txs = await prisma.stockTransaction.findMany({
        where: { itemId: item.id },
        orderBy: { date: "desc" },
      });

      const result = txs.map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        quantity: tx.quantity,
        unitPrice: tx.unitPrice != null ? tx.unitPrice / 100 : null,
        reason: tx.reason,
        date: tx.date,
        createdAt: tx.createdAt,
      }));

      return res.json({
        item: {
          id: item.id,
          name: item.name,
        },
        transactions: result,
      });
    } catch (err) {
      console.error("List stock transactions error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// DELETE /inventory/:id
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const txCount = await prisma.stockTransaction.count({
      where: { itemId: id },
    });

    if (txCount > 0) {
      return res.status(400).json({
        message:
          "Cannot delete item with existing stock transactions. Delete transactions first.",
      });
    }

    await prisma.inventoryItem.delete({ where: { id } });

    return res.status(204).send();
  } catch (err: any) {
    console.error("Delete inventory item error:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Item not found" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /inventory/:id/stock/:txId
router.delete(
  "/:id/stock/:txId",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const txId = Number(req.params.txId);

      if (isNaN(id) || isNaN(txId)) {
        return res
          .status(400)
          .json({ message: "Invalid item or transaction id" });
      }

      const tx = await prisma.stockTransaction.findUnique({
        where: { id: txId },
      });

      if (!tx || tx.itemId !== id) {
        return res
          .status(404)
          .json({ message: "Stock transaction not found for this item" });
      }

      await prisma.stockTransaction.delete({ where: { id: txId } });

      return res.status(204).send();
    } catch (err: any) {
      console.error("Delete stock transaction error:", err);
      if (err.code === "P2025") {
        return res
          .status(404)
          .json({ message: "Stock transaction not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default router;
