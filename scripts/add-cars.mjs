// Appends draft cars to cars.json from compact rows. Existing ids are skipped, so it is safe to re-run.
// Specs and blurbs are drafts written from general knowledge: they are marked reviewed:false until a human checks them.
//   npm run cars:add
//
// Row: [id, make, model, gen, year, cc, tier, hp, nm, 0-100 s, top km/h, kg, value CR, pools, tastes, wikipedia title, blurb, photoMatch?]
// pools: s street, h heritage, a apex.  tastes: e everyday, j jdm, p supercars, c classics, r rally, x concepts.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const file = join(dirname(fileURLToPath(import.meta.url)), '../supabase/functions/_shared/game/cars.json')
const COUNTRY = { IT: 'Italy', DE: 'Germany', GB: 'United Kingdom', JP: 'Japan', FR: 'France', US: 'United States', SE: 'Sweden', RU: 'Russia', CZ: 'Czechia' }
const TIER = { C: 'Common', R: 'Rare', E: 'Epic', L: 'Legendary' }
const POOL = { s: 'street', h: 'heritage', a: 'apex' }
const TASTE = { e: 'everyday', j: 'jdm', p: 'supercars', c: 'classics', r: 'rally', x: 'concepts' }

const ROWS = [
  // ── Common ──
  ['citroen-2cv', 'Citroën', '2CV', '', 1948, 'FR', 'C', 29, 53, 40, 115, 560, 6500, 'h', 'ec', 'Citroën 2CV', 'A rugged, soft-sprung farm-and-town car designed to carry eggs across a ploughed field without breaking them.'],
  ['vw-beetle', 'Volkswagen', 'Beetle', 'Type 1', 1967, 'DE', 'C', 53, 98, 27, 125, 800, 8000, 'h', 'ec', 'Volkswagen Beetle', 'An air-cooled flat-four in the back of one of the best-selling cars of all time.'],
  ['fiat-500-nuova', 'Fiat', '500', 'Nuova', 1957, 'IT', 'C', 18, 30, 45, 95, 500, 7500, 'h', 'ec', 'Fiat 500', 'A tiny rear-engine city car that put postwar Italy on wheels.'],
  ['peugeot-205-rallye', 'Peugeot', '205 Rallye', '', 1988, 'FR', 'C', 103, 134, 9.3, 185, 794, 9500, 's', 'er', 'Peugeot 205', 'A stripped, lightweight 205 with a 1.3 litre engine and steel wheels, built for cheap rally homologation.', 'Rallye'],
  ['renault-clio-16s', 'Renault', 'Clio 16S', '', 1991, 'FR', 'C', 137, 145, 8.0, 210, 960, 9000, 's', 'e', 'Renault Clio', 'A 1.8 litre 16-valve Clio that gave Renault a proper hot hatch to rival the 205 GTI.', '16S|Clio'],
  ['citroen-ax-gt', 'Citroën', 'AX GT', '', 1987, 'FR', 'C', 85, 119, 9.5, 175, 722, 6000, 's', 'e', 'Citroën AX', 'Under 750 kg and fun for it, a light, revvy hot hatch.', 'AX'],
  ['citroen-saxo-vts', 'Citroën', 'Saxo VTS', '', 1996, 'FR', 'C', 120, 153, 8.1, 200, 935, 7500, 's', 'e', 'Citroën Saxo', 'A feisty 1.6 litre 16-valve hatch and a favourite of the 90s hot hatch scene.', 'Saxo'],
  ['opel-kadett-gsi', 'Opel', 'Kadett GSi', 'E', 1984, 'DE', 'C', 115, 148, 9.0, 200, 915, 8500, 's', 'e', 'Opel Kadett', 'Opel’s answer to the Golf GTI: fuel injection and a 1.8 litre engine in a squared-off body.', 'Kadett'],
  ['vauxhall-nova-gte', 'Vauxhall', 'Nova GTE', '', 1983, 'GB', 'C', 100, 128, 9.0, 185, 780, 6500, 's', 'e', 'Vauxhall Nova', 'A light supermini with a 1.3 litre engine and sporty trim, popular with young drivers in the 80s.', 'Nova'],
  ['ford-escort-xr3i', 'Ford', 'Escort XR3i', 'Mk3', 1982, 'GB', 'C', 105, 138, 9.5, 185, 910, 8000, 's', 'e', 'Ford Escort (Europe)', 'Ford’s fuel-injected hot hatch of the early 80s, with a deep front air dam and a rear spoiler.', 'XR3'],
  ['ford-puma-17', 'Ford', 'Puma 1.7', '', 1997, 'GB', 'C', 125, 157, 9.2, 200, 1043, 9000, 's', 'e', 'Ford Puma', 'A coupé on Fiesta underpinnings with a Yamaha-developed 1.7 litre engine. Handling was its trump card.', 'Puma'],
  ['vw-polo-g40', 'Volkswagen', 'Polo G40', 'Mk2', 1991, 'DE', 'C', 113, 160, 8.9, 190, 880, 10500, 's', 'e', 'Volkswagen Polo Mk2', 'A supercharged Polo with a snail-shaped G-Lader and a limited run.', 'G40|Polo'],
  ['vw-golf-gti-mk2', 'Volkswagen', 'Golf GTI 16V', 'Mk2', 1986, 'DE', 'C', 139, 168, 8.0, 208, 960, 12000, 's', 'e', 'Volkswagen Golf Mk2', 'The bigger, heavier but quicker second-generation GTI, with a four-valve head.', 'Mk ?2|Golf II|GTI'],
  ['suzuki-swift-gti', 'Suzuki', 'Swift GTi', '', 1989, 'JP', 'C', 101, 130, 9.0, 185, 780, 9000, 's', 'ej', 'Suzuki Swift', 'A tiny 1.3 litre twin-cam hatch and a cult hit in Japan and the UK.', 'Swift'],
  ['honda-crx-si', 'Honda', 'CR-X Si', '', 1987, 'JP', 'C', 130, 142, 7.8, 200, 890, 12500, 's', 'ej', 'Honda CR-X', 'A short, light two-seat coupé with a 1.6 litre twin-cam engine and sharp handling.', 'CR-?X'],
  ['toyota-starlet-turbo', 'Toyota', 'Starlet GT Turbo', 'EP82', 1990, 'JP', 'C', 135, 160, 7.5, 200, 860, 10000, 's', 'ej', 'Toyota Starlet', 'A pocket rocket with a turbocharged 1.3 litre engine, famous for its power-to-weight.', 'Starlet'],
  ['suzuki-cappuccino', 'Suzuki', 'Cappuccino', '', 1991, 'JP', 'C', 64, 103, 9.5, 140, 700, 9500, 's', 'ej', 'Suzuki Cappuccino', 'A kei-class roadster with a turbo 660 cc engine and a removable roof.', 'Cappuccino'],
  ['honda-beat', 'Honda', 'Beat', '', 1991, 'JP', 'C', 64, 61, 10.5, 135, 760, 9000, 's', 'ej', 'Honda Beat', 'A mid-engine, rear-drive kei roadster with a three-cylinder engine that revs to 8,500 rpm.', 'Beat'],
  ['autozam-az1', 'Autozam', 'AZ-1', '', 1992, 'JP', 'C', 64, 85, 10.5, 140, 720, 17000, 's', 'ej', 'Autozam AZ-1', 'A mid-engine kei sports car with gullwing doors. Mazda built it around a Suzuki engine.', 'AZ-?1'],
  ['mg-midget', 'MG', 'Midget', '', 1961, 'GB', 'C', 55, 80, 18, 140, 640, 8500, 'h', 'ec', 'MG Midget', 'A simple, affordable British roadster with a small BMC A-series engine.', 'Midget'],
  ['mgb', 'MG', 'MGB', '', 1962, 'GB', 'C', 95, 149, 12.0, 165, 980, 9500, 'h', 'ec', 'MGB', 'The best-selling British sports car of its time, with a 1.8 litre B-series engine.', 'MGB'],
  ['triumph-spitfire', 'Triumph', 'Spitfire', '', 1962, 'GB', 'C', 63, 92, 15.0, 145, 720, 7500, 'h', 'ec', 'Triumph Spitfire', 'A small British roadster with independent suspension at all four corners.', 'Spitfire'],
  ['austin-healey-sprite', 'Austin-Healey', 'Sprite', 'Mk1', 1958, 'GB', 'C', 43, 69, 20, 130, 590, 8800, 'h', 'ec', 'Austin-Healey Sprite', 'Known as the Frogeye in Britain for its headlights perched on the bonnet.', 'Sprite|Frogeye'],
  ['fiat-x19', 'Fiat', 'X1/9', '', 1972, 'IT', 'C', 75, 93, 12.0, 160, 880, 8500, 'h', 'ec', 'Fiat X1/9', 'A Bertone-designed mid-engine targa with a removable roof panel.', 'X1'],
  ['autobianchi-a112-abarth', 'Autobianchi', 'A112 Abarth', '', 1971, 'IT', 'C', 70, 90, 11.5, 150, 680, 9000, 'h', 'er', 'Autobianchi A112', 'A hot version of a small city car with an Abarth-tuned engine, often a first rally car.', 'A112'],
  ['fiat-124-spider', 'Fiat', '124 Sport Spider', '', 1966, 'IT', 'C', 90, 123, 10.5, 170, 940, 10000, 'h', 'ec', 'Fiat 124 Spider', 'A Pininfarina roadster with a twin-cam engine that stayed in production for nearly two decades.', '124'],
  ['rover-mini-cooper', 'Rover', 'Mini Cooper 1.3i', '', 1990, 'GB', 'C', 63, 95, 12.2, 150, 700, 8000, 's', 'ec', 'Rover Mini', 'The final Mini Coopers, with fuel injection and a catalytic converter.', 'Cooper|Mini'],
  ['renault-twingo', 'Renault', 'Twingo', '', 1993, 'FR', 'C', 55, 79, 15.0, 145, 780, 5000, 's', 'e', 'Renault Twingo', 'A cab-forward city car with a sliding rear bench and a cheeky face.', 'Twingo'],
  ['fiat-panda-100hp', 'Fiat', 'Panda 100HP', '', 2006, 'IT', 'C', 100, 131, 9.5, 182, 975, 7500, 's', 'e', 'Fiat Panda', 'A boxy city car with a lively 1.4 litre engine and sports suspension.', 'Panda'],
  ['ford-fiesta-st-mk6', 'Ford', 'Fiesta ST', 'Mk6', 2005, 'GB', 'C', 148, 190, 7.9, 205, 1137, 10500, 's', 'e', 'Ford Fiesta ST', 'Ford’s modern hot-hatch benchmark, praised for its balanced chassis.', 'Fiesta'],
  ['opel-manta-gte', 'Opel', 'Manta GT/E', 'A', 1974, 'DE', 'C', 105, 142, 10.5, 185, 1000, 12000, 'h', 'ec', 'Opel Manta', 'A fuel-injected rear-drive coupé from Opel, a rival to the Ford Capri.', 'Manta'],
  ['opel-gt', 'Opel', 'GT', '', 1968, 'DE', 'C', 90, 135, 11.0, 185, 940, 16000, 'h', 'ec', 'Opel GT', 'A mini-Corvette-shaped coupé with pop-up headlights that rotate sideways.', 'Opel GT'],
  ['volvo-p1800', 'Volvo', 'P1800', '', 1961, 'SE', 'C', 100, 150, 12.5, 175, 1100, 16000, 'h', 'ec', 'Volvo P1800', 'A sleek Italian-styled coupé famed for the example Irv Gordon drove past three million miles.', 'P1800'],
  ['saab-96', 'Saab', '96', '', 1960, 'SE', 'C', 55, 100, 22.0, 135, 820, 7500, 'h', 'er', 'Saab 96', 'A front-drive oddity that won rallies under Erik Carlsson.', '96'],
  ['trabant-601', 'Trabant', '601', '', 1964, 'DE', 'C', 26, 53, 45, 100, 615, 4000, 'h', 'ex', 'Trabant 601', 'A two-stroke, Duroplast-bodied East German icon.', 'Trabant'],
  ['lada-niva', 'Lada', 'Niva', '', 1977, 'RU', 'C', 78, 127, 22.0, 130, 1150, 6000, 'h', 'e', 'Lada Niva', 'A go-anywhere 4x4 with a monocoque body, still in production more than 40 years later.', 'Niva'],
  ['daihatsu-charade-gtti', 'Daihatsu', 'Charade GTti', '', 1987, 'JP', 'C', 99, 120, 8.8, 185, 750, 7000, 's', 'ej', 'Daihatsu Charade', 'A turbocharged three-cylinder with a pocket-rocket reputation.', 'Charade'],
  ['nissan-figaro', 'Nissan', 'Figaro', '', 1991, 'JP', 'C', 76, 106, 12.0, 170, 810, 12500, 's', 'ej', 'Nissan Figaro', 'A retro-styled convertible built in a 20,000-unit limited run and sold by lottery.', 'Figaro'],
  ['datsun-510', 'Datsun', '510', '', 1968, 'JP', 'C', 96, 128, 11.0, 160, 930, 13000, 'h', 'jc', 'Datsun 510', 'The “poor man’s BMW”: a light saloon with independent rear suspension and an overhead-cam engine.', '510'],
  ['toyota-sports-800', 'Toyota', 'Sports 800', '', 1965, 'JP', 'C', 45, 68, 25.0, 155, 580, 13500, 'h', 'jc', 'Toyota Sports 800', 'A tiny air-cooled flat-twin sports car nicknamed the Yotahachi.', '800'],
  ['honda-s800', 'Honda', 'S800', '', 1966, 'JP', 'C', 70, 67, 13.0, 160, 770, 17000, 'h', 'jc', 'Honda S800', 'A small roadster with a motorcycle-style four-cylinder that revs to 8,000 rpm and chain drive to the rear wheels.', 'S800|S600'],
  ['subaru-360', 'Subaru', '360', '', 1958, 'JP', 'C', 16, 30, 40, 90, 385, 7000, 'h', 'jc', 'Subaru 360', 'The first Subaru, a two-stroke kei car nicknamed the Ladybug.', '360'],
  ['honda-n360', 'Honda', 'N360', '', 1967, 'JP', 'C', 31, 44, 28, 115, 475, 6500, 'h', 'jc', 'Honda N360', 'A kei car with a high-revving air-cooled twin, Honda’s first mass-market car.', 'N360|N600'],
  // ── Rare ──
  ['peugeot-306-gti6', 'Peugeot', '306 GTi-6', '', 1996, 'FR', 'R', 167, 193, 7.8, 225, 1215, 32000, 's', 'e', 'Peugeot 306', 'A beautifully balanced chassis and a six-speed gearbox made it the benchmark front-drive hot hatch of its day.', '306'],
  ['renault-clio-172', 'Renault', 'Clio Sport 172', '', 2000, 'FR', 'R', 169, 200, 7.0, 222, 1011, 28000, 's', 'e', 'Renault Clio', 'Renaultsport’s first Clio, with a 2.0 litre engine and a wide-track chassis.', '172|Clio'],
  ['honda-civic-type-r-ep3', 'Honda', 'Civic Type R', 'EP3', 2001, 'JP', 'R', 197, 196, 6.7, 235, 1204, 30000, 's', 'ej', 'Honda Civic Type R', 'The Swindon-built hatch with a 2.0 litre i-VTEC engine and a red-badge cult following.', 'EP3|Type R'],
  ['honda-civic-sir-eg6', 'Honda', 'Civic SiR', 'EG6', 1992, 'JP', 'R', 170, 160, 7.0, 215, 1000, 26000, 's', 'ej', 'Honda Civic (fifth generation)', 'A B16A VTEC engine in a lightweight hatchback and a tuner favourite.', 'EG6|EG'],
  ['nissan-silvia-s13', 'Nissan', 'Silvia K’s', 'S13', 1988, 'JP', 'R', 200, 265, 6.8, 230, 1150, 32000, 's', 'ej', 'Nissan Silvia', 'The rear-drive coupé that started the drift craze, here with the turbo SR20DET.', 'S13|180SX'],
  ['nissan-pulsar-gtir', 'Nissan', 'Pulsar GTI-R', 'N14', 1990, 'JP', 'R', 227, 284, 5.4, 230, 1200, 42000, 's', 'jr', 'Nissan Pulsar', 'A homologation special with a 2.0 litre turbo, all-wheel drive and a huge bonnet scoop.', 'GTI-?R|Pulsar'],
  ['subaru-impreza-wrx-gc8', 'Subaru', 'Impreza WRX', 'GC8', 1994, 'JP', 'R', 237, 308, 5.6, 230, 1230, 34000, 's', 'jr', 'Subaru Impreza WRX', 'The turbocharged boxer and symmetrical all-wheel drive combination that put Subaru on the rally map.', 'GC8|WRX'],
  ['ford-capri-28i', 'Ford', 'Capri 2.8i', 'Mk3', 1981, 'GB', 'R', 160, 229, 8.4, 205, 1150, 36000, 'h', 'ec', 'Ford Capri', 'The car you always promised yourself, here with a fuel-injected V6.', 'Capri'],
  ['ford-escort-rs2000', 'Ford', 'Escort RS2000', 'Mk1', 1973, 'GB', 'R', 110, 152, 8.7, 175, 900, 44000, 'h', 'rc', 'Ford Escort RS2000', 'A droop-snoot Escort with a 2.0 litre Pinto engine, a favourite on stages and club events.', 'RS2000'],
  ['lotus-seven-s3', 'Lotus', 'Seven', 'S3', 1970, 'GB', 'R', 126, 150, 6.0, 175, 560, 42000, 'h', 'ec', 'Lotus Seven', 'Colin Chapman’s minimalist design: no doors, no roof, almost no weight.', 'Seven'],
  ['triumph-tr6', 'Triumph', 'TR6', '', 1969, 'GB', 'R', 150, 227, 8.5, 195, 1160, 30000, 'h', 'ec', 'Triumph TR6', 'A muscular, straight-six British roadster with a Karmann-styled rear.', 'TR6'],
  ['jaguar-xk120', 'Jaguar', 'XK120', '', 1948, 'GB', 'R', 160, 260, 10.0, 200, 1310, 78000, 'h', 'c', 'Jaguar XK120', 'The world’s fastest production car in 1949, with a twin-cam straight-six.', 'XK ?120'],
  ['austin-healey-3000', 'Austin-Healey', '3000', 'Mk1', 1959, 'GB', 'R', 124, 217, 10.5, 185, 1100, 52000, 'h', 'ec', 'Austin-Healey 3000', 'A big-engined British roadster that was also a successful rally and race car.', '3000'],
  ['porsche-356-speedster', 'Porsche', '356 Speedster', '', 1954, 'DE', 'R', 60, 96, 15.0, 160, 760, 85000, 'h', 'c', 'Porsche 356', 'Porsche’s first production car, stripped to a minimal roof and windscreen.', 'Speedster|356'],
  ['porsche-911-sc', 'Porsche', '911 SC', '', 1978, 'DE', 'R', 180, 265, 6.5, 225, 1160, 52000, 'h', 'c', 'Porsche 911 (930)', 'The air-cooled 911 as most people picture it, with a 3.0 litre flat-six.', 'SC|911'],
  ['porsche-914-6', 'Porsche', '914/6', '', 1969, 'DE', 'R', 110, 157, 9.0, 205, 980, 56000, 'h', 'c', 'Porsche 914', 'A mid-engine Porsche with a 911 flat-six and a removable Targa roof.', '914'],
  ['porsche-968-cs', 'Porsche', '968 Club Sport', '', 1993, 'DE', 'R', 240, 305, 6.2, 252, 1320, 44000, 's', 'c', 'Porsche 968', 'The last front-engine Porsche of its era, lightened for the Club Sport.', '968'],
  ['bmw-m3-e36', 'BMW', 'M3', 'E36', 1992, 'DE', 'R', 286, 320, 5.9, 250, 1460, 40000, 's', 'e', 'BMW M3 (E36)', 'A 3.0 litre straight-six and a balanced chassis, the road-going M3 that was loved in Europe.', 'E36'],
  ['bmw-m5-e28', 'BMW', 'M5', 'E28', 1984, 'DE', 'R', 286, 340, 6.5, 245, 1430, 62000, 's', 'c', 'BMW M5', 'The first M5, with the M1’s straight-six in a four-door saloon.', 'E28|M5'],
  ['mercedes-190e-cosworth', 'Mercedes-Benz', '190E 2.3-16', 'W201', 1984, 'DE', 'R', 185, 235, 7.5, 230, 1280, 36000, 's', 'c', 'Mercedes-Benz 190 E 2.3-16', 'A Cosworth-developed four-valve head transformed the compact 190E into a performance saloon.', '190'],
  ['mercedes-280sl-pagoda', 'Mercedes-Benz', '280 SL', 'W113', 1968, 'DE', 'R', 170, 240, 9.5, 200, 1360, 85000, 'h', 'c', 'Mercedes-Benz W113', 'Nicknamed the Pagoda for its concave hardtop roof.', '280|W113|Pagoda'],
  ['alfa-romeo-gtv6', 'Alfa Romeo', 'GTV6', '', 1980, 'IT', 'R', 160, 235, 8.5, 205, 1170, 30000, 'h', 'c', 'Alfa Romeo GTV6', 'A Busso V6 that sings, in a transaxle coupé.', 'GTV'],
  ['alfa-romeo-spider-duetto', 'Alfa Romeo', 'Spider Duetto', '', 1966, 'IT', 'R', 109, 142, 11.0, 185, 990, 44000, 'h', 'c', 'Alfa Romeo Spider', 'Pininfarina’s boat-tail roadster that starred in The Graduate.', 'Spider|Duetto'],
  ['lancia-beta-montecarlo', 'Lancia', 'Beta Montecarlo', '', 1975, 'IT', 'R', 120, 170, 9.5, 190, 970, 28000, 'h', 'c', 'Lancia Montecarlo', 'A mid-engine two-seater designed by Pininfarina and based on Fiat running gear.', 'Monte'],
  ['fiat-dino-coupe', 'Fiat', 'Dino Coupé', '', 1967, 'IT', 'R', 160, 220, 8.5, 205, 1160, 52000, 'h', 'c', 'Fiat Dino', 'A Ferrari V6 in a Bertone-styled coupé, built to homologate the engine for Formula 2.', 'Dino'],
  ['fiat-131-abarth', 'Fiat', '131 Abarth Rally', '', 1976, 'IT', 'R', 140, 177, 8.0, 190, 950, 54000, 'h', 'r', 'Fiat 131 Abarth', 'A saloon turned rally champion that won three World Rally Championship manufacturers’ titles.', '131'],
  ['citroen-ds', 'Citroën', 'DS 21', '', 1955, 'FR', 'R', 109, 169, 14.0, 175, 1250, 40000, 'h', 'ec', 'Citroën DS', 'A hydropneumatic suspension, front disc brakes and a shape from the future.', 'DS'],
  ['citroen-sm', 'Citroën', 'SM', '', 1970, 'FR', 'R', 170, 235, 8.5, 220, 1450, 48000, 'h', 'c', 'Citroën SM', 'A Maserati V6 in a front-drive, hydropneumatic grand tourer.', 'SM'],
  ['alpine-a310-v6', 'Alpine', 'A310 V6', '', 1976, 'FR', 'R', 150, 220, 7.5, 220, 1000, 40000, 'h', 'rc', 'Alpine A310', 'A rear-engine French coupé with a PRV V6 and a plastic body.', 'A ?310'],
  ['renault-clio-v6', 'Renault', 'Clio V6', '', 2000, 'FR', 'R', 227, 300, 6.2, 235, 1335, 42000, 's', 'ep', 'Renault Clio V6', 'A mid-engine, rear-drive Clio with a V6 in the back seat position. Famously tail-happy.', 'V6'],
  ['honda-s2000', 'Honda', 'S2000', 'AP1', 1999, 'JP', 'R', 240, 208, 6.2, 240, 1250, 46000, 's', 'ej', 'Honda S2000', 'A 2.0 litre engine that revs to 9,000 rpm and makes 120 hp per litre.', 'S2000'],
  ['mazda-rx8', 'Mazda', 'RX-8', 'SE3P', 2003, 'JP', 'R', 231, 211, 6.4, 235, 1310, 22000, 's', 'ej', 'Mazda RX-8', 'A four-door rotary with rear-hinged back doors and a 9,000 rpm redline.', 'RX-?8'],
  ['mazda-cosmo-110s', 'Mazda', 'Cosmo Sport 110S', '', 1967, 'JP', 'R', 110, 130, 10.0, 185, 940, 140000, 'h', 'jcx', 'Mazda Cosmo', 'The world’s first production two-rotor Wankel sports car.', 'Cosmo'],
  ['toyota-supra-a70', 'Toyota', 'Supra Turbo', 'A70', 1987, 'JP', 'R', 232, 330, 6.5, 240, 1550, 34000, 's', 'ej', 'Toyota Supra (A70)', 'The first Supra to drop the Celica name, with a turbocharged 7M-GTE engine.', 'A70'],
  ['nissan-300zx-z32', 'Nissan', '300ZX Twin Turbo', 'Z32', 1989, 'JP', 'R', 280, 384, 5.6, 250, 1530, 36000, 's', 'ej', 'Nissan 300ZX', 'A twin-turbo V6 and a low, wide body with a mild Japanese sports-car swagger.', 'Z32|300ZX'],
  ['mitsubishi-3000gt-vr4', 'Mitsubishi', '3000GT VR-4', '', 1991, 'JP', 'R', 296, 407, 5.3, 250, 1740, 34000, 's', 'ej', 'Mitsubishi 3000GT', 'Twin turbos, all-wheel drive and active aero in a heavy-but-quick Japanese GT.', '3000'],
  ['mitsubishi-starion', 'Mitsubishi', 'Starion', '', 1982, 'JP', 'R', 180, 270, 7.0, 220, 1300, 26000, 's', 'ej', 'Mitsubishi Starion', 'A turbocharged rear-drive coupé with muscular wide arches.', 'Starion'],
  ['mitsubishi-galant-vr4', 'Mitsubishi', 'Galant VR-4', '', 1987, 'JP', 'R', 197, 289, 7.0, 220, 1325, 28000, 's', 'jr', 'Mitsubishi Galant', 'A turbocharged, all-wheel-drive saloon that won the 1989 Safari Rally.', 'Galant'],
  ['toyota-gt86', 'Toyota', 'GT86', 'ZN6', 2012, 'JP', 'R', 197, 205, 7.6, 226, 1240, 24000, 's', 'ej', 'Toyota 86', 'A light rear-drive coupé designed for driving fun more than lap times.', '86'],
  ['vw-golf-r32', 'Volkswagen', 'Golf R32', 'Mk4', 2002, 'DE', 'R', 241, 320, 6.6, 247, 1477, 24000, 's', 'e', 'Volkswagen Golf R32', 'A narrow-angle V6 in a Golf and all-wheel drive, with a distinctive exhaust note.', 'R32'],
  ['vw-corrado-vr6', 'Volkswagen', 'Corrado VR6', '', 1991, 'DE', 'R', 178, 235, 7.0, 235, 1150, 20000, 's', 'e', 'Volkswagen Corrado', 'A Golf-based coupé with a deployable rear spoiler and a smooth VR6.', 'Corrado'],
  ['opel-calibra-turbo', 'Opel', 'Calibra Turbo 4x4', '', 1992, 'DE', 'R', 204, 280, 6.8, 245, 1420, 18000, 's', 'e', 'Opel Calibra', 'A slippery coupé with an exceptionally low drag coefficient.', 'Calibra'],
  ['saab-900-turbo', 'Saab', '900 Turbo', '', 1978, 'SE', 'R', 145, 240, 9.0, 200, 1200, 14000, 'h', 'ec', 'Saab 900', 'The car that made turbocharging mainstream, with a wraparound windscreen and an engine mounted backwards.', '900'],
  ['volvo-850-t5r', 'Volvo', '850 T-5R', '', 1994, 'SE', 'R', 240, 330, 6.7, 250, 1500, 22000, 's', 'e', 'Volvo 850', 'A turbocharged family estate that raced in the British Touring Car Championship.', '850'],
  ['lotus-europa-tc', 'Lotus', 'Europa Twin Cam', '', 1971, 'GB', 'R', 105, 146, 7.5, 185, 700, 42000, 'h', 'c', 'Lotus Europa', 'A mid-engine fibreglass coupé built around a steel backbone chassis.', 'Europa'],
  ['morgan-plus-8', 'Morgan', 'Plus 8', '', 1968, 'GB', 'R', 160, 280, 6.7, 200, 900, 38000, 'h', 'c', 'Morgan Plus 8', 'A Rover V8 in a traditional ash-framed body.', 'Plus ?8'],
  ['alfa-romeo-4c', 'Alfa Romeo', '4C', '', 2013, 'IT', 'R', 237, 350, 4.5, 258, 895, 48000, 's', 'p', 'Alfa Romeo 4C', 'A carbon-fibre tub and a turbo four with an unassisted steering rack.', '4C'],
  // ── Epic ──
  ['ferrari-328-gtb', 'Ferrari', '328 GTB', '', 1985, 'IT', 'E', 270, 304, 5.5, 263, 1263, 120000, 'h', 'pc', 'Ferrari 328', 'The final carburettor-era V8 mid-engine Ferrari and a Magnum, P.I. icon.', '328'],
  ['ferrari-testarossa', 'Ferrari', 'Testarossa', '', 1984, 'IT', 'E', 390, 490, 5.2, 290, 1506, 175000, 'a', 'p', 'Ferrari Testarossa', 'Side strakes, a flat-12 and the defining supercar poster of the 1980s.', 'Testarossa'],
  ['ferrari-355', 'Ferrari', 'F355', '', 1994, 'IT', 'E', 375, 363, 4.7, 295, 1350, 130000, 'a', 'p', 'Ferrari F355', 'A five-valve-per-cylinder V8 and one of the best-sounding Ferraris.', '355'],
  ['ferrari-365-daytona', 'Ferrari', '365 GTB/4 Daytona', '', 1968, 'IT', 'E', 352, 431, 5.4, 280, 1280, 360000, 'h', 'pc', 'Ferrari 365 GTB/4', 'A front-engine V12 and one of the last great analogue Ferraris of its era.', 'Daytona|365'],
  ['ferrari-458', 'Ferrari', '458 Italia', '', 2009, 'IT', 'E', 562, 540, 3.4, 325, 1380, 240000, 'a', 'p', 'Ferrari 458', 'A naturally aspirated 4.5 litre V8 that spins to 9,000 rpm.', '458'],
  ['lamborghini-diablo', 'Lamborghini', 'Diablo', '', 1990, 'IT', 'E', 485, 580, 4.5, 325, 1576, 220000, 'a', 'p', 'Lamborghini Diablo', 'The first Lamborghini over 200 mph and the Countach’s successor.', 'Diablo'],
  ['lamborghini-gallardo', 'Lamborghini', 'Gallardo', '', 2003, 'IT', 'E', 493, 510, 4.2, 309, 1430, 140000, 'a', 'p', 'Lamborghini Gallardo', 'Lamborghini’s best-selling model, with a V10 and a baby-bull appeal.', 'Gallardo'],
  ['lamborghini-murcielago', 'Lamborghini', 'Murciélago', '', 2001, 'IT', 'E', 572, 650, 3.8, 330, 1650, 230000, 'a', 'p', 'Lamborghini Murciélago', 'A V12 with scissor doors and a name taken from a famous fighting bull.', 'Murci'],
  ['maserati-ghibli-1967', 'Maserati', 'Ghibli', 'Tipo 115', 1967, 'IT', 'E', 330, 440, 6.5, 280, 1500, 150000, 'h', 'c', 'Maserati Ghibli (AM115)', 'A Ghia-styled V8 grand tourer that rivalled the Daytona.', 'Ghibli'],
  ['maserati-bora', 'Maserati', 'Bora', '', 1971, 'IT', 'E', 310, 460, 6.5, 280, 1500, 150000, 'h', 'pc', 'Maserati Bora', 'Maserati’s first mid-engine road car, designed by Giugiaro.', 'Bora'],
  ['detomaso-pantera', 'De Tomaso', 'Pantera', '', 1971, 'IT', 'E', 310, 440, 6.0, 250, 1400, 110000, 'h', 'pc', 'De Tomaso Pantera', 'An Italian body wrapped around a Ford Cleveland V8.', 'Pantera'],
  ['porsche-993-turbo', 'Porsche', '911 Turbo', '993', 1995, 'DE', 'E', 408, 540, 4.5, 290, 1500, 190000, 'a', 'pc', 'Porsche 911 (993)', 'The last air-cooled Turbo, with twin turbos and all-wheel drive.', '993'],
  ['porsche-996-gt3', 'Porsche', '911 GT3', '996', 1999, 'DE', 'E', 360, 370, 4.4, 302, 1380, 105000, 'a', 'p', 'Porsche 911 GT3', 'A Mezger engine and manual gearbox, built for track days.', 'GT3'],
  ['nissan-gtr-r35', 'Nissan', 'GT-R', 'R35', 2007, 'JP', 'E', 480, 588, 3.5, 310, 1740, 98000, 'a', 'jp', 'Nissan GT-R', 'A twin-turbo V6 with launch control and all-wheel drive that took the Nürburgring by storm.', 'R35'],
  ['honda-nsx-r-na1', 'Honda', 'NSX-R', 'NA1', 1992, 'JP', 'E', 280, 296, 5.0, 270, 1230, 170000, 'a', 'jp', 'Honda NSX', 'A lightened, stiffened NSX with carbon seats, the first Type R of the lineage.', 'NSX'],
  ['mitsubishi-evo-ix', 'Mitsubishi', 'Lancer Evolution IX', '', 2005, 'JP', 'E', 286, 392, 4.4, 250, 1400, 76000, 's', 'jr', 'Mitsubishi Lancer Evolution', 'MIVEC variable valve timing joined the turbocharged four and active differentials.', 'IX|Evo 9|Evolution 9'],
  ['subaru-impreza-sti-gdb', 'Subaru', 'Impreza WRX STI', 'GDB', 2005, 'JP', 'E', 276, 392, 5.0, 255, 1470, 68000, 's', 'jr', 'Subaru Impreza WRX STI', 'A 2.0 litre turbo boxer, driver-controlled centre differential and the blue-and-gold look.', 'GDB|STI'],
  ['bmw-m3-e46-csl', 'BMW', 'M3 CSL', 'E46', 2003, 'DE', 'E', 360, 370, 4.9, 250, 1385, 120000, 's', 'p', 'BMW M3 (E46)', 'A carbon-fibre roof and a lightweight kit made the E46 sharper than ever.', 'E46|CSL'],
  ['bmw-m5-e39', 'BMW', 'M5', 'E39', 1998, 'DE', 'E', 400, 500, 4.8, 250, 1720, 70000, 's', 'p', 'BMW M5', 'A 4.9 litre V8 in an understated saloon.', 'E39'],
  ['mercedes-190e-evo2', 'Mercedes-Benz', '190E 2.5-16 Evo II', '', 1990, 'DE', 'E', 235, 245, 7.1, 250, 1340, 96000, 's', 'c', 'Mercedes-Benz 190 E 2.5-16 Evolution II', 'A DTM homologation special with a huge adjustable rear wing.', 'Evo'],
  ['mercedes-sls-amg', 'Mercedes-Benz', 'SLS AMG', '', 2010, 'DE', 'E', 563, 650, 3.8, 317, 1620, 150000, 'a', 'p', 'Mercedes-Benz SLS AMG', 'A gullwing 6.2 litre V8 with a long bonnet that is a nod to the 300 SL.', 'SLS'],
  ['audi-r8-v8', 'Audi', 'R8', 'Type 42', 2006, 'DE', 'E', 420, 430, 4.6, 301, 1560, 105000, 'a', 'p', 'Audi R8 (Type 42)', 'A mid-engine, all-wheel-drive supercar that was easy to drive every day.', 'R8'],
  ['audi-rs2-avant', 'Audi', 'RS2 Avant', '', 1994, 'DE', 'E', 315, 410, 4.8, 262, 1595, 92000, 's', 'e', 'Audi RS 2 Avant', 'A Porsche-tuned turbo estate and the first RS Audi.', 'RS ?2'],
  ['audi-sport-quattro', 'Audi', 'Sport Quattro', '', 1984, 'DE', 'E', 306, 350, 4.8, 250, 1300, 190000, 's', 'r', 'Audi Sport Quattro', 'A shortened Quattro with a five-cylinder turbo and a Group B pedigree.', 'Sport'],
  ['aston-martin-v8-vantage', 'Aston Martin', 'V8 Vantage', '', 1977, 'GB', 'E', 380, 500, 5.4, 270, 1610, 150000, 'h', 'c', 'Aston Martin V8 Vantage (1977)', 'Britain’s first supercar, with a pronounced bonnet scoop and a 5.3 litre V8.', 'Vantage'],
  ['lotus-esprit-v8', 'Lotus', 'Esprit V8', '', 1996, 'GB', 'E', 350, 400, 4.4, 275, 1380, 82000, 'a', 'p', 'Lotus Esprit', 'A twin-turbo V8 in the Giugiaro wedge that had been in production since 1976.', 'Esprit'],
  ['mclaren-mp4-12c', 'McLaren', 'MP4-12C', '', 2011, 'GB', 'E', 592, 600, 3.3, 330, 1434, 175000, 'a', 'p', 'McLaren MP4-12C', 'McLaren’s second road car, with a carbon tub and no anti-roll bars.', '12C'],
  ['dodge-viper-rt10', 'Dodge', 'Viper RT/10', '', 1992, 'US', 'E', 400, 630, 4.6, 290, 1490, 105000, 'a', 'p', 'Dodge Viper', 'An 8.0 litre V10 truck-based engine, no traction control and a reputation as a handful.', 'Viper'],
  ['chevrolet-corvette-c2', 'Chevrolet', 'Corvette Sting Ray', 'C2', 1963, 'US', 'E', 360, 576, 5.8, 230, 1450, 150000, 'h', 'c', 'Chevrolet Corvette (C2)', 'A split rear window and independent rear suspension, a Corvette classic.', 'C2|Sting ?Ray'],
  ['ford-mustang-boss-302', 'Ford', 'Mustang Boss 302', '', 1969, 'US', 'E', 290, 380, 6.9, 200, 1530, 98000, 'h', 'c', 'Ford Mustang (first generation)', 'A homologation special for Trans-Am racing with a high-revving 302 V8.', 'Mustang|Boss'],
  ['shelby-gt350', 'Shelby', 'Mustang GT350', '', 1965, 'US', 'E', 306, 429, 6.5, 200, 1280, 210000, 'h', 'c', 'Shelby Mustang', 'Carroll Shelby’s road-legal race Mustang with a 289 V8 and Le Mans stripes.', 'GT ?350|Shelby'],
  ['dodge-charger-rt-1969', 'Dodge', 'Charger R/T', '', 1969, 'US', 'E', 375, 650, 6.0, 210, 1720, 105000, 'h', 'c', 'Dodge Charger (B-body)', 'A 440 Magnum V8 and a coke-bottle body that starred in countless chases.', 'Charger'],
  ['peugeot-205-t16', 'Peugeot', '205 Turbo 16', '', 1984, 'FR', 'E', 200, 255, 5.8, 210, 1150, 190000, 'h', 'r', 'Peugeot 205 Turbo 16', 'A mid-engine, all-wheel-drive Group B special that looked like a normal 205 on a very different chassis.', 'T16|Turbo ?16'],
  ['lancia-037-stradale', 'Lancia', '037 Stradale', '', 1982, 'IT', 'E', 205, 245, 6.0, 215, 1170, 210000, 'h', 'r', 'Lancia 037', 'The last rear-drive car to win the World Rally Championship.', '037'],
  // ── Legendary ──
  ['ferrari-288-gto', 'Ferrari', '288 GTO', '', 1984, 'IT', 'L', 400, 496, 4.9, 305, 1160, 750000, 'a', 'pc', 'Ferrari 288 GTO', 'The first Ferrari road car to reach 300 km/h, built for Group B racing that never happened.', '288'],
  ['ferrari-laferrari', 'Ferrari', 'LaFerrari', '', 2013, 'IT', 'L', 949, 900, 2.6, 350, 1255, 1400000, 'a', 'p', 'LaFerrari', 'A V12 hybrid with 949 hp and a name that means “the Ferrari”.', 'LaFerrari'],
  ['ferrari-275-gtb4', 'Ferrari', '275 GTB/4', '', 1966, 'IT', 'L', 300, 331, 6.0, 268, 1100, 1100000, 'h', 'c', 'Ferrari 275', 'A quad-cam V12 in a Pininfarina body, and arguably the prettiest Ferrari of its era.', '275'],
  ['ferrari-f50', 'Ferrari', 'F50', '', 1995, 'IT', 'L', 513, 471, 3.7, 325, 1229, 700000, 'a', 'p', 'Ferrari F50', 'A Formula 1-derived V12 bolted to the chassis as a stressed member.', 'F50'],
  ['ferrari-250-california', 'Ferrari', '250 GT California Spyder', '', 1957, 'IT', 'L', 240, 217, 7.0, 240, 1050, 1200000, 'h', 'c', 'Ferrari 250 GT California Spyder', 'Ferrari’s open 250 for America, as seen in Ferris Bueller’s Day Off.', 'California'],
  ['porsche-918', 'Porsche', '918 Spyder', '', 2013, 'DE', 'L', 887, 1280, 2.6, 345, 1640, 1100000, 'a', 'p', 'Porsche 918 Spyder', 'A plug-in hybrid with a 4.6 litre V8 and two electric motors.', '918'],
  ['mclaren-p1', 'McLaren', 'P1', '', 2013, 'GB', 'L', 903, 900, 2.8, 350, 1395, 1300000, 'a', 'p', 'McLaren P1', 'A hybrid hypercar with a drag-reduction system and a formidable track-day record.', 'P1'],
  ['bugatti-veyron', 'Bugatti', 'Veyron 16.4', '', 2005, 'FR', 'L', 987, 1250, 2.5, 407, 1888, 1300000, 'a', 'p', 'Bugatti Veyron', 'Four turbochargers and 16 cylinders for 1,001 PS and over 400 km/h.', 'Veyron'],
  ['koenigsegg-ccx', 'Koenigsegg', 'CCX', '', 2006, 'SE', 'L', 806, 920, 3.2, 395, 1180, 750000, 'a', 'px', 'Koenigsegg CCX', 'Koenigsegg’s own engine, developed for the American market.', 'CCX'],
  ['pagani-zonda-c12', 'Pagani', 'Zonda C12', '', 1999, 'IT', 'L', 389, 570, 4.0, 297, 1250, 650000, 'a', 'p', 'Pagani Zonda', 'Horacio Pagani’s first car, with a Mercedes-AMG V12 and quad exhaust pipes.', 'Zonda'],
  ['mercedes-slr-mclaren', 'Mercedes-Benz', 'SLR McLaren', '', 2003, 'DE', 'L', 617, 780, 3.8, 334, 1768, 560000, 'a', 'p', 'Mercedes-Benz SLR McLaren', 'A carbon-fibre supercar with a supercharged V8 and a long Formula 1-like nose.', 'SLR'],
  ['ford-gt40-mk1', 'Ford', 'GT40', 'Mk I', 1964, 'GB', 'L', 335, 475, 5.3, 265, 1030, 1000000, 'h', 'cp', 'Ford GT40', 'Ford’s answer to Ferrari, which won Le Mans four years in a row from 1966.', 'GT40'],
  ['ford-gt-2005', 'Ford', 'GT', '', 2005, 'US', 'L', 550, 678, 3.3, 330, 1520, 420000, 'a', 'p', 'Ford GT', 'A modern tribute to the GT40, with a supercharged 5.4 litre V8.', 'Ford GT'],
  ['shelby-cobra-427', 'Shelby', 'Cobra 427', '', 1965, 'US', 'L', 425, 636, 4.2, 265, 1100, 1100000, 'h', 'c', 'Shelby Cobra', 'A 7.0 litre V8 shoehorned into a light British roadster, one of the quickest cars of its day.', 'Cobra'],
  ['aston-martin-db4-gt-zagato', 'Aston Martin', 'DB4 GT Zagato', '', 1960, 'GB', 'L', 314, 360, 6.1, 245, 1260, 1400000, 'h', 'c', 'Aston Martin DB4 GT Zagato', 'Only 19 were built with a Zagato body, and it is among the rarest and most expensive British cars.', 'Zagato'],
  ['aston-martin-one-77', 'Aston Martin', 'One-77', '', 2009, 'GB', 'L', 750, 750, 3.5, 354, 1630, 900000, 'a', 'p', 'Aston Martin One-77', 'A hand-built, carbon-fibre-bodied run of just 77 cars with a 7.3 litre V12.', 'One-?77'],
  ['alfa-romeo-33-stradale', 'Alfa Romeo', '33 Stradale', '', 1967, 'IT', 'L', 230, 206, 5.5, 260, 700, 1300000, 'h', 'cx', 'Alfa Romeo 33 Stradale', 'A road-going race car that can be called the world’s first supercar. Just 18 were built.', '33'],
  ['maserati-mc12', 'Maserati', 'MC12', '', 2004, 'IT', 'L', 624, 652, 3.8, 330, 1335, 800000, 'a', 'p', 'Maserati MC12', 'A road-legal version of a GT1 race car on an Enzo chassis.', 'MC12'],
  ['bmw-507', 'BMW', '507', '', 1956, 'DE', 'L', 150, 235, 11.0, 220, 1330, 950000, 'h', 'c', 'BMW 507', 'A V8 roadster styled by Albrecht von Goertz. Elvis owned one, and BMW lost money on every sale.', '507'],
]

const cars = JSON.parse(readFileSync(file, 'utf8'))
const have = new Set(cars.map(c => c.id))
let added = 0
for (const [id, make, model, gen, year, cc, tier, hp, nm, acc, top, kg, value, pools, tastes, wiki, blurb, photoMatch] of ROWS) {
  if (have.has(id)) continue
  if (!COUNTRY[cc] || !TIER[tier]) throw new Error(`bad row ${id}`)
  cars.push({
    id, make, model, gen, year, country: COUNTRY[cc], cc, tier: TIER[tier], hp, nm, acc, top, kg, value, blurb,
    pools: [...pools].map(p => POOL[p]), tastes: [...tastes].map(t => TASTE[t]), wiki, reviewed: false,
    ...(photoMatch ? { photoMatch } : {}),
  })
  have.add(id)
  added++
}
writeFileSync(file, JSON.stringify(cars, null, 2) + '\n')
const count = {}
for (const c of cars) count[c.tier] = (count[c.tier] ?? 0) + 1
console.log(`added ${added}, total ${cars.length}`, count)
