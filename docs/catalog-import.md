# Combined restaurant catalog

CloudBite uses a bounded demo catalog generated from three user-supplied CSVs under `dataset/`:

| Source file | Use in CloudBite |
| --- | --- |
| `zomato_dataset.csv` | Restaurant names, cities, cuisines, ratings, dish names, and prices. |
| `swiggy_all_menus_india.csv` | Additional restaurants, cities, dish names, categories, and prices. Its dish ratings are not treated as restaurant ratings. |
| `restaurants.csv` | Cuisine, restaurant rating, and cost-for-two enrichment where normalized restaurant name and city match a menu source. It has no dishes of its own. |

The generated `server/data/restaurants.json` and `server/data/menu.json` contain 100 restaurants, 1,957 dishes, and 30 cities: 50 restaurants from each menu source, with 26 listings enriched by `restaurants.csv`. The importer selects candidates across cities and caps each menu at 20 items so the JSON API and browser remain responsive. `source` and `metadataSource` fields record provenance. The raw CSVs are ignored by Git and are not read at app startup. Confirm redistribution rights before publicly publishing the generated records.

To regenerate the catalog from the supplied CSVs:

```bash
python3 scripts/import-catalog.py --output-dir server/data --overwrite
npm run check
npm test
```

For a local run on the port you mentioned:

```bash
PORT=5050 npm start
```

Open `http://localhost:5050/` for the six-card preview or `http://localhost:5050/restaurants.html` for the full feed. `http://localhost:5050/api/restaurants` should report `count: 100`; `/api/menu` should report `count: 1957`. The default port without `PORT=5050` is 5000. Clear an old CloudBite cart before ordering after a catalog replacement because IDs and prices may change. Rebuild and redeploy Docker/Minikube images to show catalog changes there.

These CSVs represent historical third-party records, not live restaurant inventory or prices. Missing images, vegetarian labels, and delivery times remain unknown. `isAvailable: true` only enables simulated checkout; it does not assert that a restaurant currently sells an item.
