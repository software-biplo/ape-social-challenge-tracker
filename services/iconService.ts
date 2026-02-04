
import React from 'react';
import { 
  Activity, Airplay, Anchor, Aperture, Archive, ArrowBigDown, ArrowBigLeft, ArrowBigRight, ArrowBigUp, AtSign,
  Award, Baby, BaggageClaim, Banknote, BarChart, Baseline, Bath, Battery, Beaker, Bell,
  Bike, Binary, Bitcoin, Bluetooth, Bold, Book, Bookmark, Box, Briefcase, Brush,
  Bug, Building, Bus, Cake, Calculator, Calendar, Camera, Car, Cast, Check,
  ChefHat, Cherry, Chrome, Cigarette, Circle, Clock, Cloud, Code, Codepen, Coffee,
  Coins, Compass, Contact, Cookie, Copy, Cpu, CreditCard, Croissant, Crosshair, Crown,
  CupSoda, Database, Dices, Disc, Dog, DollarSign, Dribbble, Droplets, Drumstick, Dumbbell,
  Ear, Egg, Eye, Facebook, Fan, FastForward, Feather, Figma, File, Film,
  Fingerprint, Fish, Flag, Flame, Flashlight, FlaskConical, Flower, Folder, Footprints, Framer,
  Frown, Gamepad2, Gauge, Ghost, Gift, GitBranch, Github, Gitlab, GlassWater, Globe,
  Grape, Guitar, Hammer, Hash, Headphones
} from 'lucide-react';

export const ALL_ICONS: Record<string, React.FC<any>> = {
  activity: Activity, airplay: Airplay, anchor: Anchor, aperture: Aperture, archive: Archive,
  'arrow-big-down': ArrowBigDown, 'arrow-big-left': ArrowBigLeft, 'arrow-big-right': ArrowBigRight, 'arrow-big-up': ArrowBigUp, 'at-sign': AtSign,
  award: Award, baby: Baby, 'baggage-claim': BaggageClaim, banknote: Banknote, 'bar-chart': BarChart,
  baseline: Baseline, bath: Bath, battery: Battery, beaker: Beaker, bell: Bell,
  bike: Bike, binary: Binary, bitcoin: Bitcoin, bluetooth: Bluetooth, bold: Bold,
  book: Book, bookmark: Bookmark, box: Box, briefcase: Briefcase, brush: Brush,
  bug: Bug, building: Building, bus: Bus, cake: Cake, calculator: Calculator,
  calendar: Calendar, camera: Camera, car: Car, cast: Cast, check: Check,
  'chef-hat': ChefHat, cherry: Cherry, chrome: Chrome, cigarette: Cigarette, circle: Circle,
  clock: Clock, cloud: Cloud, code: Code, codepen: Codepen, coffee: Coffee,
  coins: Coins, compass: Compass, contact: Contact, cookie: Cookie, copy: Copy,
  cpu: Cpu, 'credit-card': CreditCard, croissant: Croissant, crosshair: Crosshair, crown: Crown,
  'cup-soda': CupSoda, database: Database, dices: Dices, disc: Disc, dog: Dog,
  'dollar-sign': DollarSign, dribbble: Dribbble, droplets: Droplets, drumstick: Drumstick, dumbbell: Dumbbell,
  ear: Ear, egg: Egg, eye: Eye, facebook: Facebook, fan: Fan,
  'fast-forward': FastForward, feather: Feather, figma: Figma, file: File, film: Film,
  fingerprint: Fingerprint, fish: Fish, flag: Flag, flame: Flame, flashlight: Flashlight,
  'flask-conical': FlaskConical, flower: Flower, folder: Folder, footprints: Footprints, framer: Framer,
  frown: Frown, gamepad: Gamepad2, gauge: Gauge, ghost: Ghost, gift: Gift,
  'git-branch': GitBranch, github: Github, gitlab: Gitlab, 'glass-water': GlassWater, globe: Globe,
  grape: Grape, guitar: Guitar, hammer: Hammer, hash: Hash, headphones: Headphones
};

export const getIcon = (key: string) => {
  return ALL_ICONS[key.toLowerCase()] || Activity;
};
