# MyRaceCard — myracecard.co.uk

## What it does
Generates a clean, shareable image that runners can use to guide themselves through a race — showing checkpoints, target times, distances, elevation, and cutoffs at a glance.

## Who it's for
Runners participating in trail races, ultras, and marathons who want a visual race plan they can screenshot and reference during the event.

## Problem it solves
Helps runners remember distances, estimated times, and checkpoint details without digging through spreadsheets or race packs — just a quick look at their screen.

## How it works
1. User enters checkpoints manually or loads a GPX file
2. Enters their start time and target pace
3. App calculates arrival times and leg splits automatically
4. User picks which fields to show and chooses a theme
5. App generates a downloadable image in a card-based layout

## Themes (based on Pennine 50 project)
- Arctic — light blue background, white cards
- Forest — dark green background, green accents
- Mono — black and white, monospace feel
- Neon — black background, cyan/pink accents
- Sunrise — amber/orange background, warm tones
- Default — dark navy, teal accents

## Fields per checkpoint card
- CP name and number
- Target arrival time (large, prominent)
- Cutoff time
- Total distance so far
- Distance to next CP
- Leg time
- Leg elevation climb

## Stack
- Vanilla JS, HTML, CSS (web first)
- No backend needed — everything runs in the browser
- Image generation via Canvas API or html2canvas

## Folder Structure
- 1. HTML — main app pages
- 2. Images — screenshots, assets, generated examples
- 3. Scripts — JS files
- 4. Data — sample GPX files for testing
- 5. Styles — CSS files

## Business Model
- Free: generate and download cards
- Paid (future): remove branding, custom themes, saved race plans
