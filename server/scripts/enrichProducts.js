#!/usr/bin/env node
// Applies the long descriptions and grouped specifications from
// server/data/productDetails.js to products already in the database, matched
// by SKU. Only `description` and `specs` change — prices, stock, images and
// everything else are left untouched.
//
// Existing spec groups are kept and merged: the product's "General" group
// (brand / condition / warranty) and any group an admin added by hand stay;
// groups defined in productDetails.js replace the ones with the same name.
//
//   node server/scripts/enrichProducts.js --dry-run   # show what would change
//   node server/scripts/enrichProducts.js             # apply

import 'dotenv/config';
import { eq, inArray } from 'drizzle-orm';
import { db, rawSql } from '../db/client.js';
import { products } from '../db/schema.js';
import { PRODUCT_DETAILS } from '../data/productDetails.js';

const dryRun = process.argv.includes('--dry-run');

async function run() {
  const skus = Object.keys(PRODUCT_DETAILS);
  const rows = await db.select({ id: products.id, sku: products.sku, name: products.name, specs: products.specs })
    .from(products).where(inArray(products.sku, skus));
  const found = new Set(rows.map((r) => r.sku));

  let updated = 0;
  for (const row of rows) {
    const details = PRODUCT_DETAILS[row.sku];
    const specs = { ...(row.specs || {}), ...details.specs };
    // Keep General first so the specs table opens with brand/condition/warranty.
    const ordered = row.specs?.General ? { General: row.specs.General, ...specs } : specs;
    const groups = Object.keys(details.specs).length;
    console.log(`${dryRun ? '[dry-run] ' : ''}${row.sku.padEnd(18)} ${row.name} — description ${details.description.length} chars, ${groups} spec groups`);
    if (!dryRun) {
      await db.update(products).set({ description: details.description, specs: ordered, updatedAt: new Date() }).where(eq(products.id, row.id));
      updated += 1;
    }
  }

  const missing = skus.filter((s) => !found.has(s));
  if (missing.length) console.log(`\nNot in the database (skipped): ${missing.join(', ')}`);
  console.log(dryRun ? `\nDry run: ${rows.length} products would be updated.` : `\nUpdated ${updated} products.`);
}

run()
  .catch((err) => {
    console.error('Enrichment failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await rawSql?.end?.();
  });
