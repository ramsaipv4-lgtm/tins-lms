// Recovery words and crypto-shredding (keys.ts, SPEC §4.25)
import { aesGcmSeal, aesGcmOpen } from './util.ts';

// 256 unique lowercase words; a byte's value is its index in this list.
export const RECOVERY_WORDS: readonly string[] = [
  'able', 'acid', 'acorn', 'actor', 'adobe', 'agent', 'album', 'alder',
  'alley', 'amber', 'anchor', 'angle', 'ankle', 'apple', 'apron', 'arch',
  'arrow', 'ash', 'atlas', 'attic', 'aunt', 'autumn', 'axle', 'badge',
  'baker', 'balm', 'bamboo', 'banjo', 'barn', 'basil', 'beach', 'bean',
  'bell', 'bench', 'berry', 'birch', 'bison', 'blade', 'blaze', 'bloom',
  'boat', 'bolt', 'bone', 'boot', 'bowl', 'brass', 'bread', 'brick',
  'bridge', 'brook', 'broom', 'brush', 'bucket', 'cabin', 'cable', 'cactus',
  'camel', 'candle', 'canoe', 'canyon', 'cape', 'cargo', 'carrot', 'castle',
  'cedar', 'chain', 'chalk', 'cheese', 'cherry', 'chest', 'chime', 'cider',
  'cliff', 'clock', 'cloud', 'clover', 'coal', 'cobalt', 'comet', 'copper',
  'coral', 'cotton', 'crane', 'creek', 'crow', 'crown', 'daisy', 'dance',
  'delta', 'denim', 'desert', 'dew', 'diamond', 'dingo', 'dock', 'dolphin',
  'dome', 'door', 'dove', 'dragon', 'drum', 'dune', 'eagle', 'earth',
  'echo', 'elbow', 'elder', 'elm', 'ember', 'engine', 'fable', 'falcon',
  'farm', 'feather', 'fern', 'ferry', 'field', 'finch', 'flame', 'flint',
  'flute', 'forest', 'fossil', 'fox', 'frost', 'garden', 'garlic', 'gate',
  'gem', 'ginger', 'glacier', 'glove', 'goat', 'gold', 'grain', 'grape',
  'grove', 'gull', 'hammer', 'harbor', 'harp', 'hawk', 'hazel', 'heron',
  'hill', 'honey', 'hornet', 'horse', 'hut', 'iris', 'iron', 'island',
  'ivory', 'ivy', 'jacket', 'jade', 'jasmine', 'jelly', 'jungle', 'kayak',
  'kettle', 'kite', 'knot', 'lagoon', 'lake', 'lamp', 'lantern', 'lark',
  'leaf', 'lemon', 'lilac', 'lily', 'linen', 'lion', 'lotus', 'lumber',
  'magnet', 'mango', 'maple', 'marble', 'meadow', 'melon', 'mint', 'mirror',
  'moon', 'moss', 'moth', 'mule', 'nectar', 'nest', 'nickel', 'noodle',
  'oak', 'oasis', 'ocean', 'olive', 'onion', 'opal', 'orchid', 'otter',
  'owl', 'oyster', 'paddle', 'palm', 'panda', 'pearl', 'pebble', 'pepper',
  'piano', 'pine', 'plum', 'pond', 'poppy', 'prairie', 'pumpkin', 'quartz',
  'quill', 'rabbit', 'raven', 'reed', 'ribbon', 'river', 'robin', 'rocket',
  'rose', 'saddle', 'saffron', 'sage', 'sail', 'salmon', 'sand', 'shell',
  'silk', 'silver', 'slate', 'snow', 'sparrow', 'spruce', 'stone', 'storm',
  'sugar', 'swan', 'tiger', 'timber', 'tulip', 'valley', 'violin', 'walnut',
  'willow', 'wolf', 'wren', 'yarn', 'yew', 'zebra', 'zinc', 'yak',
];

const WORD_INDEX: ReadonlyMap<string, number> = new Map(RECOVERY_WORDS.map((w, i) => [w, i]));

export function recoveryWords(entropy: Uint8Array): string[] {
  if (entropy.length !== 32) throw new Error('recovery entropy must be 32 bytes');
  return Array.from(entropy, (b) => RECOVERY_WORDS[b]);
}

export function wordsToEntropy(words: readonly string[]): Uint8Array {
  if (words.length !== 32) throw new Error('recovery phrase must be 32 words');
  const out = new Uint8Array(32);
  words.forEach((w, i) => {
    const idx = WORD_INDEX.get(w);
    if (idx === undefined) throw new Error(`unknown recovery word: ${w}`);
    out[i] = idx;
  });
  return out;
}

export async function wrapPersonKey(personKey: Uint8Array, wrappingKey: Uint8Array): Promise<Uint8Array> {
  return aesGcmSeal(wrappingKey, personKey);
}

export async function unwrapPersonKey(wrapped: Uint8Array, wrappingKey: Uint8Array): Promise<Uint8Array> {
  return aesGcmOpen(wrappingKey, wrapped);
}

// Returns a new keyring without the person's wrapped key; the input is not modified.
export function shred(keyring: Record<string, Uint8Array>, personId: string): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const [id, key] of Object.entries(keyring)) {
    if (id !== personId) out[id] = key;
  }
  return out;
}
