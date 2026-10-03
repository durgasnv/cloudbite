#!/usr/bin/env python3
"""Build a bounded CloudBite catalog from the three locally supplied CSV files."""

import argparse
import csv
import json
import os
import re
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path


CITY_ALIASES = {'bengaluru': 'Bangalore', 'delhi': 'New Delhi'}


def clean(value):
    return (value or '').strip()


def key(value):
    return re.sub(r'[^a-z0-9]+', '', clean(value).casefold())


def city_name(value):
    value = clean(value)
    return CITY_ALIASES.get(value.casefold(), value)


def positive_price(value):
    try:
        amount = round(float(clean(value)), 2)
        return amount if 0 < amount <= 10000 else None
    except ValueError:
        return None


def rating(value):
    try:
        amount = float(clean(value))
        return amount if 0 < amount <= 5 else None
    except ValueError:
        return None


def read_csv(path, required):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if not required.issubset(set(reader.fieldnames or [])):
            raise ValueError(f'{path} is missing columns: {sorted(required - set(reader.fieldnames or []))}')
        yield from reader


def restaurant_metadata(path):
    result = defaultdict(list)
    required = {'Name', 'City', 'Cuisine', 'Rating', 'Cost'}
    for row in read_csv(path, required):
        identifier = (key(city_name(row['City'])), key(row['Name']))
        if all(identifier):
            result[identifier].append(row)
    return result


def best_metadata(rows, location):
    if not rows:
        return None
    location_key = key(location)
    def score(row):
        locality = key(row.get('Locality'))
        place_match = bool(locality and locality in location_key)
        try:
            votes = int(clean(row.get('Votes')) or 0)
        except ValueError:
            votes = 0
        return (place_match, votes)
    return max(rows, key=score)


def enrich(restaurant, metadata):
    rows = metadata.get((key(restaurant['city']), key(restaurant['name'])), [])
    match = best_metadata(rows, restaurant['location'])
    if not match:
        return
    restaurant['metadataSource'] = 'restaurants.csv'
    restaurant['priceForTwo'] = positive_price(match.get('Cost'))
    if not restaurant.get('cuisine'):
        restaurant['cuisine'] = clean(match.get('Cuisine')) or 'Various'
    if restaurant.get('rating') is None:
        restaurant['rating'] = rating(match.get('Rating'))


def swiggy_groups(path):
    groups = {}
    required = {'City', 'Restaurant Name', 'Location', 'Category', 'Dish Name', 'Price (INR)'}
    for row in read_csv(path, required):
        city = city_name(row['City'])
        name = clean(row['Restaurant Name'])
        location = clean(row['Location'])
        dish = clean(row['Dish Name'])
        price = positive_price(row['Price (INR)'])
        if not city or not name or not dish or price is None:
            continue
        identifier = (key(city), key(name), key(location))
        if identifier not in groups:
            groups[identifier] = {'city': city, 'name': name, 'place': location, 'items': {}}
        item_key = (key(dish), price)
        groups[identifier]['items'].setdefault(item_key, {
            'name': dish, 'price': price, 'category': clean(row['Category']) or 'Menu'
        })
    return list(groups.values())


def choose_swiggy(groups, metadata, limit):
    by_city = defaultdict(list)
    for group in groups:
        by_city[key(group['city'])].append(group)
    for candidates in by_city.values():
        candidates.sort(key=lambda group: (
            -bool(metadata.get((key(group['city']), key(group['name'])))),
            -len(group['items']),
            group['name'].casefold(), group['place'].casefold()
        ))
    selected = []
    while len(selected) < limit and any(by_city.values()):
        for city in sorted(by_city):
            if by_city[city] and len(selected) < limit:
                selected.append(by_city[city].pop(0))
    return selected


def write_json(path, value):
    temporary = path.with_name(path.name + '.tmp')
    with temporary.open('w', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    os.replace(temporary, path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zomato-csv', type=Path, default=Path('dataset/zomato_dataset.csv'))
    parser.add_argument('--swiggy-csv', type=Path, default=Path('dataset/swiggy_all_menus_india.csv'))
    parser.add_argument('--restaurants-csv', type=Path, default=Path('dataset/restaurants.csv'))
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--max-zomato-restaurants', type=int, default=50)
    parser.add_argument('--max-swiggy-restaurants', type=int, default=50)
    parser.add_argument('--max-items-per-restaurant', type=int, default=20)
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args()
    if min(args.max_zomato_restaurants, args.max_swiggy_restaurants,
           args.max_items_per_restaurant) < 1:
        parser.error('limits must be positive')
    targets = [args.output_dir / 'restaurants.json', args.output_dir / 'menu.json']
    if not args.overwrite and any(path.exists() for path in targets):
        parser.error('output files exist; use --overwrite to replace them')

    with tempfile.TemporaryDirectory(prefix='cloudbite-zomato-') as temp:
        subprocess.run([
            sys.executable, str(Path(__file__).with_name('import-zomato.py')),
            str(args.zomato_csv), '--output-dir', temp,
            '--max-restaurants', str(args.max_zomato_restaurants),
            '--max-items-per-restaurant', str(args.max_items_per_restaurant)
        ], check=True, stdout=subprocess.DEVNULL)
        restaurants = json.loads((Path(temp) / 'restaurants.json').read_text(encoding='utf-8'))
        menu = json.loads((Path(temp) / 'menu.json').read_text(encoding='utf-8'))

    metadata = restaurant_metadata(args.restaurants_csv)
    for restaurant in restaurants:
        restaurant['source'] = 'Zomato dataset'
        enrich(restaurant, metadata)

    groups = swiggy_groups(args.swiggy_csv)
    for group in choose_swiggy(groups, metadata, args.max_swiggy_restaurants):
        restaurant_id = len(restaurants) + 1
        restaurant = {
            'id': restaurant_id,
            'name': group['name'],
            'city': group['city'],
            'location': ', '.join(part for part in [group['place'], group['city']] if part),
            'cuisine': '', 'rating': None, 'description': '', 'image': None,
            'deliveryTime': None, 'priceForTwo': None, 'source': 'Swiggy menu dataset'
        }
        enrich(restaurant, metadata)
        restaurant['cuisine'] = restaurant['cuisine'] or 'Various'
        restaurants.append(restaurant)
        items = sorted(group['items'].values(), key=lambda item: (item['name'].casefold(), item['price']))
        for item in items[:args.max_items_per_restaurant]:
            menu.append({
                'id': len(menu) + 1, 'restaurantId': restaurant_id,
                'name': item['name'], 'description': '', 'category': item['category'],
                'price': item['price'], 'isVeg': None, 'isAvailable': True, 'image': None
            })

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_json(targets[0], restaurants)
    write_json(targets[1], menu)
    enriched = sum(restaurant.get('metadataSource') == 'restaurants.csv' for restaurant in restaurants)
    print(f'Wrote {len(restaurants)} restaurants, {len(menu)} dishes, '
          f'{len({restaurant["city"] for restaurant in restaurants})} cities; '
          f'{enriched} restaurants enriched by metadata')


if __name__ == '__main__':
    main()
