# Optional Zomato catalog import

The supplied [analysis notebook](../zomato-cleaning-analysis-visualizations.ipynb) analyzes the Kaggle **Zomato Restaurants Dataset for Metropolitan Areas**. It reads `zomato_dataset.csv`; the CSV itself is not in this repository. Kaggle metadata currently labels its license **Other (specified in description)**, but the description does not state reuse terms. Confirm the rights before publishing imported records. The importer was checked against the CSV in `/tmp`; that temporary copy is not part of this repository.

The importer maps restaurant name, city, place, cuisine, rating, item name, and price into the JSON files used by CloudBite. It preserves missing ratings as unknown, skips invalid prices, removes duplicate menu rows, and selects restaurants across cities so the demo does not show just the first city in the CSV. The source has four Bengaluru neighborhoods mislabeled as cities; the importer maps them to Bangalore and keeps the neighborhood in the displayed location. The defaults are 50 restaurants and 20 items each to keep the JSON API and browser responsive.

First generate and inspect files in a separate directory:

```bash
python3 scripts/import-zomato.py /path/to/zomato_dataset.csv --output-dir /tmp/cloudbite-zomato
```

To restrict cities, repeat `--city`, for example `--city Hyderabad --city Mumbai`. After reviewing the generated JSON and source license, replace `server/data/restaurants.json` and `server/data/menu.json` together. Do not import the original 123,657 CSV rows directly into the browser feed. Existing cart items may have different prices or IDs after replacement, so clear demo carts before switching catalogs.

The dataset has no reliable item images, vegetarian labels, availability, or delivery-time estimates. Imported records leave those fields unknown where possible. `isAvailable` is `true` only to enable CloudBite's simulated checkout; it does not assert that a real restaurant currently sells the item. The app does not place orders with real restaurants.
