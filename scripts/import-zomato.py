#!/usr/bin/env python3
"""Convert the metropolitan Zomato CSV into a small CloudBite demo catalog."""

import argparse
import csv
import json
import math
import os
from collections import defaultdict
from pathlib import Path


REQUIRED = {'Restaurant Name', 'Cuisine', 'Place Name', 'City', 'Item Name', 'Prices'}
CITY_ALIASES = {
    'banaswadi': 'Bangalore',
    'ulsoor': 'Bangalore',
    'magrath road': 'Bangalore',
    'malleshwaram': 'Bangalore',
}


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def write_json(path, data):
    temp_path = path.with_name(path.name + '.tmp')
    with temp_path.open('w', encoding='utf-8') as stream:
        json.dump(data, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    os.replace(temp_path, path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv_file', type=Path)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--city', action='append', help='Keep one city; may be repeated')
    parser.add_argument('--max-restaurants', type=int, default=50)
    parser.add_argument('--max-items-per-restaurant', type=int, default=20)
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args()
    if args.max_restaurants < 1 or args.max_items_per_restaurant < 1:
        parser.error('limits must be positive')

    requested_cities = {city.casefold() for city in args.city or []}
    grouped = {}
    with args.csv_file.open('r', encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        reader.fieldnames = [field.strip() for field in reader.fieldnames or []]
        missing = REQUIRED - set(reader.fieldnames or [])
        if missing:
            parser.error('CSV is missing columns: ' + ', '.join(sorted(missing)))
        for row in reader:
            name = (row['Restaurant Name'] or '').strip()
            source_city = (row['City'] or '').strip()
            city = CITY_ALIASES.get(source_city.casefold(), source_city)
            place = (row['Place Name'] or '').strip()
            if city != source_city:
                place = ', '.join(part for part in [place, source_city] if part)
            item = (row['Item Name'] or '').strip()
            price = number(row['Prices'])
            if not name or not city or not item or price is None or price <= 0:
                continue
            if requested_cities and city.casefold() not in requested_cities:
                continue

            key = (city.casefold(), place.casefold(), name.casefold())
            if key not in grouped:
                grouped[key] = {'name': name, 'city': city, 'place': place,
                                'cuisine': (row['Cuisine'] or '').strip(),
                                'rating': None, 'items': {}}
            restaurant = grouped[key]
            rating = number(row.get('Delivery Rating')) or number(row.get('Dining Rating'))
            if restaurant['rating'] is None and rating is not None and 0 <= rating <= 5:
                restaurant['rating'] = rating
            item_key = (item.casefold(), round(price, 2))
            restaurant['items'].setdefault(item_key, {'name': item, 'price': round(price, 2)})

    # Take restaurants across cities before applying the demo-sized limit.
    by_city = defaultdict(list)
    for restaurant in grouped.values():
        by_city[restaurant['city'].casefold()].append(restaurant)
    for entries in by_city.values():
        entries.sort(key=lambda r: (r['name'].casefold(), r['place'].casefold()))
    selected = []
    while len(selected) < args.max_restaurants and any(by_city.values()):
        for city in sorted(by_city):
            if by_city[city] and len(selected) < args.max_restaurants:
                selected.append(by_city[city].pop(0))

    restaurants = []
    menu = []
    for restaurant in selected:
        restaurant_id = len(restaurants) + 1
        restaurants.append({
            'id': restaurant_id,
            'name': restaurant['name'],
            'city': restaurant['city'],
            'location': ', '.join(part for part in [restaurant['place'], restaurant['city']] if part),
            'cuisine': restaurant['cuisine'],
            'rating': restaurant['rating'],
            'description': '',
            'image': None,
            'deliveryTime': None,
            'priceForTwo': None,
        })
        items = sorted(restaurant['items'].values(), key=lambda item: item['name'].casefold())
        for item in items[:args.max_items_per_restaurant]:
            menu.append({
                'id': len(menu) + 1,
                'restaurantId': restaurant_id,
                'name': item['name'],
                'description': '',
                'category': 'Menu',
                'price': item['price'],
                'isVeg': None,
                'isAvailable': True,
                'image': None,
            })

    if not restaurants or not menu:
        parser.error('no usable restaurant/menu records found')
    args.output_dir.mkdir(parents=True, exist_ok=True)
    targets = [args.output_dir / 'restaurants.json', args.output_dir / 'menu.json']
    if not args.overwrite and any(target.exists() for target in targets):
        parser.error('output files exist; use --overwrite to replace them')
    write_json(targets[0], restaurants)
    write_json(targets[1], menu)
    print(f'Wrote {len(restaurants)} restaurants and {len(menu)} items to {args.output_dir}')


if __name__ == '__main__':
    main()
