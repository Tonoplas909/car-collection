import type { Car } from './types.ts'

// Sample catalog. Names, specs and values come from the design handoff; extra entries fill the
// pack pools. Real car names and imagery require licensing before launch.
export const CATALOG: Car[] = [
  { id: 'ferrari-f40', make: 'Ferrari', model: 'F40', gen: '', year: 1987, country: 'Italy', cc: 'IT', tier: 'Legendary', hp: 478, nm: 577, acc: 4.2, top: 324, kg: 1100, value: 412000, pools: ['apex'], tastes: ['supercars'],
    blurb: 'Built for Ferrari’s 40th anniversary and the last car Enzo Ferrari signed off personally. Twin-turbo V8, no power steering, no ABS.' },
  { id: 'mclaren-f1', make: 'McLaren', model: 'F1', gen: '', year: 1992, country: 'United Kingdom', cc: 'GB', tier: 'Legendary', hp: 627, nm: 651, acc: 3.2, top: 386, kg: 1138, value: 980000, pools: ['apex'], tastes: ['supercars'],
    blurb: 'Central driving seat flanked by two passengers. Held the production car top-speed record for over a decade.' },
  { id: 'porsche-911-rs27', make: 'Porsche', model: '911 Carrera RS 2.7', gen: 'F-series', year: 1973, country: 'Germany', cc: 'DE', tier: 'Legendary', hp: 210, nm: 255, acc: 5.8, top: 245, kg: 975, value: 268000, pools: ['heritage'], tastes: ['classics'],
    blurb: 'A homologation special with thinner steel, lighter glass and the ducktail spoiler that became a 911 signature.' },
  { id: 'toyota-2000gt', make: 'Toyota', model: '2000GT', gen: 'MF10', year: 1967, country: 'Japan', cc: 'JP', tier: 'Legendary', hp: 150, nm: 175, acc: 8.6, top: 220, kg: 1120, value: 305000, pools: ['heritage'], tastes: ['classics', 'jdm'],
    blurb: 'Japan’s first serious grand tourer. Around 350 were built, with a Yamaha-developed straight-six.' },
  { id: 'mercedes-300sl', make: 'Mercedes-Benz', model: '300 SL Gullwing', gen: 'W198', year: 1954, country: 'Germany', cc: 'DE', tier: 'Legendary', hp: 215, nm: 275, acc: 8.8, top: 260, kg: 1295, value: 498000, pools: ['heritage'], tastes: ['classics'],
    blurb: 'Direct fuel injection and a spaceframe chassis so tall at the sills that the doors had to open upward.' },
  { id: 'porsche-959', make: 'Porsche', model: '959', gen: '', year: 1986, country: 'Germany', cc: 'DE', tier: 'Legendary', hp: 450, nm: 500, acc: 3.7, top: 317, kg: 1450, value: 512000, pools: ['apex'], tastes: ['supercars'],
    blurb: 'Group B technology for the road: sequential twin turbos, adjustable ride height and computer-controlled all-wheel drive.' },
  { id: 'nissan-skyline-r34', make: 'Nissan', model: 'Skyline GT-R V-Spec', gen: 'R34', year: 1999, country: 'Japan', cc: 'JP', tier: 'Epic', hp: 280, nm: 392, acc: 4.9, top: 250, kg: 1560, value: 142000, pools: ['apex'], tastes: ['jdm'],
    blurb: 'RB26 twin-turbo straight-six and ATTESA all-wheel drive. Officially rated at 280 hp under Japan’s gentlemen’s agreement.' },
  { id: 'honda-nsx-na1', make: 'Honda', model: 'NSX', gen: 'NA1', year: 1990, country: 'Japan', cc: 'JP', tier: 'Epic', hp: 274, nm: 285, acc: 5.7, top: 270, kg: 1365, value: 96000, pools: ['apex'], tastes: ['jdm', 'supercars'],
    blurb: 'An aluminium monocoque mid-engine car tuned with input from Formula 1 drivers, proving a supercar could be used daily.' },
  { id: 'lamborghini-countach', make: 'Lamborghini', model: 'Countach LP400', gen: '', year: 1974, country: 'Italy', cc: 'IT', tier: 'Epic', hp: 375, nm: 368, acc: 5.6, top: 290, kg: 1065, value: 188000, pools: ['heritage', 'apex'], tastes: ['supercars', 'classics'],
    blurb: 'Scissor doors and a wedge profile by Marcello Gandini. The early LP400 is the cleanest form, before the wings arrived.' },
  { id: 'toyota-supra-a80', make: 'Toyota', model: 'Supra RZ', gen: 'A80', year: 1993, country: 'Japan', cc: 'JP', tier: 'Epic', hp: 330, nm: 431, acc: 4.6, top: 250, kg: 1490, value: 88000, pools: ['apex'], tastes: ['jdm'],
    blurb: 'The 2JZ-GTE engine is known for handling far more boost than it left the factory with.' },
  { id: 'lancia-delta-evo', make: 'Lancia', model: 'Delta HF Integrale Evo', gen: '', year: 1991, country: 'Italy', cc: 'IT', tier: 'Epic', hp: 210, nm: 300, acc: 5.7, top: 220, kg: 1340, value: 109000, pools: ['apex'], tastes: ['rally'],
    blurb: 'Six consecutive World Rally Championship titles for Lancia. The Evo added wider arches and an adjustable rear spoiler.' },
  { id: 'mercedes-c111', make: 'Mercedes-Benz', model: 'C111-II', gen: '', year: 1970, country: 'Germany', cc: 'DE', tier: 'Epic', hp: 350, nm: 392, acc: 4.8, top: 300, kg: 1240, value: 160000, pools: ['heritage'], tastes: ['concepts'],
    blurb: 'A four-rotor Wankel test bed in a glassfibre wedge. Mercedes famously refused the blank cheques offered to build it.' },
  { id: 'lancia-stratos', make: 'Lancia', model: 'Stratos HF Stradale', gen: '', year: 1973, country: 'Italy', cc: 'IT', tier: 'Epic', hp: 190, nm: 226, acc: 6.8, top: 230, kg: 980, value: 205000, pools: ['heritage'], tastes: ['rally', 'classics'],
    blurb: 'Built around a Ferrari Dino V6 purely to win rallies. It took three straight World Rally Championship titles.' },
  { id: 'jaguar-etype-s1', make: 'Jaguar', model: 'E-Type 3.8', gen: 'Series 1', year: 1961, country: 'United Kingdom', cc: 'GB', tier: 'Epic', hp: 265, nm: 353, acc: 7.0, top: 241, kg: 1234, value: 175000, pools: ['heritage'], tastes: ['classics'],
    blurb: 'Launched at the 1961 Geneva show with a claimed 150 mph, disc brakes all round and a price far below its rivals.' },
  { id: 'bmw-30-csl', make: 'BMW', model: '3.0 CSL', gen: 'E9', year: 1972, country: 'Germany', cc: 'DE', tier: 'Rare', hp: 200, nm: 277, acc: 7.3, top: 220, kg: 1165, value: 68000, pools: ['heritage'], tastes: ['classics'],
    blurb: 'A lightweight homologation coupé with aluminium panels. Its racing aero kit earned it the nickname Batmobile.' },
  { id: 'mazda-rx7-fd', make: 'Mazda', model: 'RX-7', gen: 'FD', year: 1992, country: 'Japan', cc: 'JP', tier: 'Rare', hp: 255, nm: 294, acc: 5.3, top: 250, kg: 1250, value: 54000, pools: ['street', 'apex'], tastes: ['jdm'],
    blurb: 'A sequential twin-turbo rotary in a low, light body. Near 50:50 weight distribution.' },
  { id: 'bmw-m3-e30', make: 'BMW', model: 'M3', gen: 'E30', year: 1986, country: 'Germany', cc: 'DE', tier: 'Rare', hp: 195, nm: 230, acc: 6.7, top: 235, kg: 1200, value: 71000, pools: ['street', 'apex'], tastes: ['everyday'],
    blurb: 'Developed to go touring-car racing, and went on to become one of the most successful touring cars ever.' },
  { id: 'alfa-giulia-gta', make: 'Alfa Romeo', model: 'Giulia Sprint GTA', gen: 'Tipo 105', year: 1965, country: 'Italy', cc: 'IT', tier: 'Rare', hp: 115, nm: 142, acc: 9.5, top: 185, kg: 745, value: 62000, pools: ['heritage'], tastes: ['classics'],
    blurb: 'GTA stands for Gran Turismo Alleggerita: aluminium body panels over a lightened Giulia coupé.' },
  { id: 'datsun-240z', make: 'Datsun', model: '240Z', gen: 'S30', year: 1969, country: 'Japan', cc: 'JP', tier: 'Rare', hp: 151, nm: 198, acc: 8.0, top: 200, kg: 1044, value: 44500, pools: ['heritage'], tastes: ['classics', 'jdm'],
    blurb: 'A straight-six sports car priced against British roadsters. It became the best-selling sports car of its decade.' },
  { id: 'ford-sierra-cosworth', make: 'Ford', model: 'Sierra RS Cosworth', gen: '', year: 1986, country: 'United Kingdom', cc: 'GB', tier: 'Rare', hp: 204, nm: 276, acc: 6.2, top: 241, kg: 1220, value: 41000, pools: ['street'], tastes: ['everyday', 'rally'],
    blurb: 'A Cosworth-developed turbo four and a whale-tail wing, built so Ford could go Group A touring-car racing.' },
  { id: 'ford-escort-cosworth', make: 'Ford', model: 'Escort RS Cosworth', gen: 'Mk5', year: 1992, country: 'United Kingdom', cc: 'GB', tier: 'Rare', hp: 227, nm: 304, acc: 6.2, top: 232, kg: 1275, value: 52000, pools: ['street'], tastes: ['rally'],
    blurb: 'Sierra Cosworth running gear under an Escort body, with a rear wing that made real downforce at road speeds.' },
  { id: 'lancia-stratos-zero', make: 'Lancia', model: 'Stratos HF Zero', gen: '', year: 1970, country: 'Italy', cc: 'IT', tier: 'Rare', hp: 115, nm: 140, acc: 9.0, top: 200, kg: 800, value: 58000, pools: ['heritage'], tastes: ['concepts'],
    blurb: 'A Bertone show car only 84 cm tall, entered through the hinged windscreen. It led directly to the rally Stratos.' },
  { id: 'vw-golf-gti-mk1', make: 'Volkswagen', model: 'Golf GTI', gen: 'Mk1', year: 1976, country: 'Germany', cc: 'DE', tier: 'Common', hp: 110, nm: 140, acc: 9.0, top: 182, kg: 810, value: 14000, pools: ['street', 'heritage'], tastes: ['everyday'],
    blurb: 'Fuel injection in a small hatchback. The car that started the hot-hatch category.' },
  { id: 'peugeot-205-gti', make: 'Peugeot', model: '205 GTI 1.9', gen: '', year: 1986, country: 'France', cc: 'FR', tier: 'Common', hp: 130, nm: 161, acc: 7.8, top: 206, kg: 875, value: 12500, pools: ['street'], tastes: ['everyday'],
    blurb: 'Light, short and lively at the limit. The 1.9 added torque to the 1.6’s balance.' },
  { id: 'mini-cooper-s', make: 'Mini', model: 'Cooper S', gen: 'Mk1', year: 1964, country: 'United Kingdom', cc: 'GB', tier: 'Common', hp: 76, nm: 108, acc: 10.9, top: 160, kg: 650, value: 9800, pools: ['street', 'heritage'], tastes: ['everyday', 'rally', 'classics'],
    blurb: 'Front-wheel drive with a transverse engine. Won the Monte Carlo Rally outright in 1964.' },
  { id: 'renault-clio-williams', make: 'Renault', model: 'Clio Williams', gen: '', year: 1993, country: 'France', cc: 'FR', tier: 'Common', hp: 150, nm: 175, acc: 7.8, top: 215, kg: 990, value: 9400, pools: ['street'], tastes: ['everyday'],
    blurb: 'A 2.0 litre homologation special named after Renault’s Formula 1 engine partnership.' },
  { id: 'toyota-ae86', make: 'Toyota', model: 'Sprinter Trueno', gen: 'AE86', year: 1983, country: 'Japan', cc: 'JP', tier: 'Common', hp: 130, nm: 149, acc: 8.5, top: 200, kg: 940, value: 13200, pools: ['street'], tastes: ['everyday', 'jdm'],
    blurb: 'Rear-wheel drive, a revvy 4A-GE twin-cam and pop-up lights. Mountain-pass drifters made it famous.' },
  { id: 'honda-civic-ek9', make: 'Honda', model: 'Civic Type R', gen: 'EK9', year: 1997, country: 'Japan', cc: 'JP', tier: 'Common', hp: 185, nm: 160, acc: 6.7, top: 225, kg: 1050, value: 16000, pools: ['street'], tastes: ['everyday', 'jdm'],
    blurb: 'A hand-ported 1.6 litre VTEC making 185 hp, seam-welded shell and a helical limited-slip differential.' },
]

export const CARS_BY_ID: Record<string, Car> = Object.fromEntries(CATALOG.map(c => [c.id, c]))

export function getCar(id: string): Car {
  const c = CARS_BY_ID[id]
  if (!c) throw new Error(`Unknown car: ${id}`)
  return c
}

/** "Skyline GT-R V-Spec R34" style label. */
export const carLabel = (c: Car) => (c.gen ? `${c.model} ${c.gen}` : c.model)
/** "Nissan · R34" or "Ferrari". */
export const makeGen = (c: Car) => (c.gen ? `${c.make} · ${c.gen}` : c.make)
