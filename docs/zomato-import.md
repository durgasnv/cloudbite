# Zomato catalog import

The Zomato portion of the [combined catalog](catalog-import.md) was generated from the uploaded `dataset/zomato_dataset.csv`, corresponding to Kaggle's [Zomato Restaurants Dataset for Metropolitan Areas](https://www.kaggle.com/code/shakhauat/zomato-cleaning-analysis-visualizations/input?scriptVersionId=140177299). The source CSV is Git-ignored. Its redistribution rights have not been confirmed; check them before publishing the raw CSV or generated catalog. Importing this historical data does not establish a live connection to Zomato.

The importer maps restaurant name, city, place, cuisine, rating, item name, and price into the JSON files used by CloudBite. It preserves missing ratings as unknown, skips invalid prices, removes duplicate menu rows, and selects restaurants across cities so the demo does not show just the first city in the CSV. The source has four Bengaluru neighborhoods mislabeled as cities; the importer maps them to Bangalore and keeps the neighborhood in the displayed location. The defaults are 50 restaurants and 20 items each to keep the JSON API and browser responsive.

The Zomato portion of the current combined catalog contains 50 restaurants and 957 menu items. To regenerate just that portion and inspect it in a separate directory:

```bash
python3 scripts/import-zomato.py dataset/zomato_dataset.csv --output-dir /tmp/cloudbite-zomato
```

To restrict cities, repeat `--city`, for example `--city Hyderabad --city Mumbai`. After reviewing the generated JSON and source license, replace `server/data/restaurants.json` and `server/data/menu.json` together. Do not import the original 123,657 CSV rows directly into the browser feed. Existing cart items may have different prices or IDs after replacement, so clear demo carts before switching catalogs.

The app now uses the [combined catalog](catalog-import.md), so the running API returns more than the Zomato-only counts above. Existing Docker or Minikube containers use their previously built images until rebuilt and redeployed. Clear the browser's old CloudBite cart before ordering from a newly generated catalog because item IDs and prices may change.

The dataset has no reliable item images, vegetarian labels, availability, or delivery-time estimates. Imported records leave those fields unknown where possible. `isAvailable` is `true` only to enable CloudBite's simulated checkout; it does not assert that a real restaurant currently sells the item. The app does not place orders with real restaurants.
